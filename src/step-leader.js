const path = [], stx = [];

// "step-leader" is a sequence of nodes that defines a potential "strike" path of a diff
//   * data structure: stack of nodes
//   * nodes added to the step leader are candidates for a diff "strike"
//   * they do not necessarily get diffed
//   * whether or not a node gets diffed is impossible to know before executing the full diff
//   * the leader is stored in the "path" stack, "stx" is used as an auxiliary stack

// for stack safety, we acquire overhead trying to simulate recursion's post ordering
// compute a topologically ordered potential path to diff along
const fill = (f, c, i, ch) => {
  while(i = stx.length) if (!((f = stx[i-1]).path < 0 && stx.pop())) {
    if (!f.path && (f.next || f.affs)){
      if (ch = f._affs = [], c = f.next) do ch.push(c); while(c = c.sib);
      if (c = f.affs) for (c of c) c.path > -2 ? ch.push(c) : c.unsub(f);
    }
    if (!(c = f._affs && f._affs[f.path++]))
      stx.pop().path = -1, path.push(f);
    else if (c.path <= 0) c.path || stx.push(c), c._affN++;
    else throw new Error("cyclic entanglement");
  }
  return path;
}

// XXX we could push nodes as originators in frame.diff, however:
//   * path state would bleed outside of the diff cycle's context
//   * i.e. if a parent updates and memoizes a child with pending state, the child will update early
//   * such "premature" updates would be considered unexpected behavior
// below we push nodes as originators to ensure they are in the physical path
const push = f => {++f._affN, stx.push(f)}

module.exports = { fill, push }
