const { isVoid, isArr, toArr, isFn, isComp, norm } = require("./util")
const { Frame: { isFrame }, toFrame } = require("./Frame");
const { fillPath, leaders } = require("./step-leader");
let laggards = [];

// emit lifecycle event to relevant effects
const emit = (type, frame, data, temp) => {
  const effs = frame.effects;
  if (!effs) return;
  if (!isArr(effs))
    return effs[type] && void effs[type](frame, data, temp);
  for (let e of effs)
    if (e[type]) void e[type](frame, data, temp);
}
const clear = frame => {
  frame.state = frame.temp = frame.effects = this.affects =
  frame.isComputing = frame.computed =
  frame.keys = frame.affectors = frame.name = frame.key = null;
}
// remove existing (sub)frame
const pop = (frame) => {
  const { parent, children } = frame;
  emit("willPop", frame, parent)
  frame.parent = frame.children = null;
  if (children)
    while(children.length) pop(children.pop());
  emit("didPop", frame, parent)
  clear(frame);
}
// push (sub)frame onto frame
const push = (subframe, frame) => {
  emit("willPush", subframe, frame);
  if (frame){
    let i = frame.children.push(subframe), key;
    if (key = subframe.key)
      (frame.keys = frame.keys || {})[key] = i - 1;
    subframe.parent = frame;
  }
  return subframe;
}
// sub prevFrame with nextFrame at index i
const sub = (nextFrame, prevFrame, i) => {
  const { parent, children } = prevFrame;
  emit("willSub", nextFrame, parent, i);
  prevFrame.parent = prevFrame.children = null;
  if (children)
    while(children.length) pop(children.pop());
  if (nextFrame.parent = parent) 
    parent.children[i] = nextFrame;
  emit("didSub", prevFrame, parent, i)
  clear(prevFrame);
  return nextFrame;
}
// * don't check/patch for shallow/deep equality on irreducibles
//     as we cannot infer what constitutes a change for an effect
// * memoizing templates precludes the need for shouldUpdate
//   * this is only useful if subdiff is stable and implements keys
const update = (temp, frame) => {
  emit("willUpdate", frame, temp);
  frame.key = temp.key, frame.temp = temp;
  return frame;
}
const end = frame => {
  emit("willDiff", frame);
  subdiff(frame);
  emit("didDiff", frame);
  return frame;
}
const defer = frame => {
  if (frame.affectors || leaders.length) 
    laggards.push(frame);
  else void end(frame);
}
// sanitize dirty templates returned from evaluate:
//   * short circuit if no prev keys
//   * gather key translations in index
const sanitize = (dirtyNext, next, index, keys) => {
  let temp
  if (!keys){
    while(dirtyNext.length){
      temp = dirtyNext.pop();
      if (isArr(temp)) dirtyNext.push(...temp);
      else if (!isVoid(temp)) next.push(norm(temp));
    }
    return next.length;
  }
  let k, N;
  while(dirtyNext.length){
    temp = dirtyNext.pop();
    if (isArr(temp)) dirtyNext.push(...temp);
    else if (!isVoid(temp)) {
      N = next.push(temp = norm(temp));
      if ((k = temp.key) && keys[k]){
        index[k] = N - 1;
      }
    }
  }
  return N;
}
// subdiff a frame
//   * short circuit > switch under one loop
const subdiff = frame => {
  let { temp: { data, next }, children: prev } = frame;
  const { effects: effs, keys } = frame, index = {};
  next = toArr(frame.evaluate(data, next))
  frame.keys = null
  const N = sanitize(next, next = [], index, keys), 
    P = prev ? prev.length : 0;
  if (!(N || P)) return;
  if (!N){
    frame.children = null;
    while (prev.length) pop(prev.pop());
    return;
  } else if (!P){
    frame.children = [];
    while(next.length)
      defer(push(toFrame(next.pop(), effs), frame));
    return;
  }
  let i = 0, M = Math.min(N, P), n, p;
  while (i < M){
    n = next.pop(), p = prev[i];
    if (n.name === p.name)
      update(n, p) && p.inPath || void end(p)
    else defer(sub(toFrame(n, effs), p, i));
    i++;
  }
  if (N > P){
    while(next.length)
      defer(push(toFrame(next.pop(), effs), frame));
  } else while(prev.length > N) pop(prev.pop());
}
// build step leader, diff along the path
const diff = (temp, frame) => {
  fillPath(frame), end(update(temp, frame));
  while(leaders.length)
    if ((temp = leaders.pop()).temp)
      end(temp), temp.inPath = false;
  if (laggards.length) {
    for (let f of laggards) end(f);
    laggards = [];
  }
  return frame;
}
// public diff (mount, unmount and update frames)
module.exports = (temp, frame, effs) => {
  if (isArr(temp = norm(temp))) return false;
  if (!isFrame(frame)) 
    return !!temp && end(push(toFrame(temp, effs)));
  if (frame.parent) return false;
  if (!temp) return !pop(frame);
  if (temp.name === frame.name) return diff(temp, frame);
  return end(sub(toFrame(temp, effs), frame));
}
