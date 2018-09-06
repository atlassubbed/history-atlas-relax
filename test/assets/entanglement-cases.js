const { Frame, diff } = require("../../src/index");
const { Tracker, PassThrough } = require("../Effects");
const { toArr } = require("../util");

const pass = new PassThrough;

// StemCell frames are useful for testing
//   * they take lifecycle methods as props
class StemCell extends Frame {
  constructor(temp, effs){
    super(temp, effs);
    const { data: { hooks } } = temp;
    if (hooks){
      if (hooks.ctor) hooks.ctor.bind(this)(this);
      for (let h in hooks)
        this[h] = hooks[h].bind(this)
    }
  }
}

class StemCell2 extends StemCell {}

// shorthand for creating templates
// "hooks" is a persistent, default prop
const p = (id, hooks, next) => ({
  name: StemCell, data: {id, hooks}, next
})
const a = (id, hooks, next) => ({
  name: StemCell2, data: {id, hooks}, next
});

// curry is useful
const P = (id, allHooks={}) => (...next) => {
  return p(id, allHooks[id], next);
}

const rootCase = {
  /* entangled roots

    root0 -> root1
      |  \  /  |
      |   \/   |
      |   /\   |
      v  /  \  v
    root2 -> root3

  where undirected edges are implicitly top-down directed */
  adj: {
    0: [1,2,3], 
    1: [2,3], 
    2: [3]
  },
  get(hooks){
    const events = [], nodes = {};
    for (let id = 0; id < 4; id++)
      diff(P(id, hooks)(), null, [new Tracker(events, nodes), pass]);
    events.length = 0;
    for (let i in this.adj)
      for (let j of this.adj[i])
        nodes[j].entangle(nodes[i]);
    return {nodes, events};
  }
}

const treeCase = {
  /* entangled trees:

    tag0          _.--> tag4
     |  \        /     /    \
     |  tag1 -._/ _-- tag5  tag8 <-.
     | /    \ ,--'   /    \  /     |
    tag2 -> tag3 -> tag6  tag7     ;
      \____________.^ \___________/

  where undirected edges are implicitly top-down directed */
  adj: {
    0: [2],   4: [],
    1: [4],   5: [3],
    2: [3,6], 6: [8],
    3: [6],   7: [],
              8: [7]
  },
  tag0(hooks){
    return P(0, hooks)(
      P(1, hooks)(
        P(2, hooks)(),
        P(3, hooks)()
      )
    )
  },
  tag4(hooks){
    return (
      P(4, hooks)(
        P(5, hooks)(
          P(6, hooks)(),
          P(7, hooks)(),
        ),
        P(8, hooks)(),
      )
    )
  },
  get(hooks){
    const events = [], nodes = {};
    diff(this.tag0(hooks), null, [new Tracker(events, nodes), pass]);
    diff(this.tag4(hooks), null, [new Tracker(events, nodes), pass])
    events.length = 0;
    for (let i in this.adj)
      for (let j of this.adj[i])
        nodes[j].entangle(nodes[i]);
    return {nodes, events};
  }
}

module.exports = { rootCase, treeCase, p, a }
