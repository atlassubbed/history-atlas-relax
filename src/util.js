const isFn = f => typeof f === "function";

const name = t => isFn(t=t.name) ? t.name : t;

// XXX should nameless nodes be sterile? i.e. t.next -> null
const norm = t => t != null && t !== true && t !== false && (typeof t === "object" ? t : {name: null, data: String(t)});

const merge = (a, b) => {
  if (b) for (let k in b) a[k] = b[k];
  return a;
}

const isArr = Array.isArray;

module.exports = { isFn, isArr, norm, name, merge }
