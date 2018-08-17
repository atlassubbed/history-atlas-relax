const { isVoid, isArr, toArr, isFn, isComp, norm } = require("./util")
const { Frame: { isFrame }, toFrame } = require("./Frame");

// emit lifecycle event to relevant effects
const emit = (type, frame, data, temp) => {
  const effs = frame.effects;
  if (!effs) return;
  if (!isArr(effs))
    return effs[type] && void effs[type](frame, data, temp);
  let n = effs.length, eff;
  while(eff = effs[--n]) {
    if (eff[type]) void eff[type](frame, data, temp);
  }
}

const clear = frame => {
  frame.state = frame.temp = frame.effects = 
  frame.keys = frame.affectors = frame.name = frame.key = null;
}

// add new (sub)frame
const push = (temp, effs, frame) => {
  temp = toFrame(temp, effs);
  if (frame){
    let i = frame.children.push(temp), key;
    if (key = temp.key) 
      (frame.keys = frame.keys || {})[key] = i - 1;
    temp.parent = frame
  }
  emit("willPush", temp, frame)
  subdiff(temp);
  emit("didPush", temp, frame)
  return temp;
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

// replace existing (sub)frame
const replace = (temp, effs, frame, i) => {
  temp = toFrame(temp, effs);
  const { parent, children } = frame;
  emit("willSub", temp, parent, i);
  frame.parent = frame.children = null;
  if (children)
    while(children.length) pop(children.pop());
  if (temp.parent = parent) parent.children[i] = temp;
  subdiff(temp);
  emit("didSub", frame, parent, i)
  return clear(frame), temp;
}

// propagates potential changes down the frame's subtree
//   * don't check/patch for shallow/deep equality on irreducibles
//     as we cannot infer what constitutes a change for an effect
//   * memoizing templates precludes the need for shouldUpdate
//     * this is only useful if subdiff is stable and implements keys
//   * willUpdate/didUpdate ~= willSubdiff/didSubdiff
const update = (temp, frame) => {
  const { temp: { data: pD, next: pT }} = frame,
    { data: nD, next: nT } = temp;
  frame.key = temp.key
  emit("willUpdate", frame, nD, nT);
  frame.temp = temp; // XXX don't set new props until we diff?
  subdiff(frame);
  emit("didUpdate", frame, pD, pT);
  return frame;
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

// subdiff a frame node
//   * short circuit instead of switching under single loop
const subdiff = (frame, affectorId) => {
  let { temp: { data, next } } = frame;
  const { effects: effs, keys } = frame;
  let prev = frame.children, index = {};
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
      void push(next.pop(), effs, frame);
    return;
  }
  let i = 0, M = Math.min(N, P), n, p;
  while (i < M){
    n = next.pop(), p = prev[i];
    if (n.name === p.name) void update(n, p);
    else void replace(n, effs, p, i);
    i++;
  }
  if (N > P){
    while(next.length) 
      void push(next.pop(), effs, frame);
  } else {
    while(prev.length > N) pop(prev.pop());
  }
}

module.exports = (temp, frame, effs) => {
  if (isArr(temp = norm(temp))) return false;
  if (!isFrame(frame)) return !!temp && push(temp, effs);
  if (frame.parent) return false;
  if (!temp) return !pop(frame, true);
  if (temp.name === frame.name) return update(temp, frame);
  return replace(temp, effs, frame);
}
