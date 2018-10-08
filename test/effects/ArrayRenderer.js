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
  willAdd(f, p, s, i){
    this.counts.a++;
    const node = f._node = this.node(f.temp);
    if (!p) return (this.tree = node);
    p = p._node;
    const next = p.next = p.next || [];
    if (i == null) next.push(node);
    else next[i] = node;
  }
  willRemove(f, p, s, i){
    this.counts.r++;
    f._node = null;
    if (!p) return (this.tree = null);
  }
  willMove(f, p, s, i){
    this.counts.s++;
    p._node.next[i] = f._node;
  }
  willClip(f, s, P, N){
    if (s) P > N && (f._node.next.length = N)
    else delete f._node.next;
  }
  willReceive(f, t){
    this.counts.u++
    f._node.data = t.data;
  }
}
