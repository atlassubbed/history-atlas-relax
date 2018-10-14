const { isArr } = require("./util");
// XXX if removing a root, we can make a microoptimization:
//   * for all c = next(f) called on the subtree of the root:
//     * don't add c to the path unless it's also an affect, since c.temp == null at sidediff time
//   * this is not a worthwhile optimization if we assume that entangle/detangled
//     nodes are sparse in the given forest. we are already assuming this!
//   * this will also force us to distinguish between
//     stepping to children vs. stepping to affects, which leads to increased code
const path = [], stack = [];
/* XXX for stack safety, we acquire overhead to simulate recursion's post ordering
  Note that we could use a more elegant generator to accomplish what next/step accomplishes:

    function* lazy(f, ch){
      if (ch = f.next) yield* ch
      if (ch = f.affs) yield* ch
    };

  Why don't we just do this instead of rolling our own next/step code?
    1. Generators are not optimized in various implementations.
    2. The iterator protocol requires those stupid {done, value} auxiliary objects.

  All of this would add 30-100% more compute overhead to our fill/unfill functions. */

// XXX note that we do not distinguish between entangled and direct children when calling next(f)
//  this means that direct children will ALSO get _affN incr/decr during fill and unfill, respectively.
//  This is NOT necessary, and adds a tiny bit of compute overhead for the sake of brevity.
//  Why is this unnecessary? Because we only need to keep track of the in-degree for
//  perturbations on nodes which take them outside of tree-space; the "biological" parent is implied.
const next = (f, ch, i=f.step++) => (ch=f.next) ? ch[i] || f.affs && f.affs[i-ch.length] : f.affs && f.affs[i]
const unfill = (f, c=stack.push(f)) => {
  while(f = stack.pop()) if (!(--f._affN || (f.inPath = f.isOrig))){
    while(c = next(f)) stack.push(c); f.step = 0;
  }
}
// XXX we could mark nodes as originators in setState, however:
//   * step-leader state would bleed outside of the diff cycle's context
//   * i.e. if a parent updates and memoizes a child with pending state, the child will update early
//     because it was marked as an originator at the time the update was submitted
//   * such "premature" updates would be considered unexpected behavior
// below we mark nodes as originators to ensure they are in the physical path
// and compute a topologically ordered path to diff along
// don't consider nodes that are already in path, removed, or diffed
const fill = (f, t, c) => {
  if (!isArr(f)) f.isOrig = !!stack.push(f);
  else while(c = f.pop()) if(t < 0 || c.temp && c.nextState && c.tau === t) 
    c.isOrig = !!stack.push(c);
  while(t = stack.length) if (!((f = stack[t-1]).inPath && stack.pop())) {
    if (!(c = next(f))) stack.pop().inPath = !(f.step = 0), (f.affN || f.affs || f.isOrig) && path.push(f);
    else if (c.step) throw new Error("cyclic entanglement");
    else stack.push(c), c._affN++;
  }
}

module.exports = { fill, unfill, path }
