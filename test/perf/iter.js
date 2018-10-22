const { Forest, Graph, hasCycles, hasDupes, isOrdered, isVanilla } = require("./kahn");
const { shuffle, int, sample } = require("atlas-random");
const { Timer } = require("atlas-basic-timer");
const { expect } = require("chai");

// in any case, we will have to do "fill" or "mark" (almost the same thing)
// regardless of whether we use kahns or not
//   however, we may avoid incrementing in-degree on direct children with dfs
// the advantage of kahn is that we don't fill or iterate nodes that may be removed or memoized
//   this could save us tons of work during sidediff, but these simple tests are not sufficient to prove that
// these tests are POC that kahns may be viable

const timer = Timer({d: 3})
const next = (f, ch, i=f.step++) => (ch=f.next) ? ch[i] || f._affs && f._affs[i-ch.length] : f._affs && f._affs[i]
// mark nodes' in-degree, snapshot affs, add only pure originator nodes to path
// this must be post-order because kahn is not graceful when detecting cycles
const mark = f => {
  let path = [], stack = [...f], c, t = f.length;
  while(t = stack.length) if (!((c = stack[t-1]).inPath && stack.pop())) {
    if (!c.step && c.affs) c._affs = [...c.affs];
    if (!(t = next(c))) stack.pop().inPath = !(c.step = 0);
    else if (t.step) throw new Error("cyclic entanglement");
    else t.inPath || stack.push(t), t._affN++;
  }
  t = f.length;
  while(t) (c = f[--t]).isOrig = true, c._affN || path.push(c);
  return path;
}
// mark nodes' in-degree, snapshot affs, and add all nodes to path in post-order
const fill = f => {
  let path = [], stack = [], c, t = f.length;
  while(t) (c = f[--t]).isOrig = !!stack.push(c);
  while(t = stack.length) if (!((c = stack[t-1]).inPath && stack.pop())) {
    if (!c.step && c.affs) c._affs = [...c.affs];
    if (!(t = next(c))) stack.pop().inPath = !(c.step = 0), path.push(c);
    else if (t.step) throw new Error("cyclic entanglement");
    else t.inPath || stack.push(t), t._affN++;
  }
  return path;
}

const kahn = orig => {
  let htap = [], f, t;
  orig = mark(orig);
  while(f = orig.pop()){
    htap.push(f);
    while(t = next(f)) --t._affN || orig.push(t);
  }
  while(f = htap.pop())
    f.inPath = f.isOrig = false, f._affs = null, f.step = 0;
}

const dfs = orig => {
  let htap = [], f;
  orig = fill(orig);
  while(f = orig.pop()) htap.push(f);
  while(f = htap.pop())
    f.inPath = f.isOrig = false, f._affs = null, f._affN = 0;
}


const forest = new Forest(1e4, 5, 3)
forest.perturb(1/1e2)
const originators = sample(forest.nodes, 1e2);

const kahnTest = () => kahn(originators);
const dfsTest = () => dfs(originators)

timer(kahnTest, 1e2);
timer(dfsTest, 1e2)
timer(kahnTest, 1e2);
timer(dfsTest, 1e2)
timer(kahnTest, 1e2);
timer(dfsTest, 1e2)
