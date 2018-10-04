const { isArr, norm, clean } = require("./util")
const { Frame: { isFrame }, applyState, emit } = require("./Frame");
const { path, fill, unfill } = require("./step-leader");
const { push, receive, swap, pop } = require("./mutations");
const { hops } = require("./entangle");
const KeyIndex = require("./KeyIndex")

/* Should be noted that the following functions take similar time
   to insert e into x at i:

     const insert = (x, e, i) => x.splice(i, 0, e);

     const bubble = (x, e, i) => {
       let j = x.push(e), s;
       while(--j > i){
         s = x[j], x[j] = x[j-1];
         x[j-1] = s;
       }
     }

   However, we represent permutations as a series of swaps rather than insertions,
   so we avoid the quadtric term that we run into with m ~ n insertions.
   Doing n swaps likely adds constant overhead compared to doing a splice,
   but it's better to acquire that overhead since most updates require > 1 swaps */

const lags = [], htap = [], ladd = lags.push.bind(lags);

const add = (f, t) => {
  htap.push(f), t = f.temp;
  if ((t = clean([f.diff(t.data, t.next)])).length){
    f.next = [];
    let tau = f.tau, effs = f.effs, n;
    while(n=t.pop()) add(push(n, effs, tau, f))
  }
}

// diff "downwards" from a frame, short circuit if next or prev have zero elements
const subdiff = (f, t) => {
  emit("willUpdate", f), htap.push(f), t = f.temp, applyState(f);
  let prev, P = (prev = f.next) ? prev.length : 0,
      next, N = (next = clean([f.diff(t.data, t.next)])).length;
  if (P || N) if (!N){
    while(P--) pop(prev[P], f);
    f.next = null
  } else {
    let n, effs = f.effs, tau = f.tau;
    if (!P){
      f.next = [];
      while(n = next.pop()) mount(n, effs, tau, f);
    } else {
      let ix = new KeyIndex, pos = new WeakMap, i = P, j, p;
      while(i--) pos.set(p = prev[i], i), ix.push(p);
      while(n = next.pop(++i)){
        if (p = ix.pop(n)){ // update match
          j = pos.get(p);
          if (n === p.temp) unfill(p);
          else if (receive(n, p) && !(p.affN||p.affs)) subdiff(p);
        } else j = P++, mount(n, effs, tau, f, i); // mount loner
        j !== i && pos.set(prev[i], j) && swap(f, i, j)
      }
      while(P-- > N) pop(prev[P], f); // unmount orphans
    }
  }
}

// diff "sideways" along the calculated path
//   * initially used call stack; led to overflows for lateral updates
//   * htap is "path" in reverse, we don't need it to avoid .reverse(), but we avoid .length = 0
const sidediff = f => {
  while(f = path.pop()) if (f.temp && f.inPath) subdiff(f);
  while(f = lags.pop()) add(f);
  while(f = htap.pop())
    f.inPath ? emit("didUpdate", f, f._affN =+ (f.isOrig = f.inPath = false)) : emit("didAdd", f);
  while(f = hops.pop()) {
    for (let [c, t] of f._affs)
      t ? c.entangle(f) : c.detangle(f);
    f._affs = null;
  }
}
const mount = (t, effs, tau, f, i) => ((path.length ? ladd : add)(f = push(t, effs, tau, f, i)), f)
const rediff = (f, tau=-1) => {fill(f, tau), sidediff()};
// public diff (mount, unmount and update frames)
const diff = (t, f, effs, tau=-1) => {
  if (isArr(t = norm(t))) return false;
  if (!isFrame(f) || !f.temp) {
    return !!t && (sidediff(f = mount(t, effs, tau)), f);
  }
  if (!f.isRoot || t === f.temp) return false;
  if (fill(f) || !t) return !sidediff(pop(f));
  if (t.name === f.temp.name) return sidediff(receive(t, f)), f;
  effs = effs || f.effs, sidediff(pop(f));
  return sidediff(f = mount(t, effs, tau)), f;
}

module.exports = { diff, rediff }
