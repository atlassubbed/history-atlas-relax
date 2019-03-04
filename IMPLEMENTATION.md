Supporting Data Structures:

  Path:
    Stack of nodes that defines a potential "strike" path of a diff
      * nodes added to the path are candidates for a diff "strike"
      * they do not necessarily get diffed
      * whether or not a node gets diffed is impossible to know before executing the full diff
      * the leader is stored in the "path" stack, "stx" is used as an auxiliary stack
    for stack safety, we acquire overhead trying to simulate recursion's post ordering

  Seg-list:
    Segregated list structure allows us to avoid using an extra pointer for tracking context
     
    Before: Parent -- r1 -- r2 -- r3   red children are standalone, contextual nodes.
             |                        black children are real children.
             b1 -- b2 -- b3           this scheme req a firstBlackChild and firstRedChild pointer.

    After:                  Parent             we segregate the black children from the red children.
                             |                this way, we only require a single pointer.
           r3 -- r2 -- r1 -- b1 -- b2 -- b3   

    We don't implement a new class here, instead we write methods which act on children objects.
    These methods allow adding (linking) and removing (unlinking) colored children nodes from a parent,
    such that the structure remains consistent.

    Every node is a parent who has segregated children nodes.
    Every node is a segregated child, except for top-level nodes.

  Field:
    Field is defined as a collection of oscillators (timers)
      * data structure: maps tau -> doubly-linked frames (O(1) insert/remove)
      * nodes with pending updates become "excited"
      * nodes of the same frequency "oscillate coherently" and relax together unless perturbed individually
      * during a diff cycle, affected (perturbed) nodes "relax"

  Thread:
    A 'thread' is linked list of contiguous child chains.
    Why do we need this data structure? 
      1. Rebasing diffs on a parent diff can lead to unbounded memory usage
      2. Removals should be processed before all other events, allowing immediate resource recycling.
      3. Events do not commute.
      4. Linked lists are awesome and we don't need random access, but need O(1) add/remove

    given a list of children, we can color the nodes red and black:

      r-r-r-r-b-b-b-b-r-r-r-r-b-b-b-b-r-r-r-r-b-b-r-b-r-b-b-b-r-b
      |     |         |     |         |     |     |   |      |
      a1    w1        a2    w2        a3    w3    a4  w4     a5 & w5

    contiguous groups of red nodes form chains in a thread. the first red node in a chain
    is called a 'leader' or alpha node. the last one is called an omega node.
    a node may be an alpha and an omega node. a previous algorithm chained alphas and omegas.
    we just chain alphas for simplicity (while maintaining O(1) access).

    red nodes are nodes with updates. 
    nodes in a thread need not share the same parent.
    nodes in a chain share the same parent.

    thread:

      (head)                  (tail)
        a1----a2----a3----a4----a5
        |      |     |     |     |
          ... sibling chains ....

    properties of thread:
      1. every node in the thread must be an alpha node
      2. O(1) insert and remove
      3. O(U) traversal (U <= N)
      4. O(N) extra memory
      5. unmounts are processed immediately
      6. subtree mounts are processed before the next sibling

  Bit vectors:
    Most algorithms that act on data keep track of state. Sometimes, you have lots of state:

      states {
        isUpdating: true,
        inPath: true,
        isChild: false,
        isContextualRoot: true,
        isRenderingAgain: false
      }

    Using N fields in an object to keep track of boolean states is not efficient. The next best thing you can do is to condense the states into a single integer, and give each possible state a value. This forces you to do a lot of manual bookkeeping because the number of possible states is exponential for flags. For example IsUpdAndInPathAndNotChildAndIsCtxAndNotRenderingAgain is distinct from IsUpdAndInPathAndIsChildAndNotCtxAndRenderingAgain. You would need to enumerate all of them. Enums are better when your fundamental states are mutually exclusive. Flags are often not.

    The third approach is to use bit vectors, and it is a more natural way to keep track of boolean states, since we can use bitwise operations to update values without interfering with other values. Adding more flag states to a bit vector is trivial compared to adding more enums. We can use the first N bits of an integer and assign each bit to a boolean flag. For example, we have 5 flags so we'd use a 32 bit integer that looks like:

       XXXXXXXXXXXXXXXXXXXXXXXXXXXSSSSS N = 5 bits for state, ORDER = 2^5 = 32.

    If the 4th bit is 1, isContextualRoot is true. If the 4th bit is 0, it's false. The orthogonal components in a bit vector are given by powers of two. 1, 2, 4, 8, etc. are all orthogonal basis vectors and can be used as flags. The size of the state space, ORDER, is given by 2^N where N is the number of flags.

    In the example above, we have 27 "wasted" bits (denoted by X). We use those for a counter to avoid making an extra counter integer. Because of this, we must be careful when dealing with bit operations:
      * we mustn't coerce state into 32 bits
        * since we lose ~21 bits of entropy for our counter bits
        * Setting bits via state |= BIT is not allowed
        * Unsetting bits via state &= ~BIT is not allowed
        * Resetting counter via state &= ORDER-1 is allowed
        * Querying state via state & BIT is allowed
      * we mustn't increment counters by anything other than the ORDER of the state space
        * since ORDER = 0 (mod ORDER), incrementing the state variable by ORDER does not
          interfere with the state values (first log2(ORDER) bits are unchanged)

How the Engine Works:
  
  Preface: Whether you're building a reactive database like Minimongo, something like Meteor's Tracker, a reactive observer framework like MobX, or a view engine like React, you will be dealing with data flow across dynamic graphs. At the end of the day, all of those libraries have that in common. This library lets you build frameworks and applications that rely on data flow along dynamic DAGs.

  Concepts: This library lets you build reactive DAGs of nodes. Nodes are functions (think render function) that take input and return templates. Templates are a static description of what the children of a node should look like (think JSX). Nodes can also be sources of data (think state).

  Updates: The engine gives you tools for scheduling synchronous and batched asynchronous updates (diffs) across your graph. Every update triggers a diff cycle. During a diff cycle, render() functions are called, and the graph is updated. Synchronous and asynchronous work can be added on-the-fly during a diff cycle, and the cycle will be extended to reflect that work.

  Sideways-out-of-the-box: Frameworks like Preact have the concept of context, and rely on higher order node composition to inject state into trees. This framework takes a different approach -- nodes can subscribe to other nodes, creating non-tree-like edges in the graph. You can mount several orthogonal trees and establish dependencies between them via subscriptions. This is referred to as having "sideways" data dependencies. Instead of bringing state "up", often the natural thing to do is to bring state "out" or "sideways".

  Diff cycles in depth:
    10,000 foot: 
      A diff cycle is an update cycle where a sequence of render(...) functions are called, which produce mutations, which are flushed out to event listeners. When the diff cycle is complete, the graph is in its updated state, and a new diff cycle may be executed to repeat this process. Diff cycles can be extended with additional synchronous work. The semantics for initializing and extending diff cycles are identical -- via inner or outer diffs. If you extend the current diff cycle, it's called rebasing. If you extend it after flush, you add an additional subcycle to the diff cycle.
 
    Rebasing:
      Defining diffs during diffs is an essential aspect to this framework. The basic idea is that when you call diff inside of a render, we want to seamlessly, intuitively queue the work into a diff cycle. If you trigger diffs inside of render, they will be rebased synchronously onto the path, extending the current subcycle. If you trigger diffs inside of a rendered callback, they will be rebased synchronously, but for the next subcycle.

    Advantages of rebasing and scheduling:
      * opt-out of component tree structure
      * create side-effects and other reactive resources without polluting the main app tree
        * e.g. higher order components pollute the main application tree hierarchy
        * this solution naturally allows for "sideways" data storage, dependencies, etc.
      * encompass entire trees within other trees
      * perform imperative, managed diffs for cases where O(N) subdiffing is undesired
      * split state into orthogonal oscillators
      * batch updates with managed diffs (splitting up work over diff cycles)
      * create "portals" so that the application tree can inject components in other places
      * schedule alternative work to override current work
      * schedule work asynchronously in a new diff cycle
      * rebase orthogonal work synchronously into the current diff cycle
      * rebase work synchronously into the current cycle after flushing mutations
    
    Disadvantages of rebasing:
      * it is dangerous if used improperly
      * temporal cycles are not caught by static cycle detection
        * i.e. render loops require exit conditions!

    Events:
      Since you are creating a graph that updates over time, you will often want to listen to the changes that are happening on the graph. For example, your graph might represent a DOM application, and you might want to use the events to update the actual DOM. Since work can be redone on-the-fly with rebasing, we need a way of squashing events so we don't run into unbounded memory usage. The thread data structure allows us to do this with only O(N) extra memory! At its heart, it's just a doubly linked list. We have to be careful that we're merging events properly, because events are non-commutative. We cannot emit events in an aribtary order.

    Lifecycle methods:
      Often, applications will need to execute code during a render cycle. We want to minimize the number of lifecycle methods, because we want to minimize the number of places that user-defined code can run, without taking away power. We need only three methods:
        1. render
        2. rendered (think componentDidMount, componentDidUpdate)
        3. cleanup (think componentDidUnmount)

      We could devise other schemes that let us eliminate rendered and cleanup. For example, we could export a function that lets you queue up a rendered callback that returns a cleanup callback:

        useEffect(() => {
          // do something after flush
          return () => {
            //cleanup this hook's garbage
          }
        })

      but this solution amounts to syntax sugar around the lifecycle methods, so it is not implemented at the engine level.

    Automatic cleanup:
      Since this framework gives you the power to execute diffs during diffs (you can mount reactive resources during render), it also conveniently destroys those resources up when a node unmounts. The seg-list data structure is a simple modification to a doubly linked list that lets us store two-lists-in-one without using an extra pointer.

    The Diff Cycle:
      Now that we have sufficient background, let's take a closer look at the diff cycle. Every diff cycle starts with a rebase operation (phase A). Rebasing at this point is trivial because the path is empty. This is the zero-rebase, the initial filling of the path. Subsequent rebases may occur when the path is non-empty (during phases B and/or D), and they will properly extend the path with further work.
                
              go to B if work exists
                .----<-----<----.
                |               |
           >--A-->--B-->--C-->--D--> done if work !exists

      Phases:
        A (fill):
          the initial (zero) rebase to fill the path
        B (render):
          exhaust the path; run renders, queue resulting mutations, optionally calling rebase any number of times to extend the path (thus extending this phase).
        C (flush):
          emit squashed mutations (e.g. update the DOM)
        D (post-flush):
          call rendered/cleanup lifecycle fns, if any, optionally calling rebasing any number of times to extend the diff cycle with another subcycle (going back to phase B)

     Another Way of Looking at the Diff Cycle:
       Every diff cycle consists of a sequence of synchronous subcycles. 
       Each subcycle is cycle-safe only within itself. Temporal cycles are not caught.

                              time ->
       diff cycle:
         |-fill--subcycle1--subcycle2--subcycle3-...-subcycleN-|
            |
            populate initial path for first subcycle.

         N >= 1
          
       subcycle:
         |-render--flush-|
             |      |  
             |      synchronize effects after all computations finished
             |        * emit ALL removals before ANY adds
             |        * thus effects can recycle resources at a subcycle-level
             |          as opposed to only at the subdiff-level
             run all computations
               * queue up mounts as laggards
                 thus every new mount is guaranteed to have latest state
               * rebase work to extend this render phase.
