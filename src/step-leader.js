const { isArr } = require("./util");
// XXX if removing a root, we can make a microoptimization:
//   * for all step(c) called on the subtree of the root:
//     * don't add c to the path, since c.temp == null at sidediff time
//   * the extra fn calls and/or booleans will counteract any perf gains
//     * it also increases file size and complexity; not worth it
const path = [], stack = [];
// for stack safety, we acquire overhead trying to simulate recursion's post ordering
function* lazy(f, c){
  if(c = f.next) yield* c
  if(c = f.affs) yield* c
}
const unfill = (f, c=stack.push(f)) => {
  while(f = stack.pop()) if (!(--f._affN || (f.inPath = f.isOrig)))
    for (f = lazy(f); c = f.next().value;) stack.push(c);
}
// XXX we could mark nodes as originators in setState, however:
//   * step-leader state would bleed outside of the diff cycle's context
//   * i.e. if a parent updates and memoizes a child with pending state, the child will update early
//   * such "premature" updates would be considered unexpected behavior
// below we mark nodes as originators to ensure they are in the physical path
// and compute a topologically ordered path to diff along
// don't consider nodes that are in path, removed, or diffed
const fill = (f, t, c) => {
  if (!isArr(f)) f.isOrig = !!stack.push(f);
  else while(c = f.pop()) if(t < 0 || c.temp && c.nextState && c.tau === t) 
    c.isOrig = !!stack.push(c);
  while(t = stack.length) if (!((f = stack[t-1]).inPath && stack.pop()))
    if (!(c = (f.step || (f.step = lazy(f))).next().value))
      stack.pop().inPath = !(f.step = 0), (f.affN || f.affs || f.isOrig) && path.push(f);
    else if (c.step) throw new Error("cyclic entanglement");
    else stack.push(c), c._affN++;
}

module.exports = { fill, unfill, path }
