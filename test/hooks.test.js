const { describe, it } = require("mocha")
const { expect } = require("chai")
const { Frame, diff } = require("../src/index");


// * closures are nice, you can specify your rendered callback on every render
//   and it will automatically refer to the correct template.
// * since we would like to support rendered as a class method, we need to 
//   make sure we also supply the correct template as an argument to rendered.
// * opinionated patterns may be implemented on top of these methods.
//   e.g. useEffect(...)

describe("post-flush rendered method", function(){
  it("should run once with the latest template arg", function(){
    let calledRendered = 0, calledRender = 0;
    const N = 10;
    const Node = (temp, node, isFirst) => {
      calledRender++;
      if (isFirst) node.rendered = (t, f, i) => {
        calledRendered++;
        expect(t.data.id).to.equal(N)
        expect(i).to.be.true;
      }
      const { name, data: { id } } = temp;
      if (id < N){
        diff({name, data: {id: id+1}}, node);
      }
    }
    diff({name: Node, data: {id: 0}});
    expect(calledRender).to.equal(N+1);
    expect(calledRendered).to.equal(1);
  })
  it("should run once with the latest template closure", function(){
    let calledRendered = 0, calledRender = 0;
    const N = 10;
    const Node = (temp, node, isFirst) => {
      calledRender++;
      node.rendered = (t, f, i) => {
        calledRendered++;
        expect(temp.data.id).to.equal(N)
        expect(t).to.eql(temp)
        expect(i).to.be.true;
      }
      const { name, data: { id } } = temp;
      if (id < N){
        diff({name, data: {id: id+1}}, node);
      }
    }
    diff({name: Node, data: {id: 0}});
    expect(calledRender).to.equal(N+1);
    expect(calledRendered).to.equal(1);
  })
  it("should run with the last template arg used in render if outer-diffed post-flush before its rendered is called", function(){
    let calledRendered = 0, calledRender = 0, calledFirstRendered = 0;
    const h = id => ({
      name: "root", next: [
        {name: Node, data: {id}},
        {name: PostDiffNode}
      ]
    })
    const Node = (temp, node, isFirst) => {
      calledRender++;
      if (isFirst) node.rendered = (t, f, i) => {
        if (!calledRendered++){
          expect(t.data.id).to.equal(0);
          expect(i).to.be.true;
        } else {
          expect(t.data.id).to.equal(1);
          expect(i).to.be.false;
        }
      }
    }
    const PostDiffNode = (temp, node, isFirst) => {
      if (isFirst) node.rendered = (t, f, i) => {
        if (!calledFirstRendered++){
          expect(calledRendered).to.equal(0);
          diff(h(1), node.parent);
        }
      }
    }
    diff(h(0))
    expect(calledRender).to.equal(2);
    expect(calledRendered).to.equal(2);
    expect(calledFirstRendered).to.equal(2);
  })
  it("should run with the last template closure used in render if outer-diffed post-flush before its rendered is called", function(){
    let calledRendered = 0, calledRender = 0, calledFirstRendered = 0;
    const h = id => ({
      name: "root", next: [
        {name: Node, data: {id}},
        {name: PostDiffNode}
      ]
    })
    const Node = (temp, node, isFirst) => {
      calledRender++;
      node.rendered = (t, f, i) => {
        expect(t).to.eql(temp);
        if (!calledRendered++){
          expect(t.data.id).to.equal(0);
          expect(i).to.be.true;
        } else {
          expect(t.data.id).to.equal(1);
          expect(i).to.be.false;
        }
      }
    }
    const PostDiffNode = (temp, node, isFirst) => {
      if (isFirst) node.rendered = () => {
        if (!calledFirstRendered++){
          expect(calledRendered).to.equal(0);
          diff(h(1), node.parent);
        }
      }
    }
    diff(h(0))
    expect(calledRender).to.equal(2);
    expect(calledRendered).to.equal(2);
    expect(calledFirstRendered).to.equal(2);
  })
  it("should cancel the hook if unset before flush", function(){
    let calledRendered = 0, calledRender = 0;
    const upd = f => diff({name: Node, data: {id: calledRender}}, f);
    const Node = (temp, node, isFirst) => {
      expect(temp.data.id).to.equal(calledRender)
      if (!calledRender++){
        node.rendered = () => calledRendered++;
        upd(node);
      } else if (calledRender === 2) {
        node.rendered = null;
      }      
    }
    const f = upd()
    expect(calledRender).to.equal(2);
    expect(calledRendered).to.equal(0);
    upd(f);
    expect(calledRender).to.equal(3);
    expect(calledRendered).to.equal(0)
  })
  it("should cancel the hook after running it if unset after flush", function(){
    let calledRendered = 0, calledRender = 0;
    const upd = f => diff({name: Node, data: {id: calledRender}}, f);
    const Node = (temp, node, isFirst) => {
      expect(temp.data.id).to.equal(calledRender)
      if (!calledRender++){
        node.rendered = () => {
          calledRendered++;
          node.rendered = null;
        }
        upd(node);
      }  
    }
    const f = upd()
    expect(calledRender).to.equal(2);
    expect(calledRendered).to.equal(1);
    upd(f);
    expect(calledRender).to.equal(3);
    expect(calledRendered).to.equal(1)
  })
})

describe("cleanup method", function(){
  it("should run when nodes are unmounted", function(){

  })
  it("should cancel any pending rendered hooks", function(){

  })
})
