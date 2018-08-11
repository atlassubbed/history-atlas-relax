const { toArr } = require("../util");
const { Frame } = require("../../src/index");

// Classification of Frames:
//    1. Reducibility
//      1. Irreducible
//      2. Reducible
//        1. Stateful
//          1. Extended (class MyFrame extends Frame {...})
//          2. TODO: Merged (Frame.define(MyFrame))
//        2. Stateless
//    2. Rank
//      1. 0
//      2. 1
//      3. 2+ -- handle tensors in template blackbox cases
//    3. Composability
//      1. Blackbox -- TODO: keys, memozation and tensors
//      2. Functional
//
// All frames have a reducibility, rank and composability.
// Not all of the combinations are valid frames.

// Classification of templates:
//     1. Void -- map to the null frame
//     2. Literal -- sterile
//     3. Object -- TODO: Test nameless nodes treated as literals

const IrreducibleFunctional = "div";

const StatelessBlackboxScalar = data => {
  return {
    name: "div", data, next: [
      {name: "p", data},
      {name: "span", data}
    ]
  }
}

class StatefulBlackboxScalar extends Frame {
  evaluate(data){
    return {
      name: "div", data, next: [
        {name: "p", data},
        {name: "span", data}
      ]
    }
  }
}

const StatelessBlackboxVector = data => {
  return [
    {name: "div", data},
    {name: "p", data}
  ]
}

class StatefulBlackboxVector extends Frame {
  evaluate(data){
    return [
      {name: "div", data},
      {name: "p", data}
    ]
  }
}

const StatelessFunctionalScalar = (data, next) => {
  return {
    name: "div", data, next: [
      {name: "p", data},
      {name: "span", data},
      {name: "a", data, next}
    ]
  }
}

class StatefulFunctionalScalar extends Frame {
  evaluate(data, next){
    return {
      name: "div", data, next: [
        {name: "p", data},
        {name: "span", data},
        {name: "a", data, next}
      ]
    }
  }
}

const StatelessFunctionalVector = (data, next) => {
  return [
    {name: "div", data},
    {name: "p", data},
    ...toArr(next)
  ]
}

class StatefulFunctionalVector extends Frame {
  evaluate(data, next){
    return [
      {name: "div", data},
      {name: "p", data},
      ...toArr(next)
    ]
  }
}

module.exports = {
  IrreducibleFunctional,
  BlackboxScalars: [StatelessBlackboxScalar, StatefulBlackboxScalar],
  BlackboxVectors: [StatelessBlackboxVector, StatefulBlackboxVector],
  FunctionalScalars: [StatelessFunctionalScalar, StatefulFunctionalScalar],
  FunctionalVectors: [StatelessFunctionalVector, StatefulFunctionalVector]
}