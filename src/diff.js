const { isArr, norm } = require("./util")
const { Frame: { isFrame }, applyState, emit, toFrame, clearFrame } = require("./Frame");
const { path, fill, refill, unmark } = require("./step-leader");
const KeyIndex = require("./KeyIndex")

const lags = [], htap = [], stack = [], flat = [];
const link = (f, p, s, i=p.next.length) => p.next[i] = emit("willLink", f, p, s, i);
const unlink = (p, s, i) => emit("willUnlink", p, s, i);
const receive = (t, f) => {emit("willReceive", f, t).temp = t}
const receiveRoot = (t, f, p, s, prevS, hasParent=isFrame(p)) => {
  t === f.temp || (emit("willReceive", f, t).temp = t);
  if (hasParent && s){
    emit("willUnlink", p, prevS, null, true);
    emit("willLink", f, p, s);
  }
}
const rem = (f, p, ch, c) => {
  stack.push(emit("willRemove", f, p));
  while(f = stack.pop()){
    ch = f.next, c = ch && ch.length;
    while(c) stack.push(emit("willRemove", ch[--c], f))
    clearFrame(f);
  }
}
const remRoot = (f, p, s, hasParent=isFrame(p)) => {
  hasParent && emit("willUnlink", p, s, null, true);
  rem(f, hasParent && p)
}
const add = (t, p, s, i) => (lags.push(emit("willAdd", t = toFrame(t, p.effs, p.tau), p)), link(t, p, s, i))
const addRoot = (t, p, s, hasParent=isFrame(p)) => {
  let effs = p && p.effs, tau = p && p.tau != null ? p.tau : -1;
  lags.push(emit("willAdd", t = toFrame(t, effs, tau), hasParent && p));
  hasParent && emit("willLink", t, p, s);
  return t.isRoot = true, t;
}

// render a frame's next children
//   * flattens and returns the output of frame's diff function
//   * note that arr.push(...huge) is not stack-safe.
//   * ix is an option KeyIndex
const render = (f, ix) => {
  let next = [], t = f.temp
  flat.push(f.diff(t.data, t.next))
  while(flat.length) if (t = norm(flat.pop()))
    if (isArr(t)) for (let i of t) flat.push(i);
    else next.push(t), ix && ix.push(t);
  return f.inPath = false, next;
}
// diff "downwards" from a frame, short circuit if next or prev have zero elements
const subdiff = (f, t) => {
  applyState(f); htap.push(emit("willUpdate", f));
  let prev, P = (prev = f.next) ? prev.length : 0, ix,
      next = render(f, P && (ix = new KeyIndex)), N = next.length;
  if (!N && P){
    while(P) rem(prev[--P], f);
    f.next = null, unlink(f);
  } else if (N) {
    let n, p;
    if (!P){
      f.next = [];
      while(n = next.pop()) p = add(n, f, p);
    } else {
      let i = 0;
      while(p = prev[i++]) // handle removes and receives
        (n=ix.pop(p.temp)) ? n === (n.p=p).temp ?
          unmark(p) : receive(n, p) : rem(p, f);
      for (i = -1; n=next.pop(++i);) // handle adds and moves
        ix = i && prev[i-1], (p=n.p) ? link(p, f, ix, i, n.p=null) :
          (p = add(n, f, ix, i));
      (P=prev.length) >= N && unlink(f, p, N), P > N && (prev.length = N); // ditch garbage
    }
  }
}

// diff "sideways" along the calculated path
//   * initially used call stack; led to overflows for lateral updates
//   * htap is "path" in reverse, we don't need it to avoid .reverse(), but we avoid .length = 0
const sidediff = f => {
  while(f = path.pop()) if (f.temp && f.inPath) subdiff(f);
  let p, n, t;
  while(f = lags.pop()) if (stack.push(f), (t = render(f)).length){
    p = !(f.next = []);
    while(n = t.pop()) p = add(n, f, p)
  }
  while(f = stack.pop()) emit("didAdd", f);
  while(f = htap.pop()) emit("didUpdate", f)._affN =+ (f._affs = null, f.isOrig = false);
}
const rootdiff = (t, f, p, s, prevS) => {
  if (isArr(t = norm(t))) return false;
  if (!isFrame(f) || !f.temp) return !!t && (sidediff(f = addRoot(t, p, s)), f);
  if (!f.isRoot || t && (t.name !== f.temp.name)) return false;
  if (t === f.temp && !s) return false;
  if (t) return fill(f), sidediff(receiveRoot(t, f, p, s, prevS)), f;
  return refill(f), !sidediff(remRoot(f, p, s));
}
const rediff = (f, tau=-1) => (rediff.on = true, rediff.on = !!sidediff(fill(f, tau)))
rediff.on = false;
// public diff (mount, unmount and update frames)
const diff = (t, f, p, s, prevS) => (rediff.on = true, t = rootdiff(t, f, p, s, prevS), rediff.on = false, t)

module.exports = { diff, rediff }
