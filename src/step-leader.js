let epoch = 0
const path = [];

const step = f => {
  if (f.inStep) 
    throw new Error("cyclic entanglement");
  f.inStep = true;
  const { children, affects, id } = f;
  if (children){
    let cN = children.length, c;
    while(cN--) (c = children[cN]).epoch < epoch && step(c);
  }
  if (affects){
    let aN = affects.length, refs, c;
    f.affects = null;
    while(aN--){
      if ((refs = (c = affects[aN]).affectors) && refs[id]){
        (f.affects = f.affects || []).push(c)
        c.epoch < epoch && step(c);
      }
    }
  }
  f.inStep = false, f.epoch = epoch;
  path.push(f)
}

const fillPath = f => {epoch++, step(f)}

module.exports = { fillPath, path }
