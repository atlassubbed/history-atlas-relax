const { isArr, isVoid, norm } = require("./util")

const clean = dirty => {
  let next = [], t;
  while(dirty.length){
    if (isArr(t = dirty.pop())) for (let i of t) dirty.push(i);
    else if (!isVoid(t)) next.push(norm(t));
  }
  return next;
}
const evaluate = (f, t) => clean([f.evaluate((t = f.temp).data, t.next)]);

module.exports = { evaluate, clean }
