const { isArr, name } = require("./util")

// XXX handle keys and names more gracefully
//   * use a map to avoid stringifying function names
//   * use a map to support non-string keys
//   * use a memoized toLowercase to support arbitrary irreducible name casing
//   * using nested map structures may have perf implications
//   * supporting duplicate keys also has perf implications

// indexes explicit and implicit keys in LIFO order
// handles dupe keys gracefully; dupe keys across names work properly
module.exports = class KeyIndex {
  constructor(){this.cache = {}}
  push(t){
    let c = this.cache, k;
    c = c[k = name(t)] = c[k] || {};
    if (!(k = t.key)) (c.imp = c.imp || []).push(t);
    else if (!(c = c.exp = c.exp || {})[k]) c[k] = t;
    else if (isArr(c[k])) c[k].push(t);
    else c[k] = [c[k], t];
  }
  pop(t){
    let c = this.cache, k;
    if (c = c[name(t)]){
      if (!(k = t.key)) return (c = c.imp) && c.pop();
      if ((c = c.exp) && c[k]){
        if (isArr(c[k])) return c[k].pop();
        c[k] = 0*!(k = c[k]);
        return k;
      }
    }
  }
}
