Declarative reactive computations:
  Autoruns like in Meteor should be possible in my library:
  
  render(){ scope 0
    r(() => { // scope 1

      // this data changes, causing scope 0 to re-render
      r(() => { // scope 2
         // this data changes, causing scope 1 to re-render
      })
      r(() => { // scope 3
         // this data changes, causing scope 1 to re-render
      })
    })
  }

  It would be awesome if we could have r() return a template
  this would be a more scoped reactivity pattern
  compared to manually entangling to sideways state containers in various components

  if we can find a way to automatically know when something is created on first render
  we can get rid of isFirst arg to render() and have code automatically clean up and
  efficiently cached so they don't get re-created on updates

Readability: make variable names and logic more readable (less ternary operators and commas)

Error boundaries:
  1. Parent pointers will help us bubble up errors, but won't let us remove the stack in step-leader
     * might need to implement root state...
  4. Implement node.path = 3 state, indicating the node is being removed due to corruption
  5. Design motivation:
     * it is never OK to continue down a subtree during any diff stage if we hit an error
     * broken state (cycles, errors) would leave the app in undefined/unexpected state
       * it is bad taste to allow the program to continue running 
       * even if we queue up encountered errors and report them later, it's still up to the dev
         to figure out how to reconcile the broken state
     * it's better to destroy offending trees if there is no boundary to catch the error
     * if there is a boundary, we could either:
       1. unmount the offending subtree, let error boundary figure out what to do
       2. keep the offending subtree in its previous state, let error boundary figure out what to do
    
    TODO: in appropriate files
      * make sure sub/unsub throws or returns false on removed nodes (e.g. bad input)
      * make sure inner/outer diffing during on=2 state throws
      * make sure we don't throw cyclic errors, but instead do something (e.g. unmount/stop cycle?)
      * determine if inner/outer diffing should either return false or throw on bad inputs.
      * 
    I'm thinking that bad input should just return false, and disallowed behavior should throw.
    That, or everything should just throw except things that make sense to be noops
    describe("error handling", function(){
      describe("errors during fill stage (pre-diff/marking nodes)", function(){

      })
      describe("errors during subdiff stage (rendering nodes)", function(){
        // test errors made in ctor and render
      })
      describe("errors during flush stage (emitting mutation events)", function(){

      })
    })


Managed diffs: keep track of prev/sib/parent automatically in prev/sib/parent fields?
  * then use some field to indicate that this is a managed parent (e.g. node.root = 0, 1 or 2)
  * then we can simplify outer-diff signatures
    1. diff(t) mounts real t
    2. diff(t, null, {effs}) mounts real t with effects
    3. diff(null, f) unmounts real/virtual f 
    4. diff(t, f) updates real/virtual f
    5. diff(t, null, p) mounts virtual t under p
    6. diff(t, f, s) updates virtual f, moves it after s
  * need to test case where parent simultaneously creates real and virtual children
    * probably best to disallow this
    * not sure how it'd work if allowed...
    * could use magic number node.root in {0: not a root, 1: unknown type, 2: real, 3: virtual}
  * need to disallow (return false/throw error):
    1. removing a managed root from a parent that doesn't own it
    2. updating a managed root under a parent that doesn't own it
    3. moving a managed root after a node that doesn't share the same parent
  * the first two of the above checks aren't needed if we do unlink/link for managed roots
  * instead of this, investigate smarter field nullifying as opposed to doing all in ctor

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
7. Make path a linked list using left/right pointers instead of inPath/step/it
   * might have to get rid of _affs and use entanglement change buffer map
   * could remove and insert elements O(1) into the path during a diff cycle
8. Consider using parent pointers to avoid using stack memory during tree traversals

Considerations:

2. error boundaries
3. async diffs, streaming api, effects api
6. Min-heap scheduling algorithm
   * can be used to vastly limit timer usage
   * provide a basis for implementing prioritized diff cycles
   * diff caller can provide a queueing function (e.g. rIC/rAF)
     * this can actually be done beyond the engine level if we implement async diffs with didDiff cb
8. Test non-happy cases for frame.diff, etc. (e.g. is calling frame.diff("string") defined?) 

Minor considerations:


0. Instead of using so many pointers on Frames, use an external DoublyLinkedLists class everywhere.
   * e.g. for children, schedule, etc.
   * Advantage: less pointers on frames
   * Disadvantage: garbage memory
1. Minor performance boosts, at the expense of increased code complexity:
   * get rid of refill(...) since we queue up removed nodes anyway, might as well use the entire path
     * queue up recieves, cache move/add/remove event info directly on node, then iterate over path
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
7. Investigate adding/removing effects (plugins) on the fly.
   * probably don't wanna do this, as the model depends on static effs over lifetime of given node

Application-level considerations (things that can be built without changing the engine):

0. Investigate skip lists, red-black trees, self-balancing binary trees and min heaps:
   * May allow us to implement sublinear reactive sorted collections.
   * This means N updates would be under O(N^2).
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

