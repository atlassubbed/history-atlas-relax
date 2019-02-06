const { isArr } = require("./util")

let rems = [], head, tail;
// const logNode = f => {
//   let evts = [];
//   if (!f.evt.temp) evts.push("mWA");
//   else {
//     if (f.evt.temp !== f.temp) evts.push("mWR")
//     if (f.prev !== f.evt.prev) evts.push("mWM")
//   }
//   console.log("   ",evts.toString() || "N/A", f.temp.data.id, !!(f.evt.top || f.evt.bot || f === head));
// }
// const logThread = () => {
//   let f = head, h = head;
//   while(f){
//     logNode(f);
//     if (f.sib && f.sib.evt.upd) f = f.sib;
//     else f = h = h.evt.top;
//   }
// }
const pushLeader = f => {
  if (!head) head = tail = f;
  else (tail.evt.top = f).evt.bot = tail, tail = f;
}
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
const unlink = (f, p, s=f.prev, next) => {
  (next = f.sib) && (next.evt.prev = s);
  s ? (s.evt.sib = next) : (p.next = next);
}
const link = (e, f, p, s, next) => {
  (next = e.sib = (e.prev = s) ? s.evt.sib : p.next) && (next.evt.prev = f);
  s ? (s.evt.sib = f) : (p.next = f)
}

const isAdd = f => (f = f && f.evt) && f.upd && !f.temp;

const add = (f, p, s) => {
  isAdd(p) || queue(f, s, s ? s.sib : p && p.next)
}
const receive = (f, e=f.evt) => {
  if (!e.upd){
    queue(f, f.prev, f.sib);
    e.temp = f.temp;
    e.upd = true
  }
}
const move = (f, p, s, ps, e=f.evt) => {
  isAdd(p) || dequeue(f, ps);
  if (!e.upd){
    e.temp = f.temp;
    e.upd = true
  }
  isAdd(p) || queue(f, s, s ? s.sib : p && p.next);
}
const remove = (f, e=f.evt, p=f.parent) => {
  if (!e.upd || e.temp){
    e.temp = e.temp || f.temp;
    rems.push(f);
    if (e.parent = p) unlink(e, p.evt);
  }
  isAdd(p) || dequeue(f, f.prev)
}
const emit = (eff, type, f, p, s, ps) => {
  if (isArr(eff)) for (eff of eff) eff[type] && eff[type](f, p, s, ps);
  else eff[type] && eff[type](f, p, s, ps);   
}
// iterates and destroys the threads
const flush = (c=0, f, e, p, owner) => {
  while(f = rems[c++])
    emit((e = f.evt).effs, "willRemove", f, e.parent, e.prev, e.temp, f.evt = null);
  rems.length = 0;
  if (!(f = head)) return;
  owner = f.parent;
  while(f) {
    p = f.parent;
    if ((e = f.evt).upd){
      e.upd = false;
      if (!e.temp){
        emit(e.effs, "willAdd", f, p, f.prev, f.temp);
        if (p) link(e, f, p.evt, f.prev);
        if (p !== owner || f.next){
          f = f.next || f.sib || p;
          continue;
        }
      } else {
        if (f.temp !== e.temp) emit(e.effs, "willReceive", f, f.temp);
        if (f.prev !== e.prev){
          emit(e.effs, "willMove", f, p, e.prev, f.prev);
          unlink(e, p.evt), link(e, f, p.evt, f.prev);
        }
        e.temp = null;
      }
    } else if (p !== owner) {
      f = f.sib || p;
      continue;
    }
    if (!(f = f.sib) || !f.evt.upd){
      popLeader(head);
      if (f = head) owner = f.parent;
    }
  }
}

module.exports = { receive, add, move, remove, flush }
