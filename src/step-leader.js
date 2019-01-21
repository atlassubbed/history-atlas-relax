const path = [], stx = [];

// "step-leader" is a sequence of nodes that defines a potential "strike" path of a diff
//   * data structure: stack of nodes
//   * nodes added to the step leader are candidates for a diff "strike"
//   * they do not necessarily get diffed
//   * whether or not a node gets diffed is impossible to know before executing the full diff
//   * the leader is stored in the "path" stack, "stx" is used as an auxiliary stack

// XXX simplify next(...) so that we don't need both step and it.
// for stack safety, we acquire overhead trying to simulate recursion's post ordering
const next = (f, i=f.step++) => i ?
  f.it ? (f.it = f.it.sib) || f._affs && f._affs[(f.step = 1)-1] : f._affs[i] :
  (f.it = f.next) || f._affs && f._affs[i];

// compute a topologically ordered potential path to diff along
const fill = (f, c, i, ch) => {
  while(i = stx.length) if (!((f = stx[i-1]).path && stx.pop())) {
    if (!f.step && f.affs) for (c of (ch = f._affs = [], f.affs)) 
      c.path < 2 ? ch.push(c) : c.unsub(f);
    // XXX consider setting _affs to null here
    if (!(c = next(f))) stx.pop().path = 1, f.step = 0, path.push(f);
    else if (!c.step) c.path || stx.push(c), c._affN++;
    else throw new Error("cyclic entanglement");
  }
  return path;
}

// TODO do this in sidediff? 
//   * when memo, instead of unfill, just --f._affN, etc. on the node in question
//   * when we reach the node in the path, if path is false, --f._affN, etc. to all children/affects
// remove a subtree from the path
// TODO: don't use next() here and just go through the lists manually to avoid f.step/f.it
const unfill = (f, c=stx.push(f)) => {
  while(f = stx.pop()) if (!--f._affN){
    // XXX we shouldn't have to set step/_affs to init values here
    while(c = next(f)) stx.push(c); f.path = f.step = 0, f._affs = null;
  }
}
// XXX we could push nodes as originators in frame.diff, however:
//   * path state would bleed outside of the diff cycle's context
//   * i.e. if a parent updates and memoizes a child with pending state, the child will update early
//   * such "premature" updates would be considered unexpected behavior
// below we push nodes as originators to ensure they are in the physical path
const push = f => {++f._affN, stx.push(f)}

module.exports = { unfill, fill, push }
