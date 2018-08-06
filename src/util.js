const isFn = f => !!f && typeof f === "function";

const isArr = Array.isArray;

const isVoid = t => t == null || typeof t === "boolean"

const isComp = t => !!t && isFn(t.name); 

// t is already not an array
const norm = t => isVoid(t) ? false : typeof t === "object" ? t : {data: String(t)};

module.exports = { isFn, isArr, isVoid, isComp, norm }
