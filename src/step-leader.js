const { isArr } = require("./util");
// XXX if removing a root, we can make a microoptimization:
//   * for all step(c) called on the subtree of the root:
//     * don't add c to the path, since c.temp == null at sidediff time
//   * the extra fn calls and/or booleans will counteract any perf gains
//     * it also increases file size and complexity; not worth it
const path = [], stack = [];
// for stack safety, we acquire overhead trying to simulate recursion's post ordering
const next = (f, ch, i=f.step++) => (ch=f.next) ? ch[i] || f._affs && f._affs[i-ch.length] : f._affs && f._affs[i]
const unfill = (f, c=stack.push(f)) => {
  while(f = stack.pop()) if (!(--f._affN || (f.inPath = f.isOrig))){
    while(c = next(f)) stack.push(c); f.step = 0, f._affs = null;
  }
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
  while(t = stack.length) if (!(((f = stack[t-1]).inPath || f.step < 0) && stack.pop())) {
    if (!f.step && f.affs) f._affs = [...f.affs]
    if (!(c = next(f))) stack.pop().inPath = !(f.step = 0), path.push(f);
    else if (c.step > 0) throw new Error("cyclic entanglement");
    else stack.push(c), c._affN++;
  }
}

const touch = (f, t, ch, c) => {
  stack.push(f);
  let orig = [];
  while(f = stack.pop()){
    ch = f.next, c = ch && ch.length, f.step = -1;
    while(c) stack.push(ch[--c]);
    if (ch = f.affs) for (c of ch) orig.push(c);
  }
  fill(orig, t);
}

module.exports = { fill, unfill, touch, path }
