const { isFn } = require("./util");
const { relax } = require("./field");

const isFrame = f => !!f && isFn(f.render);

// not to be instantiated by caller
const Frame = function(temp, effs){
  if (!temp) return;
  this.effs = effs, this.temp = temp;
  this.affs = this.next = this._affs = this.nextState = this.state =
  this.it = this.sib = this.prev = this.top = this.bot = null;
  this._affN = this.step = 0;
  this.inPath = true, this.isOrig = false;
}
Frame.prototype.render = function(data, next){ return next }
// typical code will make sparing use of en/detangle
//   * we'll use sets for brevity, and also for sub-linearity in add/remove
//   * note that en/detangle are idempotent
Frame.prototype.entangle = function(f, a){
  if (isFrame(f) && f !== this)
    (a = f.affs = f.affs || new Set).has(this) || a.add(this);
}
Frame.prototype.detangle = function(f, a){
  if (isFrame(f) && f !== this)
    (a=f.affs) && a.delete(this) && a.size || (f.affs = null)
}
Frame.isFrame = isFrame

const del = f => relax(f, f.sib = f.prev = f.state = f.nextState = f.temp = f.effs = f.affs = f._affs = null);
// temp is already normalized
const node = (t, p) => {
  let effs = p && p.effs;
  if (!isFn(t.name)) t = new Frame(t, effs);
  else {
    const Sub = t.name;
    if (isFrame(Sub.prototype)) t = new Sub(t, effs);
    else t = new Frame(t, effs), t.render = Sub;
  }
  return t;
}

module.exports = { Frame, node, del }
