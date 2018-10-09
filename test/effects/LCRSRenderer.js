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
// TODO: possible to do this before calling willMove?
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
const removeAfter = (p, s, ns) => {
  if (s && ns) s._node.sib = ns;
  else if (s) delete s._node.sib;
  else if (p && ns) p._node.next = ns;
  else if (p) delete p._node.next;
}
module.exports = class LCRSRenderer extends Renderer {
  attachChildren(node, next){
    let child, sib, i;
    node.next = next[i = 0];
    while(child = next[i++], sib = next[i]) child.sib = sib;
  }
  willAdd(f, p, s){
    this.counts.a++;
    const node = f._node = this.node(f.temp);
    if (!p) return (this.tree = node);
    insertAfter(node, p, s)
  }
  willRemove(f, p, s, i){
    this.counts.r++;
    if (!p) this.tree = null;
    // if (i != null) removeAfter(p, s, f._node.sib); // not necessary since we need willClip
    f._node = f._node.sib = null;

  }
  willClip(f, s){
    if (s) s._node.sib && delete s._node.sib;
    else delete f._node.next;
  }
  willMove(f, p, s){
    if (insertAfter(f._node, p, s)) this.counts.s++;
  }
  willReceive(f, t){
    this.counts.u++
    f._node.data = t.data;
  }
}
