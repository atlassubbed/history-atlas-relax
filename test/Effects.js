const { expect } = require("chai")
const { Frame } = require("../src/index");
const { isArr, toArr, isObj, isVoid, isFn } = require("./util")

// PassThrough is used to attach useful lifecycle methods onto frames.
class PassThrough {
  willUpdate(f){f.willReceive && f.willReceive(f)}
  willPush(f){f.willPush && f.willPush(f)}
  willDiff(f){
    if (f.epoch) f.willUpdate && f.willUpdate(f);
    else f.willAdd && f.willAdd(f);
  }
  didDiff(f){
    if (f.epoch) f.didUpdate && f.didUpdate(f);
    else f.didAdd && f.didAdd(f);
  }
}

// Cache is used to cache all frames in the constructed tree.
class Cache {
  constructor(nodes){
    this.nodes = nodes
  }
  willPush(f, parent){
    this.nodes[f.temp.data.id] = f;
  }
}

// Tracker is used to log lifecycle events in order.
//   * many edit permuations may lead to a correct outcome
//     use this effect when the order matters
//   * when testing final trees, use Renderer instead
class Tracker {
  constructor(events){
    this.events = events; 
    this.root = null;
  }
  log(type, f){
    const e = {[type]: f.temp.data.id};
    this.events.push(e);
  }
  willPush(f, parent){
    this.log("wPu", f)
    if (!parent) this.root = f
  }
  willSub(nextF, parent, i) {
    const prev = parent ? parent.children[i] : this.root;
    this.log("wP", prev);
    if (!parent) this.root = nextF;
  }
  didSub(prevF){this.log("dP", prevF)}
  willPop(f){this.log("wP", f)}
  didPop(f){this.log("dP", f)}
  willUpdate(f){this.log("wR", f)}
  willDiff(f){this.log(f.epoch ? "wU" : "wA", f)}
  didDiff(f){this.log(f.epoch ? "dU" : "dA", f)}
}

// Timer is used to record update times.
class Timer {
  constructor(events){
    this.events = events;
    this.start = Date.now()
  }
  log(type, f){
    const e = {[type]: f.temp.data.id};
    e.dt = Date.now() - this.start;
    e.tau = f.tau;
    e.state = f.state && Object.assign({}, f.state);
    this.events.push(e);
  }
  willUpdate(f){this.log("wR", f)}
  willDiff(f){f.epoch && this.log("wU", f)}
  didDiff(f){f.epoch && this.log("dU", f)}
}

// Renderer should be as dumb as possible.
//   * each method should be O(1) and self-explanatory
//   * swaps should be optional
//   * provides a manual render function to construct the expected render
const getNext = temp => {
  const { name, data, next } = temp;
  if (!isFn(name)) return next;
  const p = name.prototype;
  if (p && isFn(p.evaluate))
    return (new name(temp)).evaluate(data, next);
  return name(data, next);
}
class Renderer {
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

module.exports = { Renderer, Tracker, PassThrough, Timer, Cache }
