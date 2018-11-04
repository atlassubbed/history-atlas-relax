const { Frame } = require("./Frame");
const { rediff } = require("./diff");
const { isFn, merge } = require("./util");

// XXX This is a first implementation
//   setTau is O(|Subtree|), can optimize later
//     * this isn't being called a lot anyway
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
// setTau cascades down the subtree and reschedules diffs
// this is no longer recursive, since we want stack safety
Frame.prototype.setTau = function(t){
  let f = this, c, on = rediff.on;
  if (dt(f.tau, f.tau = t) && stack.push(f)){
    while(f = stack.pop()){
      if (t = f.tau, c = f.next) do {
        dt(c.tau, c.tau = c.getTau(t)) && stack.push(c);
      } while (c = c.sib);
      if (!f.inPath && f.nextState) 
        t < 0 && !on ? sync.push(f) : add(f, t);
    }
    sync.length && rediff(sync);
  }
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
