# atlas-frame

Rendering-agnostic DAG reconciliation layer which can be extended via lifecycle methods.

[![Travis](https://img.shields.io/travis/[username]/[repo].svg)](https://travis-ci.org/[username]/[repo])

---

Terminology: A frame is a lightweight DAG of nodes which hold data, the ability to update the data, and lifecycle methods. A template is an object-literal describing a tree of frames. Frames should never be instantiated directly, but with the diff function, which creates, updates and destroys frames. All frames must implement an `diff` method which returns templates.

NB: This is not a view framework. It is an abstraction for DAG diffing and (a)synchronous reconciliation. This library is solely responsible for managing a living DAG graph, meaning it is rendering-agnostic. 

Effects: The diff function takes optional side-effect listeners that can do arbitrary things in response to lifecycle events on the entire graph. This way, rendering logic is completely decoupled from the data layer, meaning the same templates can be instantiated into frames which result in completely different effects.

Extending: To implement Frames with custom functionality, simply extend the Frame class or use the Frame.define helper. Long prototype chains are not recommended, use composition instead. When the "subclass" is referred to in your templates, the data DAG will be augmented with the functionality implemented in the "subclass".

Usage: The diff function is repsonsible for creating frames. A successful diff takes a template and a frame, and returns a frame. f2 = diff(t1, f1) can be thought of as "merging t1 into f1 to produce f2". If f1 is null, a brand new frame described by t1 created in its own root, and returned. If t1 is null, the void template will be merged into f1, completely destroying f1, returning true.

Potential Features:
  1. shouldUpdate: 
    Perhaps shouldUpdate should not be implemented, because it provides an opportunity for the caller to return a false negative in the diffing process. Since shouldUpdate returns either true or false for the entire node, it is hard to be 100% confident for complex diff functions. 
  2. Class extension as opposed to effects:
    Previously, effects were required to be subclasses, however this leads to many problems, like inferring the base type, long prototype chains, and side-effects overriding each other. I'm pretty sure the current plugin model works much better for side-effects on the DAG.

Upcoming Features:
  1. Relaxation time:
    Tau is a numeric parameter representing the period or relaxation time of a frame. The idea is that frames take time to commit to changes, so as to not overburden side-effects with unecessary information. Tau introduces news concepts such as entanglement (more on that later). If tau == null, the node inherits tau from the parent node. If tau === -1, then the frame is synchronous, else it is asynchronous. All irreducible and stateless frames inherit tau from their parent. Tau, like state, only makes sense for stateful frames. Tau could have been treated as a prop (like key), but this leads to unecessary granularity. Tau is more like state than it is like key; irreducible and stateless frames should be dumb with repsect to a dynamic state-like property like tau. This keeps irreducible and stateless frames simple. If tau is unable to be resolved for a frame, then that frame is treated as if tau === -1 (synchronous).
  2. Keys:
    Keys, being static properties, should be specified at the prop-level, unlike state and tau. Keys are simply used to aid subdiff in deciding which nodes to compare to which incoming templates.
  3. Memoization:
    Before, I thought of including a memoization method "this.short", but it seems caching should be done in userland and never by the underlying engine in order to keep the engine thin. Instead, the engine can simply perform a check for reference equality (===), which will automatically "short" circuit in the subdiff if the user decided to cache some template. Caching templates and computations can easily be accomplished outside the scope of the engine.
  4. Entanglement: 
    Because the concept of a relaxation time has been introduced, we have to ask when a frame gets subdiffed. If a frame's tau is 5, that means the frame will only subdiff 5ms after a change has been triggered, merging any subsequent changes before the time is up. What if the frame's parent has a tau of 1? What if the frame's parent is synchronous? Entanglement allows a frame with a given tau to be subdiffed before the frame's scheduled subdiff. Intuitively, if a parent updates, it should automatically recurse and subdiff the children, regardless of their tau's. In this sense, the children are "strongly entangled" to the parent, since the parent is a first-class subdiff trigger for the child. Conversely, the parent is NOT entangled to a child because of asymmetric top-down data flow. To eliminate "context" and "portals", we introduce entanglement between orthogonal root frames, which allows the caller to imperatively "glue" together different trees, reactively. As we've seen in certain view libraries, declarative trees sometimes need to be backdoored -- entanglement is an imperative construct to glue nodes together which may reside in different trees.
  5. Weak Entanglement:
    We talked about strong entanglement, but what about weak entanglement? More on that later. Hopefully, the entanglement metaphor proves to be a useful framework for thinking about frames.
  6. Stable Subdiffs:
    Subdiffing should fallback to matching nodes based on their names in the order they appear, so-called "implicit keys". Index matching should be a last resort.


Entanglement should allow the developer to "backdoor" the forest-of-rooted-trees architecture by letting them draw their own edges between rooted trees.

