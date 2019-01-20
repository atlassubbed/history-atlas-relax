const { describe, it } = require("mocha")
const { expect } = require("chai")
const { Frame, diff } = require("../src/index");
const { copy } = require("./util");

// we could abstract these into cases like the other tests 
// because it's clearly not as DRY as it could be ¯\_(ツ)_/¯
describe("render", function(){
  it("should provide the node as an argument to the initial render call for arrow function frames", function(){
    let referredNode;
    const MyType = ({data, next}, node) => {
      expect(node).to.be.an.instanceOf(Frame);
      referredNode = node;
    }
    const returnedFrame = diff({name: MyType});
    expect(returnedFrame).to.equal(referredNode)
  })
  it("should provide the node as an argument to the initial render call for regular function frames", function(){
    let referredNode;
    const MyType = function({data, next}, node){
      expect(node).to.be.an.instanceOf(Frame);
      referredNode = node;
    }
    const returnedFrame = diff({name: MyType});
    expect(returnedFrame).to.equal(referredNode)
  })
  it("should indicate the first render for arrow functions", function(){
    let called = false;
    const MyType = ({data, next}, node, isFirst) => {
      expect(isFirst).to.be.true;
      called = true;
    }
    diff({name: MyType});
    expect(called).to.be.true;
  })
  it("should indicate the first render for regular functions", function(){
    let called = false;
    const MyType = function({data, next}, node, isFirst){
      expect(isFirst).to.be.true;
      called = true;
    }
    diff({name: MyType});
    expect(called).to.be.true;
  })
  it("should indicate not the first render for subsequent top diffs for arrow functions", function(){
    let called = 0;
    const MyType = ({data, next}, node, isFirst) => {
      if (called++) expect(isFirst).to.be.false;
    }
    diff({name: MyType}, diff({name: MyType}))
    expect(called).to.equal(2);
  })
  it("should indicate not the first render for subsequent top diffs for regular functions", function(){
    let called = 0;
    const MyType = function({data, next}, node, isFirst){
      if (called++) expect(isFirst).to.be.false;
    }
    diff({name: MyType}, diff({name: MyType}))
    expect(called).to.equal(2);
  })
  it("should indicate not the first render for subsequent self diffs for arrow functions", function(){
    let called = 0;
    const MyType = ({data, next}, node, isFirst) => {
      if (called++) expect(isFirst).to.be.false;
    }
    diff({name: MyType}).diff()

    expect(called).to.equal(2);
  })
  it("should indicate not the first render for subsequent self diffs for regular functions", function(){
    let called = 0;
    const MyType = function({data, next}, node, isFirst){
      if (called++) expect(isFirst).to.be.false;
    }
    diff({name: MyType}).diff()
    expect(called).to.equal(2);
  })
  it("should indicate not the first render for subsequent entangled upstream updates for arrow functions", function(){
    let called = 0;
    const MyType = ({data, next}, node, isFirst) => {
      if (called++) expect(isFirst).to.be.false;
    }
    const aff = diff({name: "p"});
    diff({name: MyType}).sub(aff);
    aff.diff();
    expect(called).to.equal(2);
  })
  it("should indicate not the first render for subsequent entangled upstream updates for regular functions", function(){
    let called = 0;
    const MyType = function({data, next}, node, isFirst){
      if (called++) expect(isFirst).to.be.false;
    }
    const aff = diff({name: "p"});
    diff({name: MyType}).sub(aff);
    aff.diff();
    expect(called).to.equal(2);
  })
  it("should indicate not the first render for subsequent direct upstream updates for arrow functions", function(){
    let called = 0;
    const MyType = ({data, next}, node, isFirst) => {
      if (called++) expect(isFirst).to.be.false;
    }
    diff({name: "p", next: {name: MyType}}, diff({name: "p", next: {name: MyType}}))
    expect(called).to.equal(2);
  })
  it("should indicate not the first render for subsequent direct upstream updates for regular functions", function(){
    let called = 0;
    const MyType = function({data, next}, node, isFirst){
      if (called++) expect(isFirst).to.be.false;
    }
    diff({name: "p", next: {name: MyType}}, diff({name: "p", next: {name: MyType}}))
    expect(called).to.equal(2);
  })
})
