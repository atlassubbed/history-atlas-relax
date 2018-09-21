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
  * could also note that the output sequence must be topologically ordered, use that to reduce duplication in the test code

Micro-performance considerations after everything else is already done:

7. Call stack:
  * Both atlas-frame an preact will throw an error when trying to mount trees that exceed a certain height.
  * React does not throw an error, because it probably uses its own stack to perform subdiffs
  * This is an extreme edge case, and may be considered in the future

TODO:
  2. degenerate tau value for simulating batches at app-level? think degeneracy levels
  8. Calling setState and setTau during a diff cycle need to be well-defined.
  9. Caling diff during a diff cycle needs to be well-defined for removes/updates/subs
  10. should all entangled willUpdates be called before all evaluates, before all didUpdates?
    * |-willUpdates-|-evaluates-|-didUpdates-|
    * to ensure that every frame has access to prev and next data and state during willUpdate
      * for all affectors and self
