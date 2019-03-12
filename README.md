this is old, take it with a grain of salt

# atlas-frame

Rendering-agnostic data-graph reconciliation layer which can be extended via lifecycle methods.

[![Travis](https://img.shields.io/travis/[username]/[repo].svg)](https://travis-ci.org/[username]/[repo])

---

### just relax

Change detection, state and update management is a pain in the ass. This tiny 2KB framework lets you define data-driven trees (applications) using components and JSX. The Relax engine takes care of all of the heavy lifting associated with updating your application. We believe that the rendering and application layers should be as dumb as they can possibly be. The people who build applications deserve to write simple, stupid, declarative code with little to no auxiliary bookkeeping.

## general FAQs

### is JSX necessary?

No. JSX is syntactical sugar added to JavaScript, which gets transpiled down to function calls or objects. It's a tool that makes representing markup trees a bit easier for some people. In Relax, you can use object literals in place of JSX whenever you want. Since there is no hyperscript function in Relax, everything is compiled down to literals.

### is Relax a view library?

Not quite. Relax is an engine that powers view libraries. For example, you could implement a DOM-renderer in 40 lines of code with a plugin that runs on top of Relax. Relax takes care of everything from update scheduling to change detection and propagation for you. Plugins get to be dumb! Relax, together with something like Relax-DOM, could be a used as view library.

### is Relax only for implementing view libraries?

No! A DOM-rendering plugin is just one of many possible plugins that you could write for Relax. Similarly, you could write a string-rendering plugin in a few lines of code which is powered by Relax, and use it on the server.

### would I need to use something like Redux, Mobx or Minimongo with Relax?

Absolutely not. Relax provides first-class support for scalable state management. Defining reactive data flows, observable data, and providing state to components with different nesting levels is very easy with Relax. In React, there is the notion of "lifting the state up", followed by passing it down through prop levels. In Relax, you will never be forced to pass props down dozens of intermediate levels just to provide a certain component with data. Relax allows you to "lift the state *out*", and implements what we'll refer to as "sideways" data dependencies.

### is Relax only for HTML/web applications?

Not at all; graphs of data can be used for pretty much whatever you want. Relax does *not* care what the underlying data graph is for, so you can build data-driven applications of any kind. Relax is not limited to running in a browser, either. Plugins can do whatever you want them to do. You could write a plugin for a server-side application that logs and sends notifications or analytics in response to underlying state changes.

### is Relax a reactive data store?

Sort of. This is an engine that powers reactive data stores (e.g. observables). For example, you would be able to efficiently implement things like Meteor's `ReactiveVar`, `ReactiveDict` or `Collection` on top of Relax.

### how can Relax power both view libraries and data storage -- aren't those two different things?

They are two different things, but they can both be represented as graphs of data nodes. Instead of implementing the View and Model separately, we recognize that a View is a *type* of Model, and the heavy lifting for both can be abstracted out into the exact same engine. To Relax, a collection of user objects is no different than a collection of list elements in HTML. Relax does not care *how* the data is used, they are all just nodes in a graph. Thus the nodes/components in your application can represent HTML elements, abstract user objects, or anything you want.

## design FAQs

### can you give me an analogy of how Relax was designed?

I can try, but I will probably make several biologists angry. So, your application code is essentially a bunch of components which return JSX (markup) describing what your application tree looks like -- think of your code as the DNA for your application. When Relax mounts your application, it creates an internal representation of it in memory -- think of this representation as a stem cell. In and of itself, a stem cell doesn't do much. Stem cells need to be differentiated into more specific cells before they can do specific things. This is where plugins enter the picture. Each plugin to your app is a  differentiatation pathway.

Continuing with the genetic analogy, genes are constantly interacting with chemical markers, changing which genes are expressed over time -- you can think of these as "updates" made to your application over time. An application is constantly mounting, unmounting, updating and moving nodes in response to `diff` calls. Any time you see the function `diff`, think "update".

### why trees?

Some frameworks treat applications as arbitrary directed acyclic graphs (DAGs), others treat them as perfect rooted trees. There are libraries which let you build fully dynamic DAGs node-by-node, but the APIs tend to be cumbersome and imperative without good support for declarative, component-like abstractions. Humans seem to be very good at "thinking in" trees and hierarchies, probably because trees allow us to make assumptions that we can't make with arbitrary DAGs. For this reason, I think React took a step in the right direction -- applications, to an approximation, are basically trees.

### why not trees?

While arbitrary DAGs are too general, trees are too simple. Libraries like React make it hard to think about your application as anything other than a tree (recent context support has somewhat alleviated this problem). In reality, not everything in an application (the view, the data) fits perfectly into some hierarchy. In practical applications, you will almost always be forced to pull data "sideways" out of the hierarchy to make exceptions. With React, you'd be forced to lift state up to a common ancestor, who would likely be multiple hops up the tree -- this becomes cumbersome.

### does Relax use trees?

Yes and no. Since perfect rooted trees are not sufficient to describe the majority of practical applications, yet arbitrary DAGs are unnecessarily general for most applications, Relax goes for the middle ground. Relax treats applications as "perturbed forests". You can think of an application as a set of trees, some of which have interweaving vines that connect their branches. Most web applications that people build with view frameworks end up looking like this, structurally. Note that we aren't distinguishing the View of our application from the Model as they are two manifestations of the same thing. We no longer need constructions like "context", Redux, Mobx, or Minimongo to manage data dependencies in our application. The "perturbed forest" picture takes care of that for us; a reactive data dependency is just an edge between two nodes.

### How to perform outer-diffs
  1. diff(t) mounts real t
  2. diff(t, null, {effs}) mounts real t with effects
  3. diff(t, null, p) mounts virtual t under p
  4. diff(t, null, p, s) mounts virtual t under p after s
  5. diff(null, f) unmounts real/virtual f 
  6. diff(t, f) updates real/virtual f
  7. diff(t, f, s) updates virtual f, moves it after s


Terminology: A frame is a lightweight DAG of nodes which hold data, the ability to update the data, and lifecycle methods. A template is an object-literal describing a tree of frames. Frames should never be instantiated directly, but with the diff function, which creates, updates and destroys frames. All frames must implement an `diff` method which returns templates.

Effects: The diff function takes optional side-effect listeners that can do arbitrary things in response to lifecycle events on the entire graph. This way, rendering logic is completely decoupled from the data layer, meaning the same templates can be instantiated into frames which result in completely different effects.

Extending: To implement Frames with custom functionality, simply extend the Frame class. Long prototype chains are not recommended, use composition instead. When the "subclass" is referred to in your templates, the data DAG will be augmented with the functionality implemented in the "subclass".

Usage: The diff function is repsonsible for creating frames. A successful diff takes a template and a frame, and returns a frame. f2 = diff(t1, f1) can be thought of as "merging t1 into f1 to produce f2". If f1 is null, a brand new frame described by t1 created in its own root, and returned. If t1 is null, the void template will be merged into f1, completely destroying f1, returning true.

Current features:
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

