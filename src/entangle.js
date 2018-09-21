const { Frame } = require("./Frame");
// typical code will make sparing use of en/detangle
//   * we'll use maps and sets for brevity
//   * note that en/detangle are idempotent
// intermediate map acts as a buffer for future edge changes
const jumps = [];
const defer = (f, c, t) => (f._affs = f._affs || jumps.push(f) && new Map).set(c, t);
const isOther = (f1, f2) => Frame.isFrame(f1) && f1 !== f2;
Frame.prototype.entangle = function(f){
  if (isOther(f, this)) {
    if (f.inPath || this.inPath) defer(f, this, "entangle");
    else if (!(f.affs = f.affs || new Set).has(this)) 
      this.affCount += !!f.affs.add(this); 
  }
}
Frame.prototype.detangle = function(f){
  if (isOther(f, this)){
    const a = f.affs;
    if ((f.inPath || this.inPath)) defer(f, this, "detangle");
    else if (a && a.delete(this) && this.affCount-- && !a.size)
      f.affs = null;
  }
}

module.exports = { jumps }
