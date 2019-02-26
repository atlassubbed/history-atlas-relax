const { isArr, norm, isFn, sib } = require("./util")
const Frame = require("./Frame"), { isFrame } = Frame;
const { fill, push } = require("./step-leader");
const { link, unlink } = require("./seg-list");
const { relax, excite, pop } = require("./field")
const KeyIndex = require("./KeyIndex");
const thread = require("./thread");

/* Diff cycles, Subcycles & Rebasing:
   TLDR: 
     A diff cycle is an update cycle where a sequence of render(...) functions are called,
     which produce mutations, which are flushed out to event listeners. When the 
     diff cycle is complete, the graph is in its updated state, and a new diff cycle may be executed
     to repeat this process.

     Diff cycles can be extended with additional synchronous work. The semantics for
     initializing and extending diff cycles are identical -- via inner or outer diffs.
     If you extend the current diff cycle before flush, it's called rebasing. 
     If you extend it after flush, you add an additional subcycle to the diff cycle.

   History:
     Well before developing the diff cycle, I just used recursion, since recursion is easy
     and it is very concise. Recursion was being used pretty much everywhere. Recursion is
     not a final solution because it leads to stack overflows for large lateral and deep updates.
     Many branches ago, I replaced every recursive call with a manual stack implementation.
     At that point, the concept of a diff cycle was pretty basic:

       |----fill----|----render/emit mutations----|

     Before implementing rebasing + sucycles, this framework didn't allow performing diffs
     during other diffs. I always intended to make this possible since the conception of this library,
     as being able to diff during a diff is a powerful feature that allows us to:
       * opt-out of component tree structure
       * create side-effects and other reactive junk without polluting the main app tree
         * e.g. higher order components pollute the main application tree hierarchy
         * this solution naturally allows for "sideways" data storage, dependencies, etc.
       * encompass entire trees within other trees
       * perform imperative, managed diffs for cases where O(N) subdiffing is undesired
       * split state into orthogonal oscillators
       * batch updates with managed diffs (splitting up work over diff cycles)
       * create "portals" so that the application tree can inject components in other places
       * schedule alternative work to override current work
       * schedule work asynchronously in a new diff cycle
       * rebase orthogonal work synchronously into the current diff cycle
       * rebase work synchronously into the current cycle after flushing mutations
       * etc.

     Defining diffs during diffs is an essential aspect to this framework and allows us to create
     a single abstraction (inner/outer diffs) for pretty much everything we would wanna do to build
     complex applications. The basic idea is that when you call diff(...) inside of a render(...),
     we want to seamlessly, intuitively queue the work into a diff cycle.

     There is plenty of ambiguity, here. Which diff cycle do we add the work to? 
     The current one? That would require being able to "rebase" work onto the existing diff path. 
     The next one? That would require being able to merge diff calls on a single node properly.
     I spent a long time thinking that only one of these solutions was necessary.
     
     Turns out, rebasing was nearly already implemented in the existing abstraction.
     It's just a special case of fill(...) where the path is non-empty.

     Eventually, I realized that emitting mutations during render wasn't going to work for 
     diffs during diffs (rebasing), so I changed the diff cycle to to:

       |----fill----|----render/queue mutations/rebase more renders----|----emit mutations----|

     At that point, I was just blindly queueing mutations in an array and flushing the array
     in the emit stage. This lead to potential unbounded memory usage for rebases, so I
     had to implement a data structure (thread.js) to properly merge obsolete/redundant events,
     guaranteeing O(N) memory regardless of how many rebases were being done.
     
     I spent a long time thinking subcycles were unecessary after I got rebasing working.
     I had deprecated rendered(...) and cleanup(...) lifecycle methods beforehand so that rebasing
     was easier to implement. Render() alone does not obviously span the set of lifecycle methods:
       * beforeMount  (render)
       * beforeUpdate (render)
       * duringMount  (render)
       * duringUpdate (render)
       * afterMount   (rendered)
       * afterUpdate  (rendered)
       * willUnmount  (cleanup)
     Eventually I'd need to re-introduce the other methods. Actually, rebasing allows us
     to simulate rendered() and cleanup() by mounting an auxiliary frame during render(), then
     subbing the auxiliary frame to the owner of render(). The auxliary frame's render()
     then acts as rendered() or cleanup() depending on if the affector's temp is null.
     We achieve these methods with purely the render() if we extend our domain to two diff cycles
     (as scheduling the aux frame to run post-flush would end up requiring a second diff cycle).
     This is a really hacky solution, and it never satisfied me.

     Since I also wanted to implement context tracking (remembering aux parents/children), this
     hacky solution would no longer be feasible, since auxiliary frames automatically
     get unmounted when their environment unmounts (rendering cleanup() impossible). 
     This automatic cleanup prevents every single frame from being
     forced to manually cleanup their manual, unmanaged child frames on unmount.

     Up until that point, I thought subcycles were completely unecessary. 
     Turns out that in order to bring back rendered() such that it supports inner and outer diffing,
     we could just implement subcycles. The goal is to be able to run rendered() after flush.
     Subcycles are a natural way to do that.

     And so, the diff loop as of right now makes a distinction between diffing (during a diff)
     before (rebasing) and after (subcycles) flush. If you keep rebasing before flush,
     you will indefinitely postpone the flush. If you keep rebasing work after flush,
     you will allow flush to execute before the extra work is processed:

                         A
       |----fill----|----.----|----emit mutations----|----rendered/rebase----|----go to A----|
                         |
                         render/queue mutations/rebase/cleanup

   Architecture:
     Every diff consists of a sequence of synchronous subcycles. 
     Each subcycle is cycle-safe only within itself.

                            time ->
     diff cycle:
       |-fill--subcycle1--subcycle2--subcycle3-...-subcycleN-|
          |
          populate initial path for first subcycle.

       N >= 1
        
     subcycle:
       |-render--flush-|
           |      |  
           |      synchronize effects after all computations finished
           |        * emit ALL removals before ANY adds
           |        * thus effects can recycle resources at a subcycle-level
           |          as opposed to only at the subdiff-level
           run all computations
             * queue up mounts as laggards
               thus every new mount is guaranteed to have latest state
             * rebase work to extend this render phase. */

// auxiliary stacks/sets
//   * lags: "laggards", accumulation of to-be-mounted nodes after the path exhausts
//   * orph: "orphans", emphemral stack used for unmounting nodes immediately
//   * stx:  "stack", all-purpose auxiliary stack used for re-ordering
//   * post: "post flush", queue up nodes that have rendered methods
// magic numbers
//   global state: on in {0: not in diff, 1: in diff, can diff, 2: in diff, cannot diff}
//   local state: node.path in {0: not in path, 1: in path, 2: will remove} 
const lags = [], orph = [], stx = [], post = [], clear = [];

// flatten and sanitize a frame's next children
//   * ix is an optional KeyIndex
const clean = (t, ix, next=[]) => {
  stx.push(t);
  while(stx.length) if (t = norm(stx.pop()))
    if (isArr(t)) for (t of t) stx.push(t);
    else next.push(t), ix && ix.push(t);
  return next
}

// mutation methods for subdiffs and rootdiffs (R)
const add = (t, p, s, isRoot) => {
  if (t){
    t = node(t, p, isRoot), p = t.parent;
    t.evt && thread.add(t, p, s)
    p && link(t, p, s);
    isRoot ? lags.push(t) : stx.push(t);
    return t;
  }
}
const move = (f, p, s, ps=sib(f.prev)) => {
  f.evt && thread.move(f, p, s, ps)
  unlink(f, p, f.prev), link(f, p, s);
}
const receive = (f, t) => {
  f.evt && thread.receive(f);
  f.temp = t;
}

let on = 0, ctx = null;
// unmount several queued nodes
//   * we do this outside of the path loop since unmounts are immediate
const unmount = (f, isRoot, c, inDiff=on) => {
  while(f = orph.pop()) {
    if (f.cleanup) clear.push(f);
    if (isRoot && (c = f.affs)) for (c of c) push(c);
    if (c = f.parent, f.evt) thread.remove(f, c);
    c && c.path > -2 && unlink(f, c, f.prev), f.path = -2;
    // XXX could queue a cleanup function or render(null, node) in the path
    //   or we could find a way to automatically clean up resources on unmount
    if (c = f.next) do orph.push(c); while(c = c.sib);
    if (c = f.next) while(c = c.prev) orph.push(c);
    relax(f, f.temp = f.affs = f._affs = f.sib = f.parent = f.prev = f.next = f.hook = null)
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
const sidediff = (c, path=fill(on = 1), raw) => {
  do {
    if (ctx = path.pop() || lags.pop()){
      if (!ctx.path) {
        if (c = ctx._affs) {
          for (c of c) --c._affN || (c.path = 0);
          ctx._affs = null;
        }
      } else if (ctx.path > -2) {
        if (relax(ctx), ctx.path = 0, c = ctx._affN)
          ctx._affN = 0, ctx._affs = null;
        // XXX should get a ref to the temp here instead of below as it can change during render
        raw = ctx.render(ctx.temp, ctx, !c)
        if (ctx.path > -2){
          if (ctx.rendered)
            (ctx.hook = ctx.hook || (post.push(ctx), {f: !c})).t = ctx.temp;
          sib(c = ctx.next) ?
            c.root || subdiff(ctx, c, raw) :
            mount(ctx, clean(raw));
        }
      }
    } else {
      on = 2, thread.flush(c=0);
      if (!post.length && !clear.length) return on = 0, ctx = null;
      while (ctx = clear[c++]) ctx.cleanup && ctx.cleanup(ctx);
      on = 1, clear.length = 0;
      while(ctx = post.pop()) if (c = ctx.hook) {
        ctx.rendered && ctx.rendered(c.t, ctx, c.f), ctx.hook = null;
      }
    }
  } while(1);
}
// temp is already normalized
const node = (t, p, isRoot, isF=isFrame(p), effs=isF ? p.evt && p.evt.effs : p && p.effs) => {
  on = 2;
  if (!isFn(t.name)) t = new Frame(t, effs);
  else {
    const Sub = t.name;
    if (isFrame(Sub.prototype)) t = new Sub(t, effs);
    else t = new Frame(t, effs), t.render = Sub;
  }
  if (isRoot) t.root = 1 + !isF;
  t.parent = isF ? p : ctx;
  return on = 1, t;
}
// TODO for inner and outer diffs:
//   use errors instead of returning false for unallowed operations
//   requires rock-solid error handling
const rediff = tau => () => sidediff(pop(tau, push))
// XXX should inner diff return false if node-to-be-diffed is already in path?
//     or, should we return true and short-circuit excite/fill?
// XXX if unmounted or in path and sync, return false, else fill/excite return true
//     don't need to check if is mounting, should work...
//     then, we can deprecate checking isFirst everywhere.
// instance (inner) diff (schedule updates for frames)
Frame.prototype.diff = function(tau=-1){
  if (on > 1 || this.path < -1) return false;
  tau < 0 ? (on ? fill : sidediff)(push(this)) : excite(this, tau, rediff);
  return true;
}
// public (outer) diff (mount, unmount and update frames)
//   * diff root node, supports virtual/managed diffs for imperative backdooring
module.exports = (t, f, p=f&&f.prev, s) => {
  let r = false, inDiff = on, context = ctx;
  if (inDiff < 2) try {
    if (!isArr(t = norm(t))){
      if (!isFrame(f) || f.path < -1){
        if (t && (!s || s.parent === p)) r = add(t, p, sib(s), 1)
      } else if (f.root){
        if (t && t.name === f.temp.name) {
          if (t !== f.temp) receive(r = f, t, push(f));
          if (sib(f) && isFrame(s = f.parent) && (!p || p.parent === s)){
            (p = sib(p)) === (s = sib(f.prev)) || move(r = f, f.parent, p, s);
          }
        } else if (!t) unmount(orph.push(f), r = true);
      }
      (inDiff ? fill : sidediff)();
    }
  } finally { on = inDiff, ctx = context }
  return r;
}
