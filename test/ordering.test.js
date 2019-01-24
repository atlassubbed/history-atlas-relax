const { describe, it } = require("mocha")
const { expect } = require("chai")
const { Frame, diff } = require("../src/index");
const { copy } = require("./util");
const { Tracker } = require("./effects");
const { StemCell: { h: rawH } } = require("./cases/Frames");

const h = (id, next) => rawH(id, null, next);

const t = h(0, [
  h(1, [
    h(3),
    h(4)
  ]),
  h(2, [
    h(5),
    h(6)
  ])
])

const N = 7;

const mount = events => diff(t, null, {effs: new Tracker(events)})

// forward order means "child 1 before child 2"
// reverse order means "child 2 before child 1"
describe("mutation event and lifecycle event ordering", function(){
  describe("mounts", function(){
    const events = [], f = mount(events);
    it("should run the correct number of events", function(){
      expect(events.length).to.equal(2*N)
    })
    it("should run render events in depth-first in order", function(){
      expect(events.slice(0, N)).to.eql([
        {wA: 0}, {wA: 1}, {wA: 3}, {wA: 4}, {wA: 2}, {wA: 5}, {wA: 6}
      ])
    })
    /* XXX this should change to a more intuitive forward order
           since adding things to the DOM in this order is probably bad for reflow
           e.g.
           time ->           
             ul1    ul1      and      here we end up squeezing deep children between live nodes...
             ul2      li1    so       clever timing may allow us to avoid reflow
             ul3      li2    on...    or, we can let effects build DOM fragments and then attach them
                    ul2               at the end of the diff cycle with something like didDiff 
                    ul3 */
    it("should run willAdd events in depth-children-first order after all render events", function(){
      expect(events.slice(-N)).to.eql([
        {mWA: 0}, {mWA: 1}, {mWA: 2}, {mWA: 3}, {mWA: 4}, {mWA: 5}, {mWA: 6}
      ])
    })
  })
  describe("unmounts", function(){
    const events = [], f = mount(events);
    events.length = 0;
    diff(null, f);
    it("should run the correct number of events", function(){
      expect(events.length).to.equal(N)
    })
    it("should run willRemove events in depth-first reverse order", function(){
      expect(events).to.eql([
        {mWP: 0}, {mWP: 2}, {mWP: 6}, {mWP: 5}, {mWP: 1}, {mWP: 4}, {mWP: 3}
      ])
    })
  })
  describe("updates", function(){
    const events = [], f = mount(events);
    events.length = 0;
    diff(copy(t), f);
    it("should run the correct number of events", function(){
      expect(events.length).to.equal(2*N)
    })
    it("should run render events in depth-first order", function(){
      expect(events.slice(0, N)).to.eql([
        {wU: 0}, {wU: 1}, {wU: 3}, {wU: 4}, {wU: 2}, {wU: 5}, {wU: 6}
      ])
    })
    // XXX this should change to a more intuitive order, but it's probably fine
    it("should run willReceive events in depth-children-first order after all render events", function(){
      expect(events.slice(-N)).to.eql([
        {mWR: 0}, {mWR: 1}, {mWR: 2}, {mWR: 3}, {mWR: 4}, {mWR: 5}, {mWR: 6}
      ])
    })
  })
})