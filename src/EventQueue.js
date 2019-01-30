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
    console.log("  ", f && f.temp && f.temp.data, f.evt && f.evt.temp &&f.evt.temp.data, f.evt && f.evt.update)
  }
}
const printAll = q => {
  printDLL(q);
  console.log("printing rems")
  for (let f of q.rems){
    console.log(f.evt.temp && f.evt.temp.data)
  }
  printEvts(q);
}

module.exports = class EventQueue {
  constructor(){
    this.nexts = new Map;
    this.events = new Set, this.rems = [];
  }
  cacheChildren(f, cur=f.next){
    if (!this.nexts.has(f)) {
      this.nexts.set(f, cur);
      while(cur){
        if (cur.evt && cur.evt.update) cur = cur.sib;
        else cur.evt = {prev: cur.prev, sib: cur = cur.sib, temp: null, update: false}
      }
    }
  }
  queue(f, p, s){
    f.evt.update = true;
    if (!s){
      this.events.add(f);
      if (p && p.next && p.next.evt.update){
        this.events.delete(p.next);
      }
    } else if (!s.evt.update) {
      this.events.add(f);
      if (s.sib && s.sib.evt.update){
        this.events.delete(s.sib);
      }
    }
  }
  dequeue(f, ps, ns=f.sib){
    if (ns && ns.evt.update){
      if (f.evt.update){
        if (!ps || !ps.evt.update){
          this.events.add(ns);
        }
      } else if (ps && ps.evt.update){
        this.events.delete(ns);
      }
    }
    if (f.evt.update) this.events.delete(f);
    else f.evt.update = true;
  }
  removeChild(f){
    if (!this.nexts.has(f.parent)) return;
    const ps = f.evt.prev, s = f.evt.sib;
    if (ps) ps.evt.sib = s;
    else this.nexts.set(f.parent, s);
    if (s) s.evt.prev = ps;
  }
  addChild(f, s){
    if (!this.nexts.has(f.parent)) return;
    if (s){
      const ns = s.evt.sib;
      if (ns) ns.evt.prev = f;
      s.evt.sib = f;
      f.evt.prev = s;
      f.evt.sib = ns;
    } else {
      const ns = this.nexts.get(f.parent);
      if (ns) ns.evt.prev = f;
      f.evt.prev = null;
      f.evt.sib = ns;
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
    if (!f.evt.update){
      f.evt.temp = f.temp;
      f.evt.update = true;
      if (!f.prev || !f.prev.evt.update){
        this.events.add(f);        
      }
    }
  }
  add(f, p, s){
    f.evt = {temp: null}
    this.queue(f, p, s);
  }
  move(f, p, s, ps){
    if (!f.evt.update){
      f.evt.temp = f.evt.temp || f.temp;      
    }
    this.dequeue(f, ps);
    this.queue(f, p, s);
  }
  remove(f){
    const hasEvent = f.evt.update;
    const temp = f.evt.temp;
    if (!hasEvent || temp){
      f.evt.parent = f.parent, f.evt.temp = temp || f.temp, f.evt.effs = f.effs;
      this.rems.push(f);
      this.removeChild(f);
    }
    this.dequeue(f, f.prev)
    this.nexts.delete(f);
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
      // assertDLL(this)
    }
    for (let node of this.rems){
      const e = node.evt;
      this.emit(e.effs, "willRemove", node, e.parent, this.nexts.has(e.parent) ? e.prev : node.prev, e.temp);
      node.evt = null;
    }
    for (let node of this.events){
      this.events.delete(node);
      do {
        node.evt.update = false;
        const temp = node.evt.temp;
        if (!temp){
          this.emit(node.effs, "willAdd", node, node.parent, node.prev, node.temp);
          this.addChild(node, node.prev);
        } else {
          if (temp !== node.temp){
            this.emit(node.effs, "willReceive", node, node.temp);
          }
          const prev = this.nexts.has(node.parent) ? node.evt.prev : null;
          if (node.prev !== prev){
            this.emit(node.effs, "willMove", node, node.parent, prev, node.prev);
            this.moveChild(node, node.prev);
          }
        }
      } while(node = node.sib, node && node.evt.update);
    }
    this.clear();
    debug && console.log("\n")
  }
}
