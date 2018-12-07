const { pop } = require("./field");

const path = [], stack = [];

// for stack safety, we acquire overhead trying to simulate recursion's post ordering
const next = (f, i=f.step++) => i ? f.it ?
  (f.it = f.it.sib) || f._affs && f._affs[(f.step = 1)-1] :
  f._affs[i] : (f.it = f.next) || f._affs && f._affs[i];

const mark = (f, c, i, ch) => {
  while(i = stack.length) if (!(((f = stack[i-1]).inPath || f.step < 0) && stack.pop())) {
    if (!f.step && f.affs) for (c of (ch = f._affs = [], f.affs)) c.temp ? ch.push(c) : c.unsub(f);
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
// XXX we could mark nodes as originators in frame.diff, however:
//   * step-leader state would bleed outside of the diff cycle's context
//   * i.e. if a parent updates and memoizes a child with pending state, the child will update early
//   * such "premature" updates would be considered unexpected behavior
// below we mark nodes as originators to ensure they are in the physical path
// and compute a topologically ordered path to diff along
const fill = (f, tau) => {
  if (f) f.isOrig = !!stack.push(f);
  else while(f = pop(tau)) f.isOrig = !!stack.push(f);
  mark()
}
const refill = (f, ch, c) => {
  path.push(f);
  while(f = path.pop()){
    if (f.step = -1, c = f.next) do path.push(c); while(c = c.sib)
    if (ch = f.affs) for (c of ch) c.isOrig = !!stack.push(c);
  }
  mark();
}

module.exports = { fill, refill, unmark, path }
