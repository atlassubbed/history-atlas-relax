const { Frame } = require("./Frame");
// typical code will make sparing use of en/detangle
//   * we'll use maps and sets for brevity
//   * note that en/detangle are idempotent
// intermediate map acts as a buffer for future edge changes
const hops = [];
const defer = (f, c, isEnt) => (f._affs = f._affs || hops.push(f) && new Map).set(c, isEnt);
const isOther = (f1, f2) => Frame.isFrame(f1) && f1 !== f2;
Frame.prototype.entangle = function(f){
  if (isOther(f, this)) {
    if (f.inPath || this.inPath) defer(f, this, true);
    else if (!(f.affs = f.affs || new Set).has(this)) 
      this.affN += !!f.affs.add(this);
  }
}
Frame.prototype.detangle = function(f){
  if (isOther(f, this)){
    const a = f.affs;
    if ((f.inPath || this.inPath)) defer(f, this);
    else if (a && a.delete(this) && this.affN-- && !a.size)
      f.affs = null;
  }
}

module.exports = { hops }
