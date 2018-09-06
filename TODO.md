1. Diffing when you are inside of a diff
  * if inside a diff, ensure that the frame to be diffed on is inside the path
  * if it's not in the path, throw "unexpected entanglement" error
  * otherwise, remove it, sub it, or update it normally, but without sidediffing afterwards
  * a frame can be added to the path by entangling it in the constructor of the affector

2. Diffing on an already removed frame.
  * If you diff on top of a frame that is removed, you will create a new instance of the frame

3. setState, setTau
  * setState should trigger a diff (unless we're in a diff?)
  * if tau is set, it should schedule a diff for that node in pending path
  * if the pending path for that tau isn't set, set it and set a timer
  * the timer should fillPath with all the nodes in pending path.
  * if later timers or diffs are triggered, 

4. Added/changed/remove API
  * shouldn't prevent normal top-down diffs.
  * for example if the parent gets updated, the frame using added/changed/remove will also get diffed
  * if a change happens that results in an added/changed/remove, this will not trigger a full diff
  * instead, it will add/change/remove a single element, then full-diff under that element.

5. Refactor entanglement tests
  * use an array of test cases for trees/roots and then generate the tests prodecdurally
  * each case should implement the appropriate in-diff/post-diff entanglement changes
  * each case should implement the appropriate initiator diff (e.g. diff(..., tree/node)) 
  * should generate the expected event sequence based on the final expected DAG

6. Linear entanglement
  * Should we not cache a bunch of info for entanglement and just use indexOf?
  * This would be fine if number of entanglements is very small compared to total DAG size