const { isArr } = require("./util");
// XXX if removing a root, we can make a microoptimization:
//   * for all step(c) called on the subtree of the root:
//     * don't add c to the path, since c.temp == null at sidediff time
//   * the extra fn calls and/or booleans will counteract any perf gains
//     * it also increases file size and complexity; not worth it
const path = [];
const push = (f, ch) => {
  if (f.inStep) throw new Error("cyclic entanglement");
  f.inStep = true
  if (ch = f.next) for (let c of ch) 
    c.inPath || push(c);
  if (ch = f.affs) for (let c of ch) 
    c._affCount++, c.inPath || push(c);
  f.inPath = !(f.inStep = false);
  if (f.affCount || f.affs || f.isOrig) path.push(f)
}
// remove f's influence on the path
const pluck = (f, ch) => {
  if (f.inPath = f.isOrig) return;
  if (ch = f.next) for (let c of ch) 
    c._affCount || c.inPath && pluck(c);
  if (ch = f.affs) for (let c of ch) 
    --c._affCount || c.inPath && pluck(c);
}
// compute a topologically ordered path to diff along
// don't consider nodes that are in path, removed, or diffed
const fill = (f, tau, c) => {
  if (!isArr(f)) return f.isOrig = true, push(f);
  if (tau < 0) while(c = f.pop())
    c.isOrig = true, c.inPath || push(c);
  else while(c = f.pop())
    c.isOrig = true, c.inPath || c.temp && c.nextState && c.tau === tau && push(c);
}

module.exports = { fill, pluck, path }
