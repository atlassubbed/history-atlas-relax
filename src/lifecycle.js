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
// remove existing (sub)frame
const pop = (f, p) => {
  let ch = f.next, c;
  emit("willPop", f, p)
  if (f.next = null, ch) while(c = ch.pop()) pop(c, f);
  emit("didPop", f, p), clearFrame(f);
}
// push (sub)frame onto frame
const push = (t, effs, tau, p) => {
  t = toFrame(t, effs, tau)
  emit("willPush", t, p);
  if (p){
    let i = p.next.push(t), key;
    if (key = t.key)
      (p.keys = p.keys || {})[key] = i - 1;
  } else t.isRoot = true;
  return t;
}
// sub prev frame with next frame at index i
const sub = (t, effs, tau, f, p, i) => {
  t = toFrame(t, effs, tau)
  let ch = f.next, c;
  emit("willSub", t, p, i);
  if (f.next = null, ch) while(c = ch.pop()) pop(c, f);
  p ? (p.next[i] = t) : (t.isRoot = true)
  emit("didSub", f, p, i), clearFrame(f);
  return t;
}
// * we cannot infer what constitutes a change for an effect
// * memoizing templates should preclude shouldUpdate
//   but requires stable, keyed subdiffing
const receive = (t, f) => {
  emit("willReceive", f, t);
  return f.temp = t, f;
}

const add = (f, t, next) => {
  emit("willAdd", f), t = f.temp;
  if ((next = clean([f.diff(t.data, t.next)])).length){
    f.next = [];
    let tau = f.tau, effs = f.effs, n;
    while(n=next.pop()) add(push(n, effs, tau, f))
  }
  emit("didAdd", f);
}

module.exports = { emit, push, sub, pop, receive, add }
