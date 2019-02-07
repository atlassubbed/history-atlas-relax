const { describe, it } = require("mocha")
const { expect } = require("chai")
const { Frame, diff } = require("../src/index");
const { copy } = require("./util");

describe("error boundaries", function(){
  describe("when not in a diff", function(){
    it("should throw a constructor error globablly without unmounting the offending tree", function(){
      
    })
  })
  describe("where there is no error boundary", function(){
    it("should throw a render error globablly and unmount the offending tree", function(){

    })
    it("should throw a constructor error globally and unmount the offending tree", function(){

    })
  })
  describe("where the offending node is the only error boundary", function(){
    it("should throw a render error globablly and unmount the offending tree", function(){

    })
    it("should throw a constructor error globally and unmount the offending tree", function(){
      
    })
  })
  describe("where there is a single error boundary above the offending node", function(){
    it("should pass a render error to the boundary and unmount the offending subtree", function(){

    })
    it("should pass a constructor error to the boundary and unmount the offending subtree", function(){
      
    })
    it("should throw a catch error globablly and unmount the offending tree", function(){

    })
    describe("where the error boundary's new tree throws an error", function(){
      it("should throw a render error globablly and unmount the offending tree", function(){

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
