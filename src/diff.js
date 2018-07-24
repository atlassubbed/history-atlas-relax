const Frame = require("./Frame")
const { isVoid } = require("./util")

module.exports = diff = (effect, frame) => {
  // instaniate a brand new effect
  if (!isVoid(effect)) return add(effect);
  // or destroy an existing root frame
  if (!Frame.isFrame(frame) || frame.affector) 
    throw new Error("invalid root frame");
  remove(frame);
}
