const { isArr } = require("./util")

const rems = [], events = new Set;

const queue = (f, s, ns) => {
  if (ns && ns.evt.upd) events.delete(ns);
  if (!s || !s.evt.upd) events.add(f);
}
const dequeue = (f, ps, ns=f.sib) => {
  if (ns && ns.evt.upd){
    if (f.evt.upd){
      if (!ps || !ps.evt.upd) events.add(ns);
    } else if (ps && ps.evt.upd) events.delete(ns);
  }
  if (f.evt.upd) events.delete(f);
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
  f.evt = {temp: null, prev: null, sib: null, next: null, upd: true}
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
  rems.length = 0; for (f of events) {
    e = f.evt, p = f.parent;
    do {
      if (t = e.temp){
        if (t !== f.temp) emit(f.effs, "willReceive", f, f.temp);
        if (f.prev !== (c = e.prev)){
          emit(f.effs, "willMove", f, p, c, f.prev);
          unlink(e, p.evt), link(e, f, p.evt, f.prev);
        }
      } else {
        emit(f.effs, "willAdd", f, p, f.prev, f.temp);
        if (p) link(e, f, p.evt, f.prev);
      }
      e.upd = false;
    } while((f = f.sib) && (e = f.evt).upd);
  }
  events.clear();
}

module.exports = { receive, add, move, remove, flush }
