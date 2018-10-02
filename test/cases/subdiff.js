const { copy } = require("../util");
const { B } = require("./Frames");

/* Properties of subdiffs (arrays -> arrays):
     1. should be stable for implicit keys
     2. should be stable for explicit keys
     3. should produce a correct edit path in linear time
   We want set, K, of all permutations of the elements in power set, P, of S
     1. (n m) = n!/((n-m)!*m!)
     2. let P be the power set of S, i.e. the set of all subsets.
        |P| = 2^|S|, each element p in P has |p|! permutations
     3. let K be the set of all permutations for all p in P
        |K| = SUM((|S| s)*s!, s = 0 to s = |S|) = SUM(|S|!/s!, s = 0 to s = |S|) */

// do these steps separately to keep it simple

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
const mapToBasis = (seqs, S) => seqs.map(s => s.map(el => copy(S[el])));

// "generating" sets, factorial growth; infeasible for N > 5
// prev and next refer to subdiff's prev and next children, respectively
const bruteForceCases = [
  [ // implicit basis
    {name: "a", data: {id: 1}},
    {name: "a", data: {id: 2}},
    {name: B, data: {id: 3}},
    {name: B, data: {id: 4}}
  ],
  [ // explicit basis
    {name: "a", key: "k1", data: {id: 1}},
    {name: "a", key: "k1", data: {id: 2}},
    {name: B, key: "k1", data: {id: 3}},
    {name: B, key: "k2", data: {id: 4}}
  ],
  [ // mixed basis
    {name: "a", key: "k1", data: {id: 1}},
    {name: "a", data: {id: 2}},
    {name: B, key: "k2", data: {id: 3}},
    {name: B, data: {id: 4}}
  ]
].map(genSet => {
  const seqs = findAll(genIndexPermutationGraph(genSet.map((e, i) => i)));
  return {
    prevCases: mapToBasis(seqs, genSet),
    nextCases: mapToBasis(seqs, genSet)
  }
})

// matching cases, makePrev returns a new prev array
// makeNext* uses that as a basis for creating the next array
const makeNextSame = makePrev => {
  const next = makePrev();
  // add some holes to lower the density
  next[0] = false, next[2] = null, next[next.length-1] = true, next[5] = undefined;
  return next;
}
const makeNextLess = makePrev => {
  const next = makeNextSame(makePrev);
  let rem = 3;
  while(rem--)next.pop();
  return next;
}
const makeNextMore = makePrev => {
  const next = makeNextSame(makePrev);
  let add = 5;
  while(add--)next.push({name: "c"});
  return next;
}

// for each of these conditions, nodes should get matched properly 
// to their implicit or explicit keyed nodes in prev
const matchingCases = [
  {condition: "|next| === |prev|", makeNext: makeNextSame},
  {condition: "|next| > |prev|", makeNext: makeNextMore},
  {condition: "|next| < |prev|", makeNext: makeNextLess}
]

module.exports = { bruteForceCases, matchingCases }
