const { diff, Frame } = require("../../");
const { Tracker, LCRSRenderer } = require("../effects");
const { isFn } = require("../util");

const job = f => {
  console.log(`${f.temp.data.id} is emitted and linked`);
  f.temp.data.upd = false;
}

const trav = f => {
  let i = 0;
  while(f){
    if (f.temp.data.upd) f = job(f) || f.next || f.sib || f.parent;
    else f = f.sib || f.parent;
  }
}

const h = (id, next) => ({name: "p", data: {id, upd: true}, next}) 

const temp = h(0, [
  h(1), 
  h(2, [
    h(5), 
    h(6), 
    h(7, [
      h(9, h(11)), 
      h(10)
    ]), 
    h(8)
  ]), 
  h(3), 
  h(4)
])

const f = diff(temp);

trav(f)