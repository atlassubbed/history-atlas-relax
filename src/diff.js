const { isArr, norm, clean, isObj } = require("./util")
const { Frame: { isFrame }, applyState, emit, toFrame, clearFrame } = require("./Frame");
const { path, fill, unfill } = require("./step-leader");
const { hops } = require("./entangle");
const KeyIndex = require("./KeyIndex")

const lags = [], htap = [], ladd = lags.push.bind(lags);
const defer = (t, effs, tau, f, s, i) => ((path.length ? ladd : mount)(f = add(t, effs, tau, f, s, i)), f)
const link = (f, p, s, i=p.next.length) => (emit("willLink", f, p, s, i), p.next[i] = f);
const unlink = (p, s, i) => emit("willUnlink", p, s, i);
const rem = (f, p) => {
  emit("willRemove", f, p);
  let ch = f.next, c = ch && ch.length;
  while(c) rem(ch[--c], f);
  clearFrame(f);
}
const add = (t, effs, tau, p, s, i) => (
  emit("willAdd", t = toFrame(t, effs, tau), p),
  p ? link(t, p, s, i) : (t.isRoot = true, t)
)
const receive = (t, f) => {
  emit("willReceive", f, t);
  if (!(f.affN||f.affs||f.isOrig)) path.push(f);
  return f.temp = t, f;
}
const mount = (f, t) => {
  htap.push(f), t = f.temp;
  if ((t = clean(f)).length){
    f.next = [];
    let tau = f.tau, effs = f.effs, n, p;
    while(n=t.pop()) mount(p = add(n, effs, tau, f, p));
  }
}

// diff "downwards" from a frame, short circuit if next or prev have zero elements
const subdiff = (f, t) => {
  emit("willUpdate", f), htap.push(f), applyState(f);
  let prev, ix, P = (prev = f.next) ? prev.length : 0,
      next, N = (next = clean(f, P && (ix = new KeyIndex))).length;
  if (!N && P){
    while(P) rem(prev[--P], f);
    f.next = null, unlink(f);
  } else if (N) {
    let n, p, effs = f.effs, tau = f.tau;
    if (!P){
      f.next = [];
      while(n = next.pop()) p = defer(n, effs, tau, f, p);
    } else {
      let i = -1, mv = new Map;
      while(p = prev[++i]) // handle removes and receives
        (n=ix.pop(p.temp)) ?
          mv.set(n,p) && n === p.temp ?
            unfill(p) : receive(n, p) : rem(p, f);
      for (i = -1; n=next.pop(++i);) // handle adds and moves
        ix = i && prev[i-1], (p=mv.get(n)) ?
          link(p, f, ix, i) : (p=defer(n, effs, tau, f, ix, i));
      (P=prev.length) >= N && unlink(f, p, N), P > N && (prev.length = N); // ditch garbage
    }
  }
}
// diff "sideways" along the calculated path
//   * initially used call stack; led to overflows for lateral updates
//   * htap is "path" in reverse, we don't need it to avoid .reverse(), but we avoid .length = 0
const sidediff = f => {
  while(f = path.pop()) if (f.temp && f.inPath) subdiff(f);
  while(f = lags.pop()) mount(f);
  while(f = htap.pop())
    f.inPath ? emit("didUpdate", f, f._affN =+ (f.isOrig = f.inPath = false)) : emit("didAdd", f);
  while(f = hops.pop()) {
    for (let [c, t] of f._affs)
      t ? c.entangle(f) : c.detangle(f);
    f._affs = null;
  }
}
const rediff = (f, tau=-1) => {fill(f, tau), sidediff()};
// public diff (mount, unmount and update frames)
const diff = (t, f, effs, tau=-1) => {
  if (isArr(t = norm(t))) return false;
  if (!isFrame(f) || !f.temp)
    return !!t && (sidediff(f = defer(t, effs, tau)), f);
  if (!f.isRoot || t === f.temp) return false;
  if (fill(f) || !t) return !sidediff(rem(f));
  if (t.name === f.temp.name) return sidediff(receive(t, f)), f;
  effs = effs || f.effs, sidediff(rem(f));
  return sidediff(f = defer(t, effs, tau)), f;
}

module.exports = { diff, rediff }
