const { isArr } = require("./util");
// XXX if removing a root, we can make a microoptimization:
//   * for all step(c) called on the subtree of the root:
//     * don't add c to the path, since c.temp == null at sidediff time
//   * the extra fn calls and/or booleans will counteract any perf gains
//     * it also increases file size and complexity; not worth it
const path = [];
const add = (f, ch) => {
  if (f.inStep) throw new Error("cyclic entanglement");
  f.inStep = true
  if (ch = f.next) for (let c of ch) 
    c.inPath || add(c);
  if (ch = f.affs) for (let c of ch) 
    c._affCount++, c.inPath || add(c);
  f.inPath = !(f.inStep = false);
  if (f.affCount || f.affs || f.isOrig) path.push(f)
}
const rem = (f, ch) => {
  if (f.inPath = f.isOrig) return;
  if (ch = f.next) for (let c of ch) 
    c._affCount || c.inPath && rem(c);
  if (ch = f.affs) for (let c of ch) 
    --c._affCount || c.inPath && rem(c);
}

const unfill = f => f._affCount || rem(f);
// compute a topologically ordered path to diff along
// don't consider nodes that are in path, removed, or diffed
const fill = (f, tau, c) => {
  if (!isArr(f)) return f.isOrig = true, add(f);
  // XXX we could save energy and mark nodes as originators in setState, however:
  //   * step-leader state would bleed outside of the diff cycle's context
  //   * i.e. if a parent updates and memoizes a child with pending state, the child will update early
  //   * such "premature" updates would be considered unexpected behavior
  // below we mark nodes as originators to ensure they are in the physical path
  for (let c of f) c.isOrig = true;
  if (tau < 0) while(c = f.pop()) c.inPath || add(c);
  else while(c = f.pop()) c.inPath || c.temp && c.nextState && c.tau === tau && add(c);
}

module.exports = { fill, unfill, path }
