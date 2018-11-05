const { isArr, norm, link, unlink } = require("./util")
const { Frame: { isFrame }, applyState, emit, toFrame, clearFrame, render } = require("./Frame");
const { path, fill, refill, unmark } = require("./step-leader");
const KeyIndex = require("./KeyIndex")

const lags = [], rems = [], htap = [], stack = [];
const add = (t, p, s) => t && lags.push(emit("willAdd", t = toFrame(t, p), p, s)) && link(t, p, s);
const addR = (t, p, s) => lags.push(emit("willAdd", t = toFrame(t, p, true), isFrame(p) && p, s)) && t;
const rem = (f, p, s=f.prev) => rems.push(emit("willRemove", f, p, s)) && unlink(f, p, s);
const remR = (f, p, s) => rems.push(emit("willRemove", f, isFrame(p) && p, s))
const move = (f, p, s, ps=f.prev) => (emit("willMove", f, p, ps, s), unlink(f, p, ps), link(f, p, s));
const moveR = (f, p, s, ps) => isFrame(p) && emit("willMove", f, p, ps, s);
const receive = (f, t) => emit("willReceive", f, t).temp = t

const mount = (f, p, next) => {
  while(f = lags.pop()) if (stack.push(f), (next = render(f)).length)
    while(p = add(next.pop(), f, p));
  while(f = stack.pop()) emit("didAdd", f);
}
const unmount = (f, c) => {
  while(c = rems.pop()) if (stack.push(c) && c.next)
    while(rem(c.next, c));
  while(c = stack.pop()) emit("didRemove", c), clearFrame(c);
  return f;
}

// diff "downwards" from a frame, short circuit if next or prev have zero elements
const subdiff = f => {
  applyState(f), htap.push(emit("willUpdate", f));
  let p = f.next, ix, next = render(f, p && (ix = new KeyIndex)), n = next.length;
  if (!n && p) while(unmount(rem(f.next, f)));
  else if (n) if (!p) while(p = add(next.pop(), f, p));
  else {
    while(p = (n = ix.pop(p.temp)) ? (n === (n.p = p).temp ? unmark(p) : receive(p, n), p.sib) : unmount(rem(p, f)));
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
const rootdiff = (t, f, p, s, ps, r) => {
  if (!isArr(t = norm(t))){
    if (!isFrame(f) || !f.temp) t && mount(r = addR(t, p, s));
    else if (f.isRoot && (!t || t.name === f.temp.name))
      sidediff(t ?
        (t === f.temp || receive(f, t, fill(r = f)), s === ps || moveR(r = f, p, s, ps)) :
        unmount(remR(f, p, s, r = !refill(f))));
  }
  return r || false;
}
const rediff = (f, tau=-1) => (rediff.on = true, rediff.on = !!sidediff(fill(f, tau)))
rediff.on = false;
// public diff (mount, unmount and update frames)
const diff = (t, f, p, s, ps) => (rediff.on = true, t = rootdiff(t, f, p, s, ps), rediff.on = false, t)

module.exports = { diff, rediff }
