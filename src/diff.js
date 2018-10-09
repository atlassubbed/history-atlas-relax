const { isArr, norm, clean, isObj } = require("./util")
const { Frame: { isFrame }, applyState, emit, toFrame, clearFrame } = require("./Frame");
const { path, fill, unfill } = require("./step-leader");
const { hops } = require("./entangle");
const KeyIndex = require("./KeyIndex")

const remove = (f, p, s, i) => {
  emit("willRemove", f, p, s, i);
  let ch = f.next, c = ch && ch.length;
  while(c) remove(ch[--c], f, c && ch[c-1]);
  clearFrame(f);
}
const add = (t, effs, tau, p, s, i) => {
  t = toFrame(t, effs, tau);
  emit("willAdd", t, p, s, i);
  p ? (i == null ? p.next.push(t) : (p.next[i] = t)) : (t.isRoot = true);
  return t;
}
const move = (f, p, s, i) => {
  emit("willMove", f, p, s, i);
  return p.next[i] = f;
}
const receive = (t, f) => {
  emit("willReceive", f, t);
  if (!(f.affN||f.affs||f.isOrig)) path.push(f);
  return f.temp = t, f;
}
const clip = (f, s, P, N) => emit("willClip", f, s, P, N);

const lags = [], htap = [], ladd = lags.push.bind(lags);

const mount = (f, t) => {
  htap.push(f), t = f.temp;
  if ((t = clean([f.diff(t.data, t.next)])).length){
    f.next = [];
    let tau = f.tau, effs = f.effs, n, p;
    while(n=t.pop()) mount(p = add(n, effs, tau, f, p));
  }
}

// diff "downwards" from a frame, short circuit if next or prev have zero elements
const subdiff = (f, t) => {
  emit("willUpdate", f), htap.push(f), t = f.temp, applyState(f);
  let prev, P = (prev = f.next) ? prev.length : 0,
      next, N = (next = clean([f.diff(t.data, t.next)])).length;
  if (P || N) if (!N){
    while(P) remove(prev[--P], f, P && prev[P-1]);
    f.next = null, clip(f);
  } else {
    let n, p, effs = f.effs, tau = f.tau;
    if (!P){
      f.next = [];
      while(n = next.pop()) p = defer(n, effs, tau, f, p);
    } else {
      let ix = new KeyIndex, i = P, mut = [], pos = new Map;
      while(i--) ix.push(p = prev[i]), pos.set(p, i); // build index
      while(n = next.pop(++i)){ // get required mutations
        if (p = ix.pop(n)){
          mut[i] = pos.get(p), pos.delete(p);
          n === p.temp ? unfill(p) : receive(n, p)
        } else mut[i] = n;
      }
      for (let k of pos.values()) remove(prev[k], f, k && prev[k-1], k) // remove orphans
      for (i = -1; ++i < N;) // apply mutations after recycling orphans
        p = mut[i], mut[i] = prev[i], n = i && prev[i-1],
        p = isObj(p) ? defer(p, effs, tau, f, n, i)
          : move(p < i ? mut[p] : prev[p], f, n, i);
      (P = prev.length) >= N && clip(f, p, P, N) // submit garbage
      P > N && (prev.length = N);
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
const defer = (t, effs, tau, f, s, i) => ((path.length ? ladd : mount)(f = add(t, effs, tau, f, s, i)), f)
const rediff = (f, tau=-1) => {fill(f, tau), sidediff()};
// public diff (mount, unmount and update frames)
const diff = (t, f, effs, tau=-1) => {
  if (isArr(t = norm(t))) return false;
  if (!isFrame(f) || !f.temp)
    return !!t && (sidediff(f = defer(t, effs, tau)), f);
  if (!f.isRoot || t === f.temp) return false;
  if (fill(f) || !t) return !sidediff(remove(f));
  if (t.name === f.temp.name) return sidediff(receive(t, f)), f;
  effs = effs || f.effs, sidediff(remove(f));
  return sidediff(f = defer(t, effs, tau)), f;
}

module.exports = { diff, rediff }
