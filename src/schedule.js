const { Frame } = require("./Frame");
const { rediff } = require("./diff");
const { isFn, merge } = require("./util");

// XXX This is a first implementation
//   schedule blow-up problem for extreme (unlikely) edge case
//     * if setTau(T(t)) is called in rapid succession such that T(t) !== T(t+1)
//       then this will "blow up" the list.
//     * could use sets or keep hash tables on each node to mitigate
//       but it's an implementation detail; tests don't (and shouldn't) care about this
//   there might be a clever way to queue updates at times with less timing gymnastics
//     * tests should be agnostic of the scheduling implementation
// XXX rIC/rAF should be implemented at the effect level

let asap = typeof Promise === "function" ? Promise.resolve() : false;
asap = asap ? asap.then.bind(asap) : setTimeout;
const schedule = {}, sync = [], stack = [];
const reject = e => setTimeout(() => {throw e}); // i don't like this
const queue = tau => {
  const j = () => rediff(schedule[tau], tau);
  tau ? setTimeout(j, tau) : asap(j).catch(reject)
}
const add = (f, tau) => (schedule[tau=Math.max(tau, 0)] = schedule[tau] || []).push(f) > 1 || queue(tau);
const dt = (t1, t2) => !(t1 === t2 || t1 < 0 && t2 < 0);

// getTau can return an unchanging value to short-circuit cascading
Frame.prototype.getTau = function(next){ return next }
// setTau changes the relaxation time of a node and potentially reschedules diffs
Frame.prototype.setTau = function(t){
  let f = this, c, on = rediff.on;
  if (dt(f.tau, f.tau = t) && !f.inPath && f.nextState)
    t < 0 && !on ? rediff(f) : add(f, t);
}
// expect setState to be called a lot (unlike setTau/entangle/detangle)
//   * creating and merging partial state objects is expensive
//   * supporting (cached) update fn will vastly improve perf (setState called often)
//     note that recreating the update fn per call will hurt perf
//     users are expected to cache their update fns...
Frame.prototype.setState = function(part, next){
  const p = this.inPath, t = this.tau, store = p ? "state" : "nextState";
  if (next = this.nextState || this[store])
    return isFn(part) ? part(next) : merge(next, part);
  isFn(part) ? part(merge(this[store] = {}, this.state)) : (this[store] = part || {});
  p || (t < 0 && !rediff.on ? rediff(this) : add(this, t))
}
