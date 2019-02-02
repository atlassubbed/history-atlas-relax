const { isArr } = require("./util")
const { isFrame } = require("./Frame");
const stx = [];

let debug = 0
const printDLL = q => {
  console.log("printing first childs")
  for (let [n, t] of q.nexts){
    console.log("    ", n && n.temp && n.temp.data, "has first child", t && t.temp && t.temp.data)
  }
}
const printEvts = q => {
  console.log("printing events set")
  for (let f of q.events) {
    console.log("  ", f && f.temp && f.temp.data, f.prev && f.prev.temp.data, f.evt && f.evt.prev && f.evt.prev.temp && f.evt.prev.temp.data)
  }
}
const printAll = q => {
  // printDLL(q);
  console.log("printing rems")
  for (let f of q.rems){
    console.log(f.evt.temp && f.evt.temp.data)
  }
  printEvts(q);
}

let epoch = 0;

module.exports = class EventQueue {
  constructor(){
    this.events = new Set, this.rems = [];
  }
  isUpd(f){
    return f.evt && f.evt.epoch > epoch
  }
  isCached(f){
    return f.evt && f.evt.epoch >= epoch
  }
  cache(f, e){
    if (f && f.effs && !this.isCached(f)){
      if (debug) {
        console.log("CACHING", f.temp.data)
      }
      e = f.evt = f.evt || {};
      e.prev = f.prev, e.sib = f.sib, e.next = f.next, e.temp = null, e.epoch = epoch;
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
    if (debug){
      console.log("      queueing", s && s.temp.data, f && f.temp.data, s && s.sib && s.sib.temp.data)
      printEvts(this);
      console.log()
    }
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
    if (debug){
      console.log("      requeueing", s && s.temp.data, f && f.temp.data, ns && ns.temp.data)
      printEvts(this);
      console.log()
    }
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
    if (debug){
      console.log("      dequeueing", ps && ps.temp.data, f && f.temp.data, ns && ns.temp.data)
      printEvts(this);
      console.log()
    }
  }
  removeChild(f){
    if (!f.parent) return;
    const ps = f.evt.prev, s = f.evt.sib;
    if (ps) ps.evt.sib = s;
    else f.parent.evt.next = s;
    if (s) s.evt.prev = ps;
  }
  addChild(f, s){
    if (!f.parent) return;
    if (s){
      const ns = s.evt.sib;
      if (ns) ns.evt.prev = f;
      s.evt.sib = f;
      f.evt.prev = s;
      f.evt.sib = ns;
    } else {
      const ns = f.parent.evt.next;
      if (ns) ns.evt.prev = f;
      f.evt.prev = null;
      f.evt.sib = ns;
      f.parent.evt.next = f;
    }
  }
  moveChild(f, s){
    this.removeChild(f);
    this.addChild(f, s);
  }
  clear(){
    epoch+=2;
    this.events.clear(),
    this.rems.length = 0;
  }
  receive(f, t){
    this.cache(f);     
    this.requeue(f, f.prev, f.sib);
    if (!this.isUpd(f)){
      f.evt.temp = f.temp;
      f.evt.epoch = epoch+1
    }
  }
  add(f, p, s){
    if (s) this.cache(s), this.cache(s.sib);
    else if (p){
      this.cache(p);
      if (p.next) this.cache(p.next), this.cache(p.next.sib);
    }
    f.evt = {temp: null, epoch: epoch+1}
    this.queue(f, p, s);
  }
  move(f, p, s, ps){
    if (s) this.cache(s), this.cache(s.sib);
    else if (p){
      this.cache(p);
      if (p.next) this.cache(p.next), this.cache(p.next.sib);
    }
    if (ps) this.cache(ps);
    else if (p) this.cache(p);
    this.cache(f);
    this.cache(f.sib);
    this.dequeue(f, ps);
    if (!this.isUpd(f)){
      f.evt.temp = f.temp;
      f.evt.epoch = epoch+1
    }
    this.queue(f, p, s);
  }
  remove(f){
    this.cache(f);
    if (f.prev) this.cache(f.prev);
    if (f.sib) this.cache(f.sib);
    const temp = f.evt.temp;
    if (!this.isUpd(f) || temp){
      f.evt.parent = f.parent, f.evt.temp = temp || f.temp, f.evt.effs = f.effs;
      this.rems.push(f);
      this.removeChild(f);
    }
    this.dequeue(f, f.prev)
  }
  emit(eff, type, f, p, s, ps){
    if (debug){
      console.log(type, f.temp && f.temp.data)
      // console.log(type, args.map(f => isFrame(f) && f.temp && f.temp.data.id))      
    }
    if (isArr(eff)) for (eff of eff) eff[type] && eff[type](f, p, s, ps);
    else eff[type] && eff[type](f, p, s, ps);   
  }
  flush(){
    if (debug) {
      printAll(this)
    }
    for (let node of this.rems){
      const e = node.evt;
      this.emit(e.effs, "willRemove", node, e.parent, e.prev, e.temp);
      node.evt = null;
    }
    for (let node of this.events){
      this.events.delete(node);
      do {
        const temp = node.evt.temp;
        if (!temp){
          this.emit(node.effs, "willAdd", node, node.parent, node.prev, node.temp);
          this.addChild(node, node.prev);
        } else {
          if (temp !== node.temp){
            this.emit(node.effs, "willReceive", node, node.temp);
          }
          const prev = node.evt.prev;
          if (node.prev !== prev){
            this.emit(node.effs, "willMove", node, node.parent, prev, node.prev);
            this.moveChild(node, node.prev);
          }
        }
      } while(node = node.sib, node && this.isUpd(node));
    }
    this.clear();
    debug && console.log("\n")
  }
}
