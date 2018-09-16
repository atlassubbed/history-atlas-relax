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

const deepSet = (tree, fields) => {
  for (let f in fields) tree[f] = fields[f];
  if (tree.next) for (let c of tree.next) deepSet(c, fields);
  return tree;
}

const pretty = tree => JSON.stringify(tree, null, 2)

module.exports = { 
  isArr, isObj, isFn, isVoid, isScalar,
  toArr, has, inject, type, deepSet, pretty
}
