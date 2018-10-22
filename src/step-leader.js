const { isArr } = require("./util");
const path = [], stack = [];
// for stack safety, we acquire overhead trying to simulate recursion's post ordering
const next = (f, ch, i=f.step++) => (ch=f.next) ? ch[i] || f._affs && f._affs[i-ch.length] : f._affs && f._affs[i]
const mark = (f, c, i) => {
  while(i = stack.length) if (!(((f = stack[i-1]).inPath || f.step < 0) && stack.pop())) {
    if (!f.step && f.affs) f._affs = [...f.affs]
    if (!(c = next(f))) stack.pop().inPath = !(f.step = 0), path.push(f);
    else if (!c.step) c.inPath || stack.push(c), c._affN++;
    else if (c.step > 0) throw new Error("cyclic entanglement");
  }
}
const unmark = (f, c=stack.push(f)) => {
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
const fill = (f, tau=-1, c) => {
  if (!isArr(f)) f.isOrig = !!stack.push(f);
  else while(c = f.pop()) if(tau < 0 || c.temp && c.nextState && c.tau === tau) 
    c.isOrig = !!stack.push(c);
  mark();
}
const refill = (f, ch, c) => {
  path.push(f);
  while(f = path.pop()){
    ch = f.next, c = ch && ch.length, f.step = -1;
    while(c) path.push(ch[--c]);
    if (ch = f.affs && f.affs.values())
      while(c = ch.next().value) c.isOrig = !!stack.push(c);
  }
  mark();
}

module.exports = { fill, refill, unmark, path }
