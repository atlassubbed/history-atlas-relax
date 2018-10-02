const { isArr, clean } = require("./util")
const { toFrame, clearFrame } = require("./Frame");

// emit lifecycle event to effects
const emit = (type, f, a1, a2) => {
  const effs = f.effs;
  if (!effs) return;
  if (!isArr(effs))
    return effs[type] && void effs[type](f, a1, a2);
  for (let e of effs) if (e[type]) e[type](f, a1, a2);
}
// recursives
const pop = (f, p) => {
  let ch = f.next, c;
  emit("willPop", f, p)
  if (f.next = null, ch) while(c = ch.pop()) pop(c, f);
  emit("didPop", f, p), clearFrame(f);
}
const add = (f, t) => {
  emit("willAdd", f), t = f.temp;
  if ((t = clean([f.diff(t.data, t.next)])).length){
    f.next = [];
    let tau = f.tau, effs = f.effs, n;
    while(n=t.pop()) add(push(n, effs, tau, f))
  }
  emit("didAdd", f);
}
// directives
// XXX swap(i, j) is a sufficient generator for any permutation
//   any permutation can be written as a product of disjoint cycles
//   any cycle can be written as a product of k - 1 transpositions
//   any permutation can be written as a product of N - K transpositions
const swap = (f, i, j, c) => {
  emit("willSwap", f, i, j), c = (f = f.next)[i];
  f[i] = f[j], f[j] = c;
}
const push = (t, effs, tau, p) => {
  t = toFrame(t, effs, tau)
  emit("willPush", t, p);
  p ? p.next.push(t) : (t.isRoot = true);
  return t;
}
// cannot infer what constitutes change for effect
// shallow comparisons done at effect level
const receive = (t, f) => {
  emit("willReceive", f, t);
  return f.temp = t, f;
}

module.exports = { emit, push, pop, receive, add, swap }
