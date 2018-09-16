const { Frame } = require("./Frame");

Frame.prototype.isFam = function(f){
  return f === this || f === this.parent
};
Frame.prototype.entangle = function(f){
  if (!this.isFam(f)) (f.affs = f.affs || new Set()).add(this);
}
Frame.prototype.detangle = function(f){
  if (!this.isFam(f) && f.affs && f.affs.delete(this))
    f.affs.size || (f.affs = null)
}
