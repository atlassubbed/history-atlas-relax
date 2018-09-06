const isFn = f => !!f && typeof f === "function";

const isArr = Array.isArray;

const isVoid = t => t == null || typeof t === "boolean"

const isComp = t => !!t && isFn(t.name); 

// t is already not an array
// XXX should nameless nodes be sterile? i.e. t.next -> null
const norm = t => isVoid(t) ? false : typeof t === "object" ? t : {name: null, data: String(t)};

module.exports = { isFn, isArr, isVoid, isComp, norm }
