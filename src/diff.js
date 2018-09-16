const { isVoid, isArr, norm, applyState } = require("./util")
const { Frame: { isFrame } } = require("./Frame");
const { fillPath, path } = require("./step-leader");
const { emit, push, sub, pop, update } = require("./lifecycle");

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
//   * refactoring initdiff out of subdiff is not worth the increased complexity
//     * it doesn't remove any responsibility from subdiff
//     * the performance gain is negligble, as we short circuit fast anyway
const subdiff = f => {
  let temp = f.temp, prev = f.children, tau = f.tau;
  const effs = f.effs, keys = f.keys, index = keys && {};
  applyState(f), f.keys = null;
  const N = clean([f.evaluate(temp.data, temp.next)], temp = [], index, keys),
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
    while(n = temp.pop())
      void defer(push(n, effs, tau, f));
    return;
  }
  let i = -1, M = Math.min(N, P);
  while (++i < M){
    n = temp.pop(), p = prev[i];
    if (n.name === p.name) update(n, p)
    else void defer(sub(n, effs, tau, p, i))
  }
  if (N > P) while(n = temp.pop())
    void defer(push(n, effs, tau, f));
  else while(prev.length > N) pop(prev.pop());
}

let laggards = [];

// diff "sideways" along the calculated path
const sidediff = f => {
  while(f = path.pop())
    if (f.temp) return diff(f, true);
  while(f = laggards.pop()) diff(f);
}

const diff = (f, recur) => {
  emit("willDiff", f);
  subdiff(f);
  recur && sidediff();
  emit("didDiff", f);
}

const defer = f => (path.length ? laggards.push(f) : diff(f), f);

const rediff = (f, tau=-1) => (fillPath(f, tau), sidediff());

// public diff (mount, unmount and update frames)
const rootdiff = (t, f, effs, tau=-1) => {
  if (isArr(t = norm(t))) return false;
  if (!isFrame(f)) return !!t && defer(push(t, effs, tau));
  if (f.parent) return false;
  fillPath(f);
  if (!t) return !sidediff(pop(f));
  if (t.name === f.name) update(t, f);
  else f = defer(sub(t, effs || f.effs, tau, f));
  return sidediff(), f;
}

module.exports = { diff: rootdiff, rediff }
