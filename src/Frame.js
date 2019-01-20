const { isFn } = require("./util");

const isFrame = f => !!f && isFn(f.render);

// not to be instantiated by caller
const Frame = module.exports = function(temp, effs){
  if (!temp) return;
  this.effs = effs, this.temp = temp;
  this.affs = this.next = this._affs = this.parent =
  this.it = this.sib = this.prev = this.top = this.bot = null;
  this._affN = this.step = 0;
  this.path = 1;
}
Frame.prototype.render = function(temp){ return temp.next }
// typical code will make sparing use of (un)sub
//   * we'll use sets for brevity, and also for sub-linearity in add/remove
//   * note that (un)sub is idempotent
Frame.prototype.sub = function(f, a){
  if (isFrame(f) && f !== this)
    (a = f.affs = f.affs || new Set).has(this) || a.add(this);
}
Frame.prototype.unsub = function(f, a){
  if (isFrame(f) && f !== this)
    (a=f.affs) && a.delete(this) && a.size || (f.affs = null)
}
Frame.isFrame = isFrame
