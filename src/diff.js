const { isVoid, isArr, norm, applyState, clean } = require("./util")
const { Frame: { isFrame } } = require("./Frame");
const { path, fill, unfill } = require("./step-leader");
const { emit, push, sub, pop, receive, add } = require("./lifecycle");
const { hops } = require("./entangle");

/* diff "downwards" from a frame, short circuit the edge cases:
     1. next === prev === 0   trivial
     2. next > 0, prev === 0     "
     3. next === 0, prev > 0     "
     4. next === prev > 0     nontrivial
     5. next > prev > 0          "
     6. next < prev > 0          "        */
const subdiff = (f, t) => {
  emit("willUpdate", f), t = f.temp, applyState(f);
  let p, prev, P = (prev = f.next) ? prev.length : 0, 
      next, N = (next = clean([f.diff(t.data, t.next)])).length;
  if (P || N) if (!N){ // double if guards entire decision tree against case 1
    f.next = null
    while(p = prev.pop()) pop(p, f);
  } else {
    let n, effs = f.effs, tau = f.tau;
    if (!P){
      f.next = [];
      while(n = next.pop()) defer(push(n, effs, tau, f));
    } else {
      // nontrivial cases 4-6, requires explicit/implicit key and pos tables
      // this implementation will be simpler if we use an LCRS tree
      // XXX should we force effects to use LCRS, or make it agnostic?
      //   what's better? LCRS & insertBefore/after vs. Arrays & swaps
      //   the former is semantically closer to the DOM target, for example
      let exp = {}, imp = {}, pos = new WeakMap, i = P, k;
      while(i--) p = prev[i], t = p.temp, pos.set(p, i),
        (k=t.key) && !exp[k] ? (exp[k]=p) : (imp[k=t.name]=imp[k]||[]).push(p);
      while(n = next.pop(++i)){
        if (!(p = prev[i])) defer(push(n, effs, tau, f));
        else if (n === p.temp) unfill(p);
        else if (n.name !== p.temp.name) defer(sub(n, effs, tau, p, f, i));
        else if (receive(n,p) && !(p.affCount||p.affs)) subdiff(p), end(p)
      }
      while(P > N) pop(prev.pop(P--), f);
    }
  }
}

// diff "sideways" along the calculated path
//   * initially used call stack; led to overflows for lateral updates
//   * htap is "path" in reverse, we don't need it to avoid .reverse(), but we avoid .length = 0
const lags = [], htap = [];
const sidediff = f => {
  while(f = path.pop()) if (f.temp && f.inPath) htap.push(f), subdiff(f);
  while(f = lags.pop()) add(f);
  while(f = htap.pop()) end(f);
  while(f = hops.pop()) {
    for (let [c, t] of f._affs)
      t ? c.entangle(f) : c.detangle(f);
    f._affs = null;
  }
}
const end = f => emit("didUpdate", f, f._affCount =+ (f.isOrig = f.inPath = false))
const defer = f => (path.length ? lags.push(f) : add(f), f);
const rediff = (f, tau=-1) => {fill(f, tau), sidediff()};
// public diff (mount, unmount and update frames)
const diff = (t, f, effs, tau=-1) => {
  if (isArr(t = norm(t))) return false;
  if (!isFrame(f) || !f.temp) 
    return !!t && defer(push(t, effs, tau));
  if (!f.isRoot || t === f.temp) return false;
  fill(f);
  if (!t) return !sidediff(pop(f));
  if (t.name === f.temp.name) receive(t, f);
  else f = defer(sub(t, effs || f.effs, tau, f));
  return sidediff(), f;
}

module.exports = { diff, rediff }
