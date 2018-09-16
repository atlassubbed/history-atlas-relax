const { isArr } = require("./util");

let epoch = 0, path = [];

// XXX if removing a root, we can make a microoptimization:
//   * for all step(c) called on the subtree of the root:
//     * don't add c to the path, since c.temp == null at sidediff time
//   * the extra fn calls and/or booleans will counteract any perf gains
//     * it also increases file size and complexity; not worth it
const step = f => {
  if (f.inStep)
    throw new Error("cyclic entanglement");
  f.inStep = true;
  let ch = f.next
  if (ch){
    let cN = ch.length, c;
    while(cN--) (c = ch[cN]).epoch < epoch && step(c);
  }
  if (ch = f.affs) for (let c of ch) 
    c.epoch < epoch && step(c);
  f.inStep = !(f.epoch = epoch);
  path.push(f)
}

// compute a topologically ordered path to diff along
// don't consider nodes that are in path, removed, or diffed
const fillPath = (f, tau, c) => {
  if (++epoch && !isArr(f)) return step(f);
  if (tau < 0) while(c = f.pop()) c.epoch < epoch && step(c);
  else while(c = f.pop())
    c.temp && c.epoch < epoch && 
    c.nextState && c.tau === tau && step(c);
}

module.exports = { fillPath, path }
