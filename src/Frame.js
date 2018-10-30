const { isComp, isFn, isArr, merge } = require("./util")

const isFrame = f => !!f && isFn(f.diff);

// not to be instantiated by caller
const Frame = function(t, effs){
  if (!t) return;
  this.effs = effs, this.temp = t;
  this.affs = this.next = this._affs = this.nextState = this.state = null;
  this._affN = this.step = 0;
  this.inPath = true, this.isOrig = false;
}
Frame.prototype.diff = function(data, next){ return next }
Frame.isFrame = isFrame
Frame.define = (Subframe, proto) => {
  if (Subframe === Frame) throw new Error("cannot re-define base");
  (Subframe.prototype = merge(new Frame, proto)).constructor = Subframe
}
// XXX this is expensive, consider using sets/maps to reduce the internal api
const clearFrame = f => {
  f.next = f.state = f.nextState = f.temp = f.effs = f.affs = f._affs = null;
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
const applyState = (f, ns) => {
  if (ns = f.nextState)f.nextState = !(f.state = merge(f.state || {}, ns))
}
const emit = (type, f, p, s, i, ef) => {
  if (ef = f.effs){
    if (!isArr(ef)) ef[type] && ef[type](f, p, s, i);
    else for (let e of ef) e[type] && e[type](f, p, s, i);
  }
  return f;
}

module.exports = { Frame, toFrame, clearFrame, applyState, emit }
