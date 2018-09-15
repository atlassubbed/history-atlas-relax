const { isArr } = require("./util");

let epoch = 0, path = [];

// XXX if removing a root, we can make a microoptimization:
//   * for all step(c) called on the subtree of the root:
//     * don't add c to the path
//     * since c.temp == null guaranteed at sidediff time
//   * the extra fn calls and/or booleans will counteract any perf gains
//     * it also increases file size and complexity; not worth it
const step = f => {
  if (f.inStep)
    throw new Error("cyclic entanglement");
  f.inStep = true;
  const ch = f.children, af = f.affects, id = f.id;
  if (ch){
    let cN = ch.length, c;
    while(cN--) (c = ch[cN]).epoch < epoch && step(c);
  }
  if (af){
    let aN = af.length, refs, c;
    f.affects = null;
    while(aN--){
      if ((refs = (c = af[aN]).affs) && refs[id]){
        (f.affects = f.affects || []).push(c)
        c.epoch < epoch && step(c);
      }
    }
  }
  f.inStep = !(f.epoch = epoch);
  path.push(f)
}

// compute a topologically ordered path to diff along
// don't consider nodes that have
//   * already been considered
//   * already been diffed or removed
const fillPath = (f, tau, c) => {
  if (++epoch && !isArr(f)) return step(f);
  if (tau < 0) while(c = f.pop()) c.epoch < epoch && step(c);
  else while(c = f.pop())
    c.temp && c.epoch < epoch && 
    c.nextState && c.tau === tau && step(c);
}

module.exports = { fillPath, path }
