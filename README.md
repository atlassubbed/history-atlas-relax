# atlas-frame

Rendering-agnostic DAG reconciliation layer which can be extended via lifecycle methods.

[![Travis](https://img.shields.io/travis/[username]/[repo].svg)](https://travis-ci.org/[username]/[repo])

---

Terminology: A frame is a lightweight DAG of nodes which hold data, the ability to update the data, and lifecycle methods. An effect is a lightweight object-literal template describing a frame or subframe. Frames should never be instantiated directly, but with the diff function, which creates, updates and destroys frames.

About: This is not a view framework. It is an abstraction for DAG diffing and (a)synchronous reconciliation. This library is solely responsible for managing a live DAG graph, meaning it is rendering-agnostic. Frame can be extended to implement various renderers which react to changes in the underlying data DAG. This way, rendering logic is completely decoupled from the underlying data DAG, allowing for polymorphism. In other words, the same effects can be rendered into frames which do completely different things.

Extending: To extend Frame, simply create a subclass of Frame, implement the necessary lifecycle methods, and export your subclass. When the subclass is used to create frames, the data DAG will be augmented with the functionality implemented in the subclass.

Usage: The diff function is repsonsible for creating frames. It takes an effect and an existing frame, and diffs the effect into the existing frame. If the frame is null, the effect will be created in its own root, returning a new frame. If the effect is null, the existing frame will be destroyed. Frames implement an evaluate method which returns effect(s), and optionally implement lifecycle methods which execute scripts at various points in the frame's life. 

Shorting: shouldUpdate is not recommended, because it provides an opportunity for the caller to return a false negative in the diffing process. Since shouldUpdate returns either true or false for the entire evaluate function, it is hard to be 100% confident for complex evaluate functions. 


Implementation?:

UPDATE: Have implementors set this.type = MyClassThatExtendsFrame after calling super() 
in their class's contstructor. Then, "type" does not need to be specified in global opts as below.
Have tau for entire subframes get inherited from last parent with specified tau.
then, "tau" does not need to be specified in global opts as below, and we can get rid of global opts.

1. Specify all at diff-time:
  diff(eff, frame, opts = {tau: 15, type: Component}) 
  If tau is unspecified, make everything synchronous by default
  If type is unspecified, make it Frame (or infer it at runtime, see option 4)
  Should be fine if reactive get/set within frame.evaluate is supported (like in Meteor-tracker)

2. Specify all at effect-time, assuming all children inherit from parent:
  <MyComponent type={Component} tau={15}>
    <OtherComponent/> // type === Component, tau === 15
    <ThirdComponent tau={50}/> // type === Component, tau === 50
  </MyComponent>

3. Specify tau exactly as state would be specified, otherwise fallback to global default
  class MyComponent extends Component {
    constructor(props){
      this.tau = 50;
    }
  }
  diff(eff, frame, opts = {tau: 15, type: Component})
    should set tau to 15 on all frames if it's not defined on that frame
  This allows "dumb" tau as well:
  <MyComponent type={Component} tau={15}>
    <OtherComponent/> // type === Component, tau === 15
    <ThirdComponent tau={50}/> // type === Component, tau === 50
  </MyComponent>

4. Use solution 3 for tau, and infer the constructor used for the frame
  Obtain the constructor for the frame somehow
   Use that to instantiate basic (name === string) frames.
  Allow type to be set during diff (option 1) for performance boost
   If you know the frame DAG is homogeneous

Short circuiting instead of pure and shouldUpdate:
  1. Frames have short() which takes state/props & returns an effect, like evaluate(). 
  2. Short is to be called within evaluate()
  3. Short takes a keyname and a callback which takes next state/props.
  4. When short returns an effect, it caches the effect under the keyname, and uses the effect
  5. When short returns true, it uses the last cached effect (or null) for that keyname.
  5. When short returns a null effect, it clears the cache for the keyname and returns a null effect.

  XXX Should short return a function, use the closure to store the cached effect???? No...

  By using a dynamic name for a short, you can actually cache an arbitrary number of effects
  with a single short function. (e.g. caching many static pages for ultima pso bb tables)

  Short should cache the frame instead of the effect, when frame needs to be removed, remove the frame and reset its state, but don't attempt to remove it from the short cache unless null/undefined/false is specified.
