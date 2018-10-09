const Renderer = require("./Renderer");
const { isObj } = require("../util");

/* keeps a live-view of a tree in LCRS form:

          ROOT  derived from   ROOT   (note: one physical pointer to child arr)
          /                   /  |  \
         1                   1   2   3  
       /   \                / \  |
      4     2              4   5 6
     / \   / \            /
    7   5 6   3          7

    * this is equivalent to a binary tree
    * LCRS live-view should be possible with a singly-linked list and one pointer to head
    * make no assumptions about any other pointers' existence
    * should be able to do mutation ops in constant time with reference to prev sibling */

// insert node after s (or at front) if necessary
// effects are responsible for short-circuiting edge cases
const insertAfter = (node, p, s, ns) => {
  if (s) {
    if (node === (ns = s._node.sib)) return;
    else s._node.sib = node;
  } else {
    if (node === (ns = p._node.next)) return;
    else p._node.next = node;
  }
  return ns ? (node.sib = ns) : delete node.sib;
}
module.exports = class LCRSRenderer extends Renderer {
  attachChildren(node, next){
    let child, sib, i;
    node.next = next[i = 0];
    while(child = next[i++], sib = next[i]) child.sib = sib;
  }
  willAdd(f, p){ // assign new or recycled resources to f
    this.counts.a++;
    const node = f._node = this.node(f.temp);
    if (!p) this.tree = node;
  }
  willRemove(f, p){ // destroy or recycle resources from f
    this.counts.r++;
    f._node = f._node.sib = null;
    if (!p) this.tree = null;
  }
  willLink(f, p, s){ // update the upstream location of f
    if (insertAfter(f._node, p, s)) this.counts.s++;
  }
  willUnlink(p, s){ // discard the chain after s
    if (s) s._node.sib && delete s._node.sib;
    else delete p._node.next;
  }
  willReceive(f, t){ // give new data to f
    this.counts.u++
    f._node.data = t.data;
  }
}
