const { describe, it } = require("mocha")
const { expect } = require("chai")
const Tracker = require("./Tracker");
const { Frame, diff } = require("../src/index");
const { has, fill, type } = require("./util")
const { 
  voidBlackboxes: voids, 
  irreducibleBlackboxes: primes, 
  reducibleBlackboxes: comps, 
  functionals: functionalRoots
} = require("./assets/templates");

const allBlackboxes = [...voids, ...primes, ...comps];
const blackboxRoots = [...primes, ...comps].filter(n => !has(n.name, "(array)"))
const allNontrivialBlackboxes = allBlackboxes.filter(n => !n.name.startsWith("void"))

describe("diff", function(){
  it("should not add void templates", function(){
    const voids = [null, true, undefined, false];
    voids.forEach(val => {
      const tracker = new Tracker();
      const result = diff(val, null, tracker);
      expect(result).to.be.false;
      expect(tracker.events).to.be.empty;
    })
  })
  it("should not add multiple templates", function(){
    const templates = [{name:"div"},{name:"p"}];
    const tracker = new Tracker();
    const result = diff(templates, null, tracker);
    expect(result).to.be.false;
    expect(tracker.events).to.be.empty;
  })
  it("should not replace a frame with multiple templates", function(){
    const tracker = new Tracker();
    const result = diff([{name:"div"}, {name: "p"}], new Frame({}), tracker);
    expect(result).to.be.false;
    expect(tracker.events).to.be.empty;
  })
  it("should not remove non-frames", function(){
    const tracker = new Tracker();
    const result = diff(null, "not a frame", tracker);
    expect(result).to.be.false;
    expect(tracker.events).to.be.empty;
  })
  it("should not remove non-root frames", function(){
    const tracker = new Tracker();
    const child = new Frame({});
    (child.parent = new Frame({})).children = [child]
    const result = diff(null, child, tracker);
    expect(result).to.be.false;
    expect(tracker.events).to.be.empty;
  })
  describe("blackboxes", function(){
    blackboxRoots.forEach(({ name: id, get, added, changed, removed }) => {
      describe(`${id} frames`, function(){
        it("should be added", function(){
          const tracker = new Tracker(), data = {v: 0, id};
          const template = get(data)
          const result = diff(template, null, tracker);
          expect(result).to.be.an.instanceOf(Frame);
          expect(tracker.events).to.deep.equal(added(data))
        })
        it("should be removed", function(){
          const tracker = new Tracker(), data = {v: 0, id};
          const template = get(data)
          const frame = diff(template, null, tracker);
          tracker.reset();
          const result = diff(null, frame, tracker);
          expect(result).to.be.true;
          expect(tracker.events).to.deep.equal(removed(data))
        })
        // XXX find a way to specify multiple types of updates for a given case
        //   every case should have default change (same template, new "v" prop)
        //   certain irreducibleBlackboxes will implement various kinds of updates
        //     * keys, memoization, replacements, props resetting, re-ordering, etc. 
        it("should be updated without getting replaced", function(){
          const tracker = new Tracker(), data = {v: 0, id}, newData = {v: 1, id}
          const template = get(data), newTemplate = get(newData)
          const frame = diff(template, null, tracker);
          tracker.reset();
          const result = diff(newTemplate, frame, tracker);
          expect(result).to.be.an.instanceOf(Frame).to.equal(frame)
          expect(tracker.events).to.deep.equal(changed(newData))
        })
        blackboxRoots.forEach(({ name: newId, get: newGet, added: newAdded }) => {
          const data = {id, v: 0}, template = get(data), newTemplate = newGet(data);
          if (newTemplate.name === template.name) return;
          it(`should be replaced by ${newId} frames`, function(){
            const tracker = new Tracker();
            const frame = diff(template, null, tracker);
            expect(frame).to.be.an.instanceOf(Frame);
            tracker.reset();
            const newFrame = diff(newTemplate, frame, tracker);
            expect(newFrame).to.be.an.instanceOf(Frame).to.not.equal(frame);
            expect(tracker.events).to.deep.equal([...removed(data), ...newAdded(data)])
          })
        })
        it("should satisfy the identity diff(t) = diff(t, diff(t))", function(){
          const t1 = get({v: 0, id}), t2 = get({v: 0, id}), t3 = get({v: 0, id})
          expect(t1).to.deep.equal(t2).to.deep.equal(t3)
          expect(diff(t1))
            .to.be.an.instanceOf(Frame)
            .to.deep.equal(diff(t2, diff(t3)))
        })
      })
    })
  })

  describe("functionals", function(){
    functionalRoots.forEach(({ name: id, get, added, changed, removed, defaultNextCount }) => {
      describe(id, function(){
        allBlackboxes.forEach(({ 
          name: nextId, 
          get: nextGet, 
          added: nextAdded, 
          removed: nextRemoved, 
          changed: nextChanged,
        }) => {
          describe(`with ${nextId} child`, function(){
            it("should be added", function(){
              const tracker = new Tracker()
              const data = {v: 0, id}, template = get(data);
              template.next = nextGet(data);
              const result = diff(template, null, tracker);
              expect(result).to.be.an.instanceOf(Frame);
              expect(tracker.events).to.deep.equal(fill(nextAdded(data), added(data)))
            })
            it("should remove the root", function(){
              const tracker = new Tracker();
              const data = {v: 0, id}, template = get(data)
              template.next = nextGet(data);
              const frame = diff(template, null, tracker);
              tracker.reset();
              const result = diff(null, frame, tracker);
              expect(result).to.be.true;
              const childEvents = nextRemoved(data).filter(e => !("dR" in e))
              expect(tracker.events).to.deep.equal(fill(childEvents, removed(data)))
            })
            it("should remove just the child", function(){
              const tracker = new Tracker();
              const data = {v: 0, id}, template = get(data)
              template.next = nextGet(data);
              const frame = diff(template, null, tracker);
              tracker.reset();
              const result = diff(get(data), frame, tracker);
              expect(result).to.be.an.instanceOf(Frame);
              if (!defaultNextCount) expect(result.children).to.be.null;
              else expect(result.children.length).to.equal(defaultNextCount)
              expect(tracker.events).to.deep.equal(fill(nextRemoved(data), changed(data)))
            })
            it("should update just the root without getting replaced", function(){
              const tracker = new Tracker(), data = {v: 0, id}, newData = {v: 1, id}
              const template = get(data), newTemplate = get(newData)
              template.next = nextGet(data);
              newTemplate.next = nextGet(data);
              const frame = diff(template, null, tracker);
              tracker.reset();
              const result = diff(newTemplate, frame, tracker);
              expect(result).to.be.an.instanceOf(Frame).to.equal(frame)
              expect(tracker.events).to.deep.equal(fill(nextChanged(data), changed(newData)))
            })
            it("should update just the child without getting replaced", function(){
              const tracker = new Tracker(), data = {v: 0, id}, newData = {v: 1, id}
              const template = get(data), newTemplate = get(data);
              template.next = nextGet(data);
              newTemplate.next = nextGet(newData);
              const frame = diff(template, null, tracker);
              tracker.reset();
              const result = diff(newTemplate, frame, tracker);
              expect(result).to.be.an.instanceOf(Frame).to.equal(frame)
              expect(tracker.events).to.deep.equal(fill(nextChanged(newData), changed(data)))
            })
            it("should update both parent and child without getting replaced", function(){
              const tracker = new Tracker(), data = {v: 0, id}, newData = {v: 1, id}
              const template = get(data), newTemplate = get(newData);
              template.next = nextGet(data);
              newTemplate.next = nextGet(newData);
              const frame = diff(template, null, tracker);
              tracker.reset();
              const result = diff(newTemplate, frame, tracker);
              expect(result).to.be.an.instanceOf(Frame).to.equal(frame)
              expect(tracker.events).to.deep.equal(fill(nextChanged(newData), changed(newData)))
            })
            blackboxRoots.forEach(({ name: replaceId, get: replaceGet, added: replaceAdded }) => {
              const data = {id, v: 0}, template = get(data), newTemplate = replaceGet(data);
              if (newTemplate.name === template.name) return;
              it(`should replace the root with ${replaceId} frames`, function(){
                template.next = nextGet(data)
                const tracker = new Tracker();
                const frame = diff(template, null, tracker);
                expect(frame).to.be.an.instanceOf(Frame);
                tracker.reset();
                const newFrame = diff(newTemplate, frame, tracker);
                expect(newFrame).to.be.an.instanceOf(Frame).to.not.equal(frame);
                const childEvents = nextRemoved(data).filter(e => !("dR" in e));
                const events = [...fill(childEvents, removed(data)), ...replaceAdded(data)]
                expect(tracker.events).to.deep.equal(events)
              })
            })
            allNontrivialBlackboxes.forEach(({
              name: replaceId, 
              get: replaceGet, 
              added: replaceAdded
            }) => {
              if (!nextId.startsWith("reducible") && type(nextId) === type(replaceId)) return;
              const data = {id, v: 0}, template = get(data), newTemplate = get(data);
              template.next = nextGet(data), newTemplate.next = replaceGet(data);
              if (!nextId.startsWith("void") && template.next.name === newTemplate.next.name) return;
              it(`should replace the child with ${replaceId} frames`, function(){
                const tracker = new Tracker();
                const frame = diff(template, null, tracker);
                expect(frame).to.be.an.instanceOf(Frame);
                tracker.reset();
                const newFrame = diff(newTemplate, frame, tracker);
                expect(newFrame).to.be.an.instanceOf(Frame).to.equal(frame);
                let events;
                if (!has(nextId, "(array)") || nextId.startsWith("void")){
                  events = [...nextRemoved(data), ...replaceAdded(data)]
                } else {
                  events = fill(replaceAdded(data), nextRemoved(data), "dR", true)
                }
                expect(tracker.events).to.deep.equal(fill(events, changed(data)))
              })
            })
            it("should satisfy the identity diff(t) = diff(t, diff(t))", function(){
              const t1 = get({v: 0, id}), t2 = get({v: 0, id}), t3 = get({v: 0, id})
              const c1 = nextGet({v: 0, id}), c2 = nextGet({v: 0, id}), c3 = nextGet({v: 0, id})
              t1.next = c1, t2.next = c2, t3.next = c3;
              expect(t1).to.deep.equal(t2).to.deep.equal(t3)
              expect(diff(t1))
                .to.be.an.instanceOf(Frame)
                .to.deep.equal(diff(t2, diff(t3)))
            })
          })
        })
      })
    })
  })
})
