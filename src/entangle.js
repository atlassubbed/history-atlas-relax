const { Frame } = require("./Frame");
// typical code will make sparing use of en/detangle
//   * we'll use maps and sets for brevity
//   * note that en/detangle are idempotent
// intermediate map acts as a buffer for future edge changes
const hops = [];
const defer = (f, c, isEnt) => (f._affs = f._affs || hops.push(f) && new Map).set(c, isEnt);
const rem = (arr, el) => arr && (el = arr.indexOf(el)) > -1 && arr.splice(el, 1);
const isOther = (a, b) => Frame.isFrame(a) && a !== b;

// XXX in order to avoid using generators in fill/unfill, we must use arrays for entangled children
// This is a tradeoff, but a good one. We may assume that entangle/detangle are not called too often
// Thus, them being O(N) instead of sublinear should be fine for a typical application.
// i.e. I would rather have 30% less compute overhead in fill/unfill than sublinear entangle/detangle.
Frame.prototype.entangle = function(f, a){
  isOther(f, this) &&
    (f.inPath || this.inPath ? defer(f, this, 1) :
      (a = f.affs = f.affs || []).indexOf(this) < 0 && a.push(this) && this.affN++)
}
Frame.prototype.detangle = function(f, a){
  isOther(f, this) &&
    (f.inPath || this.inPath ? defer(f, this) :
      rem(a=f.affs, this) && this.affN-- && a.length || (f.affs = null))
}

module.exports = { hops }
