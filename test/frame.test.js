const { describe, it } = require("mocha")
const { expect } = require("chai")
const { Frame } = require("../src/index");

describe("Frame", function(){
  describe("constructor", function(){
    it("should not set instance fields if instantiated with no template", function(){
      expect(Object.keys(new Frame)).to.be.empty;
    })
    it("should set cache-related properties to null", function(){
      const f = new Frame({})
      expect(f.parent).to.be.null;
      expect(f.children).to.be.null;
      expect(f.keys).to.be.null;
      expect(f.state).to.be.null;
    })
    it("should set template properties and effects onto the instance", function(){
      const name = 1, data = 2, next = 3, key = 4, effects = [5];
      const temp = {name, data, next, key}, temp2 = {};
      const f = new Frame(temp, effects);
      const f2 = new Frame(temp2, effects[0])
      expect(f.temp).to.equal(temp)
      expect(f.key).to.equal(key);
      expect(f.name).to.equal(name);
      expect(f.effects).to.equal(effects);
      expect(f2.effects).to.equal(5)
      expect(f2.hasOwnProperty("key")).to.be.true;
      expect(f2.hasOwnProperty("name")).to.be.true;
      expect(f2.temp).to.equal(temp2)
    })
  })
  describe("static isFrame", function(){
    it("should return true for objects with an evaluate method", function(){
      const f = new Frame({});
      class Subframe extends Frame {};
      const s = new Subframe({});
      expect(Frame.isFrame(f)).to.be.true;
      expect(Frame.isFrame(s)).to.be.true;
    })
    it("should return false otherwise", function(){
      expect(Frame.isFrame(() => {})).to.be.false
    })
  })
  describe("static define", function(){
    it("should throw an error if provided base frame class", function(){
      expect(() => Frame.define(Frame, {evaluate(){return null}}))
        .to.throw("cannot re-define base")
    })
    it("should turn the provided class into a subclass of frame", function(){
      const Subframe = function(temp, effs){Frame.call(this, temp, effs)}
      const methods = {evaluate(){return null}};
      Frame.define(Subframe, methods);
      expect(Subframe.prototype.constructor).to.equal(Subframe)
      expect(Subframe.prototype.evaluate).to.equal(methods.evaluate)
      expect(new Subframe({})).to.be.an.instanceOf(Frame)
    })
  })
})
