const { Timer } = require("atlas-basic-timer");
const { shuffle, int, insert, sample } = require("atlas-random");

class Node {
  constructor(){
    this.step = this.affN = 0;
    this.inPath = this.isOrig = false;
    this.next = this.affs = null;
  }
  *[Symbol.iterator](){
    const { next, affs } = this;
    if (next) yield* next;
    if (affs) yield* affs;
  }
}

class Graph {
  constructor(n, p, allowCycles){
    this.nodes = [];
    while(n--) this.nodes.push(new Node);
    if (p) this.perturb(p, allowCycles, "next");
  }
  *[Symbol.iterator](){
    yield* this.nodes;
  }
  perturb(p, allowCycles, field="affs"){
    const { nodes } = this, n = nodes.length;
    for (let i = 0, prev, next; i < n; i++){
      prev = nodes[i], next = prev[field] || [];
      for (let j = allowCycles ? 0 : i+1; j < n; j++)
        if (Math.random() < p) insert(next, nodes[j]);
      if (next.length) prev[field] = next;
    }
  }
}


/* we want to generate a forest of total size "n"
   consisting of "degree"-ary trees, each with up to "height" levels.

   e.g. n = 17, height = 3, degree = 2 generates the forest:

      0           7        14
     / \         / \      /  \
    1   2       8   9    15  16
   / \ / \     / \ / \
  3  4 5  6  10 11 12 13

  a forest of degree-ary trees is just a contiguous array of degree-ary heaps: [...heap1, ...heap2, ...] */
class Forest extends Graph {
  constructor(n, height=1, degree=1){
    super(n);
    let leaves = Math.pow(degree, height-1), size = leaves, { nodes } = this;
    for (let i = 0; i < height-1; i++) size += Math.pow(degree, i);
    for (let r = 0; r < n; r += size){ // for each root index
      for (let p = 0; p < size - leaves; p++){ // for all non-leaves under the root
        const parent = nodes[p+r], next = [];
        for (let d = 1; d <= degree; d++){ // attach up to degree children
          const child = nodes[r+(degree*p+d)]; // e.g. [r + 2p+1, r + 2p+2] for a binary trees
          if (child) next.push(child);
        }
        if (next.length) parent.next = next;
      }
    }
  }
}

const hasCycles = graph => {
  const visiting = new Set, visited = new Set;
  return (function visit(n){
    if (!visited.has(n)) return visiting.has(n) || 
      visiting.add(n) && [...n].reduce((p, c) => !!(p || visit(c)), false) || 
      visiting.delete(n) && !visited.add(n);
  })(graph);
}
const hasDupes = path => path.length > new Set(path).size;
const isOrdered = path => {
  const seen = new Set;
  for (let node of path)
    if (seen.add(node)) for (let c of node)
      if (seen.has(c)) return false;
  return true;
}

const toposortDFS = () => {

}

const toposortKahn = () => {

}

module.exports = { Forest, Graph, hasCycles, hasDupes, isOrdered }