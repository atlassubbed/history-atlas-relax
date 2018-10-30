const isFn = f => !!f && typeof f === "function";

const name = t => isFn(t=t.name) ? t.name : t;

const isComp = t => !!t && isFn(t.name);

const isVoid = t => t == null || typeof t === "boolean"

const isObj = t => t && typeof t === "object";

// XXX should nameless nodes be sterile? i.e. t.next -> null
const norm = t => isVoid(t) ? false : isObj(t) ? t : {name: null, data: String(t)};

const merge = (a, b) => {
  if (b) for (let k in b) a[k] = b[k];
  return a;
}

const isArr = Array.isArray;

module.exports = { isFn, isArr, isComp, norm, name, isObj, merge }
