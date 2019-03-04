// node states
const IS_CHLD = 1;
const IS_CTXL = 2;
const HAS_EVT = 4;
const IN_PATH = 8;
const IS_POST = 16
const ORDER = 32;

// query bitmasks
const isCtx = f => f.ph & IS_CTXL;
const isCh = f => f.ph & IS_CHLD;
const inPath = f => f.ph & IN_PATH;
const isUpd = f => f.ph & HAS_EVT;

// util functions
const isFn = f => typeof f === "function";
const norm = t => t != null && t !== true && t !== false && 
  (typeof t === "object" ? t : {name: null, data: String(t)});
const isFrame = f => f && isFn(f.render);
const isAdd = f => f && isUpd(f) && !f.evt.temp;
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
const Frame = function(temp, evt){
  this.evt = evt ? {
    evt,
    temp: null,
    next: null,
    sib: null,
    prev: null,
    top: null,
    bot: null
  } : null;
  this.affs = this._affs = this.parent =
  this.next = this.sib = this.prev = this.top = this.bot = null;
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
    return on < 2 && !!this.temp &&
      !(!isFn(tau) && tau < 0 ?
        (on ? rebasePath : sidediff)(pushPath(this)) :
        excite(this, tau, isFn(tau) && tau))
  }
}

// on = {0: not diffing, 1: diffing, 2: cannot rebase or schedule diff}
let head, tail, on = 0, ctx = null, keys = new Map;

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
  else (tail.evt.top = f).evt.bot = tail, tail = f;
}
// remove leader node from thread
const popLeader = (ns, f, e=ns.evt, b=e.bot, t=e.top) => {
  if (f ? (f.evt.bot = b) : b) b.evt.top = f || t, e.bot = null;
  else head = f || t;
  if (f ? (f.evt.top = t) : t) t.evt.bot = f || b, e.top = null;
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
const unlinkEvent = (f, p, s=f.prev, next) => {
  (next = f.sib) && (next.evt.prev = s);
  s ? (s.evt.sib = next) : (p.next = next);
}
// attach event f after sibling s
const linkEvent = (e, f, p, s, next) => {
  (next = e.sib = (e.prev = s) ? s.evt.sib : p.next) && (next.evt.prev = f);
  s ? (s.evt.sib = f) : (p.next = f)
}
// empties the thread, emitting the queued events
const flushEvents = (c, f, e, p, owner) => {
  if (rems.length) {
    while(f = rems[c++]){
      f.cleanup && f.cleanup(f);
      if (e = f.evt) emit(e.evt, "willRemove", f, e.next, e.prev, e.temp, f.evt = null);
    }
    rems.length = 0;
  }
  if (!(f = head)) return;
  owner = f.parent;
  while(f) {
    p = f.parent;
    if (isUpd(f)){
      f.ph -= HAS_EVT, e = f.evt;
      if (!e.temp){
        c = sib(f);
        emit(e.evt, "willAdd", f, c && p, c && f.prev, f.temp);
        if (c && p) linkEvent(e, f, p.evt, sib(f.prev));
        if (sib(f.next)){
          f = f.next;
          continue;
        }
      } else {
        if (f.temp !== e.temp) emit(e.evt, "willReceive", f, f.temp);
        if ((c = sib(f.prev)) !== e.prev){
          emit(e.evt, "willMove", f, p, e.prev, c);
          unlinkEvent(e, p.evt), linkEvent(e, f, p.evt, c);
        }
        e.temp = null;
      }
    }
    if (p !== owner) f = f.sib || p;
    else if (!sib(f) || !(f = f.sib) || !isUpd(f)){
      popLeader(head);
      if (f = head) owner = f.parent;
    }
  }
}

// FIELD
// remove a node from an oscillator
const relax = (f, tau, t) => {
  if (t = f.top){
    if (t.bot = f.bot) f.bot.top = t;
    else if (t.tau !== tau && t === field.get(t.tau))
      (t.clear || clearTimeout)(t.timer), field.delete(t.tau);
    f.top = f.bot = null;
  }
}
// add/move a node to an oscillator
const excite = (f, tau, cb, t) => {
  relax(f, tau);
  if (t = field.get(tau)){
    if (t.bot) (f.bot = t.bot).top = f;
  } else {
    field.set(tau, t = {tau});
    t.timer = (cb || setTimeout)(() => {
      while(t = t.bot) pushPath(t);
      sidediff(field.delete(tau));
    }, tau, t);
  }
  (f.top = t).bot = f;
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
    isF = isFrame(p), evt = isF ? p.evt && p.evt.evt : p, on = 2;
    if (!isFn(t.name)) t = new Frame(t, evt);
    else {
      const Sub = t.name;
      if (isFrame(Sub.prototype)) t = new Sub(t, evt);
      else t = new Frame(t, evt), t.render = Sub;
    }
    // step counter
    t.st = 0;
    // phase and in degree counter
    t.ph = IN_PATH | (evt ? HAS_EVT : 0) | (isRoot ? (!isF && IS_CTXL) : IS_CHLD)
    p = t.parent = isF ? p : ctx, on = 1;
    if (t.evt) sib(t) ? isAdd(p) || queue(t, s, s ? s.sib : sib(p && p.next)) : pushLeader(t);
    p && linkNode(t, p, s);
    isRoot ? lags.push(t) : stx.push(t);
    return t;
  }
}
const move = (f, p, s, ps=sib(f.prev), e=f.evt) => {
  if (e){
    isAdd(p) || dequeue(f, ps);
    if (!isUpd(f)) e.temp = f.temp, f.ph += HAS_EVT;
    isAdd(p) || queue(f, s, s ? s.sib : sib(p && p.next));
  }
  unlinkNode(f, p, f.prev), linkNode(f, p, s);
}
const receive = (f, t, e=f.evt) => {
  if (e && !isUpd(f)){
    sib(f) ? queue(f, sib(f.prev), f.sib) : pushLeader(f)
    e.temp = f.temp, f.ph += HAS_EVT;
  }
  f.temp = t;
}

// PATH (working, smaller)
// compute a topologically ordered path to diff along
const rebasePath = (f, i, ch) => {
  while(i = stx.length)
    if (inPath(f = stx[i-1])) stx.pop();
    else if (f.st){
      if (i = --f.st) {
        if ((i = f._affs[i-1]).st)
          throw new Error("cycle")
        pushPath(i);
      } else f.ph += IN_PATH, path.push(stx.pop());
    } else {
      if (f.st++, ((i = f.next) && isCh(i)) || f.affs){
        if (ch = f._affs = [], i && isCh(i))
          do ch.push(i); while(i = i.sib);
        if (i = f.affs) for (i of i)
          i.temp ? ch.push(i) : i.unsub(f);
        f.st += ch.length;
      }
    }
}
const pushPath = f => {
  inPath(f) || stx.push(f), f.ph+=ORDER
}

// DIFF CYCLE
// unmount queued orphan nodes
const unmount = (f, isRoot, c) => {
  while(f = orph.pop()) {
    if (isRoot && (c = f.affs)) for (c of c) pushPath(c);
    if (c = f.parent, e = f.evt) {
      if (!isUpd(f) || e.temp){
        rems.push(f)
        e.temp = e.temp || f.temp;
        if (e.next = sib(f) && c) 
          c.temp && unlinkEvent(e, c.evt);
      } else if (f.cleanup) rems.push(f)
      sib(f) ? isAdd(c) || dequeue(f, sib(f.prev)) : isUpd(f) && popLeader(f);
      if (isUpd(f)) f.ph -= HAS_EVT
    } else if (f.cleanup) rems.push(f);
    c && c.temp && unlinkNode(f, c, f.prev);
    if (!inPath(f)) f.ph += IN_PATH
    if (c = f.next) do orph.push(c); while(c = c.sib);
    if (c = f.next) while(c = c.prev) orph.push(c);
    relax(f, f.temp = f.affs = f._affs = f.sib = f.parent = f.prev = f.next = null)
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
      n === (n.p = c).temp ? ((c.ph-=ORDER) < ORDER) && (c.ph -= IN_PATH) : receive(c, n) :
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
const sidediff = (c, raw=rebasePath(on=1)) => {
  do {
    if (ctx = path.pop() || lags.pop()){
      if (!inPath(ctx)) {
        if (c = ctx._affs) {
          for (c of c) ((c.ph-=ORDER) < ORDER) && (c.ph -= IN_PATH);
          ctx._affs = null;
        }
      } else if (c = ctx.temp) {
        relax(ctx);
        ctx.ph &= (ORDER-IN_PATH-1)
        ctx._affs = null;
        raw = ctx.render(c, ctx)
        if (ctx.temp){
          if (ctx.rendered && !(ctx.ph & IS_POST)){
            ctx.ph += IS_POST;
            post.push(ctx);
          }
          sib(c = ctx.next) ?
            isCh(c) && subdiff(ctx, c, clean(raw, 1)) :
            mount(ctx, clean(raw));
        }
      }
    } else {
      on = 2, flushEvents(0);
      if (!post.length) return on = 0, ctx = null;
      on = 1; while(ctx = post.pop()) if (ctx.temp){
        ctx.rendered && ctx.rendered(ctx), ctx.ph -= IS_POST
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
        if (t && (!s || s.parent === p)) r = add(t, p, sib(s), 1)
      } else if (!isCh(f)){
        if (t && t.name === f.temp.name) {
          if (t !== f.temp) receive(r = f, t, pushPath(f));
          if (sib(f) && isFrame(s = f.parent) && (!p || p.parent === s)){
            (p = sib(p)) === (s = sib(f.prev)) || move(r = f, f.parent, p, s);
          }
        } else if (!t) unmount(orph.push(f), r = true);
      }
      r && (inDiff ? rebasePath : sidediff)();
    }
  } finally { on = inDiff, ctx = context }
  return r;
}

module.exports = { Frame, diff }
