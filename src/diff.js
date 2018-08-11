const { isVoid, isArr, isFn, isComp, norm, pop } = require("./util")
const { Frame: { isFrame }, toFrame } = require("./Frame");

// emit lifecycle event to relevant effects
//   * effects are executed in reverse-order
const emit = (type, frame, data, temp) => {
  const effs = frame.effects;
  // XXX if !effs, call lifecycle method directly on frame?
  if (!effs) return;
  let n = effs.length, eff;
  while(n--) if (eff = effs[n]) 
    eff[type] && eff[type](frame, data, temp);
}

// add new subframe to existing (sub)frame or root new frame
// temp is already normalized
const add = (temp, effs, frame) => {
  temp = toFrame(temp, effs);
  if (frame){
    const i = (frame.children = frame.children || []).push(temp);
    temp.parent = frame, temp.pos = i - 1;
  }
  emit("willAdd", temp)
  subdiff(temp);
  emit("didAdd", temp)
  return temp;
}

// XXX deprecate pos-tracking? 
//   There's a bug here were we will end up with out-of-sync pos indexes
// remove existing (sub)frame
const remove = (frame, ownsRemoval) => {
  emit("willRemove", frame)
  const { parent, children } = frame;
  if (ownsRemoval && parent)
    void pop(parent.children, frame)
  frame.parent = frame.pos = null;
  if (children) for (let c of children){
    remove(c), c.parent = c.pos = null;
  }
  frame.children = null;
  if (ownsRemoval) emit("didRemove", frame)
}

// replace existing subframe with new subframe
//   * the removed node owns its removal, but we avoid splicing twice
//     in favor of setting the index directly to the new frame
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

// propagates potential changes down the frame's subtree
//   * don't check/patch for shallow/deep equality on irreducibles
//     as we cannot infer what constitutes a change for an effect
//   * memoizing templates precludes the need for shouldUpdate
//   * willUpdate/didUpdate ~= willSubdiff/didSubdiff
// temp is already normalized
const update = (temp, frame) => {
  const pD = frame.data, pT = frame.next,
    nD = temp.data == null ? null : temp.data, 
    nT = temp.next == null ? null : temp.next;
  frame.key = temp.key == null ? null : temp.key
  emit("willUpdate", frame, nD, nT);
  frame.next = nT;
  frame.data = nD; // XXX don't set the data until we diff?
  frame = subdiff(frame);
  emit("didUpdate", frame, pD, pT);
  return frame;
}

// temp is normalized
const diff = (temp, effs, frame, parent) => {
  if (frame && !temp) return !remove(frame, true)
  if (temp && !frame) return add(temp, effs, parent)
  if (temp.name !== frame.name) return replace(temp, effs, frame)
  return update(temp, frame)
}

// XXX remove thrown error here, automatically flatten arrays on the fly
//   don't attempt to flatten `next` in hyperscript function
const subdiff = frame => {
  const { data, next, effects } = frame;
  let template = frame.evaluate(data, next)

  // OPTIMIZED attempt -- this is currently buggy, use NOT OPTIMIZED below
  // let nN, pN, nT, pF, ni = 0, pi = 0;
  // if (isVoid(template)) nN = 0;
  // else if (isArr(template)) nN = template.length;
  // else nN = 1, template = [template];
  // pN = frame.children ? frame.children.length : 0
  // while(ni < nN || pi < pN){
  //   nT = template && template[ni];
  //   if (ni++ < nN){
  //     if (isArr(nT)) 
  //       throw new Error("next must be flat");
  //     if (!(nT = norm(nT))) continue;
  //   }
  //   nT ? pi++ : pN--;
  //   pF = frame.children && frame.children[pi];
  //   if (pF && !nT){
  //     remove(pF, true)
  //   } else if (nT && !pF){
  //     add(nT, effects, frame)
  //   } else if (nT.name !== pF.name){
  //     replace(nT, effects, pF)
  //   } else {
  //     update(nT, pF);
  //   }
  // }

  // NOT OPTIMIZED

  const children = (frame.children || []).slice();
  template = isArr(template) ? template : [template];
  const nextTemplates = []
  while(template.length){
    const next = template.pop();
    if (isArr(next)) template.push(...next)
    else if (!isVoid(next)) nextTemplates.push(norm(next));
  }
  // instead of reversing nextTemplates, count backwards
  const maxTempIndex = nextTemplates.length - 1;
  const max = Math.max(maxTempIndex + 1, children.length);
  for (let i = 0; i < max; i++){
    const nT = nextTemplates[maxTempIndex - i], pF = children[i];
    void diff(nT, effects, pF, frame)
  }

  if (frame.children && !frame.children.length){
    frame.children = null;
  }
  return frame;
}

module.exports = (temp, frame, effs) => {
  if (isArr(temp = norm(temp))) return false;
  if (!isFrame(frame)) frame = null
  else if (frame.parent) return false;
  return (frame || temp) && diff(temp, effs, frame);
}
