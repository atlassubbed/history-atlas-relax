const { Timer } = require("atlas-basic-timer");
const serial = require("atlas-serial");
const { TemplateFactory, count, printHeap } = require("./helpers");
const { PassThrough } = require("../Effects");
const { diff, Frame } = require("../../src/index");
const { expect } = require("chai");

const SCALES = [100, 10, 1];
const SAMPLES = 4000;
const DEC = 1
const timer = Timer({dec: DEC});
const tasks = [];
const pass = new PassThrough;
const factory1 = new TemplateFactory(class Subframe1 extends Frame {});
const factory2 = new TemplateFactory(class Subframe2 extends Frame {});
const factory3 = new TemplateFactory(class Subframe3 extends Frame {});
const factory4 = new TemplateFactory(class AsyncFrame extends Frame {
  constructor(temp, effs){
    super(temp, pass)
  }
  willAdd(){
    if (this.parent) this.didUpdate = null;
  }
  didUpdate(){
    this.done()
  }
  getTau(){
    return 0
  }
});
const cases = {
  star: {},
  binaryTree: {}, 
  linkedList: {}, 
}

const run = job => {
  process.stdout.write("    ");
  timer(job, SAMPLES);
}
const runAsync = (job, cb) => {
  process.stdout.write("    ");
  timer(job, SAMPLES, errs => {
    if (errs.length) throw errs[0];
    cb();
  })
}

// build initial cache of trees to test
for (let c in cases){
  const cache = cases[c];
  for (let s of SCALES){
    const t1 = [], t2 = [], f1 = [], f2 = [], f3 = [], f4 = [];
    cache[s] = { t1, t2, f1, f2, f3, f4 };
    for (let i = SAMPLES; i--;) {
      const temp1 = factory1[c](s);
      const temp2 = factory2[c](s);
      const temp3 = factory3[c](s);
      const temp4 = factory4[c](s);
      t1.push(temp1), t2.push(temp2)
      f1.push(diff(temp1))
      f2.push(diff(temp2))
      f3.push(diff(temp3))
      f4.push(diff(temp4))
    }
  }
}

// add tests to the task list
for (let c in cases){
  tasks.push(caseDone => {
    console.log(`\n${c}`)
    const subtasks = [];
    for (let s of SCALES){
      subtasks.push(taskDone => {
        console.log(`  N = ${s}`);
        const { t1, t2, f1, f2, f3, f4 } = cases[c][s];
        let i = -1;
        const mount = () => diff(t1[++i]);
        const update = () => diff(t1[++i], f1[i]);
        const setTau = () => f1[++i].setTau(i);
        // XXX the initial update call runs 10 times slower than later calls to update
        //   * using a different class when running unmount "fixes" this
        //   * not running the unmount "fixes" this
        //   * running unmount on a different set of frames does not fix this
        //   * these are not fixes, this is unexpected behavior and should be fixed
        const unmount = () => diff(null, f2[++i]);
        const entangleOne = () => f3[++i].entangle(f3[(i+1)%SAMPLES])
        const detangleOne = () => f3[++i].detangle(f3[(i+1)%SAMPLES])
        const entangleOneToMany = () => f3[0].entangle(f3[++i]);
        const detangleOneToMany = () => f3[0].detangle(f3[++i]);
        const entangleManyToOne = () => f3[++i].entangle(f3[0]);
        const detangleManyToOne = () => f3[++i].detangle(f3[0]);
        const updateAsync = done => {
          f4[++i].done = done;
          f4[i].setState({})
        }
        run(update), i = -1;
        run(update), i = -1;
        run(mount), i = -1;
        run(setTau), i = -1;
        run(unmount), i = -1;
        run(entangleOne), i = -1;
        run(detangleOne), i = -1;
        run(entangleOneToMany), i = -1;
        run(detangleOneToMany), i = -1;
        run(entangleManyToOne), i = -1;
        run(detangleManyToOne), i = -1;
        runAsync(updateAsync, () => taskDone())
      })
    }
    serial(subtasks, errs => {
      if (errs.length) throw errs[0];
      caseDone();
    });
  })
}

// run the tests
gc();
printHeap();
serial(tasks, () => {
  // cleanup the cache and ensure that frames are in final state
  for (let c in cases){
    for (let s of SCALES){
      const { t1, t2, f1, f2, f3, f4 } = cases[c][s];
      for (let i = SAMPLES; i--;) {
        expect(f2[i].temp).to.be.null
        expect(count(f2[i])).to.equal(1);
        expect(count(f1[i])).to.equal(s);
        expect(count(f3[i])).to.equal(s);
        expect(count(f4[i])).to.equal(s);
        expect(count(t1[i])).to.equal(s);
        expect(count(t2[i])).to.equal(s);
        expect(f3[i].affs).to.equal(null)
        t1[i] = t2[i] = f1[i] = f2[i] = f3[i] = f4[i] = null
      }
    }
  }
  gc();
  printHeap();
})
