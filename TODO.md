1. Added/changed/remove API
  * This would lead to contradictions with the diffing algorithm.
  * Investigate efficient patterns made possible by entanglement
  * Last resort is to implement some sort of mirrored state/map API
  * Could investing supporting diff(tempArr, frameArr)
    * managed diffs/low level control over a subdiff

2. Refactor entanglement tests
  * use an array of test cases for trees/roots and then generate the tests prodecdurally
  * each case should implement the appropriate in-diff/post-diff entanglement changes
  * each case should implement the appropriate initiator diff (e.g. diff(..., tree/node)) 
  * should generate the expected event sequence based on the final expected DAG
  * could also note that the output sequence must be topologically ordered, use that to reduce duplication in the test code

3. Subdiff algorithm considerations
  1. LCRS representation
    * stores more pointers, but outputs fewer edit events compared to swapping algorithm
    * semantically closer to DOM target.
    * increases tree depth, will have to limit recursion by using own stack (pop/add/fill)
    * semantically closer to DOM target
  2. Array representation
    * currently uses swapping algorithm, mutating an existing array
    * could instead recreate the array every time, avoiding swap events
  3. Output events options for effects
    * LCRS only
    * Array only, support mutate or re-create or both?
    * support both Array and LCRS separately
    * find a clever way to derive Array and LCRS from the same events
  4. Group theory
    * the subdiff algorithm can be thought of as an element of a symmetric group, sigma
      * where A = Union(prev, next) and sigma lives in S_|A|.
      * Represent sigma as a product of swaps (which are just 2-cycles)
      * the number of swaps is N - K where K is the number of disjoint cycles in sigma
      * options:
        * build up A, then apply N - K swaps after the matching has been done.
        * apply potentially more than N - K (but still linear) swaps during the matching phase.

Micro-performance considerations after everything else is already done:

7. Call stack:
  * Both atlas-frame an preact will throw an error when trying to mount trees that exceed a certain height.
  * React does not throw an error, because it probably uses its own stack to perform subdiffs
  * This is an extreme edge case, and may be considered in the future

TODO (minor):
  2. degenerate tau value for simulating batches at app-level? think degeneracy levels
  8. Calling setState and setTau during a diff cycle need to be well-defined.
  9. Caling diff during a diff cycle needs to be well-defined for removes/updates/subs
  10. should all entangled willUpdates be called before all diffs, before all didUpdates?
    * |-willUpdates-|-diffs-|-didUpdates-|
    * to ensure that every frame has access to prev and next data and state during willUpdate
      * for all affectors and self
      * should not make this data available and encourage memoization instead
  11. Once keys are implemented, the subdiff algorithm will be complete, we can consider:
    * an alternative to popping the path -- Kahn's algorithm after DFS marks the nodes with their in-degree.
      * might allow us to avoid unmarking subpaths that decided not to update
      * will, however, incur decrement costs on all nodes (not just ones that were unmarked)
    * recalculating paths IFF an entanglement change occured since the last time the path was calculated
      * i suspect this will not make a huge difference and will incur more memory cost than we want
    * is normalzing to an array more expensive than allowing a field to be an array or non-array and performing checks everywhere?
      * isArray checks would increase computation and file size
      * normalizing to an array involves wrapping scalars in an unnecessary array.
  12. h() before diff()
    * currently, we flatten the output of diff inside subdiff, 
    * this means that even memoized return values will be run through the flattening process.
    * Instead, we can flatten before memoization, inside of h(...).
    * Counterarguments to this proposal:
      * If we need to use an ephemeral key table for "next", we might as well flatten inside of diff since we iterate anyway
      * Most people are not going to be returning crap like [[[[[[{name: "p"}]], {name: "div"}]]]] in their diff functions
