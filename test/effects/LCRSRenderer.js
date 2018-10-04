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
    * should be able to do it in constant time with reference to indecies */

// Singly-linked list operations, using an index to bypass traversal
// remove i-th node
const removeChild = (parentFrame, i) => {
  const node = parentFrame.next[i]._node, next = node.sib;
  if (i === 0) {
    if (next) parentFrame._node.next = next;
    else delete parentFrame._node.next;
  } else if (next) parentFrame.next[i-1]._node.sib = next
    else delete parentFrame.next[i-1]._node.sib;
  delete node.sib;
  return node;
}
// insert j-th (or new) node before i-th node
const insertBefore = (parentFrame, i, jOrNode) => {
  const node = isObj(jOrNode) ? jOrNode : removeChild(parentFrame, jOrNode)
  let next;
  if (i <= 0) {
    next = parentFrame._node.next;
    parentFrame._node.next = node;
  } else {
    const prev = parentFrame.next[i-1]._node
    next = prev.sib;
    prev.sib = node
  }
  next ? (node.sib = next) : delete node.sib;
  return node;
}
// this is unacceptable, the point is to avoid swaps, so this is a placeholder
const transpose = (parentFrame, i, j) => {
  const ch = parentFrame.next;
  const jPrev = ch[j-1], cj = ch[j]._node
  const iPrev = ch[i-1], ci = ch[i]._node
  if (i === 0) parentFrame._node.next = cj;
  else iPrev._node.sib = cj;
  jPrev._node.sib = ci
  const si = ci.sib, sj = cj.sib;
  sj ? (ci.sib = sj) : delete ci.sib;
  si ? (cj.sib = si) : delete cj.sib;
}

module.exports = class LCRSRenderer extends Renderer {
  attachChildren(node, next){
    let child, sib, i;
    node.next = next[i = 0];
    while(child = next[i++], sib = next[i]) child.sib = sib;
  }
  willPush(frame, parent, i){
    this.counts.a++;
    const node = frame._node = this.node(frame.temp);
    if (!parent) return (this.tree = node);
    insertBefore(parent, parent.next.length, node);
  }
  willPop(frame, parent){
    this.counts.r++;
    if (!parent) {
      if (!frame._node.next) frame._node = null;
      return (this.tree = null);
    }
    removeChild(parent, parent.next.length-1)
    parent._node.next || (parent._node = null);
    frame._node.next || (frame._node = null)
  }
  willSwap(parent, i, j){
    this.counts.s++;
    transpose(parent, i, j);
  }
  willReceive(frame, temp){
    this.counts.u++
    frame._node.data = temp.data;
    if (temp.key) frame._node.key = temp.key
    else delete frame._node.key
  }
}
