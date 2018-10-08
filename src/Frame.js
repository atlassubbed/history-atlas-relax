const { isComp, isFn, isArr } = require("./util")

const isFrame = f => !!f && isFn(f.diff);

// not to be instantiated by caller
const Frame = function(t, effs){
  if (!t) return;
  this.effs = effs, this.temp = t;
  this.affs = this.next = this._affs =
  this.nextState = this.state = null;
  this.affN = this._affN = 0;
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
const applyState = (f, ns, s) => {
  if (ns = f.nextState){
    if (!(s = f.state)) f.state = ns;
    else for (let k in ns) s[k] = ns[k];
    f.nextState = null;
  }
}
const emit = (type, f, p, s, i) => {
  const ef = f.effs;
  if (ef){
    if (!isArr(ef)) return ef[type] && void ef[type](f, p, s, i);
    for (let e of ef) e[type] && e[type](f, p, s, i)
  }
}

module.exports = { Frame, toFrame, clearFrame, applyState, emit }
