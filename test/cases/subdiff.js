// Types of subdiffs (arrays -> arrays):
//   properly short circuit memoized elements
//   properly maintain a stable diff
//   properly track positions of keyed and unkeyed nodes
//   properly handle complex element swaps/moves

// const memoizedTemplate = {
//   name: "div", data: {id: "memo", v: 0}, next: {
//     name: "p", data: {id: "memo", v: 0}, next: [
//       {name: "span", data: {id: "memo", v: 0}},
//       {name: "tag", data: {id: "memo", v: 0}}
//     ]
//   }
// }

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
    }
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
    }
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
    }
  },
  // {
  //   desc: "match reordered unkeyed nodes",
  //   get: data => {
  //     return [
  //       data.v ? {name: "div", data} : {name: "p", data},
  //       data.v ? {name: "p", data} : {name: "span", data},
  //       data.v ? {name: "span", data} : {name: "a", data},
  //       data.v ? {name: "a", data} : {name: "div", data}
  //     ]
  //   }
  // },
  // {
  //   desc: "match reordered keyed nodes",
  //   get: data => {
  //     return [
  //       data.v ? {key: "2", name: "span", data} : {key: "1", name: "p", data},
  //       data.v ? {key: "4", name: "div", data}  : {key: "2", name: "span", data},
  //       data.v ? {key: "1", name: "p", data} : {key: "3", name: "a", data},
  //       data.v ? {key: "3", name: "a", data} : {key: "4", name: "div", data}
  //     ]
  //   }
  // },
  // {
  //   desc: "match keyed nodes that moved to nonexistent positions",
  //   get: data => {
  //     return data.v ? [
  //       {name: "table", key: "k1", data},
  //       {name: "one", data},
  //       {name: "two", data},
  //       {name: "three", data},
  //       {name: "span", key: "k2", data},
  //       {name: "four", data},
  //       {name: "five", data},
  //       {name: "div", key: "k3", data},
  //       {name: "six", data},
  //       {name: "br", key: "k4", data},
  //       {name: "seven", data},
  //       {name: "eight", data},
  //       {name: "p", key: "k5", data},
  //       {name: "nine", data},
  //     ] : [
  //       {name: "p", key: "k5", data},
  //       {name: "a", data},
  //       {name: "b", data},
  //       {name: "div", key: "k3", data},
  //       {name: "c", data},
  //       {name: "d", data},
  //       {name: "span", key: "k2", data}
  //     ]
  //   }
  // },
  // {
  //   desc: "match keyed nodes that would otherwise be removed",
  //   get: data => {
  //     return data.v ? [
  //       {name: "p", key: "k5", data},
  //       {name: "a", data},
  //       {name: "b", data},
  //       {name: "div", key: "k3", data},
  //       {name: "c", data},
  //       {name: "d", data},
  //       {name: "span", key: "k2", data}
  //     ] : [
  //       {name: "table", key: "k1", data},
  //       {name: "one", data},
  //       {name: "two", data},
  //       {name: "three", data},
  //       {name: "span", key: "k2", data},
  //       {name: "four", data},
  //       {name: "five", data},
  //       {name: "div", key: "k3", data},
  //       {name: "six", data},
  //       {name: "br", key: "k4", data},
  //       {name: "seven", data},
  //       {name: "eight", data},
  //       {name: "p", key: "k5", data},
  //       {name: "nine", data},
  //     ]
  //   }
  // },
]


module.exports = { updatingBlackboxes }
