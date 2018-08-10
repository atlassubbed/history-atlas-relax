const { describe, it } = require("mocha")
const { expect } = require("chai")
const Tracker = require("./Tracker");
const { Frame, diff } = require("../src/index");
const { 
  voidBlackboxes: voids, 
  irreducibleBlackboxes: primes, 
  reducibleBlackboxes: comps, 
  functionals: functionalRoots
} = require("./assets/templates");

const allBlackboxes = voids.concat(primes, comps)
const blackboxRoots = primes.concat(comps).filter(n => n.name.indexOf("array") < 0)

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

  blackboxRoots.forEach(rootTemplate => {
    const { name: id, get, added, changed, removed } = rootTemplate;
    describe(`${id}`, function(){
      it("should be added correctly", function(){
        const tracker = new Tracker(), data = {v: 0, id};
        const template = get(data)
        const result = diff(template, null, tracker);
        expect(result).to.be.an.instanceOf(Frame);
        expect(tracker.events).to.deep.equal(added(data))
      })
      it("should be removed correctly", function(){
        const tracker = new Tracker(), data = {v: 0, id};
        const template = get(data)
        const frame = diff(template, null, tracker);
        tracker.reset();
        const result = diff(null, frame, tracker);
        expect(result).to.be.true;
        expect(tracker.events).to.deep.equal(removed(data))
      })
      it("should be updated correctly", function(){
        const tracker = new Tracker(), data = {v: 0, id}, newData = {v: 1, id}
        const template = get(data), newTemplate = get(newData)
        const frame = diff(template, null, tracker);
        tracker.reset();
        const result = diff(newTemplate, frame, tracker);
        expect(result).to.be.an.instanceOf(Frame);
        expect(tracker.events).to.deep.equal(changed(newData))
      })
    })
  })

  functionalRoots.forEach(rootTemplate => {
    // test the functional with each allBlackboxes child.
    // test add/remove/changed on both the parent and child
  })

})
