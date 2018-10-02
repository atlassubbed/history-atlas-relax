const { describe, it } = require("mocha")
const { expect } = require("chai")
const { Tracker, PassThrough } = require("./Effects");
const { diff: rawDiff } = require("../src/index");
const { rootCase, treeCase, p, a } = require("./cases/entangle");
const { has } = require("./util");

const pass = new PassThrough;
const diff = (t, f, eff) => rawDiff(t, f, eff ? [eff, pass] : null);

const updateHooks = ["willReceive", "willUpdate", "didUpdate"];
const addHooks = ["willPush", "willAdd", "didAdd"];
const allHooks = [...addHooks, ...updateHooks];

// TODO: refactor this, but maybe not too much
describe("entanglement", function(){
  describe("amongst root frames", function(){
    it("should throw before the next diff runs if there are cycles", function(){
      const events = [], t1 = new Tracker(events), t2 = new Tracker(events); 
      const r1 = diff(p(0), null, t1), r2 = diff(p(0), null, t2);
      r1.entangle(r2), r2.entangle(r1), events.length = 0;
      expect(() => diff(p(0), r1)).to.throw("cyclic entanglement")
      expect(events).to.be.empty;
    })
    allHooks.forEach(hook => {
      it(`should throw before the next diff runs if cycles are introduced in ${hook}`, function(){
        const events = [], t1 = new Tracker(events), t2 = new Tracker(events);
        const r1 = diff(p(0), null, t1); 
        const r2 = diff(p(1, {[hook]: f => r1.entangle(f)}), null, t2);
        r2.entangle(r1), events.length = 0;
        const update = () => diff(p(1), r2);
        if (has(addHooks, hook)){
          expect(update).to.throw("cyclic entanglement")
        } else {
          expect(update).to.not.throw()
          events.length = 0;
          expect(update).to.throw("cyclic entanglement")
        }        
        expect(events).to.be.empty;
      })
    })
    describe("diffs in correct order", function(){
      it("should update nodes if upstream updated", function(){
        const {nodes, events} = rootCase.get();
        diff(p(0), nodes[0])
        expect(events).to.deep.equal([ 
          {wR: 0}, {wU: 0}, {wU: 1}, {wU: 2}, {wU: 3}, 
          {dU: 3}, {dU: 2}, {dU: 1}, {dU: 0}
        ])
      })
      it("should update nodes if upstream removed", function(){
        const {nodes, events} = rootCase.get();
        diff(null, nodes[0])
        expect(events).to.deep.equal([ 
          {wP: 0}, {dP: 0},
          {wU: 1}, {wU: 2}, {wU: 3},
          {dU: 3}, {dU: 2}, {dU: 1}
        ])
      })
      it("should update nodes if upstream replaced", function(){
        const {nodes, events} = rootCase.get();
        diff(a(0), nodes[0])
        expect(events).to.deep.equal([ 
          {wP: 0}, {dP: 0},
          {wU: 1}, {wU: 2}, {wU: 3},
          {dU: 3}, {dU: 2}, {dU: 1},
          {wPu: 0}, {wA: 0}, {dA: 0}
        ])
      })
      it("should not update all nodes if downstream updated", function(){
        const {nodes, events} = rootCase.get();
        diff(p(3), nodes[3])
        expect(events).to.deep.equal([{wR: 3}, {wU: 3}, {dU: 3}])
      })
      it("should not update all nodes if downstream removed", function(){
        const {nodes, events} = rootCase.get();
        diff(null, nodes[3])
        expect(events).to.deep.equal([{wP: 3}, {dP: 3}])
      })
      it("should not update all nodes if downstream replaced", function(){
        const {nodes, events} = rootCase.get();
        diff(a(3), nodes[3])
        expect(events).to.deep.equal([{wP: 3}, {dP: 3}, {wPu: 3}, {wA: 3}, {dA: 3}])
      })
      it("should reflect post-diff changes in entanglement in the next diff", function(){
        const {nodes, events} = rootCase.get();
        diff(p(0), nodes[0]);
        events.length = 0;
        nodes[2].detangle(nodes[1]);
        nodes[1].entangle(nodes[2]);
        diff(p(0), nodes[0])
        expect(events).to.deep.equal([ 
          {wR: 0}, {wU: 0}, {wU: 2}, {wU: 1}, {wU: 3}, 
          {dU: 3}, {dU: 1}, {dU: 2}, {dU: 0}
        ])
      })
    })
    describe("applied dynamically are realized in next diff", function(){
      updateHooks.forEach(hook => {
        it(`should update nodes in new order if edges are introduced in ${hook}`, function(){
          const { nodes, events } = rootCase.get({
            0: {[hook]: f => {
              nodes[2].detangle(nodes[1]);
              nodes[1].entangle(nodes[2]);
            }}
          })
          const result = [
            {wR: 0}, {wU: 0}, {wU: 2}, {wU: 1}, {wU: 3}, 
            {dU: 3}, {dU: 1}, {dU: 2}, {dU: 0}
          ]
          const update = () => diff(p(0), nodes[0]);
          update()
          expect(events).to.not.deep.equal(result)
          events.length = 0, update();
          expect(events).to.deep.equal(result)
        })
      })
      it("should properly update newly added nodes", function(){
        updateHooks.forEach(hook => {
          let p4;
          const { nodes, events } = rootCase.get({
            0: {[hook]: f => {
              if (!p4) p4 = diff(p(4), null, new Tracker(events));
              p4.entangle(nodes[3])
            }}
          })
          const update = () => diff(p(0), nodes[0]);
          update(), events.length = 0, update();
          expect(events).to.deep.equal([
            {wR: 0}, {wU: 0}, {wU: 1}, {wU: 2}, {wU: 3}, {wU: 4}, 
            {dU: 4}, {dU: 3}, {dU: 2}, {dU: 1}, {dU: 0}
          ])
        })
      })
      it("should properly destroy nodes removed during willReceive", function(){
        const { nodes, events } = rootCase.get({
          0: {willReceive: f => diff(null, nodes[3])}
        })
        diff(p(0), nodes[0]);
        expect(events).to.deep.equal([
          {wR: 0}, {wP: 3}, {dP: 3}, {wU: 0}, {wU: 1}, {wU: 2},
          {dU: 2}, {dU: 1}, {dU: 0}
        ])
      })
      it("should properly destroy nodes removed during willUpdate", function(){
        const { nodes, events } = rootCase.get({
          0: {willUpdate: f => diff(null, nodes[3])}
        })
        diff(p(0), nodes[0]);
        expect(events).to.deep.equal([
          {wR: 0}, {wU: 0}, {wP: 3}, {dP: 3}, {wU: 1}, {wU: 2},
          {dU: 2}, {dU: 1}, {dU: 0}
        ])
      })
      it("should update, then destroy nodes removed during didUpdate", function(){
        const { nodes, events } = rootCase.get({
          0: {didUpdate: f => diff(null, nodes[3])}
        })
        diff(p(0), nodes[0]);
        expect(events).to.deep.equal([
          {wR: 0}, {wU: 0}, {wU: 1}, {wU: 2}, {wU: 3},
          {dU: 3}, {dU: 2}, {dU: 1}, {dU: 0}, {wP: 3}, {dP: 3}
        ])
      })
    })
  })
  describe("amongst subframes", function(){
    it("should throw before the next diff runs if there are cycles", function(){
      const events = [], t = new Tracker(events);
      const r = diff(p(0, null, [p(1), p(2)]), null, t), c = r.next;
      c[0].entangle(c[1]), c[1].entangle(c[0]), events.length = 0;
      expect(() => diff(p(0, null, [p(1), p(2)]), r)).to.throw("cyclic entanglement")
      expect(events).to.be.empty;
    })
    allHooks.forEach(hook => {
      if (hook === "willPush") return;
      it(`should throw before the next diff runs if cycles are introduced in ${hook}`, function(){
        const events = [], t = new Tracker(events);
        const hooks = {
          willPush: (f, p) => {f.parent = p},
          [hook]: f => {
            f.entangle(f.parent.next[0])
          }
        }
        const r = diff(p(0, null, [p(1), p(2, hooks)]), null, t);
        r.next[0].entangle(r.next[1])
        events.length = 0;
        const update = () => diff(p(0, null, [p(1), p(2)]), r)
        if (has(addHooks, hook)){
          expect(update).to.throw("cyclic entanglement")
        } else {
          expect(update).to.not.throw();
          events.length = 0;
          expect(update).to.throw("cyclic entanglement")
        }
        expect(events).to.be.empty;
      })      
    })
    describe("diffs in correct order", function(){
      it("should update nodes if upstream updated", function(){
        const {nodes, events} = treeCase.get();
        diff(treeCase.tag0(), nodes[0])
        expect(events).to.deep.equal([ 
          {wR: 0}, {wU: 0}, {wR: 1}, {wU: 1}, {wR: 2}, {wR: 3},
          {wU: 4}, {wR: 5}, {wR: 8}, {wU: 5}, {wR: 6}, {wR: 7},
          {wU: 2}, {wU: 3},
          {wU: 6}, {wU: 8}, {wU: 7},
          {dU: 7}, {dU: 8}, {dU: 6}, {dU: 3}, {dU: 2}, {dU: 5}, {dU: 4}, {dU: 1}, {dU: 0} 
        ])
      })
      it("should update nodes if upstream removed", function(){
        const {nodes, events} = treeCase.get();
        diff(null, nodes[0])
        expect(events).to.deep.equal([ 
          {wP: 0}, {wP: 1}, {wP: 3}, {dP: 3}, {wP: 2}, {dP: 2}, {dP: 1}, {dP: 0},
          {wU: 4}, {wR: 5}, {wR: 8}, {wU: 5}, {wR: 6}, {wR: 7},
          {wU: 6}, {wU: 8}, {wU: 7},
          {dU: 7}, {dU: 8}, {dU: 6}, {dU: 5}, {dU: 4}
        ])
      })
      it("should update nodes if upstream replaced", function(){
        const {nodes, events} = treeCase.get();
        diff(a(0), nodes[0])
        expect(events).to.deep.equal([ 
          {wP: 0}, {wP: 1}, {wP: 3}, {dP: 3}, {wP: 2}, {dP: 2}, {dP: 1}, {dP: 0},
          {wU: 4}, {wR: 5}, {wR: 8}, {wU: 5}, {wR: 6}, {wR: 7},
          {wU: 6}, {wU: 8}, {wU: 7},
          {dU: 7}, {dU: 8}, {dU: 6}, {dU: 5}, {dU: 4},
          {wPu: 0}, {wA: 0}, {dA: 0}
        ])
      })
      it("should not update all nodes if downstream updated", function(){
        const {nodes, events} = treeCase.get();
        diff(treeCase.tag4(), nodes[4])
        expect(events).to.deep.equal([ 
          {wR: 4}, {wU: 4}, {wR: 5}, {wR: 8},
          {wU: 5}, {wR: 6}, {wR: 7},
          {wU: 3}, {wU: 6}, {wU: 8}, {wU: 7},
          {dU: 7}, {dU: 8}, {dU: 6}, {dU: 3}, {dU: 5}, {dU: 4}
        ])
      })
      it("should not update all nodes if downstream removed", function(){
        const {nodes, events} = treeCase.get();
        diff(null, nodes[4])
        expect(events).to.deep.equal([ 
          {wP: 4}, {wP: 8}, {dP: 8}, {wP: 5},
          {wP: 7}, {dP: 7}, {wP: 6}, {dP: 6}, {dP: 5}, {dP:4},
          {wU: 3}, {dU: 3} 
        ])
      })
      it("should not update all nodes if downstream replaced", function(){
        const {nodes, events} = treeCase.get();
        diff(a(4), nodes[4])
        expect(events).to.deep.equal([ 
          {wP: 4}, {wP: 8}, {dP: 8}, {wP: 5},
          {wP: 7}, {dP: 7}, {wP: 6}, {dP: 6}, {dP: 5}, {dP:4},
          {wU: 3}, {dU: 3},
          {wPu: 4}, {wA: 4}, {dA: 4},
        ])
      })
      it("should reflect post-diff changes in entanglement in the next diff", function(){
        const {nodes, events} = treeCase.get();
        diff(treeCase.tag0(), nodes[0])
        events.length = 0;
        nodes[3].detangle(nodes[2]);
        nodes[2].entangle(nodes[3]);
        diff(treeCase.tag0(), nodes[0])
        expect(events).to.deep.equal([ 
          {wR: 0}, {wU: 0}, {wR: 1}, {wU: 1}, {wR: 2}, {wR: 3},
          {wU: 4}, {wR: 5}, {wR: 8}, {wU: 5}, {wR: 6}, {wR: 7},
          {wU: 3}, {wU: 2},
          {wU: 6}, {wU: 8}, {wU: 7},
          {dU: 7}, {dU: 8}, {dU: 6}, {dU: 2}, {dU: 3}, {dU: 5}, {dU: 4}, {dU: 1}, {dU: 0} 
        ])
      })
    })
    describe("applied dynamically are realized in next diff", function(){
      updateHooks.forEach(hook => {
        it(`should update nodes in new order if edges are introduced in ${hook}`, function(){
          const { nodes, events } = treeCase.get({
            2: {[hook]: f => {
              nodes[3].detangle(f);
              f.entangle(nodes[3]);
            }}
          })
          const result = [ 
            {wR: 0}, {wU: 0}, {wR: 1}, {wU: 1}, {wR: 2}, {wR: 3},
            {wU: 4}, {wR: 5}, {wR: 8}, {wU: 5}, {wR: 6}, {wR: 7},
            {wU: 3}, {wU: 2}, 
            {wU: 6}, {wU: 8}, {wU: 7},
            {dU: 7}, {dU: 8}, {dU: 6}, {dU: 2}, {dU: 3}, {dU: 5}, {dU: 4}, {dU: 1}, {dU: 0} 
          ]
          const update = () => diff(treeCase.tag0(), nodes[0]);
          update()
          expect(events).to.not.deep.equal(result);
          events.length = 0, update();
          expect(events).to.deep.equal(result)
        })
      })
      // this is a legacy test from back when we used the affCount to decide whether to defer new adds
      it("should add new unentangled children after the affected region is updated", function(){
        const { nodes, events } = treeCase.get({
          2: {
            willUpdate: f => {f.nextChildren = [p(9, null, p(10)), p(11)]},
            diff(data, next){
              return this.nextChildren
            }
          }
        })
        const result = [ 
          {wR: 0}, {wU: 0}, {wR: 1}, {wU: 1}, {wR: 2}, {wR: 3},
          {wU: 4}, {wR: 5}, {wR: 8}, {wU: 5}, {wR: 6}, {wR: 7}, 
          {wU: 2}, {wPu: 9}, {wPu: 11}, {wU: 3}, {wU: 6}, {wU: 8}, {wU: 7}, 
          {wA: 11}, {dA: 11}, {wA: 9}, {wPu: 10}, {wA: 10}, {dA: 10}, {dA: 9},
          {dU: 7}, {dU: 8}, {dU: 6}, {dU: 3}, {dU: 2}, {dU: 5}, {dU: 4}, {dU: 1}, {dU: 0} 
        ]
        diff(treeCase.tag0(), nodes[0]);
        expect(events).to.deep.equal(result);
      })
      it("should properly update new unentangled children during the next diff", function(){
        const { nodes, events } = treeCase.get({
          2: {
            willUpdate: f => {f.nextChildren = [p(9, null, p(10)), p(11)]},
            diff(data, next){
              return this.nextChildren
            }
          }
        })
        const result = [ 
          {wR: 0}, {wU: 0}, {wR: 1}, {wU: 1}, {wR: 2}, {wR: 3},
          {wU: 4}, {wR: 5}, {wR: 8}, {wU: 5}, {wR: 6}, {wR: 7},
          {wU: 2}, {wR: 9}, {wU: 9}, {wR: 10}, {wU: 10}, {dU: 10}, {dU: 9}, {wR: 11}, {wU: 11}, {dU: 11},
          {wU: 3}, {wU: 6}, {wU: 8}, {wU: 7},
          {dU: 7}, {dU: 8}, {dU: 6}, {dU: 3}, {dU: 2}, {dU: 5}, {dU: 4}, {dU: 1}, {dU: 0} 
        ]
        const update = () => diff(treeCase.tag0(), nodes[0]);
        update(), events.length = 0, update();
        expect(events).to.deep.equal(result);
      })
      it("should add new entangled children after the affected region is updated", function(){
        const { nodes, events } = treeCase.get({
          2: {
            willUpdate: f => {
              f.nextChildren = [p(9, {ctor: f => f.entangle(nodes[7])}, p(10)), p(11)]
            },
            diff(data, next){
              return this.nextChildren
            }
          }
        })
        const result = [ 
          {wR: 0}, {wU: 0}, {wR: 1}, {wU: 1}, {wR: 2}, {wR: 3},
          {wU: 4}, {wR: 5}, {wR: 8}, {wU: 5}, {wR: 6}, {wR: 7},
          {wU: 2}, {wPu: 9}, {wPu: 11}, {wU: 3}, {wU: 6}, {wU: 8}, {wU: 7},
          {wA: 11}, {dA: 11}, {wA: 9}, {wPu: 10}, {wA: 10}, {dA: 10}, {dA: 9},
          {dU: 7}, {dU: 8}, {dU: 6}, {dU: 3}, {dU: 2}, {dU: 5}, {dU: 4}, {dU: 1}, {dU: 0} 
        ]
        diff(treeCase.tag0(), nodes[0]);
        expect(events).to.deep.equal(result);
      })
      it("should properly update newly entangled children in the next diff", function(){
        const { nodes, events } = treeCase.get({
          2: {
            willUpdate: f => {
              f.nextChildren = [p(9, {ctor: f => f.entangle(nodes[7])}, p(10)), p(11)]
            },
            diff(data, next){
              return this.nextChildren
            }
          }
        })
        const result = [ 
          {wR: 0}, {wU: 0}, {wR: 1}, {wU: 1}, {wR: 2}, {wR: 3},
          {wU: 4}, {wR: 5}, {wR: 8}, {wU: 5}, {wR: 6}, {wR: 7},
          {wU: 2}, {wR: 9}, {wR: 11}, {wU: 11}, {dU: 11},
          {wU: 3}, {wU: 6}, {wU: 8}, {wU: 7}, {wU: 9}, {wR: 10}, {wU: 10},
          {dU: 10}, {dU: 9}, {dU: 7}, {dU: 8}, {dU: 6}, {dU: 3},
          {dU: 2}, {dU: 5}, {dU: 4}, {dU: 1}, {dU: 0} 
        ]
        const update = () => diff(treeCase.tag0(), nodes[0]);
        update(), events.length = 0, update();
        expect(events).to.deep.equal(result);
      })
      // this is a legacy test from back when we used the affCount to decide whether to defer new adds
      it("should add new affector children after the affected region is updated", function(){
        const { nodes, events } = treeCase.get({
          2: {
            willUpdate: f => {
              f.nextChildren = [p(9, {ctor: f => nodes[4].entangle(f)}, p(10)), p(11)]
            },
            diff(data, next){
              return this.nextChildren
            }
          }
        })
        const result = [ 
          {wR: 0}, {wU: 0}, {wR: 1}, {wU: 1}, {wR: 2}, {wR: 3},
          {wU: 4}, {wR: 5}, {wR: 8}, {wU: 5}, {wR: 6}, {wR: 7}, 
          {wU: 2}, {wPu: 9}, {wPu: 11}, {wU: 3}, {wU: 6}, {wU: 8}, {wU: 7}, 
          {wA: 11}, {dA: 11}, {wA: 9}, {wPu: 10}, {wA: 10}, {dA: 10}, {dA: 9},
          {dU: 7}, {dU: 8}, {dU: 6}, {dU: 3}, {dU: 2}, {dU: 5}, {dU: 4}, {dU: 1}, {dU: 0} 
        ]
        diff(treeCase.tag0(), nodes[0]);
        expect(events).to.deep.equal(result);
      })
      it("should properly account for recently added affector children during the next diff", function(){
        const { nodes, events } = treeCase.get({
          2: {
            willUpdate: f => {
              f.nextChildren = [p(9, {ctor: f => nodes[4].entangle(f)}, p(10)), p(11)]
            },
            diff(data, next){
              return this.nextChildren
            }
          }
        })
        const result = [ 
          {wR: 0}, {wU: 0}, {wR: 1}, {wU: 1}, {wR: 2}, {wR: 3},
          {wU: 2}, {wR: 9}, {wR: 11}, {wU: 11}, {dU: 11}, {wU: 9}, {wR: 10}, {wU: 10}, {dU: 10},
          {wU: 4}, {wR: 5}, {wR: 8}, {wU: 5}, {wR: 6}, {wR: 7},
          {wU: 3}, {wU: 6}, {wU: 8}, {wU: 7},
          {dU: 7}, {dU: 8}, {dU: 6}, {dU: 3}, 
          {dU: 5}, {dU: 4}, {dU: 9}, {dU: 2}, {dU: 1}, {dU: 0} 
        ]
        const update = () => diff(treeCase.tag0(), nodes[0]);
        update(), events.length = 0, update();
        expect(events).to.deep.equal(result);
      })
      it("should immediately remove children regardless of entanglement", function(){
        const { nodes, events } = treeCase.get({
          0: {
            willUpdate: f => {
              f.kill = true;
            },
            diff(data, next){
              return this.kill ? null : next;
            }
          }
        })
        const result = [
          {wR: 0}, {wU: 0}, {wP: 1}, {wP: 3}, {dP: 3}, {wP: 2}, {dP: 2}, {dP: 1},
          {wU: 4}, {wR: 5}, {wR: 8}, {wU: 5}, {wR: 6}, {wR: 7},
          {wU: 6}, {wU: 8}, {wU: 7},
          {dU: 7}, {dU: 8}, {dU: 6}, {dU: 5}, {dU: 4}, {dU: 0} 
        ]
        diff(treeCase.tag0(), nodes[0]);
        expect(events).to.deep.equal(result);
      })
      // this is a legacy test from back when we used the affCount to decide whether to defer new adds
      // now we just defer everything until the path has been exhausted; this test should fail if we selectively defer
      it("should immediately remove a replaced child and defer adding the new one if it has no entanglement", function(){
        const { nodes, events } = treeCase.get({
          0: {
            willUpdate: f => {
              f.nextChildren = a(9);
            },
            diff(data, next){
              return this.nextChildren || next;
            }
          }
        })
        const result = [
          {wR: 0}, {wU: 0}, {wPu: 9}, {wS: 0}, {wP: 1}, {wP: 3}, {dP: 3}, {wP: 2}, {dP: 2}, {dP: 1},
          {wU: 4}, {wR: 5}, {wR: 8}, {wU: 5}, {wR: 6}, {wR: 7},
          {wU: 6}, {wU: 8}, {wU: 7}, {wA: 9}, {dA: 9},
          {dU: 7}, {dU: 8}, {dU: 6}, {dU: 5}, {dU: 4}, {dU: 0} 
        ]
        diff(treeCase.tag0(), nodes[0]);
        expect(events).to.deep.equal(result);
      })
      it("should immediately remove a replaced child and defer adding the new one if it is entangled", function(){
        const { nodes, events } = treeCase.get({
          0: {
            willUpdate: f => {
              f.nextChildren = a(9, {ctor: f => f.entangle(nodes[4])});
            },
            diff(data, next){
              return this.nextChildren || next;
            }
          }
        })
        const result = [
          {wR: 0}, {wU: 0}, {wPu: 9}, {wS: 0}, {wP: 1}, {wP: 3}, {dP: 3}, {wP: 2}, {dP: 2}, {dP: 1},
          {wU: 4}, {wR: 5}, {wR: 8}, {wU: 5}, {wR: 6}, {wR: 7},
          {wU: 6}, {wU: 8}, {wU: 7}, {wA: 9}, {dA: 9},
          {dU: 7}, {dU: 8}, {dU: 6}, {dU: 5}, {dU: 4}, {dU: 0} 
        ]
        diff(treeCase.tag0(), nodes[0]);
        expect(events).to.deep.equal(result);
      })
      it("should account for the new entangled replacement child in the next diff", function(){
        const { nodes, events } = treeCase.get({
          0: {
            willUpdate: f => {
              f.nextChildren = a(9, {ctor: f => f.entangle(nodes[4])});
            },
            diff(data, next){
              return this.nextChildren || next;
            }
          }
        })
        const result = [
          {wR: 4}, {wU: 4}, {wR: 5}, {wR: 8}, {wU: 9}, {wU: 5}, {wR: 6}, {wR: 7},
          {wU: 6},  {wU: 8}, {wU: 7}, {dU: 7}, {dU: 8}, {dU: 6}, {dU: 5}, {dU: 9}, {dU: 4}
        ]
        diff(treeCase.tag0(), nodes[0]);
        events.length = 0;
        diff(treeCase.tag4(), nodes[4]);
        expect(events).to.deep.equal(result);
      })
    })
  })
})
