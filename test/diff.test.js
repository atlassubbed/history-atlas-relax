const { describe, it } = require("mocha")
const { expect } = require("chai")
const Tracker = require("./Tracker");
const { Frame, diff } = require("../src/index");
const { 
  voidBlackboxes: voids, 
  irreducibleBlackboxes: primes, 
  reducibleBlackboxes: comps, 
  functionals: funcs
} = require("./assets/templates");

const allBlackboxes = voids.concat(primes, comps)
const allRoots = primes.concat(comps, funcs).filter(n => n.name.indexOf("array") < 0)

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

  allRoots.forEach(rootTemplate => {
    // if is blackbox, test add/remove/change for single root
    // else if functional, test the functional with each kind of allBlackboxes child.
    //   for add/remove/changed on both the parent and child
  })

})
