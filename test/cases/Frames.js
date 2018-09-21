const { toArr, copy, isFn } = require("../util");
const { Frame } = require("../../src/index");

// Frame classification:
//   1. Reducibility (irreducible, reducible (stateful (modern, legacy), stateless))
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
  evaluate(data){
    return StatelessBlackboxScalar(data)
  }
}
function LegacyBlackboxScalar(temp, effs){
  Frame.call(this, temp, effs)
}
Frame.define(LegacyBlackboxScalar, {
  evaluate(data){
    return StatelessBlackboxScalar(data)
  }
})

const StatelessBlackboxVector = data => [
  {name: "div", data},
  {name: "p", data}
]
class StatefulBlackboxVector extends Frame {
  evaluate(data){
    return StatelessBlackboxVector(data)
  }
}
function LegacyBlackboxVector(temp, effs){
  Frame.call(this, temp, effs)
}
Frame.define(LegacyBlackboxVector, {
  evaluate(data){
    return StatelessBlackboxVector(data)
  }
})

const StatelessFunctionalScalar = (data, next) => ({
  name: "div", data, next: [
    {name: "p", data},
    {name: "span", data},
    {name: "a", data, next}
  ]
})
class StatefulFunctionalScalar extends Frame {
  evaluate(data, next){
    return StatelessFunctionalScalar(data, next);
  }
}
function LegacyFunctionalScalar(temp, effs){
  Frame.call(this, temp, effs)
}
Frame.define(LegacyFunctionalScalar, {
  evaluate(data, next){
    return StatelessFunctionalScalar(data, next);
  }
})

const StatelessFunctionalVector = (data, next) => [
  {name: "div", data},
  {name: "p", data},
  ...toArr(next)
]
class StatefulFunctionalVector extends Frame {
  evaluate(data, next){
    return StatelessFunctionalVector(data, next);
  }
}
function LegacyFunctionalVector(temp, effs){
  Frame.call(this, temp, effs)
}
Frame.define(LegacyFunctionalVector, {
  evaluate(data, next){
    return StatelessFunctionalVector(data, next)
  }
})

// StemCell frames are useful for testing
//   * they take lifecycle methods as template props
//   * thus they become "differentiated" upon addition
class StemCell extends Frame {
  constructor(temp, effs){
    super(temp, effs);
    const { data: { hooks } } = temp;
    if (hooks){
      if (hooks.ctor) hooks.ctor.bind(this)(this);
      for (let h in hooks)
        this[h] = hooks[h].bind(this)
    }
  }
  evaluate(data, next){
    return copy(next);
  }
  static h(id, hooks, next){
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
  // constructor(temp, effs){
  //   super(temp, effs);
  //   if (effs) for (let e of toArr(effs)){
  //     if (e.log) {
  //       this.log = e.log.bind(e)
  //       break;
  //     }
  //   }
  // }
  getTau(tau){
    const myTau = this.temp.data.tau;
    return myTau != null ? myTau : tau;
  }
  static h(id, tau, next){
    return {name: Oscillator, data: {id, tau}, next};
  }
  // evaluate(data, next){
  //   this.log && this.log("e", this);
  //   return next;
  // }
}

module.exports = {
  IrreducibleFunctional,
  StemCell,
  StemCell2,
  Oscillator,
  Blackboxes: [
    StatelessBlackboxScalar, StatefulBlackboxScalar, LegacyBlackboxScalar,
    StatelessBlackboxVector, StatefulBlackboxVector, LegacyBlackboxVector
  ],
  Functionals: [
    StatelessFunctionalScalar, StatefulFunctionalScalar, LegacyFunctionalScalar,
    StatelessFunctionalVector, StatefulFunctionalVector, LegacyFunctionalVector
  ]
}