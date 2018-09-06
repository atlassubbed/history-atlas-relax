const { describe, it } = require("mocha")
const { expect } = require("chai")
const { Renderer } = require("./Effects");
const { Frame, diff } = require("../src/index");
const { isScalar, type, inject, deepNull } = require("./util")
const { 
  irreducibleBlackboxes: primes, 
  reducibleBlackboxes: comps,
  functionals: functionalRoots,
  voidBlackboxes: voids 
} = require("./assets/diff-cases");
const { updatingBlackboxes } = require("./assets/subdiff-cases")

const allBlackboxes = [...voids, ...primes, ...comps]
const allNontrivialBlackboxes = allBlackboxes.filter(n => type(n.name) !== "void")
const blackboxRoots = allNontrivialBlackboxes.filter(n => isScalar(n.name))

describe("diff", function(){
  it("should not add void templates", function(){
    const voids = [null, true, undefined, false];
    voids.forEach(val => {
      const renderer = new Renderer();
      const result = diff(val, null, renderer);
      expect(result).to.be.false;
      expect(renderer.tree).to.be.null;
      const { a, r, u } = renderer.counts;
      expect(a).to.equal(r).to.equal(u).to.equal(0)
    })
  })
  it("should not add multiple templates", function(){
    const renderer = new Renderer();
    const result = diff([{name:"div"},{name:"p"}], null, renderer);
    expect(result).to.be.false;
    expect(renderer.tree).to.be.null;
    const { a, r, u } = renderer.counts;
    expect(a).to.equal(r).to.equal(u).to.equal(0)
  })
  it("should not replace a frame with multiple templates", function(){
    const renderer = new Renderer();
    const result = diff([{name:"div"}, {name: "p"}], new Frame({}), renderer);
    expect(result).to.be.false;
    expect(renderer.tree).to.be.null;
    const { a, r, u } = renderer.counts;
    expect(a).to.equal(r).to.equal(u).to.equal(0)
  })
  it("should not remove non-frames", function(){
    const renderer = new Renderer();
    const result = diff(null, "not a frame", renderer);
    expect(result).to.be.false;
    expect(renderer.tree).to.be.null;
    const { a, r, u } = renderer.counts;
    expect(a).to.equal(r).to.equal(u).to.equal(0)
  })
  it("should not remove non-root frames", function(){
    const renderer = new Renderer(), child = new Frame({});
    (child.parent = new Frame({})).children = [child]
    const result = diff(null, child, renderer);
    expect(result).to.be.false;
    expect(renderer.tree).to.be.null;
    const { a, r, u } = renderer.counts;
    expect(a).to.equal(r).to.equal(u).to.equal(0)
  })
  describe("blackboxes", function(){
    blackboxRoots.forEach(({ name: id, get }) => {
      describe(`${id} frames`, function(){
        it("should be added", function(){
          const renderer = new Renderer(), data = {v: 0, id};
          const result = diff(get(data), null, renderer);
          expect(result).to.be.an.instanceOf(Frame);
          expect(renderer.tree).to.deep.equal(renderer.render(get(data)))
          const { a, r, u, n } = renderer.counts;
          expect(n).to.equal(a)
          expect(u).to.equal(r).to.equal(0)
        })
        it("should be removed", function(){
          const renderer = new Renderer(), data = {v: 0, id};
          const frame = diff(get(data), null, renderer);
          const result = diff(null, frame, renderer);
          expect(result).to.be.true;
          expect(renderer.tree).to.be.null
          const { a, r, u } = renderer.counts;
          expect(a).to.equal(r)
          expect(u).to.equal(0)
        })
        it("should be updated without getting replaced", function(){
          const renderer = new Renderer(), data = {v: 0, id}, newData = {v: 1, id}
          const template = get(data), newTemplate = get(newData)
          const frame = diff(get(data), null, renderer);
          const result = diff(get(newData), frame, renderer);
          expect(result).to.be.an.instanceOf(Frame).to.equal(frame)
          expect(renderer.tree).to.deep.equal(renderer.render(get(newData)));
          const { a, r, u, n } = renderer.counts;
          expect(n).to.equal(a).to.equal(u)
          expect(r).to.equal(0)

        })
        blackboxRoots.forEach(({ name: newId, get: newGet }) => {
          const data = {id, v: 0}, template = get(data), newTemplate = newGet(data);
          if (newTemplate.name === template.name) return;
          it(`should be replaced by ${newId} frames`, function(){
            const renderer = new Renderer();
            const frame = diff(template, null, renderer);
            expect(frame).to.be.an.instanceOf(Frame);
            const newFrame = diff(newTemplate, frame, renderer);
            expect(newFrame).to.be.an.instanceOf(Frame).to.not.equal(frame);
            expect(renderer.tree).to.deep.equal(renderer.render(newGet(data)));
            const { a, r, u, n } = renderer.counts;
            expect(a).to.equal(n + r)
            expect(u).to.equal(0)
          })
        })
        it("should satisfy the identity diff(t) = diff(t, diff(t))", function(){
          const t1 = get({v: 0, id}), t2 = get({v: 0, id}), t3 = get({v: 0, id})
          expect(t1).to.deep.equal(t2).to.deep.equal(t3)
          expect(diff(t1)).to.be.an.instanceOf(Frame)
            .to.deep.equal(deepNull(diff(t2, diff(t3)), ["epoch"]))
        })
      })
    })
  })
  describe("functionals", function(){
    functionalRoots.forEach(({ name: id, get }) => {
      describe(id, function(){
        allBlackboxes.forEach(({ name: nextId, get: nextGet }) => {
          describe(`with ${nextId} child`, function(){
            it("should be added", function(){
              const renderer = new Renderer(), data = {v: 0, id}
              const result = diff(inject(get(data), nextGet(data)), null, renderer);
              expect(result).to.be.an.instanceOf(Frame);
              const rendered = renderer.render(inject(get(data), nextGet(data)))
              expect(renderer.tree).to.deep.equal(rendered)
              const { a, r, u, n } = renderer.counts;
              expect(a).to.equal(n)
              expect(r).to.equal(u).to.equal(0)
            })
            it("should remove the root", function(){
              const renderer = new Renderer(), data = {v: 0, id}
              const frame = diff(inject(get(data), nextGet(data)), null, renderer);
              const result = diff(null, frame, renderer);
              expect(result).to.be.true;
              expect(renderer.tree).to.be.null;
              const { a, r, u } = renderer.counts;
              expect(a).to.equal(r)
              expect(u).to.equal(0)
            })
            it("should remove just the child", function(){
              const renderer = new Renderer(), data = {v: 0, id}
              const frame = diff(inject(get(data), nextGet(data)), null, renderer);
              const result = diff(get(data), frame, renderer)
              const rendered = renderer.render(get(data));
              expect(result).to.be.an.instanceOf(Frame).to.equal(frame);
              expect(renderer.tree).to.deep.equal(rendered);
              const { a, r, u, n } = renderer.counts;
              expect(n).to.equal(u).to.equal(a - r)
            })
            it("should update just the root without getting replaced", function(){
              const renderer = new Renderer(), data = {v: 0, id}, newData = {v: 1, id}
              const frame = diff(inject(get(data), nextGet(data)), null, renderer);
              const result = diff(inject(get(newData), nextGet(data)), frame, renderer);
              expect(result).to.be.an.instanceOf(Frame).to.equal(frame)
              const rendered = renderer.render(inject(get(newData), nextGet(data)));
              expect(renderer.tree).to.deep.equal(rendered);
              const { a, r, u, n } = renderer.counts;
              expect(n).to.equal(a).to.equal(u)
              expect(r).to.equal(0)
            })
            it("should update just the child without getting replaced", function(){
              const renderer = new Renderer(), data = {v: 0, id}, newData = {v: 1, id}
              const frame = diff(inject(get(data), nextGet(data)), null, renderer);
              const result = diff(inject(get(data), nextGet(newData)), frame, renderer);
              expect(result).to.be.an.instanceOf(Frame).to.equal(frame)
              const rendered = renderer.render(inject(get(data), nextGet(newData)));
              expect(renderer.tree).to.deep.equal(rendered);
              const { a, r, u, n } = renderer.counts;
              expect(n).to.equal(a).to.equal(u)
              expect(r).to.equal(0)
            })
            it("should update both parent and child without getting replaced", function(){
              const renderer = new Renderer(), data = {v: 0, id}, newData = {v: 1, id}
              const frame = diff(inject(get(data), nextGet(data)), null, renderer);
              const result = diff(inject(get(newData), nextGet(newData)), frame, renderer);
              expect(result).to.be.an.instanceOf(Frame).to.equal(frame)
              const rendered = renderer.render(inject(get(newData), nextGet(newData)));
              expect(renderer.tree).to.deep.equal(rendered);
              const { a, r, u, n } = renderer.counts;
              expect(n).to.equal(a).to.equal(u)
              expect(r).to.equal(0)
            })
            blackboxRoots.forEach(({ name: replaceId, get: replaceGet }) => {
              const data = {id, v: 0}, template = get(data), newTemplate = replaceGet(data);
              if (newTemplate.name === template.name) return;
              it(`should replace the root with ${replaceId} frames`, function(){
                template.next = nextGet(data)
                const renderer = new Renderer();
                const frame = diff(template, null, renderer);
                expect(frame).to.be.an.instanceOf(Frame);
                const newFrame = diff(newTemplate, frame, renderer);
                expect(newFrame).to.be.an.instanceOf(Frame).to.not.equal(frame);
                expect(renderer.tree).to.deep.equal(renderer.render(replaceGet(data)))
                const { a, r, u, n } = renderer.counts;
                expect(n).to.equal(a - r);
                expect(u).to.equal(0)
              })
            })
            allNontrivialBlackboxes.forEach(({ name: replaceId, get: replaceGet }) => {
              if (!nextId.startsWith("reducible") && type(nextId) === type(replaceId)) return;
              const data = {id, v: 0}, 
                template = inject(get(data), nextGet(data)), 
                newTemplate = inject(get(data), replaceGet(data));
              if (!nextId.startsWith("void") && template.next.name === newTemplate.next.name) return;
              it(`should replace the child with ${replaceId} frames`, function(){
                const renderer = new Renderer();
                const frame = diff(template, null, renderer);
                const oldAddedCount = renderer.counts.a;            
                const newFrame = diff(newTemplate, frame, renderer);
                expect(newFrame).to.be.an.instanceOf(Frame).to.equal(frame);
                const rendered = renderer.render(inject(get(data), replaceGet(data)));
                expect(renderer.tree).to.deep.equal(rendered)
                const { a, r, u, n } = renderer.counts;
                expect(a - r).to.equal(n);
                expect(u).to.equal(oldAddedCount - r)
              })
            })
            it("should satisfy the identity diff(t) = diff(t, diff(t))", function(){
              const t1 = inject(get({v:0, id}), nextGet({v: 0, id})),
                t2 = inject(get({v:0, id}), nextGet({v: 0, id})),
                t3 = inject(get({v:0, id}), nextGet({v: 0, id}))
              expect(t1).to.deep.equal(t2).to.deep.equal(t3)
              expect(diff(t1)).to.be.an.instanceOf(Frame)
                .to.deep.equal(deepNull(diff(t2, diff(t3)), ["epoch"]))
            })
          })
        })
        describe("subdiffs mixed children", function(){
          updatingBlackboxes.forEach(({desc, get: nextGet }) => {
            it(`should ${desc}`, function(){
              const renderer = new Renderer(), data = {id: desc, v: 0}, newData = {id: desc, v: 1};
              const template = inject(get(data), nextGet(data));
              const newTemplate = inject(get(data), nextGet(newData));
              const frame = diff(template, null, renderer)
              const newFrame = diff(newTemplate, frame, renderer);
              expect(newFrame).to.be.an.instanceOf(Frame).to.equal(frame);
              const rendered = renderer.render(inject(get(data), nextGet(newData)))
              expect(renderer.tree).to.deep.equal(rendered)
            })
          })
        })
      })
    })
  })
})
