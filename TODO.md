Considerations:

1. well-defined diffs, isFirst argument to diff(...)
2. error boundaries
3. async diffs, streaming api, effects api
4. Online updates of path instead of fill/mark before every diff cycle
5. Deprecating setTau and getTau (tau 1-to-1 with frame) for setState (tau 1-to-1 with update)

Minor considerations:

1. Minor performance boosts, at the expense of increased code complexity:
   * don't add implicit nodes to path
   * don't increase aff count for parent-child edges
   * don't increase step count for parent-child stepping
   * selectively defer mounts
   * don't snapshot affects, instead defer entangle/detangle changes to apply at end of cycle
     * downside: affects must be an array (O(n) en/detangle) or a set (no random access for fill/mark)
2. Either use the "it" field to link the path instead of using a stack, or use Kahn's algorithm
3. Rename entangle/detangle to sub/unsub, rename diff to render, rename setState to diff, effects to plugins
4. Calling setTau, setState, entangle, detangle on a removed frame will short-circuit or error

Application-level considerations (things that can be built without changing the engine):

1. Degenerate tau: splitting a common tau to achieve segmentation/batching in a diff cycle.
2. Managed subdiff with many virtual children should perform much better than an automatic subdiff
   * should be able to build an efficient Collection component which supports queries (sort, limit, filter)
   * Should be able to implement an efficient virtualized list component
   * Should be able to avoid doing N subdiffs if N components depend on the same changing list
3. setTau and getTau should make it easy to have fluid update priorities
   * make sure that setTau and getTau are the right abstraction.
   * instead we could always supply a tau value to setState
   * supply a function to setTau, acting as the "current getTau function"
   * try other abstraction if the current is wrong
4. Implement a basic synchronous view framework.
5. Implement a more advanced view framework which uses requestAnimationFrame
6. Implement "hooks-like" API using a special effect which lets you register multiple cleanup callbacks
7. functional nodes (standalone render functions) should be able to have state and entanglement.
8. Should be able to implement reactive variables on top of entanglement abstraction
   * ReactiveVar component with .set and .get methods.
   * ReactiveDict component with .set and .get methods (composed of ReactiveVars)
   * e.g. reactiveVar.get(val => template) returns a template', owned by the surrounding context
   * or you can this.entangle(reactiveVar) directly, since it is just a frame anyway
   * reactiveDict could let you .get multiple fields at once, or specify a projection, could even support nesting