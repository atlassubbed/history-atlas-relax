const { toFrame, emit, clearFrame } = require("./Frame");

// directives
// XXX swap(i, j) is a sufficient generator for any permutation
//   any permutation can be written as a product of disjoint cycles
//   any cycle can be written as a product of k - 1 transpositions
//   any permutation can be written as a product of N - K transpositions
const swap = (f, i, j, c) => {
  emit("willSwap", f, i, j), c = (f = f.next)[i];
  f[i] = f[j], f[j] = c;
}
const push = (t, effs, tau, p, i) => {
  t = toFrame(t, effs, tau)
  emit("willPush", t, p, i);
  p ? p.next.push(t) : (t.isRoot = true);
  return t;
}
const pop = (f, p) => {
  let ch = f.next, c;
  emit("willPop", f, p)
  if (f.next = null, ch) while(c = ch.pop()) pop(c, f);
  clearFrame(f);
}
// cannot infer what constitutes change for effect
// shallow comparisons done at effect level
const receive = (t, f) => {
  emit("willReceive", f, t);
  return f.temp = t, f;
}

module.exports = { push, receive, swap, pop }
