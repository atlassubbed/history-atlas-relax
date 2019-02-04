const { isArr } = require("./util")

let rems = [], head, tail;
const swapLeader = (f, ns, e=ns.evt, l=e.bot, r=e.top) => {
  if (f.evt.bot = l) l.evt.top = f, e.bot = null
  else head = f;
  if (f.evt.top = r) r.evt.bot = f, e.top = null
  else tail = f;
}
const pushLeader = f => {
  if (!head) head = tail = f;
  else (tail.evt.top = f).evt.bot = tail, tail = f;
}
const popLeader = (ns, e=ns.evt, l=e.bot, r=e.top) => {
  if (l) l.evt.top = r, e.bot = null;
  else head = r;
  if (r) r.evt.bot = l, e.top = null;
  else tail = l;
}
const queue = (f, s, ns) => {
  if (!s || !s.evt.upd){
    if (!ns || !ns.evt.upd) pushLeader(f);
    else swapLeader(f, ns);
  }
}
const dequeue = (f, s, ns=f.sib) => {
  if (f.evt.upd){
    if (!s || !s.evt.upd) {
      if (!ns || !ns.evt.upd) popLeader(f);
      else swapLeader(ns, f);
    }
  } else if (s && s.evt.upd && ns && ns.evt.upd) popLeader(ns);
}
const unlink = (f, p, s=f.prev, next) => {
  (next = f.sib) && (next.evt.prev = s);
  s ? (s.evt.sib = next) : (p.next = next);
}
const link = (e, f, p, s, next) => {
  (next = e.sib = (e.prev = s) ? s.evt.sib : p.next) && (next.evt.prev = f);
  s ? (s.evt.sib = f) : (p.next = f)
}

const add = (f, p, s) => {
  f.evt = {temp: null, prev: null, sib: null, next: null, top: null, bot: null, upd: true}
  queue(f, s, s ? s.sib : p && p.next);
}
const receive = (f, e=f.evt) => {
  if (!e.upd){
    queue(f, f.prev, f.sib);
    e.temp = f.temp;
    e.upd = true
  }
}
const move = (f, p, s, ps, e=f.evt) => {
  dequeue(f, ps);
  if (!e.upd){
    f.evt.temp = f.temp;
    f.evt.upd = true
  }
  queue(f, s, s ? s.sib : p && p.next);
}
const remove = (f, e=f.evt) => {
  if (!e.upd || e.temp){
    e.temp = e.temp || f.temp, e.effs = f.effs;
    rems.push(f);
    if (e.parent = f.parent) unlink(e, f.parent.evt);
  }
  dequeue(f, f.prev)
}
const emit = (eff, type, f, p, s, ps) => {
  if (isArr(eff)) for (eff of eff) eff[type] && eff[type](f, p, s, ps);
  else eff[type] && eff[type](f, p, s, ps);   
}
const flush = (c=0, f, e, t, p) => {
  while(f = rems[c++])
    emit((e = f.evt).effs, "willRemove", f, e.parent, e.prev, e.temp, f.evt = null);
  rems.length = 0;
  if (!head) return;
  f = head, p = f.parent;
  while(f) {
    if (t = (e = f.evt).temp){
      if (t !== f.temp) emit(f.effs, "willReceive", f, f.temp);
      if (f.prev !== (c = e.prev)){
        emit(f.effs, "willMove", f, p, c, f.prev);
        unlink(e, p.evt), link(e, f, p.evt, f.prev);
      }
    } else {
      emit(f.effs, "willAdd", f, p, f.prev, f.temp);
      if (p) link(e, f, p.evt, f.prev);
    }
    e.upd = false, f = f.sib;
    if (!f || !f.evt.upd){
      popLeader(head);
      if (f = head) p = f.parent;
    }
  }
}

module.exports = { receive, add, move, remove, flush }
