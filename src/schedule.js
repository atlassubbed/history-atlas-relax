const { Frame } = require("./Frame");
const { rediff } = require("./diff");
const { isFn } = require("./util");

// XXX This is a first implementation
//   setTau is O(|Subtree|), can optimize later
//     * this isn't being called a lot anyway
//   schedule blow-up problem for extreme (unlikely) edge case
//     * if setTau(T(t)) is called in rapid succession such that T(t) !== T(t+1) then:
//       this will "blow up" the list. 
//     * could use sets or keep hash tables on each node to mitigate
//       this is an implementation detail, the tests don't (and shouldn't) care about this
//   there might be a clever way to queue updates at times with less timing gymnastics
//     * tests should be agnostic of the scheduling implementation
const schedule = {}, sync = []

// XXX rAF, rIC, microtask, batching for even more repsonsiveness on interfaces?
//   e.g. for the tau = 0 case, use something other than setTimeout(0)
const queue = tau => void setTimeout(() => rediff(schedule[tau], tau), tau)

const add = (f, tau) => {
  const s = schedule[tau];
  if (!s) schedule[tau] = [f];
  else if (s.push(f) > 1) return;
  queue(tau);
}

const setTau = (f, next) => {
  const { nextState, children, tau } = f;
  if ((f.tau = next) === tau || next < 0 && tau < 0) return;
  if (children){
    let cN = children.length, c;
    while(cN--) setTau(c = children[cN], c.getTau(next));
  }
  if (nextState) next < 0 ? sync.push(f) : add(f, next);
}

// getTau can return an unchanging value to short-circuit cascading
Frame.prototype.getTau = function(next){ return next }
// setTau cascades down the subtree and reschedules diffs
Frame.prototype.setTau = function(next){
  const { nextState, tau } = this;
  setTau(this, next);
  if (sync.length) rediff(sync);
}
// expect setState to be called a lot (unlike setTau/entangle/detangle)
//   * creating and merging partial state objects is expensive
//   * supporting (cached) update fn will vastly improve perf
//     note that recreating the update fn per call will hurt perf
Frame.prototype.setState = function(partial){
  let next = this.nextState;
  if (next) {
    if (isFn(partial)) partial(next);
    else for (let k in partial) next[k] = partial[k];
    return;
  }
  if (!isFn(partial)) this.nextState = partial;
  else {
    let cur = this.state;
    next = this.nextState = {};
    if (cur) for (let k in cur) next[k] = cur[k];
    partial(next);
  }
  const tau = this.tau;
  tau < 0 ? rediff(this) : add(this, tau);
}
