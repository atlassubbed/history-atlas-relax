const { isArr } = require("./util")
const { isFrame } = require("./Frame");
const stx = [];

const printDLL = queue => {
  console.log("printing reverse")
  for (let [n, t] of queue.prevs){
    console.log("  ", n.temp.data.id, "comes after", t && t.temp.data.id)
  }
  console.log("printing forward")
  for (let [n, t] of queue.sibs){
    console.log("  ", n.temp.data.id, "comes before", t && t.temp.data.id)
  }
}
// console.log("printing events set")
// for (let f of this.events) {
//   console.log("  ", f._id, f.prev && f.prev._id, this.isMounted(f))
// }
// console.log("printing temp map");
// for (let [n, t] of this.temps){
//   console.log("  ", n._id, "gets temp", !!t)
// }

module.exports = class EventQueue {
  constructor(){
    this.prevs = new Map, this.sibs = new Map,
    this.temps = new Map, this.events = new Map,
    this.parents = new Set;
    this.rems = [];
  }
  cacheChildren(f, cur=f.next){
    if (!this.parents.has(f)) {
      this.parents.add(f);
      while(cur){
        this.prevs.set(cur, cur.prev);
        this.sibs.set(cur, cur = cur.sib);
      }
    }
  }
  removeChild(f, ps=this.prevs.get(f), s=this.sibs.get(f)){
    if (ps) this.sibs.set(ps, s);
    if (s) this.prevs.set(s, ps);
    this.sibs.delete(f), this.prevs.delete(f);
  }
  addChild(f, s, ns=this.sibs.get(s)){
    if (ns) this.prevs.set(ns, f);
    if (s) this.sibs.set(s, f);
    this.sibs.set(f, ns);
    this.prevs.set(f, s);
  }
  moveChild(f, s){
    this.removeChild(f);
    this.addChild(f, s);
  }
  clear(){
    this.prevs.clear(), this.sibs.clear(), this.events.clear(),
    this.temps.clear(), this.parents.clear(), this.rems.length = 0;
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
    this.events.set(f, false);
  }
  remove(f){
    if (!this.events.get(f)){
      this.rems.push([f, f.parent, this.prevs.get(f), f.temp, "willRemove", f.effs]);
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
          const prev = this.prevs.get(node);
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
