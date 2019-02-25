Render and rendered:
  1. maybe deprecate isFirst, since app-level code can use memoization and flags 
       * this.cache = this.cache || makeBigCache()
       * if (!this.called) this.called = !!(this.cache = makeBigCache())
  2. make node the last argument to these functions. instead of render(temp, node, isFirst),
     make it render(temp, isFirst, node);

inner diffs (especially if deprecate isFirst arg):
  * probably just short circuit if node is already in the path and return false (did not queue)
  * throwing err if on > 1, (undiffable state) when error boundaries are implemented.

Cleanup and flush cycle (post-order/rendered) code:
  Once we implement context tracking and automatic unmounting for context nodes, we will need a way for nodes to specify code to run before/after unmount so they can clean up unwanted resources (timers, caches, etc.). We have a few options:

    1. Export cleanup() and then() functions which queue up rendered/cleanup callbacks and run them
       after flush.
    2. Bring back cleanup() and rendered() lifecycle methods.
    3. Create concept of ephemeral effects (like plugins but for that node in that render cycle only)
       Export something like withEffect() which lets a node use an auxiliary effect that becomes part of the flush cycle for that diff only. Since it's in the flush stage, we can't do sync diffs in that code. Would be useful for reading the dom right before flush, mutating/reading the dom right after flush, doing work after the render phase to lower time-to-mount.
    4. Export a function then() which lets nodes queue up custom willDo events, treated like any other
       event, but lets the node run some function during flush. If the temp is null in that function, we're cleaning up. Should have a reference to the prev temp and cur temp so it can properly update:

        render(){
          // do stuff
          then((temp, prevTemp) => {
            // should probably allow async inner diffs here as long as not cleanup
            if (!temp) // cleanup prevTemp;
            else if (!prevTemp) // initial mount
            else if (!equals(prevTemp.prop, temp.prop)) // cleanup old and init new.
          })
        }

        then we'd need to add this in the event thread objects: {..., cbs: Array[fns]}
       Could also export a cleanup() function that does the same thing but only calls after an unmount, as opposed to after each render. Could also distinguish between thenAfterThisRender() and thenAfterEachRender() to avoid having to continually destroy and reconstruct callbacks
    5. Similar to 4, but instead of exporting then, we supply a cb to render() so render would have the 
       signature: render(temp, node, isFirst, cb). cb would take a function (like then)
    6. Similar to 4 and 5 but instead of a cleanup() callback, we have the function supplied to then()
       return another function, which specifies how to clean up the function, and takes dependency arguments to know when not to cleanup and reset

Event Ordering and Squashing:
  Without rebasing, the diff cycle is fairly simple. Removal, move, add, and receive events are generated and queued. Removal events may be processed before all of the other events, or, removals may be queued separately and flushed before the other events are flushed. This allows maximal resource recycling for a given diff cycle:

    totalEventsQueue = [...removalEventsQueue, allOtherEventsQueue].

  As soon as we introduce rebasing, this becomes a lot more complicated. We can no longer assume that every node corresponds to at most one move/add/remove event, nor can we assume that every node actually exists yet (according to the effects). Rebasing may lead to situations where a node is mutated in many ways, generating a sequence of non-commutative events. The addition of particular nodes may be dependent on the existence and/or location of other nodes. Nodes removed in rebase_i may have been added or moved in a previous rebase, in which case removing the node too early may result in inconsistencies.

  We need to figure out the correct way of squashing different types of events together to reduce the event footprint. 

    ADD events do not commute with each other unless parent-child order is preserved
    REMOVE events should commute with each other
    MOVE events do not commute with each other in the general case (sometimes, they do)
    RECEIVE events do not commute with each other, however they can be squashed to the last-seen event
    ADD and 

    ADD -> ADD adding something after a (re)moved node or under a (re)moved node
    ADD -> REMOVE
    ADD -> MOVE
    ADD -> RECEIVE

    MOVE -> ADD
    MOVE -> REMOVE
    MOVE -> MOVE
    MOVE -> RECEIVE

    RECEIVE -> REMOVE
    RECEIVE -> MOVE


  Rebasing repeatedly leads to a potential perf problem.
  Let the size of the union of the rebased affected regions be N.
  Let the number of queued events be E.
  Currently, it is possible for E >> N, and E is not bounded.

  Rebasing repeatedly is an antipattern for large applications.
  Many events may be generated for a single node


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
  * need to test case where parent simultaneously creates real and virtual children
    * probably best to disallow this
    * not sure how it'd work if allowed...
    * could use magic number node.root in {0: not a root, 1: unknown type, 2: real, 3: virtual}
  * need to test case where standalone (unmanaged) root nodes are created:
    * these nodes should not be linked/unlinked from any parent (context) node 
    * if created at top level, parent == null?
    * otherwise, parent == context node, but don't unlink/link
  * need to disallow (return false/throw error):
    1. moving a managed root after a node that doesn't share the same parent
  * need to test case where we simulate managed nodes via standalone nodes on the same effect
    * in which case, next/prev/sib aren't used.
    * should be able to override next/prev/sib on the parent with custom data structures
      without breaking the code. Should work since we use node.root now to conditionally render

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

