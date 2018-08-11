const isFn = f => !!f && typeof f === "function";

const isArr = Array.isArray;

const isVoid = t => t == null || typeof t === "boolean"

const isComp = t => !!t && isFn(t.name); 

const pop = (arr, el) => {
  const i = arr.indexOf(el);
  if (i > -1) arr.splice(i, 1)
}
// t is already not an array
// XXX should we set t.next to null if !t.name?
//   nameless nodes should be sterile, right?
const norm = t => isVoid(t) ? false : typeof t === "object" ? t : {name: null, data: String(t)};

module.exports = { isFn, isArr, isVoid, isComp, norm, pop }
