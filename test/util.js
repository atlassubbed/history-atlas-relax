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

const getNext = temp => {
  const { name, data, next } = temp;
  if (!isFn(name)) return next;
  const p = name.prototype;
  if (p && isFn(p.evaluate))
    return (new name(temp)).evaluate(data, next);
  return name(data, next);
}

const buildReducibles = Comps => Comps.map(Comp => {
  let { name } = Comp;
  const type = has(name, "Stateful") ? 
    "stateful" : has(name, "Legacy") ? 
    "legacy" : "stateless";
  const rank = has(name, "Scalar") ? "one" : "many";
  name = `reducible (${type}, returns ${rank})`
  return {name, get: data => ({name: Comp, data})}
})

module.exports = { 
  isArr, isObj, isFn, isVoid, isScalar,
  toArr, has, inject, type, getNext, buildReducibles
}
