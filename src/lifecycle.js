const { isArr } = require("./util")
const { toFrame, clearFrame } = require("./Frame");

// emit lifecycle event to effects
const emit = (type, f, a1, a2) => {
  const effs = f.effs;
  if (!effs) return;
  if (!isArr(effs))
    return effs[type] && void effs[type](f, a1, a2);
  for (let e of effs)
    if (e[type]) void e[type](f, a1, a2);
}

// remove existing (sub)frame
const pop = (f, c) => {
  const p = f.parent, ch = f.children;
  emit("willPop", f, p)
  f.parent = f.children = null;
  if (ch) while(c = ch.pop()) pop(c);
  emit("didPop", f, p), clearFrame(f);
}
// push (sub)frame onto frame
const push = (t, effs, tau, f) => {
  t = toFrame(t, effs, tau)
  emit("willPush", t, f);
  if (f){
    let i = f.children.push(t), key;
    if (key = t.key)
      (f.keys = f.keys || {})[key] = i - 1;
    t.parent = f;
  }
  return t;
}
// sub prev frame with next frame at index i
const sub = (t, effs, tau, f, i, c) => {
  t = toFrame(t, effs, tau)
  const p = f.parent, ch = f.children;
  emit("willSub", t, p, i);
  f.parent = f.children = null;
  if (ch) while(c = ch.pop()) pop(c);
  if (t.parent = p) p.children[i] = t;
  emit("didSub", f, p, i), clearFrame(f);
  return t;
}
// * we cannot infer what constitutes a change for an effect
// * memoizing templates should preclude shouldUpdate
//   but requires stable, keyed subdiffing
const update = (t, f) => {
  emit("willUpdate", f, t);
  f.key = t.key, f.temp = t;
  return f;
}

module.exports = { emit, push, sub, pop, update }
