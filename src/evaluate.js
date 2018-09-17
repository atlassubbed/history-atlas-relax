const { isArr, isVoid, norm } = require("./util")

const evaluate = (f, t) => {
  t = f.temp, t = [f.evaluate(t.data, t.next)];
  let next = [];
  while(t.length){
    if (isArr(f = t.pop())) for (let i of f) t.push(i);
    else if (!isVoid(f)) next.push(norm(f));
  }
  return next;
}

module.exports = { evaluate }
