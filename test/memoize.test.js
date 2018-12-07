const { describe, it } = require("mocha")
const { expect } = require("chai")
const { Tracker, Passthrough } = require("./effects");
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
        {wR: 0}, {wU: 0}, {dU: 0}
      ]);
    })
    it("should update children if they receive new templates", function(){
      const events = [], tracker = new Tracker(events);
      const m1 = m(1), m2 = m(2), f1 = diff(m(0,null,[m1, m2]), null, {effs: tracker});
      events.length = 0;
      const result = diff(m(0,null,[m1, m(2)]), f1);
      expect(result).to.be.an.instanceOf(Frame);
      expect(events).to.deep.equal([
        {wR: 0}, {wU: 0}, {wR: 2}, {wU: 2}, {dU: 2}, {dU: 0}
      ]);
    })
    it("should not update children which receive old templates even if the child owns a future diff cycle", function(){
      const events = [], tracker = new Tracker(events);
      const m1 = m(1), m2 = m(2);
      const f1 = diff(m(0, null, [m1, m2]), null, {effs: [tracker, new Passthrough]});
      events.length = 0;
      f1.next.sib.diff({id: 2}, 0)
      const result = diff(m(0, null, [m1, m2]), f1)
      expect(result).to.be.an.instanceOf(Frame);
      expect(events).to.deep.equal([
        {wR: 0}, {wU: 0}, {dU: 0}
      ])
    })
    it("should update children which receive old templates as long as the child owns the current diff cycle", function(done){
      const events = [], tracker = new Tracker(events);
      const didUpdate = () => {
        expect(events).to.deep.equal([
          {wU: 0}, {wU: 2}, {dU: 2}, {dU: 0}
        ])
        done();
      }
      const t = m(0, {hooks: {didUpdate}}, [m(1), m(2)])
      const f1 = diff(t, null, {effs: [tracker, new Passthrough]});
      events.length = 0;
      f1.next.sib.diff({}, 0)
      f1.diff({}, 0);
    })
    it("should remove child's influence if it only depends on parent", function(){
      const { nodes, events } = treeCase.get();
      nodes[0].render = function(data, next){
        return this.next.temp;
      }
      nodes[0].diff();
      expect(events).to.deep.equal([
        {wU: 0}, {wU: 2}, {wU: 3}, {wU: 6}, {wU: 8}, {wU: 7},
        {dU: 7}, {dU: 8}, {dU: 6}, {dU: 3}, {dU: 2}, {dU: 0}
      ])
    })
    it("should remove child's influence if it's entangled to nodes not in path", function(){
      const { nodes, events } = treeCase.get();
      nodes[0].render = function(data, next){
        return this.next.temp
      }
      const disjointRoot = diff(m(9), null, {effs: new Tracker(events)});
      events.length = 0;
      nodes[1].sub(disjointRoot)
      nodes[0].diff();
      expect(events).to.deep.equal([
        {wU: 0}, {wU: 2}, {wU: 3}, {wU: 6}, {wU: 8}, {wU: 7},
        {dU: 7}, {dU: 8}, {dU: 6}, {dU: 3}, {dU: 2}, {dU: 0}
      ])
    })
    it("should prevent child's receipt of new template, but keep its influence if it's entangled to nodes in path", function(){
      const { nodes, events } = treeCase.get();
      nodes[1].render = function(data, next){
        next[0] = this.next.temp;
        return next;
      }
      nodes[0].diff();
      expect(events).to.deep.equal([ 
        {wU: 0}, {wR: 1}, {wU: 1}, /* {wR: 2}, */ {wR: 3},
        {wU: 4}, {wR: 5}, {wR: 8}, {wU: 5}, {wR: 6}, {wR: 7},
        {wU: 2}, {wU: 3},
        {wU: 6}, {wU: 8}, {wU: 7},
        {dU: 7}, {dU: 8}, {dU: 6}, {dU: 3}, {dU: 2}, {dU: 5}, {dU: 4}, {dU: 1}, {dU: 0} 
      ])
    })
  })
})
