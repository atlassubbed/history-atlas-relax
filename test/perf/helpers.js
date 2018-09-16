const { Frame } = require("../../src/index");
const { toArr } = require("../util");

// edge cases:
//   * max height (linked list)
//   * max width (star)
//   * typical/log height (binary tree)
class TemplateFactory {
  constructor(Subframe, chainDepth=0){
    this.Frame = Subframe || Frame, 
    this.cache = {a: {}, l: {}, b: {}, s: {}};
    if (!Subframe) while(chainDepth--)
      this.Frame = class extends this.Frame {};
  }
  h(next){
    const node = {name: this.Frame};
    if (next) node.next = next;
    return node;
  }
  linkedList(n){
    if (this.cache.l[n]) return this.cache.l[n];
    let node;
    while(n--) node = this.h(node);
    return this.cache.l[n] = node;
  }
  // balanced
  binaryTree(n){
    if (this.cache.b[n]) return this.cache.b[n];
    let nodes = [], m = n;
    while(m--) nodes.push(this.h());
    let r = nodes[n-1], i = 0, p, c1, c2;
    while(i++, p = nodes.pop()){
      const s = n - 2*i;
      if (c1 = nodes[s]) (p.next = p.next || []).push(c1);
      if (c2 = nodes[s-1]) p.next.push(c2);
    }
    return this.cache.b[n] = r;
  }
  star(n){
    if (this.cache.s[n]) return this.cache.s[n];
    const next = [];
    while(n-- > 1) next.push(this.h());
    return this.cache.s[n] = this.h(next.reverse());
  }
}

const count = tree => {
  let n = 1, next = tree.next;
  if (next) for (let c of toArr(next))
    n += count(c);
  return n;
}

const printHeap = () => {
  const mb = process.memoryUsage().heapUsed/1e6;
  console.log(`\n${Math.floor(mb)} MB being used`)
}

module.exports = { TemplateFactory, count, printHeap }
