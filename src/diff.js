const { isArr, norm, merge, isFn } = require("./util")
const { Frame, node, del } = require("./Frame"), { isFrame } = Frame;
const { path, fill, refill, unmark } = require("./step-leader");
const KeyIndex = require("./KeyIndex")
const { relax, excite } = require("./field")

// auxiliary stacks
//   * htap: "reverse path", accumulation of post-order rendered nodes
//   * lags: "laggards", accumulation of to-be-mounted nodes after the path exhausts
//   * orph: "orphans", emphemral stack used for unmounting nodes immediately
//   * stx:  "stack", all-purpose auxiliary stack used for re-ordering
//   * rems: "removals", accumulation of in-order removal mutation events
//   * evts: "events", accumulation of all other in-order mutation events
const lags = [], orph = [], stx = [], htap = [], rems = [], evts = [];
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
    if (isArr(ef)) for (let e of ef) e[type] && e[type](f, p, s, i);
    else ef[type] && ef[type](f, p, s, i);
  }
}
// render a frame's next children
//   * flattens and returns the output of frame's diff function
//   * ix is an optional KeyIndex
const render = (f, ix, next=[], t=f.temp) => {
  stx.push(f.render(t.data, t.next, f, !f._affN && !f.isOrig)), htap.push(f);
  while(stx.length) if (t = norm(stx.pop()))
    if (isArr(t)) for (let i of t) stx.push(i);
    else next.push(t), ix && ix.push(t);
  return f.inPath = false, next;
}

// mutation methods for subdiffs and rootdiffs (R)
// we re-point sib to p for perf
const rem = (f, p, s=f.prev) => {unlink(f, p, s), f.sib = p, rems.push(f), orph.push(f)}
const remR = (f, p, s) => {isFrame(p) && (f.sib = p), s && (f.prev = s), rems.push(f), orph.push(f)}
const add = (t, p, s) => t && (link(t = node(t,p), p, s), stx.push(t), evts.push(["willAdd", t, p, s]), t);
const addR = (t, p, s) => (lags.push(t = node(t, p)), evts.push(["willAdd", t, isFrame(p) && p, s]), t)
const move = (f, p, s, ps=f.prev) => {unlink(f, p, ps), link(f, p, s), evts.push(["willMove", f, p, ps, s])}
const moveR = (f, p, s, ps) => isFrame(p) && evts.push(["willMove", f, p, ps, s])
const receive = (f, t) => evts.push(["willReceive", f, f.temp = t])

// queues up removals in reverse (avoiding a lastChild pointer per node)
const rev = (c, p) => {while(c.sib) c = c.sib; while(c) rem(c, p, c = c.prev)}
// unmount several queued nodes
const unmount = f => {
  while(f = orph.pop()) f.cleanup && f.cleanup(f), del(f), f.next && rev(f.next, f)
}

// diff "downwards" from a parent, p, short circuit if next or prev have zero elements
//   * we used to have a separate mount(...) function, but it's more concise this way
const subdiff = (p, c=p.next, i=c && new KeyIndex, next, n) => {
  if (p.nextState) p.nextState = !(p.state = merge(p.state || {}, p.nextState)), relax(p);
  next = render(p, i), n = next.length;
  if (!n && c) unmount(rev(c, p));
  else if (n) {
    if (c) {
      do (n = i.pop(c.temp)) ? n === (n.p = c).temp ? unmark(c) : receive(c, n) : stx.push(c); while(c = c.sib);
      while(i = stx.pop()) unmount(rem(i, p));
      for(i = p.next; i && (n = next.pop());) (c = n.p) ? (i === c ?
        (i = i.sib) : move(c, p, i.prev), n.p = null) : add(n, p, i.prev);
    }
    while(c = add(next.pop(), p, c));
    while(c = stx.pop()) lags.push(c)
  }
}
// diff "sideways" along the calculated path
//   * initially used call stack; led to overflows for lateral updates
//   * htap is "path" in reverse, we don't need it to avoid .reverse(), but we avoid .length = 0
const sidediff = (f, i=0) => {
  while(f = path.pop()) if (f.temp && f.inPath) subdiff(f);
  while(f = lags.pop()) subdiff(f);
  while(f = rems[i++]) emit("willRemove", f, f.sib, f.prev), f.effs = f.sib = f.prev = null;
  rems.length = i = 0; while(f = evts[i++]) emit(...f); evts.length = 0;
  while(f = htap.pop()) {
    f.rendered && f.rendered(f, !f._affN && !f.isOrig);
    f._affN =+ (f._affs = null, f.isOrig = false);
  }
}
// might even move this into sidediff directly if we can properly implement well-defined mounts/unmounts
let on = false;
const rediff = tau => () => on = !!sidediff(fill(!(on = true), tau));
Frame.prototype.diff = function(part, tau=-1, next){
  const p = this.inPath, store = p ? "state" : "nextState";
  if (next = this.nextState || this[store]) isFn(part) ? part(next) : merge(next, part);
  else isFn(part) ? part(merge(this[store] = {}, this.state)) : (this[store] = part || {});
  p || (tau < 0 && !on ? (on = !!sidediff(fill(this,on=true))) : excite(this, Math.max(tau, 0), rediff));
}
// public diff (mount, unmount and update frames)
//   * diff root node, supports virtual/managed diffs for imperative backdooring
module.exports = (t, f, p, s, ps) => {
  let r; on = true;
  if (!isArr(t = norm(t))){
    if (!isFrame(f) || !f.temp) t && ((r = addR(t, p, s)), r.isRoot = true);
    else if (f.isRoot && (!t || t.name === f.temp.name)){
      t ? (t === f.temp || receive(f, t, fill(r = f)), s === ps || moveR(r = f, p, s, ps)) :
        unmount(remR(f, p, s, r = !refill(f)));
    }
    sidediff();
  }
  return on = false, r || false;
}
