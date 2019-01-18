Managed diffs: keep track of prev/next automatically in prev/next fields?
  * then use some field to indicate that this is a managed parent

1. EITHER: Implement post-order events for effects
   OR: Keep an array of effects to notify about the end of the diff
       if (!eff.inArr) notify.push(eff), eff.inArr = true;
       At the end of the diff, go through each eff and call eff.didDiff();
       Can optionally provide a callback to make it async:
         parallel([...done => eff.didDiff(done)])
         This would allow us to implement async diffs.
       didDiff would give effects a chance to apply accumulated mutations (e.g. mount trees)
    Another idea, we could make all mutation events async, and queue them in parallel.

2. Fix flushed event ordering (iterate over children backwards when filling path)
4. Queue receive events in rems (just queue the node)
5. Make render only take (node, isFirst) arguments.
7. Make path a linked list using left/right pointers instead of inPath/step/it
   * might have to get rid of _affs and use entanglement change buffer map
   * could remove and insert elements O(1) into the path during a diff cycle
8. Consider bringing back parent pointers to avoid using stack memory during tree traversals
   * and helps us avoid doing the "f.it = p" hack for event flushing.
   * might be required for error boundaries

Considerations:

2. error boundaries
3. async diffs, streaming api, effects api
6. Min-heap scheduling algorithm
   * can be used to vastly limit timer usage
   * provide a basis for implementing prioritized diff cycles
   * diff caller can provide a queueing function (e.g. rIC/rAF)
8. Test non-happy cases for frame.diff, etc. (e.g. is calling frame.diff("string") defined?) 

Minor considerations:

0. Instead of using so many pointers on Frames, use an external DoublyLinkedLists class everywhere.
   * e.g. for children, schedule, etc.
   * Advantage: less pointers on frames
   * Disadvantage: garbage memory
1. Minor performance boosts, at the expense of increased code complexity:
   * get rid of refill(...) since we queue up removed nodes anyway, might as well use the entire path
     * queue up recieves, cache move/add/remove event info directly on node, then iterate over path
   * don't queue up events if there are no effs for the node?
   * don't add implicit nodes to path
   * don't increase aff count for parent-child edges
   * don't increase step count for parent-child stepping
   * selectively defer mounts
   * don't snapshot affects, instead defer sub/unsub changes to apply at end of cycle
     * downside: affects must be an array (O(n) (un)sub) or a set (no random access for fill/mark)
2. Either use the "it" field to link the path instead of using a stack, or use Kahn's algorithm
4. Calling frame.diff, sub, unsub on a removed frame will short-circuit or error
5. Use a base class of "Particle" and a subclass of "Oscillator"
   * Particle class doesn't implement entanglement, used for irreducible "dumb" nodes
   * Components and functions will be constructed as Oscillators (w/ entanglement)
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
    * like an html`` template operator

