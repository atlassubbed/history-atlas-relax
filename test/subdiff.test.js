const { describe, it } = require("mocha")
const { expect } = require("chai")
const { Renderer, Tracker } = require("./Effects");
const { diff } = require("../src/index");
const { cases } = require("./cases/subdiff");
const { inject } = require("./util")

// for each prev case, test diffing into each next case
// use a dumb, brute force (probably quadratic) method to figure out expected moves/matches
// the linear-time subdiff algorithm should achieve the same result

const pretty = children => `[${children.map(({name: n, key: k}) => n + (k ? `-${k}` : ""))}]`
// classic h, returns a template
const h = next => inject({name: "div", data: {id: 0}}, next)

describe("subdiff", function(){
  cases.forEach(({prevCases, nextCases}) => {
      prevCases.forEach(prev => {
      describe(`with previous children ${pretty(prev)}`, function(){
        nextCases.forEach((next, i) => {
          // every subcase shares this setup, we deliberately entangle the tests
          const events = [], memoEvents = [];
          const e1 = [new Renderer, new Tracker(events)];
          const e2 = [new Renderer, new Tracker(memoEvents)];
          const n1 = h(next), n2 = h(prevCases[i]);
          const f1 = diff(h(prev), null, e1);
          const f2 = diff(h(prev), null, e2);
          // performs subdiff under div turning prev children into next children
          diff(n1, f1), diff(n2, f2);

          describe(`and next children ${pretty(next)}`, function(){
            it("should morph prev into next", function(){
              expect(e1[0].tree).to.deep.equal(e1[0].render(n1));
            })
            it("should morph prev into next if next is memoized", function(){
              expect(e2[0].tree).to.deep.equal(e2[0].render(n2));
            })


            // TODO:
            //   1. if next contains a moved key from prev, then it should update and potentially move that element
            //   2. if next contains a moved species from prev, then it should update and potentially move that element
            //   3. if next is memoized and contains moves, it shouldn't update, but should still move around
          })
        })
      })
    })
  })
})
