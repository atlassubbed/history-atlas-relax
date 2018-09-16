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
let asap = typeof Promise === "function" ? Promise.resolve() : false;
asap = asap ? asap.then.bind(asap) : setTimeout;
const schedule = {}, sync = [];

// XXX rIC/rAF should be implemented at the effect level
const queue = tau => {
  if (!tau) return asap(() => rediff(schedule[tau], tau));
  setTimeout(() => rediff(schedule[tau], tau), tau)
}

const add = (f, tau) => {
  const s = schedule[tau];
  if (!s) schedule[tau] = [f];
  else if (s.push(f) > 1) return;
  queue(tau);
}

const setTau = (f, nTau) => {
  const { nextState, next, tau } = f;
  if ((f.tau = nTau) === tau || nTau < 0 && tau < 0) return;
  if (next){
    let cN = next.length, c;
    while(cN--) setTau(c = next[cN], c.getTau(nTau));
  }
  if (nextState) nTau < 0 ? sync.push(f) : add(f, nTau);
}

// getTau can return an unchanging value to short-circuit cascading
Frame.prototype.getTau = function(next){ return next }
// setTau cascades down the subtree and reschedules diffs
Frame.prototype.setTau = function(next){
  setTau(this, next);
  if (sync.length) rediff(sync);
}
// expect setState to be called a lot (unlike setTau/entangle/detangle)
//   * creating and merging partial state objects is expensive
//   * supporting (cached) update fn will vastly improve perf
//     note that recreating the update fn per call will hurt perf
Frame.prototype.setState = function(partial={}){
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
