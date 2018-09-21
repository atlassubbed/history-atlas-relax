const { describe, it } = require("mocha")
const { expect } = require("chai")
const { Frame, diff } = require("../src/index");
const { Oscillator } = require("./cases/Frames");

const h = Oscillator.h;

describe("Frame", function(){
  describe("constructor", function(){
    it("should not set instance fields if instantiated with no template", function(){
      expect(Object.keys(new Frame)).to.be.empty;
    })
    it("should set cache-related properties to their initial value", function(){
      const f = new Frame({})
      expect(f.affs).to.equal
        (f._affs).to.equal
        (f.next).to.equal
        (f.state).to.equal
        (f.nextState).to.equal
        (f.keys).to.be.null;
      expect(f.affCount).to.equal(f._affCount).to.equal(0)
      expect(f.hasOwnProperty("effs")).to.be.true;
      expect(f.effs).to.be.undefined;
      expect(f.inStep).to.equal(f.inPath).to.equal(f.isOrig).to.be.false;
    })
    it("should set template and effects onto the instance", function(){
      const name = 1, data = 2, next = 3, key = 4, effs = [5];
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
  describe("entangle", function(){
    it("should be idempotent", function(){
      const nodes = ["p","p","p"].map(name => diff({name}));
      expect(nodes[0]).to.deep.equal(nodes[1]).to.deep.equal(nodes[2])
      nodes[1].entangle(nodes[0])
      nodes[1].entangle(nodes[2])
      expect(nodes[0]).to.deep.equal(nodes[2]);
      nodes[1].entangle(nodes[0])
      expect(nodes[0]).to.deep.equal(nodes[2]);
    })
    it("should do nothing if entangling with self", function(){
      const f1 = diff({name:"p", next: {name: "div"}});
      const f2 = diff({name:"p", next: {name: "div"}});
      expect(f1).to.deep.equal(f2);
      f1.entangle(f1)
      expect(f1).to.deep.equal(f2);
    })
  })
  describe("detangle", function(){
    it("should be idempotent", function(){
      const nodes = ["p","p","p"].map(name => diff({name}));
      expect(nodes[0]).to.deep.equal(nodes[1]).to.deep.equal(nodes[2])
      nodes[1].entangle(nodes[0])
      nodes[1].entangle(nodes[2])
      expect(nodes[0]).to.deep.equal(nodes[2]);
      nodes[1].detangle(nodes[2])
      nodes[1].detangle(nodes[0])
      nodes[1].detangle(nodes[0])
      expect(nodes[0]).to.deep.equal(nodes[2]);
    })
    it("should be the inverse of entangle if removing last edge", function(){
      const nodes = ["p","p","p"].map(name => diff({name}));
      expect(nodes[0]).to.deep.equal(nodes[1]).to.deep.equal(nodes[2])
      nodes[0].entangle(nodes[1])
      expect(nodes[1]).to.not.deep.equal(nodes[2]);
      nodes[0].detangle(nodes[1]);
      expect(nodes[1]).to.deep.equal(nodes[2])
    })
  })
  describe("setTau", function(){
    it("should propagate tau changes if new tau is set", function(){
      const f = diff(h(0, 100, h(1, 40)));
      let propagated = false
      f.next[0].getTau = function(){ propagated = true }
      f.setTau(1000);
      expect(propagated).to.be.true;
    })
    it("should not propagate tau changes if current tau is re-set", function(){
      const f = diff(h(0, 100, h(1, 40)));
      let propagated = false
      f.next[0].getTau = function(){ propagated = true }
      f.setTau(100);
      expect(propagated).to.be.false;
    })
    it("should not propagate tau changes if tau < 0 and next tau < 0", function(){
      const f = diff(h(0, -1, h(1, 40)));
      let propagated = false
      f.next[0].getTau = function(){ propagated = true }
      f.setTau(-200);
      expect(propagated).to.be.false;
    })
    it("should not propagate tau changes to entangled frames", function(){
      const f1 = diff(h(0, 100)), f2 = diff(h(0, 40));
      f2.entangle(f1);
      let propagated = false
      f2.getTau = function(){ propagated = true }
      f1.setTau(1000);
      expect(propagated).to.be.false;
    })
  })
})
