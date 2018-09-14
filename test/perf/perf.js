const Timer = require("atlas-basic-timer");
const { TemplateFactory, count } = require("./helpers");
const { diff, Frame } = require("../../src/index");
const { expect } = require("chai");

const SCALES = [100, 10, 1];
const SAMPLES = 10000;
const DEC = 1

class Subframe1 extends Frame {}
class Subframe2 extends Frame {}

const factory1 = new TemplateFactory(Subframe1);
const factory2 = new TemplateFactory(Subframe2);

const timer = Timer({dec: DEC});
const cases = {
  star: {},
  binaryTree: {}, 
  linkedList: {}, 
}

const printHeap = () => {
  const mb = process.memoryUsage().heapUsed/1e6;
  console.log(`\n${Math.floor(mb)} MB being used`)
}

const forAll = cb => {
  Object.keys(cases).forEach(c => {
    cb(null, c, null);
    SCALES.forEach(s => {
      cb(cases[c], c, s);
    })
  })
}

forAll((cache, c, s) => {
  if (!cache) return;
  cache[s] = { t1: [], t2: [], f1: [], f2: [] };
})

forAll((cache, c, s) => {
  if (!cache) return;
  const { t1, t2, f1, f2 } = cache[s];
  for (let i = SAMPLES; i--;) {
    const temp1 = factory1[c](s);
    const temp2 = factory2[c](s);
    t1.push(temp1), t2.push(temp2);
    f1.push(diff(temp1))
    f2.push(diff(temp2))
  }
})

const run = job => {
  process.stdout.write("    ");
  timer(job, SAMPLES)
}

gc();
printHeap();

forAll((cache, c, s) => {
  if (!cache) return console.log(`\n${c}`);
  console.log(`  N = ${s}`)
  const { t1, t2, f1, f2 } = cache[s];
  let i;
  const mount = () => diff(t1[++i]);
  const update = () => diff(t1[++i], f1[i]);
  const setTau = () => f1[++i].setTau(i);
  // XXX the initial update call runs 10 times slower than later calls to update
  //   * using a different class when running unmount "fixes" this
  //   * not running the unmount "fixes" this
  //   * running unmount on a different set of frames does not fix this
  //   * these are not fixes, this is unexpected behavior and should be fixed
  const unmount = () => diff(null, f2[++i]);
  i = -1, run(update);
  i = -1, run(mount);
  i = -1, run(setTau)
  i = -1, run(unmount)
})

forAll((cache, c, s) => {
  if (!cache) return;
  const { t1, t2, f1, f2 } = cache[s];
  for (let i = SAMPLES; i--;) {
    expect(f2[i].temp).to.be.null
    expect(count(f2[i])).to.equal(1);
    expect(count(f1[i], "children")).to.equal(s);
    expect(count(t1[i], "next")).to.equal(s);
    expect(count(t2[i], "next")).to.equal(s);
    t1[i] = t2[i] = f1[i] = f2[i] = null
  }
})

gc();
printHeap();
