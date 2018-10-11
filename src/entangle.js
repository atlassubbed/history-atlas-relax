const { Frame } = require("./Frame");
// typical code will make sparing use of en/detangle
//   * we'll use maps and sets for brevity
//   * note that en/detangle are idempotent
// intermediate map acts as a buffer for future edge changes
const hops = [];
const defer = (f, c, isEnt) => (f._affs = f._affs || hops.push(f) && new Map).set(c, isEnt);
const isOther = (a, b) => Frame.isFrame(a) && a !== b;
Frame.prototype.entangle = function(f, a){
  isOther(f, this) &&
    (f.inPath || this.inPath ? defer(f, this, 1) :
      (a = f.affs = f.affs || new Set).has(this) || (this.affN += !!a.add(this)))
}
Frame.prototype.detangle = function(f, a){
  isOther(f, this) &&
    (f.inPath || this.inPath ? defer(f, this) :
      ((a=f.affs) && a.delete(this) && this.affN-- && a.size || (f.affs = null)))
}

module.exports = { hops }
