const { describe, it } = require("mocha")
const { expect } = require("chai")
const { Frame, diff } = require("../src/index");
const { copy } = require("./util");
const { LCRSRenderer, Tracker } = require("./effects");
const { 
  BadCtor, BadMount, BadUpdate, ErrorBoundary, 
  BadCtorBoundary, BadMountBoundary, BadUpdateBoundary 
} = require("./cases/errors")

// describe("when not in a diff", function(){
//   it("should throw a root constructor error globally and not mount the root", function(){
//     const events = [];
//     const renderer = new LCRSRenderer, tracker = new Tracker(events);
//     const work = () => diff({name: BadCtor}, null, {effs: [renderer, tracker]});
//     expect(work).to.throw("ctor error")
//     expect(renderer.tree).to.be.null;
//     expect(events).to.be.empty;
//   })
//   it("should throw a child constructor error globally and not mount the root", function(){
    // const events = [];
    // const renderer = new LCRSRenderer, tracker = new Tracker(events);
    // const work = () => diff({name: "p", next: {name: BadCtor}}, null, {effs: [renderer, tracker]});
    // expect(work).to.throw("ctor error")
    // expect(renderer.tree).to.be.null;
    // expect(events).to.be.empty;
//   })
// })

// need to test for managed, standalone and direct children
describe.only("error boundaries", function(){
  describe.only("where there is no error boundary", function(){
    describe("for direct children", function(){
      it("should throw a constructor error globally and not mount the offending tree", function(){
        const events = [];
        const renderer = new LCRSRenderer, tracker = new Tracker(events);
        const temp = () => ({name: "p", data: {id: 0}, next: {name: BadCtor, data: {id: 1}}})
        const work = () => diff(temp(), null, {effs: [renderer, tracker]});
        expect(work).to.throw("ctor")
        expect(renderer.tree).to.be.null;
        expect(events).to.be.empty;
      })
      it("should throw a mount error globally and not mount the offending tree", function(){
        const events = [];
        const renderer = new LCRSRenderer, tracker = new Tracker(events);
        const temp = () => ({name: "p", data: {id: 0}, next: {name: BadMount, data: {id: 1}}})
        const work = () => diff(temp(), null, {effs: [renderer, tracker]});
        expect(work).to.throw("mount")
        expect(renderer.tree).to.be.null;
        expect(events).to.be.empty;
      })
      it("should throw an update error globally and unmount the offending tree", function(){
        const events = [];
        const renderer = new LCRSRenderer, tracker = new Tracker(events);
        const temp = () => ({name: "p", data: {id: 0}, next: {name: BadUpdate, data:{id: 1}}});
        const f = diff(temp(), null, {effs: [renderer, tracker]})
        events.length = 0;
        expect(renderer.tree).to.eql(renderer.renderStatic(temp()))
        const work = () => diff(temp(), f);
        expect(work).to.throw("update")
        expect(renderer.tree).to.be.null;
        expect(events).to.eql([
          {mWP: 0}, {mWP: 1}
        ])
      })
    })
    describe("for managed children", function(){
      it("should throw a constructor error globally and not mount the offending tree", function(){
        const events = [];
        const renderer = new LCRSRenderer, tracker = new Tracker(events);
        const temp = () => ({name: "p", data: {id: 0}, next: {name: (t, node, isF) => {
          if (Frame.isFrame(node) && isF){
            diff({name: BadCtor, data: {id: 2}}, null, node);
          }
        }, data: {id: 1}}})
        const work = () => diff(temp(), null, {effs: [renderer, tracker]});
        expect(work).to.throw("ctor")
        expect(renderer.tree).to.be.null;
        expect(events).to.be.empty;
      })
      it("should throw a mount error globally and not mount the offending tree", function(){
        const events = [];
        const renderer = new LCRSRenderer, tracker = new Tracker(events);
        const temp = () => ({name: "p", data: {id: 0}, next: {name: (t, node, isF) => {
          if (Frame.isFrame(node) && isF){
            diff({name: BadMount, data: {id: 2}}, null, node);
          }
        }, data: {id: 1}}})
        const work = () => diff(temp(), null, {effs: [renderer, tracker]});
        expect(work).to.throw("mount")
        expect(renderer.tree).to.be.null;
        expect(events).to.be.empty;
      })
      it("should throw an update error globally and unmount the offending tree", function(){
        const events = [];
        const renderer = new LCRSRenderer, tracker = new Tracker(events);
        const managedTemp = () => ({name: BadUpdate, data: {id: 2}})
        const temp = () => ({name: "p", data: {id: 0}, next: {name: (t, node, isF) => {
          if (Frame.isFrame(node) && isF){
            node.man = diff(managedTemp(), null, node);
          } else if (Frame.isFrame(node)){
            diff(managedTemp(), node.man)
          }
        }, data: {id: 1}}})
        const f = diff(temp(), null, {effs: [renderer, tracker]});
        events.length = 0;
        const work = () => diff(temp(), f);
        expect(work).to.throw("update")
        expect(renderer.tree).to.be.null;
        expect(events).to.eql([
          {mWP: 0}, {mWP: 1}, {mWP: 2}
        ])
      })
    })
    describe("for contextual children", function(){
      it("should throw a constructor error globally and not mount the offending tree or aux tree", function(){
        const events = [];
        const r1 = new LCRSRenderer, r2 = new LCRSRenderer;
        const tracker = new Tracker(events);
        const temp = () => ({name: "p", data: {id: 0}, next: {name: (t, node, isF) => {
          if (Frame.isFrame(node) && isF){
            diff({name: BadCtor, data: {id: 2}}, null, {effs: [r2, tracker]});
          }
        }, data: {id: 1}}})
        const work = () => diff(temp(), null, {effs: [r1, tracker]});
        expect(work).to.throw("ctor")
        expect(r1.tree).to.be.null;
        expect(r2.tree).to.be.null;
        expect(events).to.be.empty;
      })
      it("should throw a mount error globally and not mount the offending tree and aux tree", function(){
        const events = [];
        const r1 = new LCRSRenderer, r2 = new LCRSRenderer;
        const tracker = new Tracker(events);
        const auxTemp = () => ({name: BadMount, data: {id: 2}})
        const temp = () => ({name: "p", data: {id: 0}, next: {name: (t, node, isF) => {
          if (Frame.isFrame(node) && isF){
            diff(auxTemp(), null, {effs: [r2, tracker]});
          }
        }, data: {id: 1}}})
        const work = () => diff(temp(), null, {effs: [r1, tracker]});
        expect(work).to.throw("mount")
        expect(r1.tree).to.be.null;
        expect(r2.tree).to.be.null;
        expect(events).to.be.empty;
      })
      it("should throw an update error globally and unmount the offending tree and aux tree", function(){
        const events = [];
        const r1 = new LCRSRenderer, r2 = new LCRSRenderer;
        const tracker = new Tracker(events);
        const managedTemp = () => ({name: BadUpdate, data: {id: 2}})
        const temp = () => ({name: "p", data: {id: 0}, next: {name: (t, node, isF) => {
          if (Frame.isFrame(node) && isF){
            node.man = diff(managedTemp(), null, {effs: [r2, tracker]});
          } else if (Frame.isFrame(node)){
            diff(managedTemp(), node.man)
          }
        }, data: {id: 1}}})
        const f = diff(temp(), null, {effs: [r1, tracker]});
        events.length = 0;
        const work = () => diff(temp(), f);
        expect(work).to.throw("update")
        expect(r1.tree).to.be.null;
        expect(r2.tree).to.be.null;
        expect(events).to.eql([
          {mWP: 0}, {mWP: 1}, {mWP: 2}
        ])
      })
    })
  })
  describe("where the offending node is the only error boundary", function(){
    it("should throw a constructor error globally and unmount the offending tree", function(){
      
    })
    it("should throw a mount error globally and unmount the offending tree", function(){

    })
    it("should throw an update error globally and unmount the offending tree", function(){

    })
  })
  describe("where there is a single error boundary above the offending node", function(){
    it("should pass a render error to the boundary and unmount the offending subtree", function(){

    })
    it("should pass a constructor error to the boundary and unmount the offending subtree", function(){
      
    })
    it("should throw a catch error globally and unmount the offending tree", function(){

    })

    describe("where the error boundary's new tree throws an error", function(){
      it("should throw a render error globally and unmount the offending tree", function(){

      })
      it("should throw a constructor error globally and unmount the offending tree", function(){

      })
    })
  })
  describe("where there are multiple error boundaries above the offending node", function(){
    it("should pass a render error to the first boundary and unmount the offending subtree", function(){

    })
    it("should pass a constructor error to the first boundary and unmount the offending subtree", function(){
      
    })
    it("should pass a catch error to the second boundary and unmount the offending subtree", function(){

    })
    describe("where the first error boundary's new tree throws an error", function(){
      it("should pass a render error to the second boundary and unmount the offending subtree", function(){

      })
      it("should pass a constructor error to the second boundary and unmount the offending subtree", function(){
        
      })
    })
  })
})
