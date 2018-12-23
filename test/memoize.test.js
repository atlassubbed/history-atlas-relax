const { describe, it } = require("mocha")
const { expect } = require("chai")
const { Tracker } = require("./effects");
const { Frame, diff } = require("../src/index");
const { StemCell: { m } } = require("./cases/Frames");
const { treeCase } = require("./cases/entangle");

describe("memoization and immutability support", function(){
  describe("updating root frames with new template === old template", function(){
    it("should not update", function(){
      const events = [], tracker = new Tracker(events);
      const t = m(0, null, m(1)), f1 = diff(t, null, {effs: tracker});
      events.length = 0;
      const result = diff(t, f1);
      expect(result).to.be.false;
      expect(events).to.be.empty;
    })
    it("should not update even if old template has been mutated", function(){
      const events = [], tracker = new Tracker(events);
      const t = m(0, null, m(1)), f1 = diff(t, null, {effs: tracker});
      events.length = 0, t.next = null;
      const result = diff(t, f1);
      expect(result).to.be.false;
      expect(events).to.be.empty;
    })
    it("should not update entangled roots", function(){
      const events = [], t1 = new Tracker(events), t2 = new Tracker(events);
      const t = m(0), f1 = diff(t, null, {effs: t1}), f2 = diff(m(0), null, {effs: t1});
      events.length = 0;
      f2.sub(f1);
      const result = diff(t, f1);
      expect(result).to.be.false;
      expect(events).to.be.empty;
    })
  })
  describe("updating subframes (children) that receive new template === old template", function(){
    it("should not update any children which don't also own the current diff cycle", function(){
      const events = [], tracker = new Tracker(events);
      const m1 = m(1), m2 = m(2), f1 = diff(m(0,null,[m1, m2]), null, {effs: tracker});
      events.length = 0;
      const result = diff(m(0, null, [m1, m2]), f1);
      expect(result).to.be.an.instanceOf(Frame);
      expect(events).to.deep.equal([
        {wU: 0}, {mWR: 0}
      ]);
    })
    it("should update children if they receive new templates", function(){
      const events = [], tracker = new Tracker(events);
      const m1 = m(1), m2 = m(2), f1 = diff(m(0,null,[m1, m2]), null, {effs: tracker});
      events.length = 0;
      const result = diff(m(0,null,[m1, m(2)]), f1);
      expect(result).to.be.an.instanceOf(Frame);
      expect(events).to.deep.equal([
       {wU: 0}, {wU: 2}, {mWR: 0}, {mWR: 2}
      ]);
    })
    it("should not update children which receive old templates even if the child owns a future diff cycle", function(){
      const events = [], tracker = new Tracker(events);
      const m1 = m(1), m2 = m(2);
      const f1 = diff(m(0, null, [m1, m2]), null, {effs: tracker});
      events.length = 0;
      f1.next.sib.diff({id: 2}, 0)
      const result = diff(m(0, null, [m1, m2]), f1)
      expect(result).to.be.an.instanceOf(Frame);
      expect(events).to.deep.equal([
        {wU: 0}, {mWR: 0}
      ])
    })
    it("should update children which receive old templates as long as the child owns the current diff cycle", function(done){
      const events = [], tracker = new Tracker(events);
      const willUpdate = () => done();
      const t = m(0, null, [m(1), m(2, {hooks: {willUpdate}})])
      const f1 = diff(t, null, {effs: tracker});
      events.length = 0;
      f1.next.sib.diff({}, 0)
      f1.diff({}, 0);
    })
    it("should remove child's influence if it only depends on parent", function(){
      const { nodes, events } = treeCase.get();
      nodes[0].getNext = function(data, next){
        return this.next.temp;
      }
      nodes[0].diff();
      expect(events).to.deep.equal([
        {wU: 0}, {wU: 2}, {wU: 3}, {wU: 6}, {wU: 8}, {wU: 7},
      ])
    })
    it("should remove child's influence if it's entangled to nodes not in path", function(){
      const { nodes, events } = treeCase.get();
      nodes[0].getNext = function(data, next){
        return this.next.temp
      }
      const disjointRoot = diff(m(9), null, {effs: new Tracker(events)});
      events.length = 0;
      nodes[1].sub(disjointRoot)
      nodes[0].diff();
      expect(events).to.deep.equal([
        {wU: 0}, {wU: 2}, {wU: 3}, {wU: 6}, {wU: 8}, {wU: 7},
      ])
    })
    it("should prevent child's receipt of new template, but keep its influence if it's entangled to nodes in path", function(){
      const { nodes, events } = treeCase.get();
      nodes[1].getNext = function(data, next){
        next[0] = this.next.temp;
        return next;
      }
      nodes[0].diff();
      expect(events).to.deep.equal([ 
        {wU: 0}, {wU: 1}, {wU: 4}, {wU: 5}, {wU: 2}, {wU: 3}, {wU: 6}, {wU: 8}, {wU: 7},
        {mWR: 1}, /* {mWR: 2}, */ {mWR: 3}, {mWR: 5}, {mWR: 8}, {mWR: 6}, {mWR: 7},
      ])
    })
  })
})
