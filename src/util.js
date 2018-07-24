const isFn = f => f && typeof f === "function";

const isArr = a => a && Array.isArray(a);

const isObj = o => o && typeof o === "object";

const isVoid = e => e == null || typeof e === "boolean"

const isComp = e => e && isFn(e.name); 

const getName = e => !e || (e = e.name) == null ? null : isFn(e) ? e.name : e

const toFrame = (effect, ParentSpecies) => {
  if (!isFn(effect.name)) return new ParentSpecies(effect);
  const ChildSpecies = effect.name, proto = ChildSpecies.prototype;
  if (proto && proto.evaluate) return new ChildSpecies(effect);
  const frame = new ParentSpecies(effect);
  frame.evaluate = ChildSpecies.bind(frame)
  return frame;
}

const toEffect = effect => {
  if (isArr(effect)) return {effects: effect};
  return isObj(effect) ? effect : {data: String(effect)}
}

module.exports = {
  isFn, isArr, isObj, isVoid, isFrame, isComp, 
  getName, toFrame, toEffect
}
