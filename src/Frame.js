const { isFn, merge } = require("./util")

const isFrame = f => !!f && isFn(f.diff);
const isComp = f => !!f && isFn(f.name);
const isOther = (a, b) => isFrame(a) && a !== b;

// not to be instantiated by caller
const Frame = function(temp, effs){
  if (!temp) return;
  this.effs = effs, this.temp = temp;
  this.affs = this.next = this._affs = this.nextState = this.state = this.sib = this.it = this.prev = null;
  this._affN = this.step = 0;
  this.inPath = true, this.isOrig = false;
}
Frame.prototype.diff = function(data, next){ return next }
// typical code will make sparing use of en/detangle
//   * we'll use sets for brevity, and also for sub-linearity in add/remove
//   * note that en/detangle are idempotent
Frame.prototype.entangle = function(f, a){
  if (isOther(f, this)) (a = f.affs = f.affs || new Set).has(this) || a.add(this);
}
Frame.prototype.detangle = function(f, a){
  if (isOther(f, this)) (a=f.affs) && a.delete(this) && a.size || (f.affs = null)
}
Frame.isFrame = isFrame
// XXX this is expensive, consider using sets/maps to reduce the internal api
const del = f => {
  f.sib = f.prev = f.state = f.nextState = f.temp = f.effs = f.affs = f._affs = null;
}
// temp is already normalized
const node = (t, p) => {
  let effs = p && p.effs, tau = p && p.tau != null ? p.tau : -1;
  if (!isComp(t)) t = new Frame(t, effs);
  else {
    const Sub = t.name;
    if (isFrame(Sub.prototype)) t = new Sub(t, effs);
    else t = new Frame(t, effs), t.diff = Sub;
  }
  return t.tau = t.getTau(tau), t;
}

module.exports = { Frame, node, del }
