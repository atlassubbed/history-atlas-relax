const { assertList, print, SinglyLinkedEffect, assertTree, assertNull } = require("./lcrs-helpers");
const { shuffle, sample, insert, int } = require("atlas-random");
const { diff } = require("./lcrs-mutations");
const { Cache } = require("../effects");

let id = 0;

const makeTemps = n => {
  let list = [];
  for (let i = 0; i < n; i++) list[i] = {name:"p", key: id++};
  return list;
}

const renderer = new SinglyLinkedEffect, cache = new Cache([]);
const children = makeTemps(5);
(sample(children).next = makeTemps(3))[1].next = makeTemps(3)

const nextChildren = sample(shuffle([...children]), 3)
nextChildren.splice(int(nextChildren.length), 0, {name: "div", key: "child"});
const temp = {name: "div", key: "parent", next: children};
const nextTemp = {name: "div", key: "parent", next: nextChildren};

const f = diff(temp, null, {effs: [renderer, cache]});
console.log(assertList(f))
assertTree(renderer, temp);
print(f)

console.log(nextChildren.map(t => t.key).join(" "))
diff(nextTemp, f)
console.log(assertList(f))
assertTree(renderer, nextTemp);
print(f)

diff(null, f);
console.log(assertList(f))
// console.log(cache.nodes)
assertNull(cache.nodes)
assertTree(renderer, null);
print(f)