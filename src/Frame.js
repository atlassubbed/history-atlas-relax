const { isComp, isFn, isArr, merge } = require("./util")

const isFrame = f => !!f && isFn(f.diff);

// not to be instantiated by caller
const Frame = function(t, effs){
  if (!t) return;
  this.effs = effs, this.temp = t;
  this.affs = this.next = this._affs =
  this.nextState = this.state = this.keys = null;
  this.affCount = this._affCount = 0;
  this.inStep = this.inPath = this.isOrig = false;
}
Frame.prototype.diff = function(data, next){ return next }
Frame.isFrame = isFrame
Frame.define = (Subframe, proto) => {
  if (Subframe === Frame) 
    throw new Error("cannot re-define base");
  const p = new Frame;
  for (let k in proto) p[k] = proto[k];
  Subframe.prototype = p
  Subframe.prototype.constructor = Subframe
}
// XXX this is expensive, consider using sets/maps to reduce the internal api
const clearFrame = f => {
  f.state = f.nextState = f.temp = f.effs = f.affs = f._affs = f.keys = null;
}
// temp is already normalized
const toFrame = (t, effs, tau) => {
  if (!isComp(t)) t = new Frame(t, effs);
  else {
    const Sub = t.name;
    if (isFrame(Sub.prototype)) t = new Sub(t, effs);
    else t = new Frame(t, effs), t.diff = Sub;
  }
  return t.tau = t.getTau(tau), t;
}

module.exports = { Frame, toFrame, clearFrame }
