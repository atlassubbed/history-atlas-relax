const { 
  IrreducibleFunctional,
  BlackboxScalars, 
  BlackboxVectors, 
  FunctionalScalars, 
  FunctionalVectors
} = require("./Frames");
const { has } = require("../util")

// Types of subdiffs (arrays -> arrays):
//   properly ignore void elements
//   properly associate keyed elements
//   properly short circuit memoized elements
//   properly add and remove elements without keys
//
//
//
//
//
//
//
//
//

const memoizedTemplate = {
  name: "div", data: {id: "memo", v: 0}, next: {
    name: "p", data: {id: "memo", v: 0}, next: [
      {name: "span", data: {id: "memo", v: 0}},
      {name: "tag", data: {id: "memo", v: 0}}
    ]
  }
}
