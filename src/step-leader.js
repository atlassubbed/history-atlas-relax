let epoch = 0
const leaders = [];

const step = frame => {
  if (frame.inStep) 
    throw new Error("cylic entanglement");
  frame.inStep = true;
  const { children, affects, id } = frame;
  if (children) for (let f of children) 
    f.epoch < epoch && step(f);
  if (affects) {
    let refs;
    frame.affects = null;
    for (let f of affects){
      if ((refs = f.affectors) && refs[id]){
        (frame.affects = frame.affects || []).push(f)
        f.epoch < epoch && step(f);
      }
    }
  }
  frame.inStep = false, frame.epoch = epoch;
  if (frame.affects || frame.affectors)
    leaders.push(frame), frame.inPath = true;
}

const fillPath = frame => {
  epoch++, step(frame);
}

module.exports = { fillPath, leaders }
