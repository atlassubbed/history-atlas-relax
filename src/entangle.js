const { Frame } = require("./Frame");
// typical code will make sparing use of en/detangle
//   * we'll use sets for brevity, and also for sub-linearity in add/remove
//   * note that en/detangle are idempotent
const isOther = (a, b) => Frame.isFrame(a) && a !== b;
Frame.prototype.entangle = function(f, a){
  if (isOther(f, this)) (a = f.affs = f.affs || new Set).has(this) || a.add(this);
}
Frame.prototype.detangle = function(f, a){
  if (isOther(f, this)) (a=f.affs) && a.delete(this) && a.size || (f.affs = null)
}
