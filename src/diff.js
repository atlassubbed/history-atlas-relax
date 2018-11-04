const { isArr, norm, link, unlink } = require("./util")
const { Frame: { isFrame }, applyState, emit, toFrame, clearFrame, render } = require("./Frame");
const { path, fill, refill, unmark } = require("./step-leader");
const KeyIndex = require("./KeyIndex")

const lags = [], rems = [], htap = [], stack = [];
const add = (t, p, s) => t && lags.push(emit("willAdd", t = toFrame(t, p.effs, p.tau), p, s)) && link(t, p, s);
const remove = (f, p, s=f.prev) => rems.push(emit("willRemove", f, p, s)) && unlink(f, p, s);
const move = (f, p, s, s2=f.prev) => (emit("willMove", f, p, s2, s), unlink(f, p, s2), link(f, p, s));
const receive = (f, t) => (f.temp === t ? unmark(f) : (emit("willReceive", f, t).temp = t), f.sib)
const mount = (f, p, next) => {
  while(f = lags.pop()) if (stack.push(f), (next = render(f)).length)
    while(p = add(next.pop(), f, p));
  while(f = stack.pop()) emit("didAdd", f);
}
const unmount = (f, c) => {
  while(c = rems.pop()) if (stack.push(c) && c.next)
    while(remove(c.next, c));
  while(c = stack.pop()) emit("didRemove", c), clearFrame(c);
  return f;
}
const receiveRoot = (t, f, p, s, prevS) => {
  if (f.temp !== t) emit("willReceive", f, t).temp = t;
  if (isFrame(p) && s !== prevS) emit("willMove", f, p, prevS, s)
}
const remRoot = (f, p, s) => {
  unmount(rems.push(emit("willRemove", f, isFrame(p) && p, s)));
}
const addRoot = (t, p, s) => {
  let effs = p && p.effs, tau = p && p.tau != null ? p.tau : -1;
  lags.push(emit("willAdd", t = toFrame(t, effs, tau), isFrame(p) && p, s));
  return t.isRoot = true, t;
}

// diff "downwards" from a frame, short circuit if next or prev have zero elements
const subdiff = f => {
  applyState(f), htap.push(emit("willUpdate", f));
  let p = f.next, ix, next = render(f, p && (ix = new KeyIndex)), n = next.length;
  if (!n && p) while(unmount(remove(f.next, f)));
  else if (n) if (!p) while(p = add(next.pop(), f, p));
  else {
    while(p = (n = ix.pop(p.temp)) ? receive(n.p = p, n) : unmount(remove(p, f)));
    for(let c = f.next; c && (n = next.pop());) (p = n.p) ? (c === p ?
      (c = c.sib) : move(p, f, c.prev), n.p = null) : add(n, f, c.prev);
    while(p = add(next.pop(), f, p));
  }
}

// diff "sideways" along the calculated path
//   * initially used call stack; led to overflows for lateral updates
//   * htap is "path" in reverse, we don't need it to avoid .reverse(), but we avoid .length = 0
const sidediff = f => {
  while(f = path.pop()) if (f.temp && f.inPath) subdiff(f);
  mount();
  while(f = htap.pop()) emit("didUpdate", f)._affN =+ (f._affs = null, f.isOrig = false);
}
const rootdiff = (t, f, p, s, prevS, r=false) => {
  if (!isArr(t = norm(t))){
    if (!isFrame(f) || !f.temp) t && mount(r = addRoot(t, p, s));
    else if (f.isRoot && (!t || (t === f.temp ? s !== prevS : t.name === f.temp.name)))
      sidediff(t ? receiveRoot(t, f, p, s, prevS, fill(r = f)) : remRoot(f, p, s, r = !refill(f)));
  }
  return r;
}
const rediff = (f, tau=-1) => (rediff.on = true, rediff.on = !!sidediff(fill(f, tau)))
rediff.on = false;
// public diff (mount, unmount and update frames)
const diff = (t, f, p, s, prevS) => (rediff.on = true, t = rootdiff(t, f, p, s, prevS), rediff.on = false, t)

module.exports = { diff, rediff }
