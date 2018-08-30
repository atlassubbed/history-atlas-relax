const { isComp, isFn, isArr, toArr } = require("./util")

let curId = 0;

// not to be instantiated by caller
const Frame = function(temp, effs){
  if (!temp) return;
  this.id = this.affectors = this.affects =
  this.parent = this.children =
  this.epoch = this.state = this.keys = null;
  this.affCount = 0, this.inStep = this.inPath = false;
  this.effects = effs, this.temp = temp;
  this.name = temp.name, this.key = temp.key;
}
Frame.prototype.evaluate = function(data, next){ return next }
Frame.prototype.entangle = function(frame){
  const affs = this.affectors = this.affectors || {};
  const id = frame.id = frame.id || ++curId;
  if (affs[id]) return;
  (frame.affects = frame.affects || []).push(this)
  this.affCount += (affs[id] = true)
}
Frame.prototype.detangle = function(frame){
  const { affectors } = this, { id } = frame;
  if (!affectors || !affectors[id]) return;
  affectors[id] = false
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
const toFrame = (temp, effs) => {
  if (!isComp(temp)) return new Frame(temp, effs);
  const Subframe = temp.name
  if (isFrame(Subframe.prototype)) 
    return new Subframe(temp, effs);
  const frame = new Frame(temp, effs);
  frame.evaluate = Subframe;
  return frame;
}

module.exports = { Frame, toFrame }
