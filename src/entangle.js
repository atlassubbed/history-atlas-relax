const { Frame } = require("./Frame");

Frame.prototype.entangle = function(f){
  if (f !== this) (f.affs = f.affs || new Set()).add(this);
}
Frame.prototype.detangle = function(f){
  if (f !== this && f.affs && f.affs.delete(this))
    f.affs.size || (f.affs = null)
}
