const { isArr } = require("./util")
const { isFrame } = require("./Frame");
const stx = [];

let debug = 0
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
  console.log("printing first childs")
  for (let [n, t] of q.nexts){
    console.log("    ", n && n.temp && n.temp.data, "has first child", t && t.temp && t.temp.data)
  }
}
const printEvts = q => {
  console.log("printing events set")
  for (let f of q.events) {
    console.log("  ", f && f.temp && f.temp.data, f.prev && f.prev.temp.data, f.evt && f.evt[2] && f.evt[2].data, f.evt && f.evt.length)
  }
}
const printAll = q => {
  printDLL(q);
  console.log("printing rems")
  for (let f of q.rems){
    console.log(f.evt[2] && f.evt[2].data)
  }
  printEvts(q);
}

module.exports = class EventQueue {
  constructor(){
    this.nexts = new Map;
    this.events = new Set, this.rems = [];
  }
  isUpd(f){
    return f.evt.length !== 2
  }
  cacheChildren(f, cur=f.next){
    if (!this.nexts.has(f)) {
      this.nexts.set(f, cur);
      while(cur){
        if (cur.evt && this.isUpd(cur)) cur = cur.sib;
        else cur.evt = [cur.prev, cur = cur.sib]
      }
    }
  }
  queue(f, p, s){
    if (!s){
      this.events.add(f);
      if (p && p.next && this.isUpd(p.next)){
        this.events.delete(p.next);
      }
    } else if (!this.isUpd(s)) {
      this.events.add(f);
      if (s.sib && this.isUpd(s.sib)){
        this.events.delete(s.sib);
      }
    }
    // if (debug){
    //   console.log("     queueing", s && s.temp.data, f.temp.data, s && s.sib && s.sib.temp.data)
    //   printEvts(this);
    //   console.log()
    // }
  }
  requeue(f, s, ns){
    if (!this.isUpd(f)){
      if (ns && this.isUpd(ns)){
        this.events.delete(ns);
      }
      if (!s || !this.isUpd(s)){
        this.events.add(f);
      }
    }
    // if (debug){
    //   console.log("     requeueing", s && s.temp.data, f.temp.data, ns && ns.temp.data)
    //   printEvts(this);
    //   console.log()
    // }
  }
  dequeue(f, ps, ns=f.sib){
    if (ns && this.isUpd(ns)){
      if (this.isUpd(f)){
        if (!ps || !this.isUpd(ps)){
          this.events.add(ns);
        }
      } else if (ps && this.isUpd(ps)){
        this.events.delete(ns);
      }
    }
    if (this.isUpd(f)) this.events.delete(f);
    // if (debug){
    //   console.log("     dequeueing", ps && ps.temp.data, f.temp.data, ns && ns.temp.data)
    //   printEvts(this);
    //   console.log()
    // }
  }
  removeChild(f){
    if (!this.nexts.has(f.parent)) return;
    const ps = f.evt[0], s = f.evt[1];
    if (ps) ps.evt[1] = s;
    else this.nexts.set(f.parent, s);
    if (s) s.evt[0] = ps;
  }
  addChild(f, s){
    if (!this.nexts.has(f.parent)) return;
    if (s){
      const ns = s.evt[1];
      if (ns) ns.evt[0] = f;
      s.evt[1] = f;
      f.evt[0] = s;
      f.evt[1] = ns;
    } else {
      const ns = this.nexts.get(f.parent);
      if (ns) ns.evt[0] = f;
      f.evt[0] = null;
      f.evt[1] = ns;
      this.nexts.set(f.parent, f);
    }
  }
  moveChild(f, s){
    this.removeChild(f);
    this.addChild(f, s);
  }
  clear(){
    this.events.clear(),
    this.nexts.clear(), this.rems.length = 0;
  }
  receive(f, t){
    this.requeue(f, f.prev, f.sib);
    if (!this.isUpd(f)){
      f.evt.push(f.temp);
    }
  }
  add(f, p, s){
    f.evt = []
    this.queue(f, p, s);
  }
  move(f, p, s, ps){
    this.dequeue(f, ps);
    if (!this.isUpd(f)){
      f.evt.push(f.temp)
    }
    this.queue(f, p, s);
  }
  remove(f){
    this.dequeue(f, f.prev)
    if (f.evt.length >= 2){
      if (!f.evt[2]) f.evt.push(f.temp);
      f.evt.push(f.parent, f.effs);
      this.rems.push(f);
      this.removeChild(f);
    }
  }
  emit(eff, type, f, p, s, ps){
    // if (debug){
    //   console.log(type, f.temp && f.temp.data)
    //   // console.log(type, args.map(f => isFrame(f) && f.temp && f.temp.data.id))      
    // }
    if (isArr(eff)) for (eff of eff) eff[type] && eff[type](f, p, s, ps);
    else eff[type] && eff[type](f, p, s, ps);   
  }
  flush(){
    // if (debug) {
    //   printAll(this)
    //   // assertDLL(this)
    // }
    for (let node of this.rems){
      const e = node.evt, eff = e.pop(), par = e.pop();
      this.emit(eff, "willRemove", node, par, this.nexts.has(par) ? e[0] : node.prev, e[2]);
      node.evt = null;
    }
    for (let node of this.events){
      this.events.delete(node);
      do {
        const temp = node.evt.pop();
        if (!temp){
          this.emit(node.effs, "willAdd", node, node.parent, node.prev, node.temp);
          this.addChild(node, node.prev);
          node.evt.length = 2
        } else {
          if (temp !== node.temp){
            this.emit(node.effs, "willReceive", node, node.temp);
          }
          const prev = this.nexts.has(node.parent) ? node.evt[0] : null;
          if (node.prev !== prev){
            this.emit(node.effs, "willMove", node, node.parent, prev, node.prev);
            this.moveChild(node, node.prev);
          }
        }
      } while(node = node.sib, node && this.isUpd(node));
    }
    this.clear();
    // debug && console.log("\n")
  }
}
