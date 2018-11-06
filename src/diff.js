const { isArr, norm, merge } = require("./util")
const { Frame: { isFrame }, node, del } = require("./Frame");
const { path, fill, refill, unmark } = require("./step-leader");
const KeyIndex = require("./KeyIndex")

// auxiliary stacks
//   * htap & lags are needed for the whole diff
//   * aux1 & aux2 are safe to use between subdiffs
const lags = [], htap = [], aux1 = [], aux2 = []

// detach node f from linked list p after sibling s
const unlink = (f, p, s, next) => {
  (next = f.sib) && (next.prev = s)
  s ? (s.sib = next) : (p.next = next);
}
// attach node f into linked list p after sibling s
const link = (f, p, s, next) => {
  (next = f.sib = (f.prev = s) ? s.sib : p.next) && (next.prev = f);
  s ? (s.sib = f) : (p.next = f)
}
// emit an event
const emit = (type, f, p, s, i, ef) => {
  if (ef = f.effs){
    if (!isArr(ef)) ef[type] && ef[type](f, p, s, i);
    else for (let e of ef) e[type] && e[type](f, p, s, i);
  }
  return f;
}
// render a frame's next children
//   * flattens and returns the output of frame's diff function
//   * ix is an optional KeyIndex
const render = (f, ix) => {
  let next = [], t = f.temp
  aux1.push(f.diff(t.data, t.next))
  while(aux1.length) if (t = norm(aux1.pop()))
    if (isArr(t)) for (let i of t) aux1.push(i);
    else next.push(t), ix && ix.push(t);
  return f.inPath = false, next;
}

// mutation methods for subdiffs and rootdiffs (R)
const add = (t, p, s) => (t && lags.push(emit("willAdd", t = node(t, p), p, s)) && link(t, p, s), t);
const addR = (t, p, s) => lags.push(emit("willAdd", t = node(t, p), isFrame(p) && p, s)) && t;
const rem = (f, p, s=f.prev) => aux1.push(emit("willRemove", f, p, s)) && unlink(f, p, s);
const remR = (f, p, s) => aux1.push(emit("willRemove", f, isFrame(p) && p, s))
const move = (f, p, s, ps=f.prev) => (emit("willMove", f, p, ps, s), unlink(f, p, ps), link(f, p, s));
const moveR = (f, p, s, ps) => isFrame(p) && emit("willMove", f, p, ps, s);
const receive = (f, t) => emit("willReceive", f, t).temp = t

// mounts several laggards, who are mounted _after_ sidediffing (very important)
const mount = (f, p, next) => {
  while(f = lags.pop()) if (aux2.push(f), (next = render(f)).length)
    while(p = add(next.pop(), f, p));
  while(f = aux2.pop()) emit("didAdd", f);
}
// queues up removals in reverse (avoiding a lastChild pointer per node)
const rev = (c, p) => {while(c.sib) c = c.sib; while(c) rem(c, p, c = c.prev)}
// unmount several queued nodes
const unmount = f => {while(f = aux1.pop()) del(f), f.next && rev(f.next, f)}

// diff "downwards" from a parent, p, short circuit if next or prev have zero elements
const subdiff = p => {
  if (p.nextState) p.nextState = !(p.state = merge(p.state || {}, p.nextState))
  htap.push(emit("willUpdate", p));
  let c = p.next, i, next = render(p, c && (i = new KeyIndex)), n = next.length;
  if (!n && c) unmount(rev(c, p));
  else if (n) if (!c) while(c = add(next.pop(), p, c));
  else {
    do (n = i.pop(c.temp)) ? n === (n.p = c).temp ? unmark(c) : receive(c, n) : aux2.push(c); while(c = c.sib);
    while(i = aux2.pop()) unmount(rem(i, p));
    for(i = p.next; i && (n = next.pop());) (c = n.p) ? (i === c ?
      (i = i.sib) : move(c, p, i.prev), n.p = null) : add(n, p, i.prev);
    while(c = add(next.pop(), p, c));
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
// diff a root node, supports virtual/managed diffs for imperative backdooring
const rootdiff = (t, f, p, s, ps, r) => {
  if (!isArr(t = norm(t))){
    if (!isFrame(f) || !f.temp) t && (mount(r = addR(t, p, s)), r.isRoot = true);
    else if (f.isRoot && (!t || t.name === f.temp.name))
      sidediff(t ?
        (t === f.temp || receive(f, t, fill(r = f)), s === ps || moveR(r = f, p, s, ps)) :
        unmount(remR(f, p, s, r = !refill(f))));
  }
  return r || false;
}

// public entry points, keeps track of whether or not the program is already in a diff
const rediff = (f, tau=-1) => (rediff.on = true, rediff.on = !!sidediff(fill(f, tau)))
rediff.on = false;
// public diff (mount, unmount and update frames)
const diff = (t, f, p, s, ps) => (rediff.on = true, t = rootdiff(t, f, p, s, ps), rediff.on = false, t)

module.exports = { diff, rediff }
