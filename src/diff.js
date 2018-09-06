const { isVoid, isArr, isFn, isComp, norm } = require("./util")
const { Frame: { isFrame }, toFrame } = require("./Frame");
const { fillPath, path } = require("./step-leader");
let laggards = [];

// without loss of readability:
//   * t === template literal
//   * f === frame instance

// emit lifecycle event to relevant effects
const emit = (type, f, a1, a2) => {
  const effs = f.effects;
  if (!effs) return;
  if (!isArr(effs))
    return effs[type] && void effs[type](f, a1, a2);
  for (let e of effs)
    if (e[type]) void e[type](f, a1, a2);
}
// TODO remove any existing entanglement
//   XXX is setting affectors/affects to null sufficient?
//     it shouldn't be since we'll have a memory leak;
//     should clean it manually on all affected frames
const clear = f => {
  f.state = f.temp = f.effects = f.affects =
  f.keys = f.affectors = f.name = f.key = null;
}
// remove existing (sub)frame
const pop = (f, c) => {
  const { parent, children } = f;
  emit("willPop", f, parent)
  f.parent = f.children = null;
  if (children) while(c = children.pop()) pop(c);
  emit("didPop", f, parent), clear(f);
}
// push (sub)frame onto frame
const push = (t, effs, f) => {
  t = toFrame(t, effs);
  emit("willPush", t, f);
  if (f){
    let i = f.children.push(t), key;
    if (key = t.key)
      (f.keys = f.keys || {})[key] = i - 1;
    t.parent = f;
  }
  t.affectors && path.length ? laggards.push(t) : diff(t);
  return t;
}
// sub prev frame with next frame at index i
const sub = (t, effs, f, i, c) => {
  t = toFrame(t, effs);
  const { parent, children } = f;
  emit("willSub", t, parent, i);
  f.parent = f.children = null;
  if (children) while(c = children.pop()) pop(c);
  if (t.parent = parent) parent.children[i] = t;
  emit("didSub", f, parent, i), clear(f);
  t.affectors && path.length ? laggards.push(t) : diff(t);
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
const diff = (f, recur) => {
  emit("willDiff", f);
  subdiff(f);
  recur && sidediff();
  emit("didDiff", f);
}

// sanitize dirty templates returned from evaluate:
//   * short circuit if no prev keys
//   * gather key translations in index
const clean = (dirty, next, index, keys) => {
  let t;
  if (!keys){
    while(dirty.length){
      t = dirty.pop();
      if (isArr(t)) dirty.push(...t);
      else if (!isVoid(t)) next.push(norm(t));
    }
    return next.length;
  }
  let k, N;
  while(dirty.length){
    t = dirty.pop();
    if (isArr(t)) dirty.push(...t);
    else if (!isVoid(t)) {
      N = next.push(t = norm(t));
      if ((k = t.key) && keys[k]){
        index[k] = N - 1;
      }
    }
  }
  return N;
}
// diff "downwards" from a frame
//   * short circuit > switch under one loop
const subdiff = f => {
  let { temp: { data, next }, children: prev } = f;
  const { effects: effs, keys } = f, index = {};
  next = [f.evaluate(data, next)], f.keys = null
  const N = clean(next, next = [], index, keys), 
    P = prev ? prev.length : 0;
  if (!(N || P)) return;
  let n, p;
  if (!N){
    f.children = null;
    while (p = prev.pop()) pop(p);
    return;
  }
  if (!P){
    f.children = [];
    while(n = next.pop()) push(n, effs, f);
    return;
  }
  let i = -1, M = Math.min(N, P);
  while (++i < M){
    n = next.pop(), p = prev[i];
    if (n.name === p.name) update(n, p)
    else sub(n, effs, p, i);
  }
  if (N > P) while(n = next.pop()) push(n, effs, f);
  else while(prev.length > N) pop(prev.pop());
}

// diff "sideways" along the calculated path
const sidediff = f => {
  while(f = path.pop())
    if (f.temp) return diff(f, true);
  while(f = laggards.pop()) diff(f);
}
// public diff (mount, unmount and update frames)
module.exports = (t, f, effs) => {
  if (isArr(t = norm(t))) return false;
  if (!isFrame(f)) return !!t && push(t, effs);
  if (f.parent) return false;
  fillPath(f);
  if (!t) return !sidediff(pop(f));
  if (t.name === f.name) update(t, f);
  else f = sub(t, effs || f.effects, f);
  return sidediff(), f;
}
