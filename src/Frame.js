const { isComp, isFn, isArr } = require("./util")

let curId = 0;

// not to be instantiated by caller
const Frame = function(t, effs){
  if (!t) return;
  this.id = this.affectors = this.affects =
  this.parent = this.children =
  this.epoch = this.state = this.keys = null;
  this.affCount = 0, this.inStep = false;
  this.effects = effs, this.temp = t;
  this.name = t.name, this.key = t.key;
}
Frame.prototype.evaluate = function(data, next){ return next }
Frame.prototype.entangle = function(f){
  if (f === this.parent || f === this) return;
  const affs = this.affectors = this.affectors || {};
  const id = f.id = f.id || ++curId;
  if (affs[id]) return;
  (f.affects = f.affects || []).push(this)
  this.affCount++, affs[id] = f;
}
Frame.prototype.detangle = function(f){
  const { affectors } = this, { id } = f;
  if (!affectors || !affectors[id]) return;
  affectors[id] = null
  if (!--this.affCount) this.affectors = null;
}
Frame.prototype.setTau = function(){}
Frame.prototype.setState = function(){}
Frame.isFrame = f => !!f && isFn(f.evaluate);
Frame.define = (Subframe, proto) => {
  if (Subframe === Frame) 
    throw new Error("cannot re-define base")
  Subframe.prototype = Object.assign(new Frame(), proto);
  Subframe.prototype.constructor = Subframe
}

const isFrame = Frame.isFrame;
// temp is already normalized
const toFrame = (t, effs) => {
  if (!isComp(t)) return new Frame(t, effs);
  const Subframe = t.name
  if (isFrame(Subframe.prototype)) 
    return new Subframe(t, effs);
  const frame = new Frame(t, effs);
  frame.evaluate = Subframe;
  return frame;
}

module.exports = { Frame, toFrame }
