const isFn = f => !!f && typeof f === "function";

const name = t => isFn(t=t.name) ? t.name : t;

const isComp = t => !!t && isFn(t.name);

const isVoid = t => t == null || typeof t === "boolean"

// XXX should nameless nodes be sterile? i.e. t.next -> null
const norm = t => isVoid(t) ? false : typeof t === "object" ? t : {name: null, data: String(t)};

const isArr = Array.isArray;

// flattens dirty (a shallow copy, thus safe)
// we avoid dirty.push(...t) to avoid stack overflow
const clean = dirty => {
  let next = [], t;
  while(dirty.length) if (t = norm(dirty.pop()))
    if (isArr(t)) for (let i of t) dirty.push(i);
    else next.push(t);
  return next;
}

module.exports = { isFn, isArr, isComp, norm, clean, name }
