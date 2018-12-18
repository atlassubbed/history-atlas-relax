const { isArr, name } = require("./util")

// XXX handle keys and names more gracefully
//   * use a map to avoid stringifying function names
//   * use a map to support non-string keys
//   * use a memoized toLowercase to support arbitrary irreducible name casing
//   Cons:
//     * using nested map structures may have perf implications
//     * supporting duplicate keys also has perf implications

// indexes explicit and implicit keys in LIFO order
// handles dupe keys gracefully; dupe keys across names work properly
module.exports = class KeyIndex {
  constructor(){this.cache = {}}
  push(t){
    let c = this.cache, k;
    c = c[k = name(t)] = c[k] || {};
    (k = t.key) ? (c = c.exp = c.exp || {})[k] ? isArr(c[k]) ?
    c[k].push(t) : (c[k] = [c[k], t]) : c[k] = t : (c.imp = c.imp || []).push(t);
  }
  pop(t){
    let c = this.cache[name(t)], k;
    return c ? (k = t.key) ? ((c = c.exp) && c[k]) ? isArr(c[k]) ? 
      c[k].pop() : (c[k] = !(k = c[k]), k) : 0 : (c=c.imp) && c.pop() : 0
  }
}
