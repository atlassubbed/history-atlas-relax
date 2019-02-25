const path = [], stx = [];

// "step-leader" is a sequence of nodes that defines a potential "strike" path of a diff
//   * data structure: stack of nodes
//   * nodes added to the step leader are candidates for a diff "strike"
//   * they do not necessarily get diffed
//   * whether or not a node gets diffed is impossible to know before executing the full diff
//   * the leader is stored in the "path" stack, "stx" is used as an auxiliary stack

// for stack safety, we acquire overhead trying to simulate recursion's post ordering
// compute a topologically ordered potential path to diff along
const fill = (f, i, ch) => {
  while(i = stx.length) if (!((f = stx[i-1]).path < 0 && stx.pop())) {
    if (!f.path && (((i = f.next) && !i.root) || f.affs)){
      if (ch = f._affs = [], i && !i.root) do ch.push(i); while(i = i.sib);
      if (i = f.affs) for (i of i) i.path > -2 ? ch.push(i) : i.unsub(f);
      f.path = ch.length+1;
    }
    if (--f.path <= 0) stx.pop().path = -1, path.push(f);
    else if ((i = f._affs[f.path-1]).path <= 0) push(i)
    else throw new Error("cyclic entanglement");
  }
  return path;
}

// XXX we could push nodes as originators in frame.diff, however:
//   * path state would bleed outside of the diff cycle's context
//   * i.e. if a parent updates and memoizes a child with pending state, the child will update early
//   * such "premature" updates would be considered unexpected behavior
// below we push nodes as originators to ensure they are in the physical path
const push = f => {
  // note we mustn't incr _affN for laggards
  if ((!f.path && stx.push(f)) || f._affN) ++f._affN
}

module.exports = { fill, push }
