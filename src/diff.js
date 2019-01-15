const { isArr, norm, merge, isFn } = require("./util")
const Frame = require("./Frame"), { isFrame } = Frame;
const { unfill, fill, push } = require("./step-leader");
const { relax, excite, pop } = require("./field")
const KeyIndex = require("./KeyIndex")

// auxiliary stacks
//   * lags: "laggards", accumulation of to-be-mounted nodes after the path exhausts
//   * orph: "orphans", emphemral stack used for unmounting nodes immediately
//   * stx:  "stack", all-purpose auxiliary stack used for re-ordering
//   * evts: "events", accumulation of in-order mutation events
// magic numbers
//   global state: on in {0: not in diff, 1: in diff, can diff, 2: in diff, cannot diff}
//   local state: node.path in {0: not in path, 1: in path, 2: will remove} 
let lags = [], orph = [], stx = [], evts = [];

// render a frame's next children
//   * flattens and returns the output of frame's diff function
//   * ix is an optional KeyIndex
// XXX only pass f, isFirst to render?
const render = (f, ix, next=[], t=f.temp, isUpd=f._affN) => {
  if (f.path = 0, isUpd) f._affN =+ (f._affs = null);
  t = f.render(t.data, t.next, f, !isUpd);
  if (f.path < 2) stx.push(t);
  while(stx.length) if (t = norm(stx.pop()))
    if (isArr(t)) for (let i of t) stx.push(i);
    else next.push(t), ix && ix.push(t);
  return next;
}

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

// mutation methods for subdiffs and rootdiffs (R)
// we re-point it to p for perf
const rem = (f, p) => {f.it = p, orph.push(f)}
const add = (t, p, s) => t && (link(t = node(t,p), p, s), stx.push(t), evts.push(["willAdd", t, p, s]), t);
const addR = (t, p, s) => (lags.push(t = node(t, p)), evts.push(["willAdd", t, isFrame(p) && p, s]), t)
const move = (f, p, s, ps=f.prev) => {unlink(f, p, ps), link(f, p, s), evts.push(["willMove", f, p, ps, s])}
const moveR = (f, p, s, ps) => isFrame(p) && evts.push(["willMove", f, p, ps, s])
const receive = (f, t) => evts.push(["willReceive", f, f.temp = t])

// unmount several queued nodes
const unmount = (f, isRoot, c, ch) => {
  while(f = orph.pop()) {
    if (isRoot && (ch = f.affs)) for (c of ch) c.path < 2 && push(c);
    unlink(f, f.it, f.prev), evts.push(f), f.path = 2;
    if (c = f.next) while(c) rem(c, f, c = c.sib)
  }
}
// diff "downwards" from a parent, p, short circuit if next or prev have zero elements
//   * we used to have a separate mount(...) function, but it's more concise this way
const subdiff = (p, c=p.next, i=c && new KeyIndex, next, n) => {
  if (p.nextState) p.state = merge(p.state || {}, p.nextState), relax(p, p.nextState = null);
  next = render(p, i), n = next.length; // XXX use aux stack for all diff mounts called during render so that managed diff mounts happen in order?
  if (!n && c) {while(c) rem(c, p, c = c.sib); unmount()}
  else if (n) {
    if (c) {
      do (n = i.pop(c.temp)) ? n === (n.p = c).temp ? unfill(c) : receive(c, n) : rem(c,p);
      while(c = c.sib); unmount();
      for(i = p.next; i && (n = next.pop());) (c = n.p) ? (i === c ?
        (i = i.sib) : move(c, p, i.prev), n.p = null) : add(n, p, i.prev);
    }
    while(c = add(next.pop(), p, c));
    while(c = stx.pop()) lags.push(c)
  }
}

/* **********
     READ THIS FIRST: This comment is about a "subcycle" technique. I'm not removing this 
     comment because it was a prior train of thought and might be useful. I've skipped this
     and gone ahead implementing rebasing, because I think it is simpler and more intuitive
     compared to subcycles. Note that rebasing can be a major footgun. 
     Managed diffs are for advanced users.
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
    These situations justify being able to circumvent subdiff and perform managed diffs.
*/

let on = 0;
const sidediff = (f, i=0, path=fill(on = 1)) => {
  while(f = path.pop() || lags.pop()) if (f.path === 1) subdiff(f);
  on = 2; while(f = evts[i++]) {
    if (isArr(f)) emit(...f)
    else emit("willRemove", f, f.it, f.prev),
      relax(f, f.state = f.nextState = f.temp = f.affs = f._affs = f.sib = f.it = f.prev = f.effs = null);
  }
  on = evts.length = 0;
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
  return on = 1, t;
}

const rediff = tau => () => sidediff(pop(tau, push))
// XXX should we get rid of nextState and just merge into current state?
//   * well, then there'd be inconsistency between current rendered state and current state
//   * or, we could remove state tracking responsibility from the engine and only schedule
Frame.prototype.diff = function(part, tau=-1){
  if (on > 1) return false;
  if (isFn(part)) part(this.nextState || merge(this.nextState = {}, this.state));
  else this.nextState = this.nextState ? merge(this.nextState, part) : part || {};
  this.path || (tau < 0 ? (on ? fill : sidediff)(push(this)) : excite(this, tau, rediff))
}
// public diff (mount, unmount and update frames)
//   * diff root node, supports virtual/managed diffs for imperative backdooring
module.exports = (t, f, p, s, ps) => {
  let r = false, inDiff = on;
  if (inDiff < 2) try {
    // if updating newly mounted root during diff, don't generate willReceive events
    // TODO: make this readable.
    if (!isArr(t = norm(t))){
      if (!isFrame(f) || f.path === 2) t && ((r = addR(t, p, s)).isRoot = true);
      else if (f.isRoot && (!t || t.name === f.temp.name))
        t ? (t === f.temp || ((r = f)._affN || !f.path ? receive(f, t, push(f)) : (f.temp = t)), s === ps || moveR(r = f, p, s, ps)) :
          unmount(rem(f, isFrame(p) && p, s && (f.prev = s)), r = true);
      (inDiff ? fill : sidediff)();
    }
  } finally { on = inDiff }
  return r;
}
