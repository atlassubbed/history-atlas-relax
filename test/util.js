const isArr = Array.isArray;

const isObj = x => x && typeof x === "object";

const isFn = x => x && typeof x === "function";

const isVoid = x => x == null || typeof x === "boolean";

const toArr = a => isArr(a) ? a : [a];

const has = (str, substr) => str.indexOf(substr) > -1

const isScalar = str => {
  return !(has(str, "(array)") || has(str, "(tensor)"))
}

const inject = (parent, next) => (parent.next = next, parent);

const type = str => {
  const i = str.indexOf("(");
  if (i < 0) return str;
  return str.slice(0, i).trim();
}

const deepIgnore = (node, txfm) => {
  txfm(node);
  let c;
  if (c = node.next) do {
    deepIgnore(c, txfm);
  } while(c = c.sib)
  return node;
}

const merge = (a, b) => {
  if (b) for (let k in b) a[k] = b[k];
  return a;
}

const pretty = tree => JSON.stringify(tree, null, 2)

// pseudo-deep copy a multi-dimensional array
const copy = t => t && (isArr(t) ? t.map(copy) : Object.assign({}, t));

module.exports = { 
  isArr, isObj, isFn, isVoid, isScalar,
  toArr, has, inject, type, pretty, copy, deepIgnore, merge
}
