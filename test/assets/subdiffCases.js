const { 
  IrreducibleFunctional,
  FunctionalScalars, 
  FunctionalVectors
} = require("./Frames");
const { has } = require("../util")

// Types of subdiffs (arrays -> arrays):
//   properly short circuit memoized elements

const memoizedTemplate = {
  name: "div", data: {id: "memo", v: 0}, next: {
    name: "p", data: {id: "memo", v: 0}, next: [
      {name: "span", data: {id: "memo", v: 0}},
      {name: "tag", data: {id: "memo", v: 0}}
    ]
  }
}

const updatingBlackboxes = [
  {
    desc: "ignore void nodes in sparse vectors",
    get: data => {
      return [
        null, false, 
        {name: "div", data}, true, undefined,
        data.v ? null : {name: "p", data}, false,
        data.v ? {name: "p", data} : true, false,
        data.v ? "value" : null, false,
        data.v ? false : 413, null,
        data.v ? {name: "span", data} : true, null, null,
        data.v ? false : {name: "span", data}, false
      ]
    },
    changed: ({id, v}) => [
      {wU: "div", id, data: {id, v}}, {dU: "div", id, data: {id, v: 0}},
      {wU: "p", id, data: {id, v}}, {dU: "p", id, data: {id, v: 0}},
      {wU: null, id: "413", data: "value"}, {dU: null, id: "value", data: "413"},
      {wU: "span", id, data: {id, v}}, {dU: "span", id, data: {id, v: 0}}
    ]
  },
  {
    desc: "remove expired nodes",
    get: data => {
      return [
        {name: "div", data},
        {name: "p", data},
        data.v ? null : {name: "span", data},
        data.v ? false : {name: "a", data}
      ]
    },
    changed: ({id, v}) => [
      {wU: "div", id, data: {id, v}}, {dU: "div", id, data: {id, v: 0}},
      {wU: "p", id, data: {id, v}}, {dU: "p", id, data: {id, v: 0}},
      {wR: "span", id}, {dR: "span", id},
      {wR: "a", id}, {dR: "a", id}
    ]
  },
  {
    desc: "add new nodes",
    get: data => {
      return [
        {name: "div", data},
        {name: "p", data},
        data.v ? {name: "span", data} : null,
        data.v ? {name: "a", data} : true
      ]
    },
    changed: ({id, v}) => [
      {wU: "div", id, data: {id, v}}, {dU: "div", id, data: {id, v: 0}},
      {wU: "p", id, data: {id, v}}, {dU: "p", id, data: {id, v: 0}},
      {wA: "span", id}, {dA: "span", id},
      {wA: "a", id}, {dA: "a", id}
    ]
  },
  {
    desc: "match reordered unkeyed nodes based on indexes",
    get: data => {
      return [
        data.v ? {name: "div", data} : {name: "p", data},
        data.v ? {name: "p", data} : {name: "span", data},
        data.v ? {name: "span", data} : {name: "a", data},
        data.v ? {name: "a", data} : {name: "div", data}
      ]
    },
    changed: ({id, v}) => [
      {wR: "p", id}, {dR: "p", id},
      {wA: "div", id}, {dA: "div", id},
      {wR: "span", id}, {dR: "span", id},
      {wA: "p", id}, {dA: "p", id},
      {wR: "a", id}, {dR: "a", id},
      {wA: "span", id}, {dA: "span", id},
      {wR: "div", id}, {dR: "div", id},
      {wA: "a", id}, {dA: "a", id}  
    ]
  },
  // {
  //   desc: "properly match reordered keyed nodes based on keys",
  //   get: data => {
  //     return [
  //       data.v ? {key: "2", name: "span", data} : {key: "1", name: "p", data},
  //       data.v ? {key: "4", name: "div", data}  : {key: "2", name: "span", data},
  //       data.v ? {key: "1", name: "p", data} : {key: "3", name: "a", data},
  //       data.v ? {key: "3", name: "a", data} : {key: "4", name: "div", data}
  //     ]
  //   },
  //   changed: ({id, v}) => [
  //     {wU: "p", id, data: {id, v}}, {dU: "p", id, data: {id, v:0}},
  //     {wU: "span", id, data: {id, v}}, {dU: "span", id, data: {id, v:0}},
  //     {wU: "a", id, data: {id, v}}, {dU: "a", id, data: {id, v:0}},
  //     {wU: "div", id, data: {id, v}}, {dU: "div", id, data: {id, v:0}},
  //   ]
  // },
]

const voidBlackboxes = [
  {
    name: "void (true)", get: ({v}) => v ? false : true, 
    added: () => [], removed: () => [], changed: () => []
  },
  {
    name: "void (false)", get: ({v}) => v ? null : false, 
    added: () => [], removed: () => [], changed: () => []
  },
  {
    name: "void (null)", get: ({v}) => v ? undefined : null, 
    added: () => [], removed: () => [], changed: () => []
  },
  {
    name: "void (undefined)", get: ({v}) => v ? true : undefined, 
    added: () => [], removed: () => [], changed: () => []
  },
  {
    name: "void (array)", get: ({v}) => {
      return [true, false, v ? false : null, undefined];
    }, 
    added: () => [], removed: () => [], changed: () => []
  },
  {
    name: "void (tensor)", get: ({v}) => {
      return [
        true, 
        [false, true, null, [undefined, [true]]],
        null, null, [null, undefined, false]
      ]
    },
    added: () => [], removed: () => [], changed: () => []
  }
]

const functionals = [
  {
    name: "irreducible (returns zero to many)", get: data => {
      return {name: IrreducibleFunctional, data};
    },
    defaultNextCount: 0,
    added: ({id}) => [
      {wA: IrreducibleFunctional, id}, null, {dA: IrreducibleFunctional, id}
    ],
    removed: ({id}) => [
      {wR: IrreducibleFunctional, id}, null, {dR: IrreducibleFunctional, id}
    ],
    changed: ({id, v}) => [
      {wU: IrreducibleFunctional, id, data: {id, v}},
      null,
      {dU: IrreducibleFunctional, id, data: {id, v: 0}}
    ]
  },
  ...FunctionalScalars.map(Scalar => {
    const { name } = Scalar;
    const type = has(name, "Stateful") ? "stateful" : "stateless";
    const desc = `reducible (${type}, returns one)`
    return {
      name: desc, get: data => ({name: Scalar, data}),
      defaultNextCount: 1,
      added: ({id}) => [
        {wA: name, id}, {wA: "div", id}, 
        {wA: "p", id}, {dA: "p", id},
        {wA: "span", id}, {dA: "span", id}, 
        {wA: "a", id}, null, {dA: "a", id}, 
        {dA: "div", id}, {dA: name, id}
      ],
      removed: ({id}) => [
        {wR: name, id}, {wR: "div", id}, 
        {wR: "p", id}, {wR: "span", id}, {wR: "a", id}, null,
        {dR: name, id}
      ],
      changed: ({id, v}) => [
        {wU: name, id, data: {id, v}}, {wU: "div", id, data: {id, v}}, 
        {wU: "p", id, data: {id, v}}, {dU: "p", id, data: {id, v:0}}, 
        {wU: "span", id, data: {id, v}}, {dU: "span", id, data: {id, v:0}}, 
        {wU: "a", id, data: {id, v}}, null, {dU: "a", id, data: {id, v:0}},
        {dU: "div", id, data: {id, v:0}}, {dU: name, id, data: {id, v:0}}
      ],
    }
  }),
  ...FunctionalVectors.map(Vector => {
    const { name } = Vector;
    const type = has(name, "Stateful") ? "stateful" : "stateless";
    const desc = `reducible (${type}, returns many)`
    return {
      name: desc, get: data => ({name: Vector, data}),
      defaultNextCount: 2,
      added: ({id}) => [
        {wA: name, id}, 
        {wA: "div", id}, {dA: "div", id},
        {wA: "p", id}, {dA: "p", id},
        null,
        {dA: name, id}
      ],
      removed: ({id}) => [
        {wR: name, id},
        {wR: "div", id}, {wR: "p", id}, null,
        {dR: name, id}
      ],
      changed: ({id, v}) => [
        {wU: name, id, data: {id, v}},
        {wU: "div", id, data: {id, v}},
        {dU: "div", id, data: {id, v:0}},
        {wU: "p", id, data: {id, v}}, 
        {dU: "p", id, data: {id, v:0}},
        null,
        {dU: name, id, data: {id, v:0}}
      ],
    }
  })
]


module.exports = { updatingBlackboxes, voidBlackboxes, functionals }
