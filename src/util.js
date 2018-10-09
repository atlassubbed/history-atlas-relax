const isFn = f => !!f && typeof f === "function";

const name = t => isFn(t=t.name) ? t.name : t;

const isComp = t => !!t && isFn(t.name);

const isVoid = t => t == null || typeof t === "boolean"

const isObj = t => t && typeof t === "object";

// XXX should nameless nodes be sterile? i.e. t.next -> null
const norm = t => isVoid(t) ? false : isObj(t) ? t : {name: null, data: String(t)};

const isArr = Array.isArray;

// flattens next (a shallow copy, thus safe)
// we avoid .push(...t) to avoid stack overflow
// ix is an optional KeyIndex
const clean = (f, ix) => {
  let next = [], t = f.temp
  f = [f.diff(t.data, t.next)];
  while(f.length) if (t = norm(f.pop()))
    if (isArr(t)) for (let i of t) f.push(i);
    else next.push(t), ix && ix.push(t);
  return next;
}

module.exports = { isFn, isArr, isComp, norm, clean, name, isObj }
