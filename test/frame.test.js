const { describe, it } = require("mocha")
const { expect } = require("chai")
const { Frame } = require("../src/index");

describe("Frame", function(){
  describe("constructor", function(){
    it("should throw error if no template provided", function(){
      expect(() => new Frame()).to.throw;
    })
    it("should set cache-related properties to null", function(){
      const f = new Frame({})
      expect(f.parent).to.be.null;
      expect(f.children).to.be.null;
      expect(f.pos).to.be.null;
      expect(f.keys).to.be.null;
      expect(f.state).to.be.null;
    })
    it("should set non-existent template properties and effects to null", function(){
      const f = new Frame({});
      expect(f.data).to.be.null;
      expect(f.next).to.be.null;
      expect(f.key).to.be.null;
      expect(f.name).to.be.null;
      expect(f.effects).to.be.null;
    })
    it("should set existing template properties and effects onto the instance", function(){
      const name = 1, data = 2, next = 3, key = 4, effects = [5];
      const f = new Frame({name, data, next, key}, effects);
      const f2 = new Frame({}, effects[0])
      expect(f.data).to.equal(data);
      expect(f.next).to.equal(next);
      expect(f.key).to.equal(key);
      expect(f.name).to.equal(name);
      expect(f.effects).to.equal(effects);
      expect(f2.effects).to.deep.equal(effects)
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
})
