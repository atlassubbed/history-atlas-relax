const isFn = f => typeof f === "function";

// XXX you think WeakMaps are pointless? Well, this crap is why we should be using WeakMaps.
const name = t => isFn(t=t.name) ? t.name : t;

// XXX should nameless nodes be sterile? i.e. t.next -> null
const norm = t => t != null && t !== true && t !== false && (typeof t === "object" ? t : {name: null, data: String(t)});

const isArr = Array.isArray;

module.exports = { isFn, isArr, norm, name }
