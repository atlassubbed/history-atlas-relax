const { describe, it } = require("mocha")
const { expect } = require("chai")
const { Tracker } = require("./effects");
const { diff: rawDiff } = require("../src/index");
const { rootCase, treeCase, p, a } = require("./cases/entangle");
const { has } = require("./util");

const diff = (t, f, eff) => rawDiff(t, f, {effs: eff});

// willAdd is the first render, willUpdate is every other render
// didAdd is the first rendered, didUpdate is every other rendered
// only render and rendered are canonical
const updateHooks = ["willUpdate", "didUpdate"];
const addHooks = ["willAdd", "didAdd"];
const allHooks = [...addHooks, ...updateHooks];

// TODO: refactor this, but maybe not too much
describe("entanglement", function(){
  describe("amongst root frames", function(){
    it("should throw before the next diff runs if there are cycles", function(){
      const events = [], t1 = new Tracker(events), t2 = new Tracker(events); 
      const r1 = diff(p(0), null, t1), r2 = diff(p(0), null, t2);
      r1.sub(r2), r2.sub(r1), events.length = 0;
      expect(() => diff(p(0), r1)).to.throw("cyclic entanglement")
      expect(events).to.be.empty;
    })
    it("should clean up unmounted entangled affects by the end of the next cycle", function(){
      const r1 = diff(p(0)), r2 = diff(p(1));
      r2.sub(r1);
      expect(r1.affs).to.contain(r2);
      diff(null, r2);
      expect(r1.affs).to.contain(r2);
      diff(p(0), r1);
      expect(r1.affs).to.be.null
    })
    allHooks.forEach(hook => {
      it(`should throw before the next diff runs if cycles are introduced in ${hook}`, function(){
        const events = [], t1 = new Tracker(events), t2 = new Tracker(events);
        const r1 = diff(p(0), null, t1);
        const r2 = diff(p(1, {[hook]: f => r1.sub(f)}), null, t2);
        r2.sub(r1), events.length = 0;
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
          {wP: 0},
          {wU: 1}, {wU: 2}, {wU: 3},
          {dU: 3}, {dU: 2}, {dU: 1}
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
        expect(events).to.deep.equal([{wP: 3}])
      })
      it("should reflect post-diff changes in entanglement in the next diff", function(){
        const {nodes, events} = rootCase.get();
        diff(p(0), nodes[0]);
        events.length = 0;
        nodes[2].unsub(nodes[1]);
        nodes[1].sub(nodes[2]);
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
              nodes[2].unsub(nodes[1]);
              nodes[1].sub(nodes[2]);
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
              p4.sub(nodes[3])
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
      it.skip("should properly destroy nodes removed during willUpdate", function(){
        const { nodes, events } = rootCase.get({
          0: {willUpdate: f => diff(null, nodes[3])}
        })
        diff(p(0), nodes[0]);
        expect(events).to.deep.equal([
          {wR: 0}, {wU: 0}, {wP: 3}, {wU: 1}, {wU: 2},
          {dU: 2}, {dU: 1}, {dU: 0}
        ])
      })
      it.skip("should update, then destroy nodes removed during didUpdate", function(){
        const { nodes, events } = rootCase.get({
          0: {didUpdate: f => diff(null, nodes[3])}
        })
        diff(p(0), nodes[0]);
        expect(events).to.deep.equal([
          {wR: 0}, {wU: 0}, {wU: 1}, {wU: 2}, {wU: 3},
          {dU: 3}, {dU: 2}, {dU: 1}, {dU: 0}, {wP: 3}
        ])
      })
    })
  })
  describe("amongst subframes", function(){
    it("should throw before the next diff runs if there are cycles", function(){
      const events = [], t = new Tracker(events);
      const r = diff(p(0, null, [p(1), p(2)]), null, t), c = r.next;
      c.sub(c.sib), c.sib.sub(c), events.length = 0;
      expect(() => diff(p(0, null, [p(1), p(2)]), r)).to.throw("cyclic entanglement")
      expect(events).to.be.empty;
    })
    it("should clean up unmounted entangled affects by the end of the next cycle", function(){
      const r = diff(p(0, null, p(1))), c = r.next;
      c.sub(r);
      expect(r.affs).to.contain(c);
      diff(p(0), r);
      expect(r.affs).to.contain(c);
      diff(p(0), r);
      expect(r.affs).to.be.null
    })
    allHooks.forEach(hook => {
      it(`should throw before the next diff runs if cycles are introduced in ${hook}`, function(){
        const events = [], t = new Tracker(events);
        let parent;
        const hooks = {
          [hook]: f => {
            f.sub(parent.next)
          }
        }
        const r = diff(p(0, {willAdd: f => parent = f}, [p(1), p(2, hooks)]), null, t);
        r.next.sub(r.next.sib)
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
          {wP: 0}, {wP: 1}, {wP: 2}, {wP: 3},
          {wU: 4}, {wR: 5}, {wR: 8}, {wU: 5}, {wR: 6}, {wR: 7},
          {wU: 6}, {wU: 8}, {wU: 7},
          {dU: 7}, {dU: 8}, {dU: 6}, {dU: 5}, {dU: 4}
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
          {wP: 4}, {wP: 5}, {wP: 6},
          {wP: 7}, {wP: 8},
          {wU: 3}, {dU: 3} 
        ])
      })
      it("should reflect post-diff changes in entanglement in the next diff", function(){
        const {nodes, events} = treeCase.get();
        diff(treeCase.tag0(), nodes[0])
        events.length = 0;
        nodes[3].unsub(nodes[2]);
        nodes[2].sub(nodes[3]);
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
              nodes[3].unsub(f);
              f.sub(nodes[3]);
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
            getNext(data, next){
              return this.nextChildren
            }
          }
        })
        const result = [ 
          {wR: 0}, {wU: 0}, {wR: 1}, {wU: 1}, {wR: 2}, {wR: 3},
          {wU: 4}, {wR: 5}, {wR: 8}, {wU: 5}, {wR: 6}, {wR: 7}, 
          {wU: 2}, {wU: 3}, {wU: 6}, {wU: 8}, {wU: 7}, {wA: 11}, {wA: 9},
          {wA: 10}, {dA: 10}, {dA: 9}, {dA: 11},
          {dU: 7}, {dU: 8}, {dU: 6}, {dU: 3}, {dU: 2}, {dU: 5}, {dU: 4}, {dU: 1}, {dU: 0} 
        ]
        diff(treeCase.tag0(), nodes[0]);
        expect(events).to.deep.equal(result);
      })
      it("should properly update new unentangled children during the next diff", function(){
        const { nodes, events } = treeCase.get({
          2: {
            willUpdate: f => {f.nextChildren = [p(9, null, p(10)), p(11)]},
            getNext(data, next){
              return this.nextChildren
            }
          }
        })
        const result = [ 
          {wR: 0}, {wU: 0}, {wR: 1}, {wU: 1}, {wR: 2}, {wR: 3},
          {wU: 4}, {wR: 5}, {wR: 8}, {wU: 5}, {wR: 6}, {wR: 7},
          {wU: 2}, {wR: 9}, {wR: 11}, {wU: 3}, {wU: 6}, {wU: 8}, {wU: 7}, {wU: 11}, {wU: 9}, {wR: 10}, {wU: 10},
          {dU: 10}, {dU: 9}, {dU: 11}, {dU: 7}, {dU: 8}, {dU: 6}, {dU: 3}, {dU: 2}, {dU: 5}, {dU: 4}, {dU: 1}, {dU: 0}
        ]
        const update = () => diff(treeCase.tag0(), nodes[0]);
        update(), events.length = 0, update();
        expect(events).to.deep.equal(result);
      })
      it("should add new entangled children after the affected region is updated", function(){
        const { nodes, events } = treeCase.get({
          2: {
            willUpdate: f => {
              f.nextChildren = [p(9, {ctor: f => f.sub(nodes[7])}, p(10)), p(11)]
            },
            getNext(data, next){
              return this.nextChildren
            }
          }
        })
        const result = [ 
          {wR: 0}, {wU: 0}, {wR: 1}, {wU: 1}, {wR: 2}, {wR: 3},
          {wU: 4}, {wR: 5}, {wR: 8}, {wU: 5}, {wR: 6}, {wR: 7},
          {wU: 2}, {wU: 3}, {wU: 6}, {wU: 8}, {wU: 7}, {wA: 11}, {wA: 9},
          {wA: 10}, {dA: 10}, {dA: 9}, {dA: 11},
          {dU: 7}, {dU: 8}, {dU: 6}, {dU: 3}, {dU: 2}, {dU: 5}, {dU: 4}, {dU: 1}, {dU: 0} 
        ]
        diff(treeCase.tag0(), nodes[0]);
        expect(events).to.deep.equal(result);
      })
      it("should properly update newly entangled children in the next diff", function(){
        const { nodes, events } = treeCase.get({
          2: {
            willUpdate: f => {
              f.nextChildren = [p(9, {ctor: f => f.sub(nodes[7])}, p(10)), p(11)]
            },
            getNext(data, next){
              return this.nextChildren
            }
          }
        })
        const result = [
          {wR: 0}, {wU: 0}, {wR: 1}, {wU: 1}, {wR: 2}, {wR: 3},
          {wU: 4}, {wR: 5}, {wR: 8}, {wU: 5}, {wR: 6}, {wR: 7},
          {wU: 2}, {wR: 9}, {wR: 11},
          {wU: 3}, {wU: 6}, {wU: 8}, {wU: 7}, {wU: 11}, {wU: 9}, {wR: 10}, {wU: 10},
          {dU: 10}, {dU: 9}, {dU: 11}, {dU: 7}, {dU: 8}, {dU: 6}, {dU: 3},
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
              f.nextChildren = [p(9, {ctor: f => nodes[4].sub(f)}, p(10)), p(11)]
            },
            getNext(data, next){
              return this.nextChildren
            }
          }
        })
        const result = [ 
          {wR: 0}, {wU: 0}, {wR: 1}, {wU: 1}, {wR: 2}, {wR: 3},
          {wU: 4}, {wR: 5}, {wR: 8}, {wU: 5}, {wR: 6}, {wR: 7}, 
          {wU: 2}, {wU: 3}, {wU: 6}, {wU: 8}, {wU: 7}, {wA: 11}, {wA: 9},
          {wA: 10}, {dA: 10}, {dA: 9}, {dA: 11},
          {dU: 7}, {dU: 8}, {dU: 6}, {dU: 3}, {dU: 2}, {dU: 5}, {dU: 4}, {dU: 1}, {dU: 0} 
        ]
        diff(treeCase.tag0(), nodes[0]);
        expect(events).to.deep.equal(result);
      })
      it("should properly account for recently added affector children during the next diff", function(){
        const { nodes, events } = treeCase.get({
          2: {
            willUpdate: f => {
              f.nextChildren = [p(9, {ctor: f => nodes[4].sub(f)}, p(10)), p(11)]
            },
            getNext(data, next){
              return this.nextChildren
            }
          }
        })
        const result = [ 
          {wR: 0}, {wU: 0}, {wR: 1}, {wU: 1}, {wR: 2}, {wR: 3},
          {wU: 2}, {wR: 9}, {wR: 11}, {wU: 11}, {wU: 9}, {wR: 10},
          {wU: 4}, {wR: 5}, {wR: 8}, {wU: 5}, {wR: 6}, {wR: 7},
          {wU: 3}, {wU: 6}, {wU: 8}, {wU: 7},  {wU: 10},
          {dU: 10}, {dU: 7}, {dU: 8}, {dU: 6}, {dU: 3},
          {dU: 5}, {dU: 4}, {dU: 9}, {dU: 11}, {dU: 2}, {dU: 1}, {dU: 0}
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
            getNext(data, next){
              return this.kill ? null : next;
            }
          }
        })
        const result = [
          {wR: 0}, {wU: 0}, {wP: 1}, {wP: 2}, {wP: 3},
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
            getNext(data, next){
              return this.nextChildren || next;
            }
          }
        })
        const result = [
          {wR: 0}, {wU: 0}, {wP: 1}, {wP: 2}, {wP: 3},
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
              f.nextChildren = a(9, {ctor: f => f.sub(nodes[4])});
            },
            getNext(data, next){
              return this.nextChildren || next;
            }
          }
        })
        const result = [
          {wR: 0}, {wU: 0}, {wP: 1}, {wP: 2}, {wP: 3},
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
              f.nextChildren = a(9, {ctor: f => f.sub(nodes[4])});
            },
            getNext(data, next){
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
