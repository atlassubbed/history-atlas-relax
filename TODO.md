Steps to achieve well-defined diff (without rebasing, yet):
  1. Implement the flush model, where all events are queued and flushed at the end of the cycle.
  2. Modify diff so that it:
     * willAdd, but doesn't mount, adds to lags
     * adds new temp, but doesn't fill path, adds to originators
     * calculates originators, willRemove, doesn't unmount, adds to removes
  3. Implement the subcycle model (sidediff).
     * while we have queued originators or lags or unmounts:
       * fill path with queued originators
       * perform all queued unmounts
       * subdiff off the path until path is empty
       * mount off lags until lags is empty
       * flush events
  4. Modify setState so that (we may need to upgrade node.inPath to an integer):
     * if not in path
       * if tau < 0, queue update as above, instead of upgrading to tau = 0.
         * if we're not in a diff, initiate a sidediff
       * else merge state into next and async schedule update as usual
     * else
       * if tau < 0, merge state directly onto node, upgrade to originator
       * else, merge state into next and async schedule update as usual
  5. Modify fill to applyState on all originators before marking, guaranteeing that nextState is null


2. Consider queueing up emitted events (except receives), run all events after emptying path/lags:
   * all removes, all moves & adds, all didUpdates
   * this way, all removes for an affected region are done before any adds
   * allows better resource recylcing
3.

Considerations:

1. well-defined diffs
2. error boundaries
3. async diffs, streaming api, effects api
4. Online updates of path instead of fill/mark before every diff cycle (rebasing the path)
6. Min-heap scheduling algorithm
   * can be used to vastly limit timer usage
   * provide a basis for implementing online diffs (e.g. prioritized diff cycles, rebasing)
   * diff caller can provide a queueing function (e.g. rIC/rAF)
8. Test non-happy cases for frame.diff, etc. (e.g. is calling frame.diff("string") defined?) 

Minor considerations:

1. Minor performance boosts, at the expense of increased code complexity:
   * don't add implicit nodes to path
   * don't increase aff count for parent-child edges
   * don't increase step count for parent-child stepping
   * selectively defer mounts
   * don't snapshot affects, instead defer sub/unsub changes to apply at end of cycle
     * downside: affects must be an array (O(n) (un)sub) or a set (no random access for fill/mark)
2. Either use the "it" field to link the path instead of using a stack, or use Kahn's algorithm
4. Calling frame.diff, sub, unsub on a removed frame will short-circuit or error
   * currently, you can call frame.diff({}, tau) on a null frame, and it will continue to schedule it.
5. Use a base class of "Particle" and a subclass of "Oscillator"
   * Particle class doesn't implement state or entanglement, used for irreducible "dumb" nodes
   * Components and functions will be constructed as Oscillators (w/ entanglement and state)
   * Advantage is that the vast majority of nodes are irreducible, and have leaner constructors.
   * Disadvantage is that there are now TWO flavors of node - or is this an advantage?
6. Investigate using weakmaps or symbols, falling back to strings for internal fields

Application-level considerations (things that can be built without changing the engine):

1. Degenerate tau: splitting a common tau to achieve segmentation/batching in a diff cycle.
2. Managed subdiff with many virtual children should perform much better than an automatic subdiff
   * should be able to build an efficient Collection component which supports queries (sort, limit, filter)
   * Should be able to implement an efficient virtualized list component
   * Should be able to avoid doing N subdiffs if N components depend on the same changing list
4. Implement a basic synchronous view framework.
5. Implement a more advanced view framework which uses requestAnimationFrame
6. Implement "hooks-like" API using a special effect which lets you register multiple cleanup callbacks
7. functional nodes (standalone render functions) should be able to have state and entanglement.
8. Should be able to implement reactive variables on top of entanglement abstraction
   * ReactiveVar component with .set and .get methods.
   * ReactiveDict component with .set and .get methods (composed of ReactiveVars)
   * e.g. reactiveVar.get(val => template) returns a template', owned by the surrounding context
   * or you can this.sub(reactiveVar) directly, since it is just a frame anyway
   * reactiveDict could let you .get multiple fields at once, or specify a projection, could even support nesting
9. Implement "short" or "memo" function which seamlessly integrates into template/JSX syntax
10. Implement "jsx" template literal operator/function which makes it easy to not use JSX.