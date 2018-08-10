const toArr = a => Array.isArray(a) ? a : [a];

const has = (str, substr) => str.indexOf(substr) > -1

module.exports = { toArr, has }
