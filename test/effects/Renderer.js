const { isArr, toArr, isObj, isVoid, isFn } = require("../util")

// Base Renderer (subclasses implement attachChildren)
//   * Given a template, recursively diff and render it into a fully evaluated literal tree
//   * The output will be used to verify the live-view is correct after a series of edits
module.exports = class Renderer {
  constructor(){
    this.tree = null, this.resetCounts();
  }
  resetCounts(){
    this.counts = {a: 0, r: 0, u: 0, n: 0, s: 0}
  }
  node({name, key, data}){
    const node = { name, data };
    if (key) node.key = key;
    return node;
  }
  diff(temp){
    const { name, data, next } = temp;
    if (!isFn(name)) return next;
    const p = name.prototype;
    if (p && isFn(p.diff))
      return (new name(temp)).diff(data, next);
    return name(data, next);
  }
  render(temp){
    if (isVoid(temp)) return;
    this.counts.n++;
    if (!isObj(temp)) 
      return {name: null, data: String(temp)};
    const rendered = this.node(temp);
    let next = this.diff(temp);
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
      this.attachChildren(rendered, nextRendered);
    return rendered;
  }
}