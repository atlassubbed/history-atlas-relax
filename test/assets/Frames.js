const { toArr } = require("../util");
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

module.exports = {
  IrreducibleFunctional,
  Blackboxes: [
    StatelessBlackboxScalar, StatefulBlackboxScalar, LegacyBlackboxScalar,
    StatelessBlackboxVector, StatefulBlackboxVector, LegacyBlackboxVector
  ],
  Functionals: [
    StatelessFunctionalScalar, StatefulFunctionalScalar, LegacyFunctionalScalar,
    StatelessFunctionalVector, StatefulFunctionalVector, LegacyFunctionalVector
  ]
}