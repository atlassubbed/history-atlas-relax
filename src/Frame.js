const { isComp, isFn, isArr } = require("./util")
const RSV = ["name", "data", "next", "key"]
const nRSV = RSV.length

// XXX don't recommend Subframe extends Frame API for performance reasons...
//   switch class Frame {} to raw constructor syntax...

// not to be instantiated by caller

// const Frame = function(temp, effs){
//   this.parent = this.children = this.pos = null;
//   this.state = this.keys = null;
//   // XXX move this into toFrame, 
//   //   since pseudo-frames (classes with an evaluate method)
//   //   may not do this in their constructors...
//   this.effects = effs ? isArr(effs) ? effs : [effs] : null;
//   for (let i = nRSV, k, v; i--;)
//     this[k = RSV[i]] = (v = temp[k]) == null ? null : v
// }

// // XXX don't need this, just use next inline in subdiff?
// Frame.prototype.evaluate = function(data, next){
//   return next;
// }

// Frame.isFrame = f => !!f && isFn(f.evaluate);

class Frame {
  constructor(temp, effs){
    this.parent = this.children = this.pos = null;
    this.state = this.keys = null;
    // XXX move this into toFrame, 
    //   since pseudo-frames (classes with an evaluate method)
    //   may not do this in their constructors...
    this.effects = effs ? isArr(effs) ? effs : [effs] : null;
    for (let i = nRSV, k, v; i--;)
      this[k = RSV[i]] = (v = temp[k]) == null ? null : v
  }
  // XXX move entangle, setState, setTau into an object
  //   and set the prototype in toFrame or in createFrame???
  //   then, the caller doesn't have to use "extends"
  //   and can just define a basic class however they want
  //   ultimately, this.setState, this.setTau, this.entangle
  //   should still be callable in their class without them implementing it
  entangle(){}
  setState(){}
  setTau(){}
  evaluate(data, next){ return next }
  static isFrame(f){return !!f && isFn(f.evaluate)}
  // static helper "define" for pre-es6 code?
  // in "define", merge the optionsObject with Object.create(Frame.prototype)
  // then set that to the prototype of the new class.
}

const isFrame = Frame.isFrame;

// temp is already normalized
const toFrame = (temp, effs) => {
  if (!isComp(temp)) return new Frame(temp, effs);
  const Subframe = temp.name
  if (isFrame(Subframe.prototype)) return new Subframe(temp, effs);
  const frame = new Frame(temp, effs);
  // XXX don't bind to frame here, since this should be stateless
  frame.evaluate = Subframe.bind(frame);
  return frame;
}

module.exports = { Frame, toFrame }
