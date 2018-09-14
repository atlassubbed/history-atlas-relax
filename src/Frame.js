const { isComp, isFn, isArr, merge } = require("./util")

const isFrame = f => !!f && isFn(f.evaluate);

// not to be instantiated by caller
const Frame = function(t, effs){
  if (!t) return;
  this.id = this.affs = this.affects =
  this.parent = this.children = this.nextState =
  this.state = this.keys = this.tau = null;
  this.affCount = this.epoch = 0, this.inStep = false;
  this.effects = effs, this.temp = t;
  this.name = t.name, this.key = t.key;
}
Frame.prototype.evaluate = function(data, next){ return next }
Frame.isFrame = isFrame
Frame.define = (Subframe, proto) => {
  if (Subframe === Frame) 
    throw new Error("cannot re-define base");
  const p = new Frame;
  for (let k in proto) p[k] = proto[k];
  Subframe.prototype = p
  Subframe.prototype.constructor = Subframe
}

const clearFrame = f => {
  f.state = f.nextState = f.temp = f.effects = f.affects =
  f.keys = f.affs = f.name = f.key = null;
}
// temp is already normalized
const toFrame = (t, effs, tau) => {
  if (!isComp(t)) t = new Frame(t, effs);
  else {
    const Sub = t.name;
    if (isFrame(Sub.prototype)) t = new Sub(t, effs);
    else t = new Frame(t, effs), t.evaluate = Sub;
  }
  return t.tau = t.getTau(tau), t;
}

module.exports = { Frame, toFrame, clearFrame }
