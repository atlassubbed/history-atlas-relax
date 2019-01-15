const { describe, it } = require("mocha")
const { expect } = require("chai")
const { Frame, diff } = require("../src/index");
const { StemCell } = require("./cases/Frames");

describe("Frame", function(){
  describe("constructor", function(){
    it("should not set instance fields if instantiated with no template", function(){
      expect(Object.keys(new Frame)).to.be.empty;
    })
    it("should set cache-related properties to their initial value", function(){
      const f = new Frame({});
      expect(f.affs).to.equal
        (f._affs).to.equal
        (f.next).to.equal
        (f.state).to.equal
        (f.prev).to.equal
        (f.sib).to.equal
        (f.it).to.equal
        (f.nextState).to.be.null
      expect(f._affN).to.equal(f.step).to.equal(0)
      expect(f.hasOwnProperty("effs")).to.be.true;
      expect(f.effs).to.be.undefined;
      expect(f.path).to.equal(1);
    })
    it("should set template and effects and tau getter onto the instance", function(){
      const name = 1, data = 2, next = 3, key = 4, effs = [5]
      const temp = {name, data, next, key}, temp2 = {};
      const f = new Frame(temp, effs);
      const f2 = new Frame(temp2, effs[0])
      expect(f.temp).to.equal(temp)
      expect(f.effs).to.equal(effs);
      expect(f2.effs).to.equal(5)
      expect(f2.temp).to.equal(temp2)
    })
  })
  describe("static isFrame", function(){
    it("should return true for objects with a diff method", function(){
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
  describe("sub", function(){
    it("should be idempotent", function(){
      const nodes = ["p","p","p"].map(name => diff({name}));
      expect(nodes[0]).to.deep.equal(nodes[1]).to.deep.equal(nodes[2])
      nodes[1].sub(nodes[0])
      nodes[1].sub(nodes[2])
      expect(nodes[0]).to.deep.equal(nodes[2]);
      nodes[1].sub(nodes[0])
      expect(nodes[0]).to.deep.equal(nodes[2]);
    })
    it("should do nothing if entangling with self", function(){
      const f1 = diff({name:"p", next: {name: "div"}});
      const f2 = diff({name:"p", next: {name: "div"}});
      expect(f1).to.deep.equal(f2);
      f1.sub(f1)
      expect(f1).to.deep.equal(f2);
    })
  })
  describe("unsub", function(){
    it("should be idempotent", function(){
      const nodes = ["p","p","p"].map(name => diff({name}));
      expect(nodes[0]).to.deep.equal(nodes[1]).to.deep.equal(nodes[2])
      nodes[1].sub(nodes[0])
      nodes[1].sub(nodes[2])
      expect(nodes[0]).to.deep.equal(nodes[2]);
      nodes[1].unsub(nodes[2])
      nodes[1].unsub(nodes[0])
      nodes[1].unsub(nodes[0])
      expect(nodes[0]).to.deep.equal(nodes[2]);
    })
    it("should be the inverse of sub if removing last edge", function(){
      const nodes = ["p","p","p"].map(name => diff({name}));
      expect(nodes[0]).to.deep.equal(nodes[1]).to.deep.equal(nodes[2])
      nodes[0].sub(nodes[1])
      expect(nodes[1]).to.not.deep.equal(nodes[2]);
      nodes[0].unsub(nodes[1]);
      expect(nodes[1]).to.deep.equal(nodes[2])
    })
  })
})
