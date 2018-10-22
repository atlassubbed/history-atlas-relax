const { isArr, norm, clean } = require("./util")
const { Frame: { isFrame }, applyState, emit, toFrame, clearFrame } = require("./Frame");
const { path, fill, refill, unmark } = require("./step-leader");
const KeyIndex = require("./KeyIndex")

const lags = [], htap = [], stack = [];
const link = (f, p, s, i=p.next.length) => p.next[i] = emit("willLink", f, p, s, i);
const unlink = (p, s, i) => emit("willUnlink", p, s, i);
const receive = (t, f) => {emit("willReceive", f, t), f.temp = t}
const rem = (f, p, ch, c) => {
  stack.push(emit("willRemove", f, p));
  while(f = stack.pop()){
    ch = f.next, c = ch && ch.length;
    while(c) stack.push(emit("willRemove", ch[--c], f))
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
      let i = 0;
      while(p = prev[i++]) // handle removes and receives
        (n=ix.pop(p.temp)) ? n === (n.p=p).temp ?
          unmark(p) : receive(n, p) : rem(p, f);
      for (i = -1; n=next.pop(++i);) // handle adds and moves
        ix = i && prev[i-1], (p=n.p) ? link(p, f, ix, i, n.p=null) :
          (p = add(n, effs, tau, f, ix, i));
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
  while(f = lags.pop()) if (stack.push(f), (t = clean(f)).length){
    tau = f.tau, effs = f.effs, p = !(f.next = []), n;
    while(n = t.pop()) p = add(n, effs, tau, f, p)
  }
  while(f = stack.pop()) emit("didAdd", f);
  while(f = htap.pop()) emit("didUpdate", f)._affN =+ (f._affs = null, f.isOrig = f.inPath = false);
}
const rediff = (f, tau=-1) => sidediff(fill(f, tau))
// public diff (mount, unmount and update frames)
const diff = (t, f, effs, tau=-1) => {
  if (isArr(t = norm(t))) return false;
  if (!isFrame(f) || !f.temp) return !!t && (sidediff(f = add(t, effs, tau)), f);
  if (!f.isRoot || t === f.temp) return false;
  if (t && t.name === f.temp.name) return fill(f), sidediff(receive(t, f)), f;
  refill(f), effs = effs || f.effs, rem(f)
  return sidediff(f = !t || add(t, effs, tau)), f;
}

module.exports = { diff, rediff }
