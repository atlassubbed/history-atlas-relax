const path = [], stx = [];

// "step-leader" is a sequence of nodes that defines a potential "strike" path of a diff
//   * data structure: stack of nodes
//   * nodes added to the step leader are candidates for a diff "strike"
//   * they do not necessarily get diffed
//   * whether or not a node gets diffed is impossible to know before executing the full diff
//   * the leader is stored in the "path" stack, "stx" is used as an auxiliary stack

// for stack safety, we acquire overhead trying to simulate recursion's post ordering
const next = (f, i=f.step++) => i ? f.it ?
  (f.it = f.it.sib) || f._affs && f._affs[(f.step = 1)-1] :
  f._affs[i] : (f.it = f.next) || f._affs && f._affs[i];

// compute a topologically ordered potential path to diff along
const fill = (f, c, i, ch) => {
  while(i = stx.length) if (!(((f = stx[i-1]).inPath || !f.temp) && stx.pop())) {
    if (!f.step && f.affs) for (c of (ch = f._affs = [], f.affs)) c.temp ? ch.push(c) : c.unsub(f);
    if (!(c = next(f))) stx.pop().inPath = !(f.step = 0), path.push(f);
    else if (!c.step) c.inPath || stx.push(c), c._affN++;
    else throw new Error("cyclic entanglement");
  }
  return path;
}

// remove a subtree from the path
const unfill = (f, c=stx.push(f)) => {
  while(f = stx.pop()) if (!(--f._affN || (f.inPath = f.isOrig))){
    while(c = next(f)) stx.push(c); f.step = 0, f._affs = null;
  }
}
// XXX we could push nodes as originators in frame.diff, however:
//   * path state would bleed outside of the diff cycle's context
//   * i.e. if a parent updates and memoizes a child with pending state, the child will update early
//   * such "premature" updates would be considered unexpected behavior
// below we push nodes as originators to ensure they are in the physical path
const push = f => f.isOrig = !!stx.push(f)

module.exports = { unfill, fill, push }
