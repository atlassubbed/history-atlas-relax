const toArr = a => Array.isArray(a) ? a : [a];

const has = (str, substr) => str.indexOf(substr) > -1

const findFirst = (arr, obj) => {
  let n = arr.length;
  for (let i = 0; i < n; i++){
    const el = arr[i];
    if (el === obj || obj in el) return i;
  }
  return -1;
}

const fill = (source, dest, at=null, keepAt) => {
  const i = findFirst(dest, at);
  if (i < 0) return dest;
  if (!keepAt) dest.splice(i, 1, ...source);
  else dest.splice(i+1, 0, ...source);
  return dest;
}

const type = str => {
  const i = str.indexOf("(");
  if (i < 0) return str;
  return str.slice(0, i).trim();
}

const isScalar = str => {
  return !(has(str, "(array)") || has(str, "(tensor)"))
}

module.exports = { toArr, has, fill, type, isScalar }
