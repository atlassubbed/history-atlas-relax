const equals = require("atlas-deep-equals")
const { isVoid, isArr, isFn, isComp, norm } = require("./util")
const { Frame: { isFrame }, toFrame } = require("./Frame");

// emit lifecycle event to relevant effects
const emit = (type, frame, data, temp) => {
  const effs = frame.effects;
  // XXX if !effs, call lifecycle method directly on frame?
  if (!effs) return;
  let n = effs.length, eff;
  // XXX effects run in reverse-specified order
  // XXX lifecycle events should only trigger on irreducible frames?
  while(n--) if (eff = effs[n]) 
    eff[type] && eff[type](frame, data, temp);
}

// add new subframe to existing (sub)frame or root new frame
// temp is already normalized
const add = (temp, effs, frame) => {
  temp = toFrame(temp, effs);
  if (frame){
    const i = (frame.children = frame.children || []).push(temp);
    temp.parent = frame, temp.pos = i;
  }
  emit("willAdd", temp)
  subdiff(temp);
  emit("didAdd", temp)
  return temp;
}

// remove existing (sub)frame
const remove = (frame, ownsRemoval) => {
  emit("willRemove", frame)
  const { parent, children } = frame;
  if (ownsRemoval && parent)
    void parent.children.splice(frame.pos,1);
  frame.parent = frame.pos = null;
  if (children) for (let c of children){
    remove(c), c.parent = c.pos = null;
  }
  frame.children = null;
  if (ownsRemoval) emit(frame, "didRemove")
}

// replace existing subframe with new subframe
// temp is already normalized
const replace = (temp, effs, frame) => {
  temp = toFrame(temp, effs);
  const { pos, parent } = frame;
  remove(frame)
  temp.pos = pos;
  if (temp.parent = parent) parent.children[pos] = temp;
  emit("didRemove", frame)
  frame = temp; // drop ref before recur
  emit("willAdd", frame)
  subdiff(frame);
  emit("didAdd", frame)
  return frame;
}

// potentially update (sub)frame
// temp is already normalized
const update = (temp, frame) => {
  const pD = frame.data, pT = frame.next,
    nD = temp.data == null ? null : temp.data, 
    nT = temp.next == null ? null : temp.next,
    isFnl = isComp(frame),
    // XXX burden the deep-equals work onto the effects
    //   since they may need a customized patch
    //   which can't really be inferred here
    isUpdate = isFnl || !equals(nD, pD, true);
  // XXX shouldUpdate/shouldReact/shouldDiff should skip everything below?
  //   shouldUpdate should only be checked on nodes that don't have children args
  frame.key = temp.key == null ? null : temp.key
  emit("willReceive", frame, nD, nT)
  // XXX rename to willDiff?
  if (isUpdate) emit("willUpdate", frame, nD, nT);
  frame.next = nT;
  frame.data = nD; // XXX don't set the data until we diff?
  frame = subdiff(frame); // XXX shouldUpdate should only skip the diff?
  // XXX rename to didDiff?
  if (isUpdate) emit("didUpdate", frame, pD, pT);
  return frame;
}

// XXX remove thrown error here, automatically flatten arrays on the fly
//   don't do it in hyperscript function
const subdiff = frame => {
  const { data, next, effects } = frame;
  let template = frame.evaluate(data, next)
  let nN, pN, nT, pF, ni = 0, pi = 0;
  if (isVoid(template)) nN = 0;
  else if (isArr(template)) nN = template.length;
  else nN = 1, template = [template];
  pN = frame.children ? frame.children.length : 0
  while(ni < nN || pi < pN){
    nT = template && template[ni];
    if (ni++ < nN){
      if (isArr(nT)) 
        throw new Error("next must be flat");
      if (!(nT = norm(nT))) continue;
    }
    nT ? pi++ : pN--;
    pF = frame.children && frame.children[pi];
    if (pF && !nT){
      remove(pF, true)
    } else if (nT && !pF){
      add(nT, effects, frame)
    } else if (nT.name !== pF.name){
      replace(nT, effects, pF)
    } else {
      update(nT, pF);
    }
  }
  if (frame.children && !frame.children.length)
    frame.children = null;
  return frame;
}

module.exports = (temp, frame, effs) => {
  if (isArr(temp)) return false;
  temp = norm(temp);
  if (!isFrame(frame)) return temp && add(temp, effs);
  if (frame.parent) return false;
  if (!temp) return !remove(frame, true);
  if (temp.name === frame.name) return update(temp, frame)
  return replace(temp, effs, frame)
}
