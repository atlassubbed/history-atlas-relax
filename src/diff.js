const { isVoid, isArr, norm, applyState } = require("./util")
const { Frame: { isFrame } } = require("./Frame");
const { fillPath, path } = require("./step-leader");
const { emit, push, sub, pop, receive, add } = require("./lifecycle");
const { evaluate } = require("./evaluate")

// diff "downwards" from a frame
//   * short circuit > switch under one loop
const subdiff = f => {
  applyState(f)
  const prev = f.next, next = evaluate(f),
    P = prev ? prev.length : 0, N = next.length;
  if (!(N || P)) return;
  let n, p;
  if (!N){
    f.next = null;
    while (p = prev.pop()) pop(p, f);
    return;
  }
  const effs = f.effs, tau = f.tau;
  if (!P){
    f.next = [];
    while(n = next.pop())
      void defer(push(n, effs, tau, f));
    return;
  }
  let i = -1, M = Math.min(N, P);
  while (++i < M){
    n = next.pop(), p = prev[i];
    if (n.name === p.temp.name) receive(n, p)
    else void defer(sub(n, effs, tau, p, f, i))
  }
  if (N > P) while(n = next.pop())
    void defer(push(n, effs, tau, f));
  else while(prev.length > N) pop(prev.pop(), f);
}

// diff "sideways" along the calculated path
//   * initially used call stack; led to overflows for lateral updates
//   * htap is "path" in reverse, we don't need it to avoid .reverse(), but we avoid .length = 0
const laggards = [], htap = [];
const sidediff = f => {
  while(f = path.pop()) if (f.temp)
    emit("willUpdate", f), subdiff(f), htap.push(f);
  while(f = laggards.pop()) add(f);
  while(f = htap.pop()) emit("didUpdate", f)
}
const defer = f => (path.length ? laggards.push(f) : add(f), f);
const rediff = (f, tau=-1) => (fillPath(f, tau), sidediff());
// public diff (mount, unmount and update frames)
const rootdiff = (t, f, effs, tau=-1) => {
  if (isArr(t = norm(t))) return false;
  if (!isFrame(f) || !f.temp) 
    return !!t && defer(push(t, effs, tau));
  if (!f.isRoot) return false;
  fillPath(f);
  if (!t) return !sidediff(pop(f));
  if (t.name === f.temp.name) receive(t, f);
  else f = defer(sub(t, effs || f.effs, tau, f));
  return sidediff(), f;
}

module.exports = { diff: rootdiff, rediff }
