const { copy } = require("../util");

// the following test cases should be spanned by our combinatorially generated child cases
// const oldCases = [
//   {
//     desc: "match reordered unkeyed nodes",
//     get: data => {
//       return [
//         data.v ? {name: "div", data} : {name: "p", data},
//         data.v ? {name: "p", data} : {name: "span", data},
//         data.v ? {name: "span", data} : {name: "a", data},
//         data.v ? {name: "a", data} : {name: "div", data}
//       ]
//     }
//   },
//   {
//     desc: "match reordered keyed nodes",
//     get: data => {
//       return [
//         data.v ? {key: "2", name: "span", data} : {key: "1", name: "p", data},
//         data.v ? {key: "4", name: "div", data}  : {key: "2", name: "span", data},
//         data.v ? {key: "1", name: "p", data} : {key: "3", name: "a", data},
//         data.v ? {key: "3", name: "a", data} : {key: "4", name: "div", data}
//       ]
//     }
//   },
//   {
//     desc: "match keyed nodes that moved to nonexistent positions",
//     get: data => {
//       return data.v ? [
//         {name: "table", key: "k1", data},
//         {name: "one", data},
//         {name: "two", data},
//         {name: "three", data},
//         {name: "span", key: "k2", data},
//         {name: "four", data},
//         {name: "five", data},
//         {name: "div", key: "k3", data},
//         {name: "six", data},
//         {name: "br", key: "k4", data},
//         {name: "seven", data},
//         {name: "eight", data},
//         {name: "p", key: "k5", data},
//         {name: "nine", data},
//       ] : [
//         {name: "p", key: "k5", data},
//         {name: "a", data},
//         {name: "b", data},
//         {name: "div", key: "k3", data},
//         {name: "c", data},
//         {name: "d", data},
//         {name: "span", key: "k2", data}
//       ]
//     }
//   },
//   {
//     desc: "match keyed nodes that would otherwise be removed",
//     get: data => {
//       return data.v ? [
//         {name: "p", key: "k5", data},
//         {name: "a", data},
//         {name: "b", data},
//         {name: "div", key: "k3", data},
//         {name: "c", data},
//         {name: "d", data},
//         {name: "span", key: "k2", data}
//       ] : [
//         {name: "table", key: "k1", data},
//         {name: "one", data},
//         {name: "two", data},
//         {name: "three", data},
//         {name: "span", key: "k2", data},
//         {name: "four", data},
//         {name: "five", data},
//         {name: "div", key: "k3", data},
//         {name: "six", data},
//         {name: "br", key: "k4", data},
//         {name: "seven", data},
//         {name: "eight", data},
//         {name: "p", key: "k5", data},
//         {name: "nine", data},
//       ]
//     }
//   }
// ]

// Types of subdiffs (arrays -> arrays):
//   properly maintain a stable diff
//   properly track (explicit) keyed and (implicit) unkeyed nodes
//   properly handle complex element swaps/moves

/* We want set, K, of all permutations of the elements in power set, P, of S
     1. {n,m} === n choose m = n!/((n-m)!*m!)
     2. let P be the power set of S, i.e. the set of all subsets.
        |P| = 2^|S|
        each element p in P has |p|! permutations
     3. let K be the set of all permutations for all p in P
        |K| = SUM({|S|,s}*s!, s = 0 to s = |S|) = SUM(|S|!/s!, s = 0 to s = |S|) 
   The following steps could easily be done simulataneously (e.g. with Maps, single function)
   but we won't because perf < readability in test code
   we are not testing this code, so it needs to be clear */

// "generating" set
const genSet = [
  {name: "a"}, // unkeyed species a
  {name: "b"}, // unkeyed species b
  {name: "a", key: "k1"}, // keyed species a
  {name: "b", key: "k2"}, // keyed species b
]

/* generates a trie which stores all elements in K
   e.g. if S = {1,2,3}
   then the generated trie is something like
       START
      /  |  \
     1   2   3
    / \ / \ / \
    2 3 1 3 1 2
    | | | | | |
    3 2 3 1 2 1 */
const genIndexPermutationGraph = indexes => indexes.reduce((p, i) => {
  p[i] = genIndexPermutationGraph(indexes.filter(j => j !== i));
  return p;
}, {})

/* finds every unique sequence stored in a trie
  e.g. if S = {1,2} then our trie looks something like:
    START
    /   \
   1     2
   |     |
   2     1
  and we get the set, K, of sequences:
    {[], [1], [2], [1,2], [2,1]} 
  which is just a set of all elements in the trie */
const findAll = (trie, res=[], cur=[]) => {
  res.push(cur);
  for (let i in trie) findAll(trie[i], res, [...cur, i]);
  return res;
}

// maps our sequences to our (transformed) test cases
const mapToBasis = (seqs, S, transform=e=>e) => seqs.map(seq => seq.map(el => transform(S[el])));

// "prev" and "next" refer to subdiff's prev children and next children
// subdiff's job is to correctly morph prev into next via an edit sequence
const seqs = findAll(genIndexPermutationGraph(genSet.map((e,i) => i)))
const prevCases = mapToBasis(seqs, genSet, copy)
const nextCases = mapToBasis(seqs, genSet, copy)
const memoizedCases = mapToBasis(seqs, genSet)

module.exports = { prevCases, nextCases, memoizedCases }
