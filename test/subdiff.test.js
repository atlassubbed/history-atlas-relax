const { describe, it } = require("mocha")
const { expect } = require("chai")
const { ArrayRenderer, LCRSRenderer, Passthrough } = require("./effects");
const { StemCell } = require("./cases/Frames");
const { diff } = require("../src/index");
const { bruteForceCases, matchingCases } = require("./cases/subdiff");
const { inject, has, isFn } = require("./util")
const { m } = StemCell;

const tag = ({name: n, key: k, data: {id}}) => {
  n = isFn(n) ? n.name : n;
  if (k) n += `-${k}`;
  if (id) n += `-${id}`;
  return n;
}
// classic h, returns a template
const h = next => ({name: "div", data: {id: 0}, next})

// tells us where to insert 2-subseq into prev and next arrays
const forTwoSequenceIndexCombination = (N, P, cb) => {
  P = P+2, N = N+2;
  // largest term is ((NP)^2)/4, this is fine
  for (let p1 = 0; p1 < P; p1++)
    for (let p2 = p1 + 1; p2 < P; p2++)
      for (let n1 = 0; n1 < N; n1++)
        for (let n2 = n1 + 1; n2 < N; n2++)
          cb([n1, n2, p1, p2]);
}
const insert = (arr, i, el) => arr.splice(i, 0, el)

// XXX explicit and implicit keys tests are nearly identical
//   However, for now, we won't remove the 2x code duplication below.
//   Nodes are categorized as either explicit (keyed) or implicit (unkeyed),
//   and there is unlikely to be further classification when it comes to matching nodes
//   so this duplication appears to be tolerable.
describe("subdiff", function(){
  describe("implicit, stable matching regardless of index and density", function(){
    const makePrev = () => [
      {name: StemCell, key: "k1"},
      {name: StemCell, key: "k1"},
      {name: StemCell, key: "k2"},
      {name: StemCell, key: "k3"},
      {name: "p"},
      {name: "p"},
      {name: "p", key: "k2"},
      {name: "p", key: "k2"},
      {name: "p", key: "k1"},
      {name: "p", key: "k4"}
    ]
    matchingCases.forEach(({condition, makeNext}) => {
      it(`should update matching prev nodes if ${condition}`, function(){
        const N = makeNext(makePrev).length, P = makePrev().length;
        forTwoSequenceIndexCombination(N, P, ([n1, n2, p1, p2]) => {
          const prev = makePrev(), next = makeNext(makePrev);
          let didR1 = 0, didR2 = 0, didU1 = 0, didU2 = 0;
          const t1 = m(1), t2 = m(2);
          const pt1 = m(1, {
            willReceive: (f, t) => {
              didR1++
              expect(t).to.equal(t1)
            },
            didUpdate: () => didU1++
          })
          const pt2 = m(2, {
            willReceive: (f, t) => {
              didR2++
              expect(t).to.equal(t2)
            },
            didUpdate: () => didU2++
          })
          insert(next, n1, t1)
          insert(next, n2, t2)
          insert(prev, p1, pt1)
          insert(prev, p2, pt2)
          diff(h(next), diff(h(prev), null, new Passthrough))
          expect(didR1).to.equal(didR2).to.equal(didU1).to.equal(didU2).to.equal(1);
        })
      })
    })
  })
  describe("explicit, stable key matching regardless of index and density", function(){
    const makePrev = () => [
      {name: StemCell},
      {name: StemCell},
      {name: StemCell, key: "k2"},
      {name: StemCell, key: "k3"},
      {name: "p"},
      {name: "p"},
      {name: "p", key: "k2"},
      {name: "p", key: "k2"},
      {name: "p", key: "k1"},
      {name: "p", key: "k4"}
    ]
    matchingCases.forEach(({condition, makeNext}) => {
      it(`should update matching prev nodes if ${condition}`, function(){
        const N = makeNext(makePrev).length, P = makePrev().length;
        forTwoSequenceIndexCombination(N, P, ([n1, n2, p1, p2]) => {
          const prev = makePrev(), next = makeNext(makePrev);
          let didR1 = 0, didR2 = 0, didU1 = 0, didU2 = 0;
          const t1 = m(1), t2 = m(2);
          const pt1 = m(1, {
            willReceive: (f, t) => {
              didR1++
              expect(t).to.equal(t1)
            },
            didUpdate: () => didU1++
          })
          const pt2 = m(2, {
            willReceive: (f, t) => {
              didR2++
              expect(t).to.equal(t2)
            },
            didUpdate: () => didU2++
          })
          t1.key = t2.key = pt1.key = pt2.key = "k1";
          insert(next, n1, t1)
          insert(next, n2, t2)
          insert(prev, p1, pt1)
          insert(prev, p2, pt2)
          diff(h(next), diff(h(prev), null, new Passthrough))
          expect(didR1).to.equal(didR2).to.equal(didU1).to.equal(didU2).to.equal(1);
        })
      })
    })
  })
  let c = 0;
  // brute force consistency checks
  describe("edits prev children to match next children", function(){
    bruteForceCases.forEach(({prevCases, nextCases}) => {
      prevCases.forEach((prev, j) => {
        describe(`with prev [${prev.map(tag)}]`, function(){
          nextCases.forEach((next, i) => {
            const t2 = h(next), t1 = h(prev);
            const r1 = new ArrayRenderer, r2 = new LCRSRenderer;
            describe(`swap rendered to next [${next.map(tag)}]`, function(){
              const f = diff(t1, null, r1);
              const { a: mA, r: mR, u: mU, s: mS } = r1.counts;
              r1.resetCounts(), diff(t2, f);
              const expectedTree = r1.render(t2)
              // add, remove, update, total N, swaps
              const { a, r, u, n, s } = r1.counts;
              it("should not contain superfluous events", function(){
                // mounting phase should only add nodes
                expect(mA).to.equal(mS + 1).to.equal(prev.length + 1);
                expect(mR).to.equal(mU).to.equal(0)
                 // accounts for the parent div node
                const maxUpdates = prev.length + 1;
                expect(u).to.be.at.most(maxUpdates);
                expect(a).to.equal(next.length - prev.length + r); // sanity check
                expect(r).to.equal(maxUpdates - u); // if we didn't update a node, we removed it.
                expect(s).to.be.at.most(u - 1 + a); // we should never do more swaps than this
                expect(n).to.equal(next.length + 1) // sanity check
              })
              it("should edit prev to match next", function(){
                // the edit path is correct
                expect(r1.tree).to.deep.equal(expectedTree);
              })
            })
            describe(`LCRS rendered to next [${next.map(tag)}]`, function(){
              const f = diff(t1, null, r2);
              diff(t2, f);
              it("should edit prev to match next", function(){
                expect(r2.tree).to.deep.equal(r2.render(t2));
              })
            })
          })
        })
      })
    })
  })
})
