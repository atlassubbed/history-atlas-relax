const { describe, it } = require("mocha")
const { expect } = require("chai")
const { LCRSRenderer, Tracker } = require("./effects");
const { StemCell } = require("./cases/Frames");
const { diff } = require("../src/index");
const { prevCases, nextCases, finalCases } = require("./cases/squash");
const { has, isFn } = require("./util")

const tag = ({name: n, data: {id}}) => {
  if (id) n += `-${id}`;
  return n;
}
// classic h, returns a template
const h = next => ({name: "div", data: {id: 0}, next})

describe("event squashing", function(){
  // brute force consistency checks
  describe("edits prev children to match final children", function(){
    prevCases.forEach(prev => {
      const t1 = h(prev);
      describe(`with prev [${prev.map(tag)}]`, function(){
        nextCases.forEach(next => {
          const t2 = h(next);
          describe(`and intermediate [${next.map(tag)}]`, function(){
            finalCases.forEach(final => {
              const t3 = h(final);
              describe(`LCRS rendered to final [${final.map(tag)}]`, function(){
                // don't do separate tests for minimal stdout, use descriptive errors instead
                it("should not contain superfluous events", function(){
                  const events = [], renderer = new LCRSRenderer, tracker = new Tracker(events)
                  const f = diff(t1, null, {effs: [renderer, tracker]});
                  let called = false;
                  diff({name: (temp, a, isFirst) => {
                    if (!called && !isFirst){
                      called = true;
                      diff(t3, f);
                    }
                  }}).sub(f);
                  // get rid of mount-related events/counts
                  renderer.resetCounts(), events.length = 0, diff(t2, f);
                  // add, remove, update, total N, moves
                  const { a, r, u, s } = renderer.counts;
                  // sanity checks
                  expect(u).to.be.lte(prev.length+1);
                  expect(a).to.be.lte(final.length);
                  expect(r).to.be.lte(prev.length);
                  expect(s).to.be.lte(prev.length);
                  // at most one recieve/move/add/remove event per node
                  ["mWR", "mWM", "mWA", "mWP"].forEach(type => {
                    const seen = {};
                    events.forEach(e => {
                      if (e[type] != null){
                        expect(seen[e[type]], `node w/ id ${e[type]} got multiple ${type} events`).to.be.undefined;
                        seen[e[type]] = true;
                      }
                    })
                  })
                  // added nodes do not have any receive/move events
                  let added = {};
                  events.forEach(e => {
                    if (e.mWA != null) added[e.mWA] = true;
                  });
                  ["mWR", "mWM"].forEach(type => {
                    events.forEach(e => {
                      if (e[type] != null){
                        expect(added[e[type]], `added node w/ id ${e[type]} also got a ${type} event`).to.be.undefined;
                      }
                    })
                  })
                  // removed nodes do not have any receive/move events
                  const removed = {};
                  events.forEach(e => {
                    if (e.mWP != null) removed[e.mWP] = true;
                  });
                  ["mWR", "mWM"].forEach(type => {
                    events.forEach(e => {
                      if (e[type] != null){
                        expect(removed[e[type]], `removed node w/ id ${e[type]} also got a ${type} event`).to.be.undefined;
                      }
                    })
                  })
                  added = {};
                  events.forEach(e => {
                    if (e.mWA != null) added[e.mWA] = true;
                    if (e.mWP != null) {
                      expect(added[e.mWP], `node w/ id ${e.mWP} got added then removed`).to.be.undefined;
                    }
                  })
                })
                it("should edit prev to match next", function(){
                  const renderer = new LCRSRenderer;
                  const f = diff(t1, null, {effs: renderer});
                  let called = false;
                  diff({name: (temp, a, isFirst) => {
                    if (!called && !isFirst){
                      called = true;
                      diff(t3, f);
                    }
                  }}).sub(f);
                  diff(t2, f);
                  const expectedTree = renderer.renderStatic(t3)
                  expect(renderer.tree).to.deep.equal(expectedTree);
                })
              })
            })
          })
        })
      })
    })
  })
})