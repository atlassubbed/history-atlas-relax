1. Diffing when you are inside of a diff
  * if inside a diff, ensure that the frame to be diffed on is inside the path
  * if it's not in the path, throw "unexpected entanglement" error
  * otherwise, remove it, sub it, or update it normally, but without sidediffing afterwards
  * a frame can be added to the path by entangling it in the constructor of the affector

2. Diffing on an already removed frame.
  * If you diff on top of a frame that is removed, it will be treated as a diff on the null frame
  * this results in cleaner app-level code

3. Added/changed/remove API
  * shouldn't prevent normal top-down diffs.
  * for example if the parent gets updated, the frame using added/changed/remove will also get diffed
  * if a change happens that results in an added/changed/remove, this will not trigger a full diff
  * instead, it will add/change/remove a single element, then full-diff under that element.

4. Refactor entanglement tests
  * use an array of test cases for trees/roots and then generate the tests prodecdurally
  * each case should implement the appropriate in-diff/post-diff entanglement changes
  * each case should implement the appropriate initiator diff (e.g. diff(..., tree/node)) 
  * should generate the expected event sequence based on the final expected DAG

Micro-performance considerations after everything else is already done:

Write perofrmance.test.js which uses basic-timer to test mounts. removes, updates setTau, setState, etc. for large N
  * Should jsut output execution times and not test functionality

For special case tau === 0, consider using something like RIC/RAF instead of setTimeout

These considerations matter if tau and entangled edges are changed many times with respect to the number of diffs

5. Linear entanglement
  * Should we not cache a bunch of info for entanglement and just use indexOf?
  * This would be fine if number of entanglements is very small compared to total DAG size
  * This will use less memory

6. Constant entanglement and scheduling
  * investigate using ES6 Set and/or linked-lists+hash for scheduling and entanglement (for O(1) inserts and dels)
  * The linked-list+hash option will require loads more memory, since we'll need it to be doubly-linked and reference all of the nodes and affectors for quick removals
  * Could actually avoid double-linked by tagging the nodes for removal and then removing the next time we iterate (keeping prev node reference), similar to what we do now, then we'll avoid recreating the list (like we do now)


TODO:
  1. Refactor entangle tests by simply asserting that the methods are called in topo-order
  2. degenerate tau value for simulating batches at app-level? think degeneracy levels