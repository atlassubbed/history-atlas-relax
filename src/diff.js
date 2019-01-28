const { isArr, norm, isFn } = require("./util")
const Frame = require("./Frame"), { isFrame } = Frame;
const { fill, push } = require("./step-leader");
const { relax, excite, pop } = require("./field")
const KeyIndex = require("./KeyIndex")
const EventQueue = require("./EventQueue");

/* **********
     READ THIS FIRST: This comment is about a "subcycle" technique. I'm not removing this 
     comment because it was a prior train of thought and might be useful. I've skipped this
     and gone ahead implementing rebasing, because I think it is simpler and more intuitive
     compared to subcycles. Subcycles can also be simulated in userland by scheduling async diffs
     Note that rebasing can be a major footgun; managed diffs are for advanced users.
   **********

   diff "sideways" along the calculated path
     History: 
       * initially used call stack; led to overflows for lateral updates
       * initially did not have a concept of "subcycles"
       * "subcycles" introduced to allow well-defined diffs
       * "subcycles" is a first implementation of well-defined diffs
     Future: 
       * implement the "rebasing" technique.
       * tau = 0 async diffs could be implemented as a way to simulate subcycles
       * rebasing opens up other exciting features

   Every diff consists of a sequence of synchronous subcycles. 
   Each subcycle is cycle-safe only within its own context (the rebase method may fix this).

                          time ->
   diff cycle:
     |-fill-subcycle1--subcycle2--subcycle3-...-subcycleN-|
        |
        populate initial path for first subcycle.

   subcycle:
     |-lifecycle--mutations-|
           |          |  
           |          synchronize effects after all computations finished
           |            * emit ALL removals before ANY adds
           |            * thus effects can recycle resources accross subcycles
           |              as opposed to only accross subdiffs
           run all computations
             * queue up mounts as laggards
             * thus every new mount is guaranteed to have latest state
  
    We'd like to allow diffing during a diff. To do so, we need a way of tracking
    updates that aren't in the path, then running them in an immediate cycle.
    This allows the managed diff pattern, which is an imperative pattern for nodes 
    where an O(N) subdiff is simply too expensive for each update. In most cases,
    the linear cost of a subdiff is perfectly fine. Other times, the number of nodes 
    being updated is U, where 1 << U << N. In these cases, subdiffs may be too costly.
    These situations justify being able to circumvent subdiff and perform managed diffs. */

// auxiliary stacks
//   * lags: "laggards", accumulation of to-be-mounted nodes after the path exhausts
//   * orph: "orphans", emphemral stack used for unmounting nodes immediately
//   * stx:  "stack", all-purpose auxiliary stack used for re-ordering
//   * evts: "events", accumulation of in-order mutation events
// magic numbers
//   global state: on in {0: not in diff, 1: in diff, can diff, 2: in diff, cannot diff}
//   local state: node.path in {0: not in path, 1: in path, 2: will remove} 
let lags = [], orph = [], stx = [], queue = new EventQueue;

// flatten and sanitize a frame's next children
//   * ix is an optional KeyIndex
const clean = (t, ix, next=[]) => {
  stx.push(t);
  while(stx.length) if (t = norm(stx.pop()))
    if (isArr(t)) for (let i of t) stx.push(i);
    else next.push(t), ix && ix.push(t);
  return next
}

// detach node f from linked list p after sibling s
const unlink = (f, p, s, next) => {
  (next = f.sib) && (next.prev = s);
  s ? (s.sib = next) : p && (p.next = next);
}
// attach node f into linked list p after sibling s
const link = (f, p, s, next) => {
  (next = f.sib = (f.prev = s) ? s.sib : p && p.next) && (next.prev = f);
  s ? (s.sib = f) : p && (p.next = f)
}

// mutation methods for subdiffs and rootdiffs (R)
const add = (t, p, s, isRoot) => {
  if (t){
    t = node(t, p), p = t.parent;
    t.effs && queue.add(t)
    link(t, p, s);
    isRoot ? lags.push(t) : stx.push(t);
    return t;
  }
}
const move = (f, p, s, ps=f.prev) => {
  f.effs && queue.move(f)
  unlink(f, p, ps), link(f, p, s);
}
const receive = (f, t) => {
  f.effs && queue.receive(f, t);
  f.temp = t;
}

// unmount several queued nodes
//   * we do this outside of the path loop since unmounts are immediate
const unmount = (f, isRoot, c, ch) => {
  while(f = orph.pop()) {
    if (isRoot && (ch = f.affs)) for (c of ch) push(c);
    queue.cacheChildren(f);
    f.effs && queue.remove(f)
    unlink(f, f.parent, f.prev), f.path = -2;
    // XXX could queue a cleanup function or render(null, node) in the path
    //   or we could find a way to automatically clean up resources on unmount
    relax(f, f.temp = f.affs = f._affs = f.sib = f.parent = f.prev = f.effs = null)
    if (c = f.next) do orph.push(c); while(c = c.sib);
  }
}

// mount under a node that has no current children
const mount = (f, next, c) => {
  while(c = add(next.pop(), f, c));
  while(c = stx.pop()) lags.push(c);
}

// diff "downwards" from a parent, p, short circuit if next has zero elements
//   * need keyed subdiff otherwise we'll incorrectly add/remove nodes
const subdiff = (p, c, next, i=new KeyIndex, n) => {
   // XXX use aux stack for all diff mounts called during render so that managed diff mounts happen in order?
  if ((next = clean(next, i)).length){
    do (n = i.pop(c.temp)) ?
      n === (n.p = c).temp ? --c._affN || (c.path=0) : receive(c, n) :
      orph.push(c); while(c = c.sib); unmount();
    for(i = p.next; i && (n = next.pop());) (c = n.p) ? (i === c ?
      (i = i.sib) : move(c, p, i.prev), n.p = null) : add(n, p, i.prev);
    mount(p, next, c);
  } else {
    do orph.push(c); while(c = c.sib); unmount();
  }
}

let on = 0;
const sidediff = (f, c, path=fill(on = 1), raw) => {
  while(f = path.pop() || lags.pop()) {
    if (!f.path) {
      if (f._affs) {
        while(c = f._affs[f.path++])
          --c._affN || (c.path=0);
        f.path = 0, f._affs = null;
      }
    } else if (f.path > -2) {
      if (relax(f), f.path = 0, c = f._affN){
        queue.cacheChildren(f)
        f._affN = 0, f._affs = null;
      }
      raw = f.render(f.temp, f, !c)
      if (f.path > -2){
        if (c = f.next) c.root || subdiff(f, c, raw);
        else mount(f, clean(raw));
      }
    }
  }
  on = 2, queue.flush(), on = 0;
}
// temp is already normalized
const node = (t, p) => {
  let effs = p && p.effs; on = 2;
  if (!isFn(t.name)) t = new Frame(t, effs);
  else {
    const Sub = t.name;
    if (isFrame(Sub.prototype)) t = new Sub(t, effs);
    else t = new Frame(t, effs), t.render = Sub;
  }
  if (isFrame(p)) t.parent = p;
  return on = 1, t;
}
// TODO for inner and outer diffs:
//   use errors instead of returning false for unallowed operations
//   requires rock-solid error handling
const rediff = tau => () => sidediff(pop(tau, push))
// instance (inner) diff (schedule updates for frames)
Frame.prototype.diff = function(tau=-1){
  if (on > 1 || this.path < -1 || (this.path && !this._affN)) return false;
  tau < 0 ? (on ? fill : sidediff)(push(this)) : excite(this, tau, rediff);
  return true;
}
// public (outer) diff (mount, unmount and update frames)
//   * diff root node, supports virtual/managed diffs for imperative backdooring
module.exports = (t, f, p=f&&f.prev, s) => {
  let r = false, inDiff = on;
  if (inDiff < 2) try {
    if (!isArr(t = norm(t))){
      if (!isFrame(f) || f.path < -1) t && (r = add(t, p, s, 1)).root++;
      else if (f.root){
        f.parent && queue.cacheChildren(f.parent);
        if (t && t.name === f.temp.name) {    // note we mustn't incr _affN for laggards
          if (t !== f.temp) receive(r = f, t, (f.path && !f._affN) || push(f));
          if (isFrame(f.parent) && p !== f.prev) move(r = f, f.parent, p);
        } else if (!t) unmount(orph.push(f), r = true);
      }
      (inDiff ? fill : sidediff)();
    }
  } finally { on = inDiff }
  return r;
}
