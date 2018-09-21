const { isVoid, isArr, norm, applyState, clean } = require("./util")
const { Frame: { isFrame } } = require("./Frame");
const { fill, path, pluck } = require("./step-leader");
const { emit, push, sub, pop, receive, add } = require("./lifecycle");
const { jumps } = require("./entangle");

const calc = (f, t) => clean([f.diff((t = f.temp).data, t.next)]);

// diff "downwards" from a frame
//   * short circuit > switch under one loop
const subdiff = f => {
  emit("willUpdate", f);
  applyState(f)
  const prev = f.next, next = calc(f),
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
    while(n = next.pop()) defer(push(n, effs, tau, f));
    return;
  }
  let i = -1, M = Math.min(N, P);
  while (++i < M){
    n = next.pop(), p = prev[i];
    if (n === p.temp) pluck(p);
    else if (n.name !== p.temp.name) defer(sub(n, effs, tau, p, f, i));
    else if (receive(n,p) && !(p.affCount||p.affs)) subdiff(p), end(p);
  }
  if (N > P) while(n = next.pop()) defer(push(n, effs, tau, f));
  else while(prev.length > N) pop(prev.pop(), f);
}

// diff "sideways" along the calculated path
//   * initially used call stack; led to overflows for lateral updates
//   * htap is "path" in reverse, we don't need it to avoid .reverse(), but we avoid .length = 0
const laggards = [], htap = [];
const sidediff = f => {
  while(f = path.pop()) if (f.temp && f.inPath) htap.push(f), subdiff(f);
  while(f = laggards.pop()) add(f);
  while(f = htap.pop()) end(f);
  while(f = jumps.pop()) {
    for (let [c, t] of f._affs) c[t](f);
    f._affs = null;
  }
}
const end = f => emit("didUpdate", f, f._affCount =+ (f.isOrig = f.inPath = false))
const defer = f => (path.length ? laggards.push(f) : add(f), f);
const rediff = (f, tau=-1) => (fill(f, tau), sidediff());
// public diff (mount, unmount and update frames)
const diff = (t, f, effs, tau=-1) => {
  if (isArr(t = norm(t))) return false;
  if (!isFrame(f) || !f.temp) 
    return !!t && defer(push(t, effs, tau));
  if (!f.isRoot || t === f.temp) return false;
  fill(f);
  if (!t) return !sidediff(pop(f));
  if (t.name === f.temp.name) receive(t, f);
  else f = defer(sub(t, effs || f.effs, tau, f));
  return sidediff(), f;
}

module.exports = { diff, rediff }
