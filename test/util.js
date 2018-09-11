const isArr = Array.isArray;

const isObj = x => x && typeof x === "object";

const isFn = x => x && typeof x === "function";

const isVoid = x => x == null || typeof x === "boolean";

const toArr = a => isArr(a) ? a : [a];

const has = (str, substr) => str.indexOf(substr) > -1

const isScalar = str => {
  return !(has(str, "(array)") || has(str, "(tensor)"))
}

const inject = (parent, next) => Object.assign(parent, {next})

const type = str => {
  const i = str.indexOf("(");
  if (i < 0) return str;
  return str.slice(0, i).trim();
}

const deepNull = (tree, fields) => {
  for (let f of fields) tree[f] = null;
  if (tree.children) tree.children.forEach(c => void deepNull(c, fields));
  return tree;
}

const pretty = tree => JSON.stringify(tree, null, 2)

module.exports = { 
  isArr, isObj, isFn, isVoid, isScalar,
  toArr, has, inject, type, deepNull, pretty
}
