const { isComp, isFn, isArr, toArr, id } = require("./util")

// APIs for creating frame classes
//   1. class MyFrame extends Frame {...}
//   2. class MyFrame {constructor(t, e){Frame.call(this, t, e)} evaluate(){...}}
//   3. const MyFrame = (d, n) => {...}
//   4. const MyFrame = Frame.define(MyFrame, methods)
// not to be instantiated by caller
const Frame = function(temp, effs){
  if (!temp) return;
  this.parent = this.state = this.keys = null;
  this.children = null;
  this.effects = effs, this.temp = temp;
  this.name = temp.name, this.key = temp.key;
}
Frame.prototype.evaluate = function(data, next){ return next }
Frame.prototype.entangle = function(){}
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
