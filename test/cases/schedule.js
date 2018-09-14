/* based on context, p and c refer, respectively, to either:
     1. the parent and child tau
     2. the parent and child

phase space for p and c

        c (time)
        ^        (dotted line: p = c)
        | B   ,'
    E   J   A
        |,'   C
----H---G---K----> p (time)
        |
    D   I   F
        |

A: line of coherent relaxation
B: parent relaxes faster than child
C: parent relaxes slower than child
D: region of no relaxation
E: only child relaxes
F: only parent relaxes 
G: parent and child async immediate
H: parent sync, child async immediate
I: parent async immediate, child sync
J: parent async immediate, child async
K: parent async, child async immediate */

// timescale modifiers
const id = t => t;
const half = t => t/2;
const twice = t => 2*t;
const neg = () => -1;
const nil = () => 0;

const states = [
  {phase: "p = c > 0", p: id, c: id},
  {phase: "p < c", p: half, c: twice},
  {phase: "p > c", p: twice, c: half},
  {phase: "p < 0, c > 0", p: neg, c: id},
  {phase: "c < 0, p > 0", p: id, c: neg},
  {phase: "p = c < 0", p: neg, c: neg},
  {phase: "p = c = 0", p: nil, c: nil},
  {phase: "p < 0, c = 0", p: neg, c: nil},
  {phase: "c < 0, p = 0", p: nil, c: neg},
  {phase: "p > 0, c = 0", p: id, c: nil},
  {phase: "c > 0, p = 0", p: nil, c: id}
]
// transition matrix factory
const trans = (p, c) => [
  [0, 1, 1, p, c, 0, 0, 0, 0, 0, 0],
  [1, 0, 1, p, c, 0, 0, 0, 0, 0, 0],
  [1, 1, 0, p, c, 0, 0, 0, 0, 0, 0],
  [p, p, p, 0, 0, c, 0, 0, 0, 0, 0],
  [c, c, c, 0, 0, p, 0, 0, 0, 0, 0],
  [0, 0, 0, c, p, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
]
// event and action factory
const wU = (id, dt, tau, state=null) => ({wU: id, dt, tau, state})
const dU = (id, state=null) => ({dU: id, state})
const update = (...order) => (p, c, states) => {
  order.forEach(({p: pI, c: cI}) => {
    if (pI != null) p.setState(states[pI]);
    else if (cI != null) c.setState(states[cI]);
  })
}
const resultP = (p, c, states) => [
  wU(0, p, p), wU(1, p, c), dU(1), dU(0, states[0])
]
const resultC = (p, c, states) => [
  wU(1, c, c), dU(1, states[0])
]
const resultPC = (p, c, states) => [
  ...resultP(p, c, states), wU(1, c, c), dU(1, states[1])
]
const resultParentSlower = (p, c, states) => [
  wU(1, c, c), dU(1, states[1]), 
  wU(0, p, p), wU(1, p, c, states[1]), dU(1, states[1]), dU(0, states[0])
]
const resultParentFaster = (p, c, states) => [
  wU(0, p, p), wU(1, p, c), dU(1, states[1]), dU(0, states[0])
]
// all scheduling tests can be boiled down to, for each region in phase space:
//   1. an action that modifies the DAG
//   2. an expected sequence of events resulting from the action
const parentCases = [
  {
    name: "immediately update p -> c when p sets state",
    filter: (p, c) => p < 0,
    action: update({p:0}),
    result: resultP
  },
  {
    name: "wait tau_p then update p -> c when p sets state",
    filter: (p, c) => p >= 0,
    action: update({p:0}),
    result: resultP
  }
]

const childCases = [
  {
    name: "immediately update only c when c sets state",
    filter: (p, c) => c < 0,
    action: update({c:0}),
    result: resultC
  },
  {
    name: "wait tau_c then update only c when c sets state",
    filter: (p, c) => c >= 0,
    action: update({c:0}),
    result: resultC
  }
]

const parentFirstCases = [
  {
    name: "immediately update p -> c then update c again when p, c sets state",
    filter: (p, c) => p < 0 && c < 0,
    action: update({p:0}, {c:1}),
    result: resultPC
  },
  {
    name: "immediately update p -> c, then wait tau_c and update c again when p, c sets state",
    filter: (p, c) => p < 0 && c >= 0,
    action: update({p:0}, {c:1}),
    result: resultPC
  },
  {
    name: "immediately update c, then wait tau_p and update p -> c when p, c sets state",
    filter: (p, c) => p >= 0 && c < 0,
    action: update({p:0}, {c:1}),
    result: resultParentSlower
  },
  {
    name: "wait tau_c and update c, then wait tau_p-tau_c and update p -> c when p, c sets state",
    filter: (p, c) => p >= 0 && c >= 0 && c < p,
    action: update({p:0}, {c:1}),
    result: resultParentSlower
  },
  {
    name: "wait tau_p and update only p -> c when p, c sets state",
    filter: (p, c) => p >= 0 && c >= 0 && c >= p,
    action: update({p:0}, {c:1}),
    result: resultParentFaster
  },
]

const childFirstCases = [
  {
    name: "immediately update c, then update p -> c when c, p sets state",
    filter: (p, c) => p < 0 && c < 0,
    action: update({c:0}, {p:1}),
    result: (p, c, states) => [
      ...resultC(p, c, states),
      wU(0, p, p), wU(1, p, c, states[0]), dU(1, states[0]), dU(0, states[1])
    ]
  },
  {
    name: "immediately update only p -> c with c's next state when c, p sets state",
    filter: (p, c) => p < 0 && c >= 0,
    action: update({c:0}, {p:1}),
    result: (p, c, states) => [
      wU(0, p, p), wU(1, p, c), dU(1, states[0]), dU(0, states[1])
    ] 
  },
  {
    name: "immediately update c, then wait tau_p and update p -> c when c, p sets state",
    filter: (p, c) => p >= 0 && c < 0,
    action: update({c:1}, {p:0}),
    result: resultParentSlower
  },
  {
    name: "wait tau_c and update c, then wait tau_p-tau_c and update p -> c when c, p sets state",
    filter: (p, c) => p >= 0 && c >= 0 && c < p,
    action: update({c:1}, {p:0}),
    result: resultParentSlower
  },
  {
    name: "wait tau_p and update only p -> c when c, p sets state",
    filter: (p, c) => p >= 0 && c >= 0 && c >= p,
    action: update({c:1}, {p:0}),
    result: resultParentFaster
  }
]

const doubleCases = [
  {
    name: "immediately update p -> c twice when p sets state twice",
    filter: (p, c) => p < 0,
    action: update({p:0}, {p:1}),
    result: (p, c, states) => [
      ...resultP(p, c, states),
      wU(0, p, p, states[0]), wU(1, p, c), dU(1), dU(0, states[1])
    ]
  },
  {
    name: "immediately update c twice when c sets state twice",
    filter: (p, c) => c < 0,
    action: update({c:0}, {c:1}),
    result: (p, c, states) => [
      ...resultC(p, c, states),
      wU(1, c, c, states[0]), dU(1, states[1])
    ]
  },
  {
    name: "wait tau_p and only update p -> c once when p sets state twice",
    filter: (p, c) => p >= 0,
    action: update({p:0}, {p:1}),
    result: (p, c, states) => [wU(0, p, p), wU(1, p, c), dU(1), dU(0, states[1])]
  },
  {
    name: "wait tau_c and only update c once when c sets state twice",
    filter: (p, c) => c >= 0,
    action: update({c:0}, {c:1}),
    result: (p, c, states) => [wU(1, c, c), dU(1, states[1])]
  }
]

const dynamicTauCases = [
  {
    name: "immediately update only p -> c when p sets tau",
    filter: (p, c) => p < 0,
    action: update({p:0}, {c:1}),
    result: (p, c, states) => [
      wU(0, p, p), wU(1, p, c), dU(1, states[1]), dU(0, states[0])
    ]
  },
  {
    name: "immediately update c, then wait new tau_p and update p -> c when p sets tau",
    filter: (p, c) => p >= 0 && c < 0,
    action: update({p:0}, {c:1}),
    result: resultParentSlower
  },
  {
    name: "wait new tau_c and update c, then wait new tau_p-new tau_c and update p -> c when p sets tau",
    filter: (p, c) => p >= 0 && c >= 0 && c < p,
    action: update({p:0}, {c:1}),
    result: resultParentSlower
  },
  {
    name: "wait new tau_p and update only p -> c when p sets tau",
    filter: (p, c) => p >= 0 && c >= 0 && c >= p,
    action: update({p:0}, {c:1}),
    result: resultParentFaster
  },
]

module.exports = { 
  parentCases,
  parentFirstCases,
  childFirstCases,
  doubleCases,
  childCases, 
  dynamicTauCases,
  states, 
  pTrans: trans(1,0), 
  cTrans: trans(0,1)
}
