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
  diff(data){
    return StatelessBlackboxScalar(data)
  }
}

const StatelessBlackboxVector = data => [
  {name: "div", data},
  {name: "p", data}
]
class StatefulBlackboxVector extends Frame {
  diff(data){
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
  diff(data, next){
    return StatelessFunctionalScalar(data, next);
  }
}

const StatelessFunctionalVector = (data, next) => [
  {name: "div", data},
  {name: "p", data},
  ...toArr(next)
]
class StatefulFunctionalVector extends Frame {
  diff(data, next){
    return StatelessFunctionalVector(data, next);
  }
}

// StemCell frames are useful for testing
//   * they take lifecycle methods as template props
//   * thus they become "differentiated" upon addition
class StemCell extends Frame {
  constructor(temp, effs){
    super(temp, effs);
    const hooks = temp.data && temp.data.hooks;
    if (hooks){
      if (hooks.ctor) hooks.ctor.bind(this)(this);
      for (let h in hooks)
        this[h] = hooks[h].bind(this)
    }
  }
  diff(data, next){
    return (data && data.copy) ? copy(next) : next;
  }
  static h(id, hooks, next){
    return {name: StemCell, data: {id, hooks, copy: true}, next};
  }
  static m(id, hooks, next){
    return {name: StemCell, data: {id, hooks}, next};
  }
}

class StemCell2 extends StemCell {
  static h(id, hooks, next){
    return {name: StemCell2, data: {id, hooks}, next};
  }
}

// Oscillator frames implement getTau and "relax" into new state
//   * extends StemCell for future testing purposes
//   * behaves as an oscillator when update frequency >> 1/tau
class Oscillator extends StemCell {
  getTau(tau){
    const myTau = this.temp.data.tau;
    return myTau != null ? myTau : tau;
  }
  static h(id, tau, next){
    return {name: Oscillator, data: {id, tau, copy: true}, next};
  }
  static p(id, data, next){
    data.copy = true, data.id = id;
    return {name: Oscillator, data, next}
  }
}

class B extends Frame {}

module.exports = {
  IrreducibleFunctional,
  B,
  StemCell,
  StemCell2,
  Oscillator,
  Blackboxes: [
    StatelessBlackboxScalar, StatefulBlackboxScalar,
    StatelessBlackboxVector, StatefulBlackboxVector
  ],
  Functionals: [
    StatelessFunctionalScalar, StatefulFunctionalScalar,
    StatelessFunctionalVector, StatefulFunctionalVector
  ]
}