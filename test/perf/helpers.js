const { Frame } = require("../../src/index");
const { toArr } = require("../util");
const { shuffle } = require("atlas-random");

let id = 0;
// edge cases:
//   * max height (linked list)
//   * max width (star)
//   * typical/log height (binary tree)
class TemplateFactory {
  constructor(Subframe, chainDepth=0){
    this.Frame = Subframe || Frame;
    if (!Subframe) while(chainDepth--)
      this.Frame = class extends this.Frame {};
  }
  h(next){
    const node = {name: this.Frame, data: {id: ++id}};
    if (next) node.next = next;
    return node;
  }
  linkedList(n){
    let node;
    while(n--) node = this.h(node);
    return node;
  }
  // balanced
  binaryTree(n){
    let nodes = [], m = n;
    while(m--) nodes.push(this.h());
    let r = nodes[n-1], i = 0, p, c1, c2;
    while(i++, p = nodes.pop()){
      const s = n - 2*i;
      if (c1 = nodes[s]) (p.next = p.next || []).push(c1);
      if (c2 = nodes[s-1]) p.next.push(c2);
    }
    return r;
  }
  star(n){
    const next = [];
    while(n-- > 1) next.push(this.h());
    return this.h(next.reverse());
  }
  keyedStar(n){
    let key = 0;
    const next = [];
    while(n-- > 1) {
      const node = this.h();
      node.key = ++key
      next.push(node)
    }
    return this.h(shuffle(next))
  }
}

const count = tree => {
  let stack = [tree], n = 0, next;
  while(next = stack.pop()){
    n++;
    if (next.next) stack.push(next.next);
    if (!next.prev) while(next = next.sib) stack.push(next);
  }
  return n;
}

const printHeap = () => {
  const mb = process.memoryUsage().heapUsed/1e6;
  console.log(`\n${Math.floor(mb)} MB being used`)
}

const printTitle = (name, padding) => {
  const numPad = Math.max(0, padding-name.length)
  name = name + Array(numPad+1).fill().join(" ");
  process.stdout.write(`    ${name} `);
}

const doWork = n => {
  if (n){
    const result = [];
    while(n--) result.push({name: "div"});
  }
}

module.exports = { TemplateFactory, count, printHeap, printTitle, doWork }
