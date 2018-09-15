const isFn = f => !!f && typeof f === "function";

const isArr = Array.isArray;

const isVoid = t => t == null || typeof t === "boolean"

const isComp = t => !!t && isFn(t.name); 

// XXX should nameless nodes be sterile? i.e. t.next -> null
const norm = t => isVoid(t) ? false : typeof t === "object" ? t : {name: null, data: String(t)};

const applyState = (f, ns, s) => {
  if (ns = f.nextState){
    if (!(s = f.state)) f.state = ns;
    else for (let k in ns) s[k] = ns[k];
    f.nextState = null;
  }
}

module.exports = { isFn, isArr, isVoid, isComp, norm, applyState }
