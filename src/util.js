const isFn = f => !!f && typeof f === "function";

const isArr = Array.isArray;

const isVoid = t => t == null || typeof t === "boolean"

const isComp = t => !!t && isFn(t.name); 

// XXX should nameless nodes be sterile? i.e. t.next -> null
const norm = t => isVoid(t) ? false : typeof t === "object" ? t : {name: null, data: String(t)};

// flattens dirty (a shallow copy, thus safe)
// we avoid dirty.push(...t) to avoid stack overflow
const clean = dirty => {
  let next = [], t;
  while(dirty.length) if (t = norm(dirty.pop()))
    if (isArr(t)) for (let i of t) dirty.push(i);
    else next.push(t);
  return next;
}

const applyState = (f, ns, s) => {
  if (ns = f.nextState){
    if (!(s = f.state)) f.state = ns;
    else for (let k in ns) s[k] = ns[k];
    f.nextState = null;
  }
}

module.exports = { isFn, isArr, isVoid, isComp, norm, applyState, clean }
