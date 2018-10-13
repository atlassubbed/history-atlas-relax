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
const add = (f, tau) => (schedule[tau] = schedule[tau] || []).push(f) > 1 || queue(tau);
const dt = (t1, t2) => !(t1 === t2 || t1 < 0 && t2 < 0);

// getTau can return an unchanging value to short-circuit cascading
Frame.prototype.getTau = function(next){ return next }
// setTau cascades down the subtree and reschedules diffs
// this is no longer recursive, since we want stack safety
Frame.prototype.setTau = function(tau){
  let f = this, ch;
  if (dt(f.tau, f.tau = tau) && stack.push(f)){
    while(f = stack.pop()){
      if (tau = f.tau, ch = f.next) for (let c of ch)
        if (dt(c.tau, c.tau = c.getTau(tau))) stack.push(c);
      if (f.nextState) tau < 0 ? sync.push(f) : add(f, tau);
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
  if (next = this.nextState)
    return isFn(part) ? part(next) : merge(next, part);
  isFn(part) ? part(merge(this.nextState = {}, this.state))
    : (this.nextState = part);
  this.tau < 0 ? rediff(this) : add(this, this.tau);
}
