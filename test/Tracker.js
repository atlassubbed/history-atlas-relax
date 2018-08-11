const { expect } = require("chai")
const { Frame } = require("../src/index");

// Tracker creates effects that track diffs.
module.exports = class Tracker {
  constructor(){this.events = []}
  reset(){this.events = []}
  willAdd(frame){
    if (frame.parent){
      expect(frame.parent).to.be.an.instanceOf(Frame);
      expect(frame.pos).to.be.greaterThan(-1)
      expect(frame.parent.children.indexOf(frame)).to.equal(frame.pos)
      expect(frame.children).to.be.null
    }
    this.capture("wA", frame)
  }
  didAdd(frame){this.capture("dA", frame)}
  willUpdate(frame, data){this.capture("wU", frame, {data})}
  didUpdate(frame, data){this.capture("dU", frame, {data})}
  willRemove(frame){this.capture("wR", frame)}
  didRemove(frame){
    expect(frame.children).to.be.null;
    expect(frame.parent).to.be.null
    expect(frame.pos).to.be.null
    this.capture("dR", frame)
  }
  capture(type, frame, meta){
    let name = frame.name, id = frame.data;
    if (typeof name === "function") name = name.name;
    if (id && typeof id === "object") id = id.id
    this.events.push(Object.assign({[type]: name, id}, meta));
  }
}
