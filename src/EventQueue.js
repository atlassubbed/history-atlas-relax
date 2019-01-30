const { isArr } = require("./util")
const { isFrame } = require("./Frame");
const stx = [];

const assertDLL = q => {
  for (let [n, t] of q.prevs){
    if (!n) throw new Error("mapping falsy to node in prevs");
    if (t === undefined) throw new Error("mapping node to undefined in prevs");
    if (!t) {
      if (n.parent && q.nexts.get(n.parent) !== n) {
        throw new Error("parent's first child doesn't match with null prev for node")
      }
    }
  }
  for (let [n, t] of q.nexts){
    if (!n) throw new Error("mapping falsy to some first child")
    if (t) {
      if (q.prevs.get(t) !== null){
        throw new Error("parent's first child has non-null prev")
      }
    }
  }
  for (let [n, t] of q.sibs){
    if (!n) throw new Error("mapping falsy to node in prevs");
    if (t === undefined) throw new Error("mapping node to undefined in prevs");
  }
}
const printDLL = q => {
  console.log("  printing reverse")
  for (let [n, t] of q.prevs){
    console.log("    ", n && n.temp.data.id, "comes after", t && t.temp.data.id)
  }
  console.log("  printing forward")
  for (let [n, t] of q.sibs){
    console.log("    ", n && n.temp.data.id, "comes before", t && t.temp.data.id)
  }
  console.log("  printing first childs")
  for (let [n, t] of q.nexts){
    console.log("    ", n && n.temp.data.id, "has first child", t && t.temp.data.id)
  }
}
const printEvts = q => {
  console.log("printing events set")
  for (let [f, temp] of q.events) {
    console.log("  ", f.temp.data.id, f.prev && f.prev.temp.data.id, !!temp)
  }
}
const printAll = q => {
  printDLL(q);
  console.log("printing rems")
  for (let r in q.rems){
    console.log(r[0].temp.data.id, r[1] && r[1].temp.data.id, r[2] && r[2].temp.data.id)
  }
  printEvts(q);
}

module.exports = class EventQueue {
  constructor(){
    this.prevs = new Map, this.sibs = new Map, this.nexts = new Map;
    this.events = new Map, this.rems = [];
  }
  cacheChildren(f, cur=f.next){
    if (!this.nexts.has(f)) {
      this.nexts.set(f, cur);
      while(cur){
        this.prevs.set(cur, cur.prev);
        this.sibs.set(cur, cur = cur.sib);
      }
    }
  }
  removeChild(f){
    if (!this.nexts.has(f.parent)) return;
    const ps = this.prevs.get(f), s = this.sibs.get(f);
    if (ps) this.sibs.set(ps, s);
    else this.nexts.set(f.parent, s);
    if (s) this.prevs.set(s, ps);
    this.sibs.delete(f), this.prevs.delete(f);
  }
  addChild(f, s){
    if (!this.nexts.has(f.parent)) return;
    if (s){
      const ns = this.sibs.get(s);
      if (ns) this.prevs.set(ns, f);
      this.sibs.set(s, f);
      this.sibs.set(f, ns);
      this.prevs.set(f, s);
    } else {
      const ns = this.nexts.get(f.parent);
      if (ns) this.prevs.set(ns, f);
      this.sibs.set(f, ns);
      this.nexts.set(f.parent, f);
      this.prevs.set(f, null);
    }
  }
  moveChild(f, s){
    this.removeChild(f);
    this.addChild(f, s);
  }
  clear(){
    this.events.clear(), this.sibs.clear(), this.prevs.clear(), 
    this.nexts.clear(), this.rems.length = 0;
  }
  receive(f, t){
    if (!this.events.has(f)){
      this.events.set(f, f.temp);
    }
  }
  add(f){
    this.events.set(f, null);
  }
  move(f){
    if (!this.events.has(f)){
      this.events.set(f, f.temp);
    }
  }
  remove(f){
    const hasEvent = this.events.has(f);
    const temp = this.events.get(f);
    if (!hasEvent || temp){
      this.rems.push([f, f.parent, this.nexts.has(f.parent) && this.prevs.get(f), temp || f.temp, "willRemove", f.effs]);
      this.removeChild(f);
    }
    this.events.delete(f);
  }
  emit(eff, type, args){
    // console.log(type, args.map(f => isFrame(f) && f.temp && f.temp.data.id))
    if (isArr(eff)) for (eff of eff) eff[type] && eff[type](...args);
    else eff[type] && eff[type](...args);   
  }
  flush(){
    // printAll(this)
    // assertDLL(this)
    for (let event of this.rems){
      this.emit(event.pop(), event.pop(), event);
    }
    for (let node of this.events.keys()){
      do {
        stx.push(node);
        node = this.events.has(node.prev) ? node.prev : null;
      } while(node);
      while(node = stx.pop()){
        const temp = this.events.get(node);
        if (!temp){
          this.emit(node.effs, "willAdd", [node, node.parent, node.prev, node.temp]);
          this.addChild(node, node.prev);
        } else {
          if (temp !== node.temp){
            this.emit(node.effs, "willReceive", [node, node.temp]);
          }
          const prev = this.nexts.has(node.parent) ? this.prevs.get(node) : null;
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
