// util functions
const isArr = Array.isArray;
const isFn = f => typeof f === "function";
const name = t => isFn(t=t.name) ? t.name : t;
const norm = t => t != null && t !== true && t !== false && 
  (typeof t === "object" ? t : {name: null, data: String(t)});
const isFrame = f => f && isFn(f.render);
const isAdd = f => (f = f && f.evt) && f.upd && !f.temp;
const sib = p => p && p.root < 2 ? p : null;
const asap = typeof Promise === "function" ? Promise.resolve().then.bind(Promise.resolve()) : false;
const reject = e => setTimeout(() => {throw e}); // i don't like this

const lags = [], orph = [], rems = [], stx = [], path = [], post = [], field = {};

// flatten and sanitize a frame's next children
//   * ix is an optional key index
const clean = (t, ix, next=[]) => {
  stx.push(t);
  while(stx.length) if (t = norm(stx.pop()))
    if (isArr(t)) for (t of t) stx.push(t);
    else next.push(t), ix && pushIndex(ix, t)
  return next
}
// emit mutation event to plugins
const emit = (eff, type, f, p, s, ps) => {
  if (isArr(eff)) for (eff of eff) eff[type] && eff[type](f, p, s, ps);
  else eff[type] && eff[type](f, p, s, ps);   
}
// indexes explicit and implicit keys in LIFO order
const pushIndex = (ix, t, k) => {
  ix = ix[k = name(t)] = ix[k] || {};
  (k = t.key) ?
    ((ix = ix.exp = ix.exp || {})[k] = t) :
    (ix.imp = ix.imp || []).push(t);
}
const popIndex = (ix, t, k) => 
  (ix = ix[name(t)]) &&
    ((k = t.key) ?
      ((ix = ix.exp) && (t = ix[k])) && (ix[k] = null, t) :
      (ix=ix.imp) && ix.pop())

// not to be instantiated by caller
const Frame = function(temp, effs){
  if (!temp) return;
  this.evt = effs ? {
    effs,
    temp: null,
    prev: null,
    sib: null,
    next: null,
    top: null,
    bot: null,
    upd: true
  } : null
  this.temp = temp;
  this.affs = this._affs = this.next = this.parent =
  this.sib = this.prev = this.top = this.bot = this.hook = null;
  // this.path = {-2: unmounted, -1: in path, 0: not in path, >0: recursion step index + 1}
  this.root = this._affN = 0, this.path = -1
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
    return on < 2 && this.path > -2 &&
      !(tau < 0 ? (on ? rebasePath : sidediff)(pushPath(this)) : excite(this, tau))
  }
}
// on = {0: not diffing, 1: diffing, 2: cannot rebase or schedule diff}
let head, tail, on = 0, ctx = null;

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
  if (!s || !s.evt.upd){
    if (!ns || !ns.evt.upd) pushLeader(f);
    else popLeader(ns, f);
  }
}
const dequeue = (f, s, ns=f.sib) => {
  if (f.evt.upd){
    if (!s || !s.evt.upd) popLeader(f, ns && ns.evt.upd && ns)
  } else if (s && s.evt.upd && ns && ns.evt.upd) popLeader(ns);
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
  while(f = rems[c++]){
    f.cleanup && f.cleanup(f);
    if (e = f.evt) emit(e.effs, "willRemove", f, e.next, e.prev, e.temp, f.evt = null);
  }
  rems.length = 0;
  if (!(f = head)) return;
  owner = f.parent;
  while(f) {
    p = f.parent;
    if ((e = f.evt).upd){
      e.upd = false;
      if (!e.temp){
        c = sib(f);
        emit(e.effs, "willAdd", f, c && p, c && f.prev, f.temp);
        if (c && p) linkEvent(e, f, p.evt, sib(f.prev));
        if (sib(f.next)){
          f = f.next;
          continue;
        }
      } else {
        if (f.temp !== e.temp) emit(e.effs, "willReceive", f, f.temp);
        if ((c = sib(f.prev)) !== e.prev){
          emit(e.effs, "willMove", f, p, e.prev, c);
          unlinkEvent(e, p.evt), linkEvent(e, f, p.evt, c);
        }
        e.temp = null;
      }
    }
    if (p !== owner) f = f.sib || p;
    else if (!sib(f) || !(f = f.sib) || !f.evt.upd){
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
    else if (t === field[t.tau] && t.tau !== tau)
      field[t.tau] = t.timer && clearTimeout(t.timer);
    f.top = f.bot = null;
  }
}
// add/move a node to an oscillator
const excite = (f, tau, t, cb) => {
  relax(f, tau);
  if (t = field[tau]){
    if (t.bot) (f.bot = t.bot).top = f;
  } else {
    t = field[tau] = {tau};
    cb = () => {
      while(t = t.bot) pushPath(t);
      sidediff(field[tau]=null);
    }
    t.timer = tau || !asap ? setTimeout(cb, tau) : !asap(cb).catch(reject);
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
  if (f.root < 2 && s) return linkNodeAfter(f, s);
  if (s = p.next) (s.root < 2 ? linkNodeBefore : linkNodeAfter)(f, s);
  if (f.root < 2 || !s || s.root > 1) p.next = f;
}
// detach node f from seg-list p after sibling s
const unlinkNode = (f, p, s=null, n=f.sib) => {
  if (n) n.prev = s;
  if (s) s.sib = n;
  if (f === p.next) p.next = n || s
}

// MUTATIONS
const add = (t, p, s, isRoot, isF, effs) => {
  if (t){
    isF = isFrame(p), effs = isF ? p.evt && p.evt.effs : p && p.effs, on = 2;
    if (!isFn(t.name)) t = new Frame(t, effs);
    else {
      const Sub = t.name;
      if (isFrame(Sub.prototype)) t = new Sub(t, effs);
      else t = new Frame(t, effs), t.render = Sub;
    }
    if (isRoot) t.root = 1 + !isF;
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
    if (!e.upd) e.temp = f.temp, e.upd = true;
    isAdd(p) || queue(f, s, s ? s.sib : sib(p && p.next));
  }
  unlinkNode(f, p, f.prev), linkNode(f, p, s);
}
const receive = (f, t, e=f.evt) => {
  if (e && !e.upd){
    sib(f) ? queue(f, sib(f.prev), f.sib) : pushLeader(f)
    e.temp = f.temp;
    e.upd = true
  }
  f.temp = t;
}

// PATH
// compute a topologically ordered path to diff along
const rebasePath = (f, i, ch) => {
  while(i = stx.length) if (!((f = stx[i-1]).path < 0 && stx.pop())) {
    if (!f.path && (((i = f.next) && !i.root) || f.affs)){
      if (ch = f._affs = [], i && !i.root) do ch.push(i); while(i = i.sib);
      if (i = f.affs) for (i of i) i.path > -2 ? ch.push(i) : i.unsub(f);
      f.path = ch.length+1;
    }
    if (--f.path <= 0) stx.pop().path = -1, path.push(f);
    else if ((i = f._affs[f.path-1]).path <= 0) pushPath(i)
    else throw new Error("cyclic entanglement");
  }
}
const pushPath = f => {
  f.path || stx.push(f), ++f._affN
}

// DIFF CYCLE
// unmount queued orphan nodes
const unmount = (f, isRoot, c) => {
  while(f = orph.pop()) {
    if (isRoot && (c = f.affs)) for (c of c) pushPath(c);
    c = f.parent, e = f.evt;
    if (f.cleanup || (e && (!e.upd || e.temp))) rems.push(f);
    if (e) {
      if (!e.upd || e.temp){
        e.temp = e.temp || f.temp;
        if (e.next = sib(f) && c) 
          c.path > -2 && unlinkEvent(e, c.evt);
      }
      sib(f) ? isAdd(c) || dequeue(f, sib(f.prev)) : e.upd && popLeader(f);
      e.upd = false;
    }
    c && c.path > -2 && unlinkNode(f, c, f.prev), f.path = -2;
    if (c = f.next) do orph.push(c); while(c = c.sib);
    if (c = f.next) while(c = c.prev) orph.push(c);
    relax(f, f.temp = f.affs = f._affs = f.sib = f.parent = f.prev = f.next = f.hook = null)
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
    do (n = popIndex(i, c.temp)) ?
      n === (n.p = c).temp ? --c._affN || (c.path=0) : receive(c, n) :
      orph.push(c); while(c = c.sib); unmount();
    for(i = p.next; i && (n = next.pop());)
      (c = n.p) ?
        (n.p = null, i === c) ?
          (i = i.sib) :
          move(c, p, sib(i.prev)) :
        add(n, p, sib(i.prev));
    mount(p, next, c);
  } else {
    do orph.push(c); while(c = c.sib); unmount();
  }
}
// diff "sideways" across the path
const sidediff = (c, raw=rebasePath(on=1)) => {
  do {
    if (ctx = path.pop() || lags.pop()){
      if (!ctx.path) {
        if (c = ctx._affs) {
          for (c of c) --c._affN || (c.path = 0);
          ctx._affs = null;
        }
      } else if (ctx.path > -2) {
        relax(ctx), ctx.path = ctx._affN = 0, ctx._affs = null;
        raw = ctx.render(c = ctx.temp, ctx)
        if (ctx.path > -2){
          if (ctx.rendered)
            ctx.hook || post.push(ctx), ctx.hook = c;
          sib(c = ctx.next) ?
            c.root || subdiff(ctx, c, clean(raw, c = {}), c) :
            mount(ctx, clean(raw));
        }
      }
    } else {
      on = 2, flushEvents(c=0);
      if (!post.length) return on = 0, ctx = null;
      on = 1; while(ctx = post.pop()) if (c = ctx.hook) {
        ctx.rendered && ctx.rendered(c, ctx), ctx.hook = null;
      }
    }
  } while(1);
}
// public (outer) diff (mount, unmount and update frames)
const diff = (t, f, p=f&&f.prev, s) => {
  let r = false, inDiff = on, context = ctx;
  if (inDiff < 2) try {
    if (!isArr(t = norm(t))){
      if (!isFrame(f) || f.path < -1){
        if (t && (!s || s.parent === p)) r = add(t, p, sib(s), 1)
      } else if (f.root){
        if (t && t.name === f.temp.name) {
          if (t !== f.temp) receive(r = f, t, pushPath(f));
          if (sib(f) && isFrame(s = f.parent) && (!p || p.parent === s)){
            (p = sib(p)) === (s = sib(f.prev)) || move(r = f, f.parent, p, s);
          }
        } else if (!t) unmount(orph.push(f), r = true);
      }
      (inDiff ? rebasePath : sidediff)();
    }
  } finally { on = inDiff, ctx = context }
  return r;
}

module.exports = { Frame, diff }
