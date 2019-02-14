const { isArr } = require("./util")

/* a 'thread' is linked list of contiguous child chains.

   Why do we need this data structure? 
     1. Rebasing diffs on a parent diff can lead to unbounded memory usage
     2. Removals should be processed before all other events, allowing immediate resource recycling.
     3. Events do not commute.
     4. Linked lists are awesome and we don't need random access, but need O(1) add/remove

   given a list of children, we can color the nodes red and black:

     r-r-r-r-b-b-b-b-r-r-r-r-b-b-b-b-r-r-r-r-b-b-r-b-r-b-b-b-r-b
     |     |         |     |         |     |     |   |      |
     a1    w1        a2    w2        a3    w3    a4  w4     a5 & w5

   contiguous groups of red nodes form chains in a thread. the first red node in a chain
   is called a 'leader' or alpha node. the last one is called an omega node.
   a node may be an alpha and an omega node. a previous algorithm chained alphas and omegas.
   we just chain alphas for simplicity (while maintaining O(1) access).
   
   red nodes are nodes with updates. 
   nodes in a thread need not share the same parent.
   nodes in a chain share the same parent.

   thread:

     (head)                  (tail)
       a1----a2----a3----a4----a5
       |      |     |     |     |
          ... sibling chains ....

   properties of thread:
      1. every node in the thread must be an alpha node
      2. O(1) insert and remove
      3. O(U) traversal (U <= N)
      4. O(N) extra memory
      5. unmounts are processed immediately
      6. subtree mounts are processed before the next sibling */

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
  if (f.root < 2) isAdd(p) || queue(f, s, s ? s.sib : p && p.next);
  else pushLeader(f);
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
const remove = (f, p, e=f.evt) => {
  if (!e.upd || e.temp){
    e.temp = e.temp || f.temp;
    rems.push(f);
    if (e.parent = f.root < 2 ? p : null) unlink(e, p.evt);
  }
  if (f.root < 2) isAdd(p) || dequeue(f, f.prev);
  else if (e.upd) popLeader(f);
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
        emit(e.effs, "willAdd", f, f.root < 2 && p, f.root < 2 && f.prev, f.temp);
        if (f.root < 2 && p) link(e, f, p.evt, f.prev);
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
    if (f.root > 1 || !(f = f.sib) || !f.evt.upd){
      popLeader(head);
      if (f = head) owner = f.parent;
    }
  }
}

module.exports = { receive, add, move, remove, flush }
