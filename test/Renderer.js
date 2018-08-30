const { expect } = require("chai")
const { Frame } = require("../src/index");
const { isArr, getNext, toArr, isObj, isVoid } = require("./util")

// Before, we were using a Tracker effect to log lifecycle events.
// Since many edit permutations may lead to a correct outcome,
// we instead implement a simple renderer to verify the outcome.
// This way, the underlying edit path can change freely.

// Renderers (effects) should be as dumb as possible.
//   * Each method should be O(1) and self-explanatory
//   * swaps should be optional
//   * provides a manual render function to construct the expected render

module.exports = class Renderer {
  constructor(){
    this.tree = null;
    this.counts = {a: 0, r: 0, u: 0, n: 0}
  }
  render(temp){
    if (isVoid(temp)) return;
    this.counts.n++;
    if (!isObj(temp)) 
      return {name: null, data: String(temp)};
    const { name, key, data } = temp;
    const rendered = { name, data };
    if (key) rendered.key = key;
    let next = getNext(temp);
    if (isVoid(next)) return rendered;
    next = [...toArr(next)];
    const nextRendered = [];
    while(next.length){
      let el = next.pop(), renderedChild;
      if (isArr(el)) next.push(...el);
      else if (renderedChild = this.render(el)){
        nextRendered.push(renderedChild);
      }
    }
    if (nextRendered.reverse().length)
      rendered.next = nextRendered;
    return rendered;
  }
  willPush(frame, parent){
    // will be pushing frame onto parent's children
    const { name, temp: {data}, key } = frame;
    const node = { name, data };
    frame._node = node
    if (key) node.key = key;
    if (!parent) return (this.tree = node);
    const parentNode = parent._node;
    (parentNode.next = parentNode.next || []).push(node);
  }
  willSub(nextFrame, parent, i){
    // will substitute the i-th child of parent for nextFrame
    const { name, temp: { data }, key } = nextFrame;
    const node = { name, data };
    nextFrame._node = node
    if (key) nextFrame._node.key = key;
    if (!parent) return this.nextRoot = node;
  }
  didSub(prevFrame, parent, i){
    // did substitute prevFrame for the current i-th child of parent
    this.counts.r++
    if (!parent)
      return this.tree = this.nextRoot, this.nextRoot = null;
    const parentNode = parent._node;
    parentNode.next[i] = parent.children[i]._node;
  }
  willPop(frame, parent){
    // about to remove frame from parent
    // can be used to trigger a hook
  }
  didPop(frame, parent){
    // just removed frame from parent
    this.counts.r++;
    if (!parent) return (this.tree = null);
    const node = parent._node, next = node.next;
    void next.pop();
    if (!next.length)
      delete node.next;
  }
  willUpdate(frame, temp){
    // will be setting new temp onto frame
    frame._node.data = temp.data;
  }
  willDiff(frame){
    // about to add or update frame
    // can be used to trigger a hook
  }
  didDiff(frame){
    // just finished adding or updating frame
    if (frame.epoch) return this.counts.u++;
    this.counts.a++;
  }
}
