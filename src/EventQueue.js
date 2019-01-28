const { isArr } = require("./util")
const { isFrame } = require("./Frame");
const stx = [];

const printDLL = cache => {
  console.log("  printing reverse")
  for (let [n, t] of cache.prevs){
    console.log("    ", n && n.temp.data.id, "comes after", t && t.temp.data.id)
  }
  console.log("  printing forward")
  for (let [n, t] of cache.sibs){
    console.log("    ", n && n.temp.data.id, "comes before", t && t.temp.data.id)
  }
}
const printEvts = q => {
  console.log("printing temp map");
  for (let [n, t] of q.temps){
    console.log("  ", n.temp.data.id, "gets temp", !!t)
  }
  console.log("printing events set")
  for (let [f, isAdding] of q.events) {
    console.log("  ", f.temp.data.id, f.prev && f.prev.temp.data.id, isAdding)
  }
}
const printAll = q => {
  for (let [p, cache] of q.parents) {
    console.log("printing parent dll", p.temp.data.id);
    printDLL(cache)
  }
  console.log("printing rems")
  for (let r in q.rems){
    console.log(r[0].temp.data.id, r[1] && r[1].temp.data.id, r[2] && r[2].temp.data.id)
  }
  printEvts(q);
}

module.exports = class EventQueue {
  constructor(){
    this.temps = new Map, this.events = new Map, this.parents = new Map, this.rems = [];
  }
  cacheChildren(f, cur=f.next){
    if (!this.parents.has(f)) {
      const cache = {prevs: new Map, sibs: new Map};
      this.parents.set(f, cache);
      cache.prevs.set(cur, null);
      cache.sibs.set(null, cur);
      while(cur){
        cache.prevs.set(cur, cur.prev);
        cache.sibs.set(cur, cur = cur.sib);
      }
    }
  }
  removeChild(f){
    const cache = this.parents.get(f.parent);
    if (!cache) return;
    const ps = cache.prevs.get(f), s = cache.sibs.get(f);
    cache.sibs.set(ps, s);
    cache.prevs.set(s, ps);
    cache.sibs.delete(f), cache.prevs.delete(f);
  }
  addChild(f, s){
    const cache = this.parents.get(f.parent);
    if (!cache) return;
    const ns = cache.sibs.get(s);
    cache.prevs.set(ns, f);
    cache.sibs.set(s, f);
    cache.sibs.set(f, ns);
    cache.prevs.set(f, s);
  }
  moveChild(f, s){
    this.removeChild(f);
    this.addChild(f, s);
  }
  clear(){
    this.events.clear(), this.temps.clear(), this.parents.clear(), this.rems.length = 0;
  }
  receive(f, t, pt=this.temps.get(f)){
    if (this.events.get(f) !== true){
      if (!pt) this.temps.set(f, f.temp);
      else if (pt === t) this.temps.delete(f);
    }
  }
  add(f){
    this.events.set(f, true);
  }
  move(f){
    if (this.events.has(f)) return;
    this.events.set(f, false);
  }
  remove(f){
    if (!this.events.get(f)){
      const cache = this.parents.get(f.parent);
      this.rems.push([f, f.parent, cache && cache.prevs.get(f), f.temp, "willRemove", f.effs]);
      this.removeChild(f);
    }
    this.events.delete(f);
    this.temps.delete(f);
  }
  emit(eff, type, args){
    // console.log(type, args.map(f => isFrame(f) && f.temp && f.temp.data.id))
    if (isArr(eff)) for (eff of eff) eff[type] && eff[type](...args);
    else eff[type] && eff[type](...args);   
  }
  flush(){
    // printAll(this)
    for (let event of this.rems){
      this.emit(event.pop(), event.pop(), event);
    }
    for (let node of this.temps.keys()){
      this.emit(node.effs, "willReceive",[node, node.temp]);
    }
    for (let node of this.events.keys()){
      do {
        stx.push(node);
        node = this.events.has(node.prev) ? node.prev : null;
      } while(node);
      while(node = stx.pop()){
        if (this.events.get(node)){
          this.emit(node.effs, "willAdd", [node, node.parent, node.prev, node.temp]);
          this.addChild(node, node.prev);
        } else {
          const cache = this.parents.get(node.parent);
          const prev = cache && cache.prevs.get(node);
          if (node.prev !== prev){
            this.emit(node.effs, "willMove", [node, node.parent, prev, node.prev]);
            this.moveChild(node, node.prev);
          }
        }
        this.events.delete(node);
      }
    }
    this.clear();
  }
}
