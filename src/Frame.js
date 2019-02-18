const { isFn } = require("./util");

const isFrame = f => f && isFn(f.render);

// not to be instantiated by caller
const Frame = module.exports = function Frame(temp, effs){
  if (!temp) return;
  this.evt = effs ? {
    effs,
    temp: null,
    prev: null,
    sib: null,
    next: null,
    top: null,
    bot: null,
    upd: true
  } : null
  this.temp = temp;
  this.affs = this._affs = this.next = this.parent =
  this.sib = this.prev = this.top = this.bot = null;
  this.root = this._affN = 0, this.path = -1
}

// typical code will make sparing use of (un)sub
//   * we'll use sets for brevity, and also for sub-linearity in add/remove
//   * note that (un)sub is idempotent
Frame.prototype = {
  constructor: Frame,
  render(temp){
    return temp.next;
  },
  sub(f){
    isFrame(f) && f !== this && (f.affs = f.affs || new Set).add(this)
  },
  unsub(f){
    isFrame(f) && f.affs && f.affs.delete(this) && (f.affs.size || (f.affs = null))
  }
}

Frame.isFrame = isFrame
