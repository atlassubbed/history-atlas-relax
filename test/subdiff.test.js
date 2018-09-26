const { describe, it } = require("mocha")
const { expect } = require("chai")
const { Renderer, Tracker } = require("./Effects");
const { diff } = require("../src/index");
const { prevCases, nextCases, memoizedCases } = require("./cases/subdiff");
const { inject } = require("./util")

// for each prev case, test diffing into each next case
// use a dumb, brute force (probably quadratic) method to figure out expected moves/matches
// the linear-time subdiff algorithm should achieve the same result

const pretty = children => `[${children.map(({name: n, key: k}) => n + (k ? `-${k}` : ""))}]`
// classic h, returns a template
const h = next => inject({name: "div"}, next)

describe("subdiff", function(){
  prevCases.forEach(prev => {
    describe(`with previous children ${pretty(prev)}`, function(){
      nextCases.forEach(next => {
        describe(`and next children ${pretty(next)}`, function(){
          it("should morph prev into next", function(){
            const renderer = new Renderer, nextTemp = h(next);
            const f1 = diff(h(prev), null, renderer);
            // performs a subdiff under div turning prev children into next children
            diff(nextTemp, f1)
            expect(renderer.tree).to.deep.equal(renderer.render(nextTemp));
          })
        })
      })
    })
  })
})
