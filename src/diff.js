const { isArr, norm, clean } = require("./util")
const { Frame: { isFrame }, applyState, emit, toFrame, clearFrame } = require("./Frame");
const { path, fill, touch, unfill } = require("./step-leader");
const KeyIndex = require("./KeyIndex")

const lags = [], htap = [], rems = [];
const link = (f, p, s, i=p.next.length) => p.next[i] = emit("willLink", f, p, s, i);
const unlink = (p, s, i) => emit("willUnlink", p, s, i);
const receive = (t, f) => {emit("willReceive", f, t), f.temp = t}
const rem = (f, p, ch, c) => {
  rems.push(emit("willRemove", f, p));
  while(f = rems.pop()){
    ch = f.next, c = ch && ch.length;
    while(c) rems.push(emit("willRemove", ch[--c], f))
    clearFrame(f);
  }
}
const add = (t, effs, tau, p, s, i) => (
  lags.push(emit("willAdd", t = toFrame(t, effs, tau), p)),
  p ? link(t, p, s, i) : (t.isRoot = true, t)
)

// diff "downwards" from a frame, short circuit if next or prev have zero elements
const subdiff = (f, t) => {
  htap.push(emit("willUpdate", f)), applyState(f);
  let prev, P = (prev = f.next) ? prev.length : 0, ix,
      next = clean(f, P && (ix = new KeyIndex)), N = next.length
  if (!N && P){
    while(P) rem(prev[--P], f);
    f.next = null, unlink(f);
  } else if (N) {
    let n, p, effs = f.effs, tau = f.tau;
    if (!P){
      f.next = [];
      while(n = next.pop()) p = add(n, effs, tau, f, p);
    } else {
      let i = 0, mv = new Map;
      while(p = prev[i++]) // handle removes and receives
        (n=ix.pop(p.temp)) ? mv.set(n,p) && n === p.temp ?
          unfill(p) : receive(n, p) : rem(p, f);
      for (i = -1; n=next.pop(++i);) // handle adds and moves
        ix = i && prev[i-1], (p=mv.get(n)) ?
          link(p, f, ix, i) : (p = add(n, effs, tau, f, ix, i));
      (P=prev.length) >= N && unlink(f, p, N), P > N && (prev.length = N); // ditch garbage
    }
  }
}

// diff "sideways" along the calculated path
//   * initially used call stack; led to overflows for lateral updates
//   * htap is "path" in reverse, we don't need it to avoid .reverse(), but we avoid .length = 0
const sidediff = f => {
  while(f = path.pop()) if (f.temp && f.inPath) subdiff(f);
  let tau, effs, p, n, t;
  while(f = lags.pop()) if (htap.push(f), (t = clean(f)).length){
    tau = f.tau, effs = f.effs, p = !(f.next = []), n;
    while(n = t.pop()) p = add(n, effs, tau, f, p)
  }
  while(f = htap.pop()) f.inPath ?
    (emit("didUpdate", f)._affN =+ (f._affs = null, f.isOrig = f.inPath = false)) :
    emit("didAdd", f);
}
const rediff = (f, tau=-1) => sidediff(fill(f, tau))
// public diff (mount, unmount and update frames)
const diff = (t, f, effs, tau=-1) => {
  if (isArr(t = norm(t))) return false;
  if (!isFrame(f) || !f.temp)
    return !!t && (sidediff(f = add(t, effs, tau)), f);
  if (!f.isRoot || t === f.temp) return false;
  if (!t) return touch(f, tau), !sidediff(rem(f));
  if (t.name === f.temp.name) return fill(f, tau), sidediff(receive(t, f)), f;
  return effs = effs || f.effs, touch(f, tau), rem(f), sidediff(f = add(t, effs, tau)), f;
}

module.exports = { diff, rediff }
