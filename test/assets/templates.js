const { 
  IrreducibleFunctional,
  BlackboxScalars, 
  BlackboxVectors, 
  FunctionalScalars, 
  FunctionalVectors
} = require("./Frames");
const { has } = require("../util")

// Classification of templates:
//     1. Void -- map to the null frame
//     2. Literal -- sterile
//     3. Object

// Blackboxes: Skip keys, memoization and tensors for now.
// Literals: For now, don't test nameless nodes (e.g. {name: null, data: ...})

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
      const arr = [true, false, v ? false : null, undefined];
      if (v) arr.push(null);
      return arr;
    }, 
    added: () => [], removed: () => [], changed: () => []
  }
]

const irreducibleBlackboxes = [
  {
    name: "literal (zero)", get: ({v}) => v ? 0.1 : 0,
    added: () => [{wA: null, id: "0"}, {dA: null, id: "0"}], 
    removed: () => [{wR: null, id: "0"}, {dR: null, id: "0"}],
    changed: ({v}) => [
      {wU: null, id: "0", data: v ? "0.1" : "0"},
      {dU: null, id: v ? "0.1" : "0", data: "0"}
    ]
  },
  {
    name: "literal (number)", get: ({v}) => v ? 34532 : 23412,
    added: () => [{wA: null, id: "23412"}, {dA: null, id: "23412"}], 
    removed: () => [{wR: null, id: "23412"}, {dR: null, id: "23412"}],
    changed: ({v}) => [
      {wU: null, id: "23412", data: v ? "34532" : "23412"},
      {dU: null, id: v ? "34532" : "23412", data: "23412"}
    ]
  },
  {
    name: "literal (empty string)", get: ({v}) => v ? " " : "",
    added: () => [{wA: null, id: ""}, {dA: null, id: ""}], 
    removed: () => [{wR: null, id: ""}, {dR: null, id: ""}],
    changed: ({v}) => [
      {wU: null, id: "", data: v ? " " : ""},
      {dU: null, id: v ? " " : "", data: ""}
    ]
  },
  {
    name: "literal (string)", get: ({v}) => v ? "new" : "old",
    added: () => [{wA: null, id: "old"}, {dA: null, id: "old"}], 
    removed: () => [{wR: null, id: "old"}, {dR: null, id: "old"}],
    changed: ({v}) => [
      {wU: null, id: "old", data: v ? "new" : "old"},
      {dU: null, id: v ? "new" : "old", data: "old"}
    ]
  },
  {
    name: "literal (array)", get: ({v}) => {
      return ["old", v ? 234 : -234, "last"]
    },
    added: () => [
      {wA: null, id: "old"}, {dA: null, id: "old"},
      {wA: null, id: "-234"}, {dA: null, id: "-234"},
      {wA: null, id: "last"}, {dA: null, id: "last"}
    ], 
    removed: () => [
      {wR: null, id: "old"}, {dR: null, id: "old"},
      {wR: null, id: "-234"}, {dR: null, id: "-234"},
      {wR: null, id: "last"}, {dR: null, id: "last"}
    ], 
    changed: ({v}) => [
      {wU: null, id: "old", data: "old"},
      {dU: null, id: "old", data: "old"},
      {wU: null, id: "-234", data: v ? "234" : "-234"},
      {dU: null, id: v ? "234" : "-234", data: "-234"},
      {wU: null, id: "last", data: "last"},
      {dU: null, id: "last", data: "last"}
    ]
  },
  {
    name: "irreducible (single)", get: data => {
      return {name: "div", data};
    },
    added: ({id}) => [{wA: "div", id}, {dA: "div", id}],
    removed: ({id}) => [{wR: "div", id}, {dR: "div", id}],
    changed: ({id, v}) => [
      {wU: "div", id, data: {id, v}}, 
      {dU: "div", id, data: {id, v: 0}},
    ]
  },
  {
    name: "irreducible (array)", get: data => {
      const arr = [
        {name: "div", data}, 
        {name: "p", data}
      ];
      return arr;
    },
    added: ({id}) => [
      {wA: "div", id}, {dA: "div", id},
      {wA: "p", id}, {dA: "p", id}
    ],
    removed: ({id}) => [
      {wR: "div", id}, {dR: "div", id},
      {wR: "p", id}, {dR: "p", id}
    ],
    changed: ({id, v}) => [
      {wU: "div", id, data: {id, v}},
      {dU: "div", id, data: {id, v: 0}},
      {wU: "p", id, data: {id, v}},
      {dU: "p", id, data: {id, v:0}},
    ]
  },
  {
    name: "irreducible (nested)", get: data => {
      return {name: "div", data, next: {name: "p", data}}
    },
    added: ({id}) => [
      {wA: "div", id}, {wA: "p", id}, {dA: "p", id}, {dA: "div", id}
    ],
    removed: ({id}) => [
      {wR: "div", id}, {wR: "p", id}, {dR: "div", id}
    ],
    changed: ({id, v}) => [
      {wU: "div", id, data: {id, v}},
      {wU: "p", id, data: {id, v}},
      {dU: "p", id, data: {id, v: 0}},
      {dU: "div", id, data: {id, v:0}}
    ]
  },
  {
    name: "irreducible (nested array)", get: data => {
      return {
        name: "div", data, next: [
          {name: "p", data, next: {name: "a", data}},
          {name: "tag", data, next: {name: "tag2", data}}
        ]
      }
    },
    added: ({id}) => [
      {wA: "div", id}, {wA: "p", id}, {wA: "a", id},
      {dA: "a", id}, {dA: "p", id},
      {wA: "tag", id}, {wA: "tag2", id},
      {dA: "tag2", id}, {dA: "tag", id},
      {dA: "div", id}
    ],
    removed: ({id}) => [
      {wR: "div", id}, {wR: "p", id}, {wR: "a", id},
      {wR: "tag", id}, {wR: "tag2", id},
      {dR: "div", id}
    ],
    changed: ({id, v}) => [
      {wU: "div", id, data: {id, v}},
      {wU: "p", id, data: {id, v}},
      {wU: "a", id, data: {id, v}}, 
      {dU: "a", id, data: {id, v:0}},
      {dU: "p", id, data: {id, v:0}},
      {wU: "tag", id, data: {id, v}},
      {wU: "tag2", id, data: {id, v}}, 
      {dU: "tag2", id, data: {id, v: 0}},
      {dU: "tag", id, data: {id, v:0}},
      {dU: "div", id, data: {id, v:0}}
    ]
  }
]

const reducibleBlackboxes = [
  ...BlackboxScalars.map(Scalar => {
    const { name } = Scalar;
    const type = has(name, "Stateful") ? "stateful" : "stateless";
    const desc = `reducible (${type}, returns one)`
    return {
      name: desc, get: data => ({name: Scalar, data}),
      added: ({id}) => [
        {wA: name, id},
        {wA: "div", id}, {wA: "p", id}, {dA: "p", id},
        {wA: "span", id}, {dA: "span", id}, {dA: "div", id},
        {dA: name, id}
      ],
      removed: ({id}) => [
        {wR: name, id},
        {wR: "div", id}, {wR: "p", id}, {wR: "span", id},
        {dR: name, id}
      ],
      changed: ({id, v}) => [
        {wU: name, id, data: {id, v}},
        {wU: "div", id, data: {id, v}}, 
        {wU: "p", id, data: {id, v}}, 
        {dU: "p", id, data: {id, v:0}}, 
        {wU: "span", id, data: {id, v}},
        {dU: "span", id, data: {id, v:0}}, 
        {dU: "div", id, data: {id, v:0}},
        {dU: name, id, data: {id, v:0}}
      ],
    }
  }),
  ...BlackboxVectors.map(Vector => {
    const { name } = Vector;
    const type = has(name, "Stateful") ? "stateful" : "stateless";
    const desc = `reducible (${type}, returns many)`
    return {
      name: desc, get: data => ({name: Vector, data}),
      added: ({id}) => [
        {wA: name, id},
        {wA: "div", id}, {dA: "div", id},
        {wA: "p", id}, {dA: "p", id},
        {dA: name, id}
      ],
      removed: ({id}) => [
        {wR: name, id},
        {wR: "div", id}, {wR: "p", id},
        {dR: name, id}
      ],
      changed: ({id, v}) => [
        {wU: name, id, data: {id, v}},
        {wU: "div", id, data: {id, v}},
        {dU: "div", id, data: {id, v:0}},
        {wU: "p", id, data: {id, v}}, 
        {dU: "p", id, data: {id, v:0}}, 
        {dU: name, id, data: {id, v:0}}
      ],
    }
  })
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

module.exports = { 
  voidBlackboxes, 
  irreducibleBlackboxes, 
  reducibleBlackboxes, 
  functionals
}
