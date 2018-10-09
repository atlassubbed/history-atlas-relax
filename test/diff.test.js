const { describe, it } = require("mocha")
const { expect } = require("chai")
const { ArrayRenderer, LCRSRenderer, Cache } = require("./effects");
const { Frame, diff } = require("../src/index");
const { isScalar, type, inject } = require("./util")
const { 
  irreducibleBlackboxes: primes, 
  reducibleBlackboxes: comps,
  functionals: functionalRoots,
  voidBlackboxes: voids,
  updatingBlackboxes
} = require("./cases/diff");

const allBlackboxes = [...voids, ...primes, ...comps]
const allNontrivialBlackboxes = allBlackboxes.filter(n => type(n.name) !== "void")
const blackboxRoots = allNontrivialBlackboxes.filter(n => isScalar(n.name))

// needs to be a factory
const renderers = () => [new ArrayRenderer, new LCRSRenderer];

describe("diff", function(){
  it("should not add void templates", function(){
    const voids = [null, true, undefined, false];
    voids.forEach(val => {
      renderers().forEach(renderer => {
        const result = diff(val, null, renderer);
        expect(result).to.be.false;
        expect(renderer.tree).to.be.null;
        const { a, r, u } = renderer.counts;
        expect(a).to.equal(r).to.equal(u).to.equal(0)
      })
    })
  })
  it("should add a new frame if diffing on top of a null frame", function(){
    let nullFrame = new Frame();
    const result = diff({name: "div"}, nullFrame);
    expect(result).to.not.be.false;
    expect(result).to.not.equal(nullFrame);
  })
  it("should not add multiple templates", function(){
    renderers().forEach(renderer => {
      const result = diff([{name:"div"},{name:"p"}], null, renderer);
      expect(result).to.be.false;
      expect(renderer.tree).to.be.null;
      const { a, r, u } = renderer.counts;
      expect(a).to.equal(r).to.equal(u).to.equal(0)
    })
  })
  it("should not replace a frame with multiple templates", function(){
    renderers().forEach(renderer => {
      const result = diff([{name:"div"}, {name: "p"}], new Frame({}), renderer);
      expect(result).to.be.false;
      expect(renderer.tree).to.be.null;
      const { a, r, u } = renderer.counts;
      expect(a).to.equal(r).to.equal(u).to.equal(0)
    })
  })
  it("should not remove non-frames", function(){
    renderers().forEach(renderer => {
      const result = diff(null, "not a frame", renderer);
      expect(result).to.be.false;
      expect(renderer.tree).to.be.null;
      const { a, r, u } = renderer.counts;
      expect(a).to.equal(r).to.equal(u).to.equal(0)
    })
  })
  it("should not remove non-root frames", function(){
    renderers().forEach(renderer => {
      const child = new Frame({});
      const result = diff(null, child, renderer);
      expect(result).to.be.false;
      expect(renderer.tree).to.be.null;
      const { a, r, u } = renderer.counts;
      expect(a).to.equal(r).to.equal(u).to.equal(0)
    })
  })
  describe("blackboxes", function(){
    blackboxRoots.forEach(({ name: id, get }) => {
      describe(`${id} frames`, function(){
        it("should be added", function(){
          renderers().forEach(renderer => {
            const data = {v: 0, id};
            const result = diff(get(data), null, renderer);
            expect(result).to.be.an.instanceOf(Frame);
            expect(renderer.tree).to.deep.equal(renderer.render(get(data)))
            const { a, r, u, n } = renderer.counts;
            expect(n).to.equal(a)
            expect(u).to.equal(r).to.equal(0)
          })
        })
        it("should be removed", function(){
          renderers().forEach(renderer => {
            const data = {v: 0, id};
            const cache = [], c = new Cache(cache);
            const frame = diff(get(data), null, [renderer, c]);
            const result = diff(null, frame, [renderer, c]);
            expect(result).to.be.true;
            expect(renderer.tree).to.be.null
            const { a, r, u } = renderer.counts;
            expect(a).to.equal(cache.length).to.equal(r)
            expect(u).to.equal(0)
            for (let c of cache) if (!c.temp) expect(c._node).to.be.null;
          })
        })
        it("should be updated without getting replaced", function(){
          renderers().forEach(renderer => {
            const data = {v: 0, id}, newData = {v: 1, id}
            const template = get(data), newTemplate = get(newData)
            const frame = diff(get(data), null, renderer);
            const result = diff(get(newData), frame, renderer);
            expect(result).to.be.an.instanceOf(Frame).to.equal(frame)
            expect(renderer.tree).to.deep.equal(renderer.render(get(newData)));
            const { a, r, u, n } = renderer.counts;
            expect(n).to.equal(a).to.equal(u)
            expect(r).to.equal(0)
          })
        })
        blackboxRoots.forEach(({ name: newId, get: newGet }) => {
          const data = {id, v: 0}, template = get(data), newTemplate = newGet(data);
          if (newTemplate.name === template.name) return;
          it(`should be replaced by ${newId} frames`, function(){
            renderers().forEach(renderer => {
              const cache = [], c = new Cache(cache);
              const frame = diff(template, null, [renderer, c]);
              expect(frame).to.be.an.instanceOf(Frame);
              const newFrame = diff(newTemplate, frame, [renderer, c]);
              expect(newFrame).to.be.an.instanceOf(Frame).to.not.equal(frame);
              expect(renderer.tree).to.deep.equal(renderer.render(newGet(data)));
              const { a, r, u, n } = renderer.counts;
              expect(a).to.equal(cache.length).to.equal(n + r)
              expect(u).to.equal(0)
              for (let c of cache) if (!c.temp) expect(c._node).to.be.null
            })
          })
        })
        it("should satisfy the identity diff(t) = diff(t, diff(t))", function(){
          const t1 = get({v: 0, id}), t2 = get({v: 0, id}), t3 = get({v: 0, id})
          expect(t1).to.deep.equal(t2).to.deep.equal(t3)
          expect(diff(t1)).to.be.an.instanceOf(Frame)
            .to.deep.equal(diff(t2, diff(t3)))
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
              renderers().forEach(renderer => {
                const data = {v: 0, id}
                const result = diff(inject(get(data), nextGet(data)), null, renderer);
                expect(result).to.be.an.instanceOf(Frame);
                const rendered = renderer.render(inject(get(data), nextGet(data)))
                expect(renderer.tree).to.deep.equal(rendered)
                const { a, r, u, n } = renderer.counts;
                expect(a).to.equal(n)
                expect(r).to.equal(u).to.equal(0)
              })
            })
            it("should remove the root", function(){
              renderers().forEach(renderer => {
                const data = {v: 0, id}, cache = [], c = new Cache(cache);
                const frame = diff(inject(get(data), nextGet(data)), null, [renderer, c]);
                const result = diff(null, frame, [renderer, c]);
                expect(result).to.be.true;
                expect(renderer.tree).to.be.null;
                const { a, r, u } = renderer.counts;
                expect(a).to.equal(cache.length).to.equal(r)
                expect(u).to.equal(0)
                for (let c of cache) if (!c.temp) expect(c._node).to.be.null
              })
            })
            it("should remove just the child", function(){
              renderers().forEach(renderer => {
                const data = {v: 0, id}, cache = [], c = new Cache(cache);
                const frame = diff(inject(get(data), nextGet(data)), null, [renderer, c]);
                const result = diff(get(data), frame, [renderer, c])
                const rendered = renderer.render(get(data));
                expect(result).to.be.an.instanceOf(Frame).to.equal(frame);
                expect(renderer.tree).to.deep.equal(rendered);
                const { a, r, u, n } = renderer.counts;
                expect(n).to.equal(u).to.equal(a - r)
                expect(cache.length).to.equal(a);
                for (let c of cache) if (!c.temp) expect(c._node).to.be.null
              })
            })
            it("should update just the root without getting replaced", function(){
              renderers().forEach(renderer => {
                const data = {v: 0, id}, newData = {v: 1, id}
                const frame = diff(inject(get(data), nextGet(data)), null, renderer);
                const result = diff(inject(get(newData), nextGet(data)), frame, renderer);
                expect(result).to.be.an.instanceOf(Frame).to.equal(frame)
                const rendered = renderer.render(inject(get(newData), nextGet(data)));
                expect(renderer.tree).to.deep.equal(rendered);
                const { a, r, u, n } = renderer.counts;
                expect(n).to.equal(a).to.equal(u)
                expect(r).to.equal(0)
              })
            })
            it("should update just the child without getting replaced", function(){
              renderers().forEach(renderer => {
                const data = {v: 0, id}, newData = {v: 1, id}
                const frame = diff(inject(get(data), nextGet(data)), null, renderer);
                const result = diff(inject(get(data), nextGet(newData)), frame, renderer);
                expect(result).to.be.an.instanceOf(Frame).to.equal(frame)
                const rendered = renderer.render(inject(get(data), nextGet(newData)));
                expect(renderer.tree).to.deep.equal(rendered);
                const { a, r, u, n } = renderer.counts;
                expect(n).to.equal(a).to.equal(u)
                expect(r).to.equal(0)
              })
            })
            it("should update both parent and child without getting replaced", function(){
              renderers().forEach(renderer => {
                const data = {v: 0, id}, newData = {v: 1, id}
                const frame = diff(inject(get(data), nextGet(data)), null, renderer);
                const result = diff(inject(get(newData), nextGet(newData)), frame, renderer);
                expect(result).to.be.an.instanceOf(Frame).to.equal(frame)
                const rendered = renderer.render(inject(get(newData), nextGet(newData)));
                expect(renderer.tree).to.deep.equal(rendered);
                const { a, r, u, n } = renderer.counts;
                expect(n).to.equal(a).to.equal(u)
                expect(r).to.equal(0)
              })
            })
            blackboxRoots.forEach(({ name: replaceId, get: replaceGet }) => {
              const data = {id, v: 0}, template = get(data), newTemplate = replaceGet(data);
              if (newTemplate.name === template.name) return;
              it(`should replace the root with ${replaceId} frames`, function(){
                template.next = nextGet(data)
                renderers().forEach(renderer => {
                  const cache = [], c = new Cache(cache);
                  const frame = diff(template, null, [renderer, c]);
                  expect(frame).to.be.an.instanceOf(Frame);
                  const newFrame = diff(newTemplate, frame, [renderer, c]);
                  expect(newFrame).to.be.an.instanceOf(Frame).to.not.equal(frame);
                  expect(renderer.tree).to.deep.equal(renderer.render(replaceGet(data)))
                  const { a, r, u, n } = renderer.counts;
                  expect(n).to.equal(a - r);
                  expect(cache.length).to.equal(n + r)
                  expect(u).to.equal(0)
                  for (let c of cache) if (!c.temp) expect(c._node).to.be.null;
                })
              })
            })
            allNontrivialBlackboxes.forEach(({ name: replaceId, get: replaceGet }) => {
              if (!nextId.startsWith("reducible") && type(nextId) === type(replaceId)) return;
              const data = {id, v: 0}, 
                template = inject(get(data), nextGet(data)), 
                newTemplate = inject(get(data), replaceGet(data));
              if (!nextId.startsWith("void") && template.next.name === newTemplate.next.name) return;
              it(`should replace the child with ${replaceId} frames`, function(){
                renderers().forEach(renderer => {
                  const cache = [], c = new Cache(cache);
                  const frame = diff(template, null, [renderer, c]);
                  const oldAddedCount = renderer.counts.a;
                  const newFrame = diff(newTemplate, frame, [renderer, c]);
                  expect(newFrame).to.be.an.instanceOf(Frame).to.equal(frame);
                  const rendered = renderer.render(inject(get(data), replaceGet(data)));
                  expect(renderer.tree).to.deep.equal(rendered)
                  const { a, r, u, n } = renderer.counts;
                  expect(a).to.equal(cache.length).to.equal(n + r);
                  expect(u).to.equal(oldAddedCount - r)
                  for (let c of cache) if (!c.temp) expect(c._node).to.be.null;
                })
              })
            })
            it("should satisfy the identity diff(t) = diff(t, diff(t))", function(){
              const t1 = inject(get({v:0, id}), nextGet({v: 0, id})),
                t2 = inject(get({v:0, id}), nextGet({v: 0, id})),
                t3 = inject(get({v:0, id}), nextGet({v: 0, id}))
              expect(t1).to.deep.equal(t2).to.deep.equal(t3)
              expect(diff(t1)).to.be.an.instanceOf(Frame)
                .to.deep.equal(diff(t2, diff(t3)))
            })
          })
        })
      })
    })
  })
})
