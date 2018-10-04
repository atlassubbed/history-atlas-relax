const Renderer = require("./Renderer");

// Renderers should be as dumb as possible.
//   * each method should be O(1) and self-explanatory
//   * provides a manual render function to construct the expected render
// effects may listen to events and create their own queues
// e.g. queue all willPush, willSwap, willPop, willReceive
// when didUpdate is called on the last element in the cycle, flush all events:
//   e.g. first remove all orphans (perhaps recycle their resources)
//        then push all
module.exports = class ArrayRenderer extends Renderer {
  attachChildren(node, next){
    node.next = next;
  }
  willPush(frame, parent){
    this.counts.a++;
    // will push frame onto parent's children
    const node = frame._node = this.node(frame.temp);
    if (!parent) return (this.tree = node);
    const parentNode = parent._node;
    (parentNode.next = parentNode.next || []).push(node);
  }
  willSwap(parent, i, j){
    this.counts.s++
    // will swap the i-th child with the j-th child
    const next = parent._node.next, c = next[i];
    next[i] = next[j], next[j] = c;
  }
  willPop(frame, parent){
    // about to remove frame from parent
    this.counts.r++;
    if (!frame._node.next || !frame._node.next.length) frame._node = null
    if (!parent) return (this.tree = null)
    const node = parent._node, next = node.next;
    next.pop();
    if (!next.length){
      delete node.next
      parent._node = null;
    }
  }
  willReceive(frame, temp){
    this.counts.u++
    // will be setting new temp onto frame
    frame._node.data = temp.data;
    if (temp.key) frame._node.key = temp.key
    else delete frame._node.key
  }
}
