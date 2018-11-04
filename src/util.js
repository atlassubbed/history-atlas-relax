const isFn = f => !!f && typeof f === "function";

const name = t => isFn(t=t.name) ? t.name : t;

const isComp = t => !!t && isFn(t.name);

const isVoid = t => t == null || typeof t === "boolean"

const isObj = t => t && typeof t === "object";

// XXX should nameless nodes be sterile? i.e. t.next -> null
const norm = t => isVoid(t) ? false : isObj(t) ? t : {name: null, data: String(t)};

const merge = (a, b) => {
  if (b) for (let k in b) a[k] = b[k];
  return a;
}

// attach node f into linked list after sibling s
const link = (f, p, s) => {
  let k = f.sib = s ? s.sib : p.next;
  if (k) k.prev = f;
  if (k = f.prev = s || null) k.sib = f;
  else p.next = f;
  return f;
}

// detach node f from linked list after sibling s
const unlink = (f, p, s) => {
  let next = f.sib;
  if (s && next) (s.sib = next).prev = s;
  else if (s) s.sib = null;
  else if (next) (p.next = next).prev = null;
  else p.next = null;
  return next;
}

const isArr = Array.isArray;

module.exports = { isFn, isArr, isComp, norm, name, isObj, merge, link, unlink }
