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
const insertAfter = (f, p, s) => {
  f.sib = s ? s.sib : p.next;
  if (s) s.sib = f;
  else p.next = f;
}
const removeAfter = (f, p, s) => {
  if (s) s.sib = f.sib;
  else p.next = f.sib;
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
    if (!p) this.tree = node;
    p && insertAfter(node, p._node, s && s._node);
  }
  willRemove(f, p, s){
    this.counts.r++;
    if (!p) return (this.tree = null);
    removeAfter(f._node, p._node, s && s._node);
  }
  didRemove(f){
    f._node = null
  }
  willMove(f, p, ps, ns){
    this.counts.s++;
    const node = f._node, parent = p._node;
    removeAfter(node, parent, ps && ps._node);
    insertAfter(node, parent, ns && ns._node);
  }
  willReceive(f, t){
    this.counts.u++
    if (t.data != null) f._node.data = t.data;
  }
}
