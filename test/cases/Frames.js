const { toArr, copy, isFn } = require("../util");
const { Frame } = require("../../src/index");

// Frame classification:
//   1. Reducibility (irreducible, reducible (stateful, stateless))
//   2. Rank (0, 1, 2+)
//   3. Composability (blackbox, functional)
// Template classification:
//   1. Void (in diff's kernel)
//   2. Literal (sterile)
//   3. Object

const IrreducibleFunctional = "div";

const StatelessBlackboxScalar = data => ({
  name: "div", data, next: [
    {name: "p", data},
    {name: "span", data}
  ]
})
class StatefulBlackboxScalar extends Frame {
  render(data){
    return StatelessBlackboxScalar(data)
  }
}

const StatelessBlackboxVector = data => [
  {name: "div", data},
  {name: "p", data}
]
class StatefulBlackboxVector extends Frame {
  render(data){
    return StatelessBlackboxVector(data)
  }
}

const StatelessFunctionalScalar = (data, next) => ({
  name: "div", data, next: [
    {name: "p", data},
    {name: "span", data},
    {name: "a", data, next}
  ]
})
class StatefulFunctionalScalar extends Frame {
  render(data, next){
    return StatelessFunctionalScalar(data, next);
  }
}

const StatelessFunctionalVector = (data, next) => [
  {name: "div", data},
  {name: "p", data},
  ...toArr(next)
]
class StatefulFunctionalVector extends Frame {
  render(data, next){
    return StatelessFunctionalVector(data, next);
  }
}

// StemCell frames are useful for testing
//   * they take lifecycle methods as template props
//   * thus they become "differentiated" upon construction
class StemCell extends Frame {
  constructor(temp, effs){
    let data = temp.data, hooks = data && data.hooks;
    super(temp, effs);
    if (hooks){
      if (hooks.ctor) hooks.ctor.bind(this)(this);
      for (let h in hooks)
        this[h] = hooks[h].bind(this)
    }
  }
  render(data, next, f, isFirst){
    isFirst ? f.willAdd && f.willAdd(f) : f.willUpdate && f.willUpdate(f);
    for (let eff of toArr(this.effs)) if (eff && eff.log) eff.log(isFirst ? "wA" : "wU", f);
    if (f.getNext) return f.getNext(data, next, f, isFirst);
    return data && data.copy ? copy(next) : next;
  }
  static h(id, data, next){
    data = data || {}, data.id = id, data.copy = true;
    return {name: StemCell, data, next};
  }
  static m(id, data, next){
    data = data || {}, data.id = id;
    return {name: StemCell, data, next};
  }
}

class StemCell2 extends StemCell {
  static h(id, data, next){
    data = data || {}, data.id = id;
    return {name: StemCell2, data, next};
  }
}

class B extends Frame {}

module.exports = {
  IrreducibleFunctional,
  B,
  StemCell,
  StemCell2,
  Blackboxes: [
    StatelessBlackboxScalar, StatefulBlackboxScalar,
    StatelessBlackboxVector, StatefulBlackboxVector
  ],
  Functionals: [
    StatelessFunctionalScalar, StatefulFunctionalScalar,
    StatelessFunctionalVector, StatefulFunctionalVector
  ]
}