const { Timer } = require("atlas-basic-timer");
const serial = require("atlas-serial");
const { TemplateFactory, count, printHeap, rightPad, doWork } = require("./helpers");
const { Passthrough } = require("../effects");
const { diff, Frame } = require("../../src/index");
const { expect } = require("chai");
const { copy } = require("../util")

const SCALES = [50];
const SAMPLES = 5e3;
const DIFF_WORK = 0; // set to zero to compare just the implementation
const DEC = 1;
const PAD_AMT = 25;
const timer = Timer({dec: DEC});
const tasks = [];
const pass = new Passthrough;
const factory1 = new TemplateFactory(class Subframe1 extends Frame {
  diff(data, next){
    return doWork(DIFF_WORK), next;
  }
});
const factory2 = new TemplateFactory(class Subframe2 extends Frame {
  diff(data, next){
    return doWork(DIFF_WORK), next;
  }
});
const factory3 = new TemplateFactory(class Subframe3 extends Frame {
  diff(data, next){
    return doWork(DIFF_WORK), next;
  }
});
const factory4 = new TemplateFactory(class AsyncFrame extends Frame {
  constructor(temp, effs){
    super(temp, pass)
  }
  willAdd(f, parent){
    if (parent) this.didUpdate = null;
  }
  didUpdate(){
    this.done()
  }
  diff(data, next){
    return doWork(DIFF_WORK), copy(next);
  }
  getTau(){
    return 0
  }
});
const cases = {
  star: {},
  keyedStar: {},
  binaryTree: {}, 
  linkedList: {}, 
}

const run = (name, job) => {
  process.stdout.write(`    ${rightPad(name, PAD_AMT)} `);
  timer(job, SAMPLES);
}
const runAsync = (name, job, cb) => {
  process.stdout.write(`    ${rightPad(name, PAD_AMT)} `);
  timer(job, SAMPLES, errs => {
    if (errs.length) throw errs[0];
    cb();
  })
}

// build initial cache of trees to test
for (let c in cases){
  const cache = cases[c];
  for (let s of SCALES){
    const t1 = [], t3 = [], f1 = [], f2 = [], f3 = [], f4 = [];
    cache[s] = { t1, t3, f1, f2, f3, f4 };
    for (let i = SAMPLES; i--;) {
      for (let j = 0; j < 3; j++) t1.push(factory1[c](s))
      t3.push(factory3[c](s))
      f1.push(diff(factory1[c](s)))
      f2.push(diff(factory2[c](s)))
      f3.push(diff(factory3[c](s)))
      f4.push(diff(factory4[c](s)))
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
        const { t1, t3, f1, f2, f3, f4 } = cases[c][s];
        let i = -1;
        const m1 = f3[0].temp, m = [Object.assign({}, m1), Object.assign({}, m1)]
        run("first update", () => diff(t1.pop(), f1[++i])), i = -1;
        run("second update", () => diff(t1.pop(), f1[++i])), i = -1;
        // run("update memoized root", () => diff(m1, f3[0])), i = -1;
        run("update memoized children", () => diff(m[++i%2], f3[0])), i = -1;
        run("mount", () => diff(t1.pop())), i = -1;
        // run("set tau", () => f1[++i].setTau(i)), i = -1;
        run("unmount", () => diff(null, f2[++i])), i = -1;
        // run("entangle one", () => f3[++i].entangle(f3[(i+1)%SAMPLES])), i = -1;
        // run("detangle one", () => f3[++i].detangle(f3[(i+1)%SAMPLES])), i = -1;
        run("entangle one to many", () => f3[0].entangle(f3[++i])), i = -1;
        run("update one to many", () => diff(t3.pop(), f3[++i])), i = -1;
        run("detangle one to many", () => f3[0].detangle(f3[++i])), i = -1;
        // run("entangle many to one", () => f3[++i].entangle(f3[0])), i = -1;
        // run("detangle many to one", () => f3[++i].detangle(f3[0])), i = -1;
        runAsync("update async", done => {
          f4[++i].done = done;
          f4[i].setState({})
        }, () => taskDone())
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
      const { t1, t3, f1, f2, f3, f4 } = cases[c][s];
      expect(t1).to.be.empty;
      expect(t3).to.be.empty;
      for (let i = SAMPLES; i--;) {
        expect(f2[i].temp).to.be.null
        expect(count(f2[i])).to.equal(1);
        expect(count(f1[i])).to.equal(s);
        expect(count(f3[i])).to.equal(s);
        expect(count(f4[i])).to.equal(s);
        expect(f3[i].affs).to.equal(null)
        f1[i] = f2[i] = f3[i] = f4[i] = null
      }
    }
  }
  gc();
  printHeap();
})
