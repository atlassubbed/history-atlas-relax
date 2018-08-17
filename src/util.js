const isFn = f => !!f && typeof f === "function";

const isArr = Array.isArray;

const toArr = x => isArr(x) ? x : [x];

const isVoid = t => t == null || typeof t === "boolean"

const isComp = t => !!t && isFn(t.name); 

// t is already not an array
// XXX should nameless nodes be sterile? i.e. t.next -> null
const norm = t => isVoid(t) ? false : typeof t === "object" ? t : {name: null, data: String(t)};

let curId = 0;

const id = () => ++id;

module.exports = { isFn, isArr, toArr, isVoid, isComp, norm, id }
