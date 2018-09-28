const { copy } = require("../util");

/* Properties of subdiffs (arrays -> arrays):
     1. properly maintain a stable diff
     2. properly track (explicit) keyed and (implicit) unkeyed nodes
     3. properly handle complex element swaps/moves
   We want set, K, of all permutations of the elements in power set, P, of S
     1. {n,m} === n choose m = n!/((n-m)!*m!)
     2. let P be the power set of S, i.e. the set of all subsets.
        |P| = 2^|S|
        each element p in P has |p|! permutations
     3. let K be the set of all permutations for all p in P
        |K| = SUM({|S|,s}*s!, s = 0 to s = |S|) = SUM(|S|!/s!, s = 0 to s = |S|) 
   The following steps could easily be done simulataneously (e.g. with Maps, single function)
   but we won't because perf < readability in test code
   we are not testing this code, so it needs to be clear */

/* generates a trie which stores all elements in K
   e.g. if S = {1,2,3}
   then the generated trie is something like
       START
      /  |  \
     1   2   3
    / \ / \ / \
    2 3 1 3 1 2
    | | | | | |
    3 2 3 1 2 1
  reduce is used to accumulate entries in the trie */
const genIndexPermutationGraph = indexes => indexes.reduce((p, i) => {
  p[i] = genIndexPermutationGraph(indexes.filter(j => j !== i));
  return p;
}, {})

/* finds every unique sequence stored in a trie
  e.g. if our trie looks something like:
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
const mapToBasis = (seqs, S, txfm=e=>e) => seqs.map(s => s.map(el => txfm(S[el])));

// "generating" sets, factorial growth; would be infeasible for N > 5
// prev and next refer to subdiff's prev and next children, respectively
// subdiff's job is to correctly morph prev into next via an edit sequence
const basis = [
  {name: "a", data: {id: 1}}, // unkeyed species a
  {name: "a", data: {id: 2}}, // unkeyed species a
  {name: "b", data: {id: 3}}, // unkeyed species b
  {name: "a", key: "k1", data: {id: 4}}, // keyed species a
  {name: "b", key: "k2", data: {id: 5}}, // keyed species b
]
const cases = [
  basis.filter((e, i) => i < 4), // covers implicit keys
  basis.filter((e, i) => i > 0)  // covers explicit keys
].map(genSet => {
  const seqs = findAll(genIndexPermutationGraph(genSet.map((e, i) => i)));
  return {
    prevCases: mapToBasis(seqs, genSet),
    nextCases: mapToBasis(seqs, genSet, copy)
  }
})

module.exports = { cases }
