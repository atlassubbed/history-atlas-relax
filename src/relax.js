// node states
const IS_CHLD = 1;
const IS_CTXL = 2;
const HAS_EVT = 4;
const IN_PATH = 8;
const IN_POST = 16
const ORDER = 32;

// diff states
const IDLE = 0;
const DIFF = 1;
const LOCK = 2;

// query bitmasks
const isCtx = f => f._ph & IS_CTXL;
const isCh = f => f._ph & IS_CHLD;
const inPath = f => f._ph & IN_PATH;
const isUpd = f => f._ph & HAS_EVT;

// util functions
const isFn = f => typeof f === "function";
const norm = t => t != null && t !== true && t !== false && 
  (typeof t === "object" ? t : {name: null, data: String(t)});
const isFrame = f => f && isFn(f.render);
const isAdd = f => f && isUpd(f) && !f._evt._temp;
const sib = p => p && !isCtx(p) ? p : null;

// aux data structures
const lags = [], orph = [], rems = [], stx = [], path = [], post = [], field = new Map;

// flatten and sanitize a frame's next children
//   * if ix then index the nodes' implicit/explicit keys
const clean = (t, ix, next=[]) => {
  stx.push(t);
  while(stx.length) if (t = norm(stx.pop()))
    if (Array.isArray(t)) for (t of t) stx.push(t);
    else next.push(t), ix && pushIndex(t)
  return next
}
// emit mutation event to plugins
const emit = (evt, type, f, p, s, ps) => {
  if (Array.isArray(evt)) for (evt of evt)
    evt[type] && evt[type](f, p, s, ps);
  else evt[type] && evt[type](f, p, s, ps);   
}

// not to be instantiated by caller
const Frame = function(temp, _evt){
  this._evt = _evt ? {
    _evt,
    _temp: null,
    _next: null,
    _sib: null,
    _prev: null,
    _top: null,
    _bot: null
  } : null;
  this.affs = this._affs = this.par =
  this.next = this.sib = this.prev = this._top = this._bot = null;
  this.temp = temp;
}
Frame.prototype = {
  constructor: Frame,
  render(temp){
    return temp.next;
  },
  // rarely called, use sets for sublinearity
  sub(f){
    isFrame(f) && f !== this && (f.affs = f.affs || new Set).add(this)
  },
  unsub(f){
    isFrame(f) && f.affs && f.affs.delete(this) && (f.affs.size || (f.affs = null))
  },
  // instance (inner) diff (schedule updates for frames)
  diff(tau=-1){
    return on < LOCK && !!this.temp &&
      !(!isFn(tau) && tau < 0 ?
        (on ? rebasePath : sidediff)(pushPath(this)) :
        excite(this, tau, isFn(tau) && tau))
  }
}

// on = {0: not diffing, 1: diffing, 2: cannot rebase or schedule diff}
let head, tail, on = IDLE, ctx = null, keys = new Map;

// KEY INDEXER
// indexes explicit and implicit keys in LIFO order
const pushIndex = (t, ix, k) => {
  (ix = keys.get(k = t.name)) || keys.set(k, ix = {});
  (k = t.key) ?
    ((ix = ix.exp = ix.exp || {})[k] = t) :
    (ix.imp = ix.imp || []).push(t);
}
const popIndex = (t, ix, k) =>
  (ix = keys.get(t.name)) &&
    ((k = t.key) ?
      ((ix = ix.exp) && (t = ix[k])) && (ix[k] = null, t) :
      (ix=ix.imp) && ix.pop())

// THREAD
// add leader node to thread
const pushLeader = f => {
  if (!head) head = tail = f;
  else (tail._evt._top = f)._evt._bot = tail, tail = f;
}
// remove leader node from thread
const popLeader = (ns, f, e=ns._evt, b=e._bot, t=e._top) => {
  if (f ? (f._evt._bot = b) : b) b._evt._top = f || t, e._bot = null;
  else head = f || t;
  if (f ? (f._evt._top = t) : t) t._evt._bot = f || b, e._top = null;
  else tail = f || b;
}
const queue = (f, s, ns) => {
  if (!s || !isUpd(s)){
    if (!ns || !isUpd(ns)) pushLeader(f);
    else popLeader(ns, f);
  }
}
const dequeue = (f, s, ns=f.sib) => {
  if (isUpd(f)){
    if (!s || !isUpd(s)) popLeader(f, ns && isUpd(ns) && ns)
  } else if (s && isUpd(s) && ns && isUpd(ns)) popLeader(ns);
}
// detach event f after sibling s
const unlinkEvent = (f, p, s=f._prev, next) => {
  (next = f._sib) && (next._evt._prev = s);
  s ? (s._evt._sib = next) : (p._next = next);
}
// attach event f after sibling s
const linkEvent = (e, f, p, s, next) => {
  (next = e._sib = (e._prev = s) ? s._evt._sib : p._next) && (next._evt._prev = f);
  s ? (s._evt._sib = f) : (p._next = f)
}
// empties the thread, emitting the queued events
const flushEvents = (c, f, e, p, owner) => {
  if (rems.length) {
    while(f = rems[c++]){
      f.cleanup && f.cleanup(f);
      if (e = f._evt) emit(e._evt, "remove", f, e._next, e._prev, e._temp, f._evt = null);
    }
    rems.length = 0;
  }
  if (!(f = head)) return;
  owner = f.par;
  while(f) {
    p = f.par;
    if (isUpd(f)){
      f._ph -= HAS_EVT, e = f._evt;
      if (!e._temp){
        c = sib(f);
        emit(e._evt, "add", f, c && p, c && f.prev, f.temp);
        if (c && p) linkEvent(e, f, p._evt, sib(f.prev));
        if (sib(f.next)){
          f = f.next;
          continue;
        }
      } else {
        if (f.temp !== e._temp) emit(e._evt, "temp", f, f.temp, e._temp);
        if ((c = sib(f.prev)) !== e._prev){
          emit(e._evt, "move", f, p, e._prev, c);
          unlinkEvent(e, p._evt), linkEvent(e, f, p._evt, c);
        }
        e._temp = null;
      }
    }
    if (p !== owner) f = f.sib || p;
    else if (!sib(f) || !(f = f.sib) || !isUpd(f)){
      popLeader(head);
      if (f = head) owner = f.par;
    }
  }
}

// FIELD
// remove a node from an oscillator
const relax = (f, tau, t) => {
  if (t = f._top){
    if (t._bot = f._bot) f._bot._top = t;
    else if (t.tau !== tau && t === field.get(t.tau))
      (t.clear || clearTimeout)(t.timer), field.delete(t.tau);
    f._top = f._bot = null;
  }
}
// add/move a node to an oscillator
const excite = (f, tau, cb, t) => {
  relax(f, tau);
  if (t = field.get(tau)){
    if (t._bot) (f._bot = t._bot)._top = f;
  } else {
    field.set(tau, t = {tau});
    t.timer = (cb || setTimeout)(() => {
      while(t = t._bot) pushPath(t);
      sidediff(field.delete(tau));
    }, tau, t);
  }
  (f._top = t)._bot = f;
}

// SEG-LIST
const linkNodeAfter = (f, s, n=s.sib) =>
  (((f.prev = s).sib = f).sib = n) && (n.prev = f);
const linkNodeBefore = (f, s, n=s.prev) =>
  (((f.sib = s).prev = f).prev = n) && (n.sib = f);
// attach node f into seg-list p after sibling s
const linkNode = (f, p, s=null) => {
  if (!isCtx(f) && s) return linkNodeAfter(f, s);
  if (s = p.next) (isCtx(s) ? linkNodeAfter : linkNodeBefore)(f, s);
  if (!isCtx(f) || !s || isCtx(s)) p.next = f;
}
// detach node f from seg-list p after sibling s
const unlinkNode = (f, p, s=null, n=f.sib) => {
  if (n) n.prev = s;
  if (s) s.sib = n;
  if (f === p.next) p.next = n || s
}

// MUTATIONS
const add = (t, p, s, isRoot, isF, evt) => {
  if (t){
    isF = isFrame(p), evt = isF ? p._evt && p._evt._evt : p, on = LOCK;
    if (!isFn(t.name)) t = new Frame(t, evt);
    else {
      const Sub = t.name;
      if (isFrame(Sub.prototype)) t = new Sub(t, evt);
      else t = new Frame(t, evt), t.render = Sub;
    }
    // step counter
    t._st = 0;
    // phase and in degree counter
    t._ph = IN_PATH | (evt ? HAS_EVT : 0) | (isRoot ? (!isF && IS_CTXL) : IS_CHLD)
    p = t.par = isF ? p : ctx, on = DIFF;
    if (t._evt) sib(t) ? isAdd(p) || queue(t, s, s ? s.sib : sib(p && p.next)) : pushLeader(t);
    p && linkNode(t, p, s);
    isRoot ? lags.push(t) : stx.push(t);
    return t;
  }
}
const move = (f, p, s, ps=sib(f.prev), e=f._evt) => {
  if (e){
    isAdd(p) || dequeue(f, ps);
    if (!isUpd(f)) e._temp = f.temp, f._ph += HAS_EVT;
    isAdd(p) || queue(f, s, s ? s.sib : sib(p && p.next));
  }
  unlinkNode(f, p, f.prev), linkNode(f, p, s);
}
const receive = (f, t, e=f._evt) => {
  if (e && !isUpd(f)){
    sib(f) ? queue(f, sib(f.prev), f.sib) : pushLeader(f)
    e._temp = f.temp, f._ph += HAS_EVT;
  }
  f.temp = t;
}
const remove = (f, p, s, e=f._evt) => {
  if (e) {
    if (!isUpd(f) || e._temp){
      rems.push(f)
      e._temp = e._temp || f.temp;
      if (e._next = sib(f) && p)
        p.temp && unlinkEvent(e, p._evt);
    } else if (f.cleanup) rems.push(f)
    sib(f) ? isAdd(p) || dequeue(f, sib(s)) : isUpd(f) && popLeader(f);
    if (isUpd(f)) f._ph -= HAS_EVT
  } else if (f.cleanup) rems.push(f);
  p && p.temp && unlinkNode(f, p, s);
  if (!inPath(f)) f._ph += IN_PATH
  relax(f, f.temp = f.affs = f._affs = null)
}

// PATH
// compute a topologically ordered path to diff along
const rebasePath = (f, i, ch) => {
  const walkAffs = i => i.temp ? ch.push(i) : i.unsub(f);
  while(i = stx.length)
    if (inPath(f = stx[i-1])) stx.pop();
    else if (f._st){
      if (i = --f._st) {
        if ((i = f._affs[i-1])._st)
          throw new Error("cycle")
        pushPath(i);
      } else f._ph += IN_PATH, path.push(stx.pop());
    } else {
      if (f._st++, ((i = f.next) && isCh(i)) || f.affs){
        if (ch = f._affs = [], i && isCh(i))
          do ch.push(i); while(i = i.sib);
        if (i = f.affs) i.forEach(walkAffs)
        f._st += ch.length;
      }
    }
}
const pushPath = f => {
  inPath(f) || stx.push(f), f._ph+=ORDER
}

// DIFF CYCLE
// unmount queued orphan nodes
const unmount = (f=orph.pop(), isRoot, c, p, s) => {
  while(f){
    p = f.par, s = f.prev;
    if (f.temp){ // entering "recursion"
      if (isRoot && (c = f.affs)) c.forEach(pushPath)
      remove(f, p, s);
      if (c = f.next) while(c.sib) c = c.sib;
      if (c) {
        f = c;
        continue;
      }
    }
    c = !(p && p.temp) && (s || p);
    f.sib = f.par = f.prev = f.next = null;
    f = c || orph.pop();
  }
}
// mount under a node that has no children
const mount = (f, next, c) => {
  while(c = add(next.pop(), f, c));
  while(c = stx.pop()) lags.push(c);
}
// diff "downwards" from a node
const subdiff = (p, c, next, i, n) => {
  if (next.length){
    do (n = popIndex(c.temp)) ?
      n === (n.p = c).temp ? ((c._ph-=ORDER) < ORDER) && (c._ph -= IN_PATH) : receive(c, n) :
      orph.push(c); while(c = c.sib); unmount();
    for(i = p.next; i && (n = next.pop());)
      (c = n.p) ?
        (n.p = null, i === c) ?
          (i = i.sib) :
          move(c, p, sib(i.prev)) :
        add(n, p, sib(i.prev));
    mount(p, next, c), keys = new Map;
  } else {
    do orph.push(c); while(c = c.sib); unmount();
  }
}
// diff "sideways" across the path
const sidediff = (c, raw=rebasePath(on=DIFF)) => {
  do {
    if (ctx = path.pop() || lags.pop()){
      if (!inPath(ctx)) {
        if (c = ctx._affs) {
          for (c of c) ((c._ph-=ORDER) < ORDER) && (c._ph -= IN_PATH);
          ctx._affs = null;
        }
      } else if (c = ctx.temp) {
        relax(ctx);
        ctx._ph &= (ORDER-IN_PATH-1)
        ctx._affs = null;
        raw = ctx.render(c, ctx)
        if (ctx.temp){
          if (ctx.rendered && !(ctx._ph & IN_POST)){
            ctx._ph += IN_POST;
            post.push(ctx);
          }
          sib(c = ctx.next) ?
            isCh(c) && subdiff(ctx, c, clean(raw, 1)) :
            mount(ctx, clean(raw));
        }
      }
    } else {
      on = LOCK, flushEvents(0);
      if (!post.length) return on = IDLE, ctx = null;
      on = DIFF; while(ctx = post.pop()) if (ctx.temp){
        ctx.rendered && ctx.rendered(ctx), ctx._ph -= IN_POST
      }
    }
  } while(1);
}
// public (outer) diff (mount, unmount and update frames)
const diff = (t, f, p=f&&f.prev, s) => {
  let r = false, inDiff = on, context = ctx;
  if (inDiff < 2) try {
    if (!Array.isArray(t = norm(t))){
      if (!isFrame(f) || !f.temp){
        if (t && (!s || s.par === p)) r = add(t, p, sib(s), 1)
      } else if (!isCh(f)){
        if (t && t.name === f.temp.name) {
          if (t !== f.temp) receive(r = f, t, pushPath(f));
          if (sib(f) && isFrame(s = f.par) && (!p || p.par === s)){
            (p = sib(p)) === (s = sib(f.prev)) || move(r = f, f.par, p, s);
          }
        } else if (!t) unmount(f, r = true);
      }
      r && (inDiff ? rebasePath : sidediff)();
    }
  } finally { on = inDiff, ctx = context }
  return r;
}

module.exports = { Frame, diff }
