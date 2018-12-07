const { Timer } = require("atlas-basic-timer");
const serial = require("atlas-serial");
const { TemplateFactory, count, printHeap, printTitle, doWork } = require("./helpers");
const { Passthrough } = require("../effects");
const { diff, Frame } = require("../../src/index");
const { expect } = require("chai");
const { copy, isArr } = require("../util")

const SCALES = [50];
const SAMPLES = 5e3;
const RENDER_WORK = 0; // set to zero to compare just the implementation
const DEC = 1;
const PAD_AMT = 25;
const timer = Timer({dec: DEC});
const tasks = [];
const opts = {effs: new Passthrough};

// don't wanna doWork during initialization
let init = true;

class Subframe extends Frame {
  render(data, next){
    const s = this.state;
    init || doWork(RENDER_WORK)
    return s && s.next || next;
  }
  didUpdate(){
    if (this.done) this.done();
  }
}

const factory1 = new TemplateFactory(class Subframe1 extends Subframe {});
const factory2 = new TemplateFactory(class Subframe2 extends Subframe {});
const factory3 = new TemplateFactory(class Subframe3 extends Subframe {});

const cases = {
  star: {},
  keyedStar: {},
  binaryTree: {}, 
  linkedList: {}, 
}

const run = (name, job) => {
  printTitle(name, PAD_AMT)
  timer(job, SAMPLES);
}
const runAsync = (name, job, cb) => {
  printTitle(name, PAD_AMT)
  timer(job, SAMPLES, errs => {
    if (errs.length) throw errs[0];
    cb();
  })
}

// build initial cache of trees to test
for (let c in cases){
  const cache = cases[c];
  for (let s of SCALES){
    const t1 = [], t2 = [], t3 = [], f1 = [], f2 = [], f3 = [];
    cache[s] = { t1, t2, t3, f1, f2, f3 };
    for (let i = 0; i < 5; i++) t3.push(factory3[c](s));
    t2.push(factory2[c](s))
    t1.push(factory1[c](s))
    t1.push(factory1[c](s))
    for (let i = SAMPLES; i--;) {
      f1.push(diff(factory1[c](s)))
      f2.push(diff(factory2[c](s)))
      f3.push(diff(factory3[c](s), null, opts))
    }
  }
}

// initialization is over, now we wanna doWork during diffs
init = false;

// add tests to the task list
for (let c in cases){
  tasks.push(caseDone => {
    console.log(`\n${c}`)
    const subtasks = [];
    for (let s of SCALES){
      subtasks.push(taskDone => {
        console.log(`  N = ${s}`);
        const { t1, t2, t3, f1, f2, f3 } = cases[c][s];
        let i = -1;
        const m1 = Object.assign({}, f2[0].temp), m2 = Object.assign({}, f2[0].temp);
        const t10 = t1.pop(), t11 = t1.pop(), t20 = t2.pop();
        const s1 = t3.pop().next, s2 = t3.pop().next;
        const upd1 = s => s.next = s1, upd2 = s => s.next = s2;
        const state3 = {next: t3.pop().next};
        const state4 = {next: t3.pop().next};
        const state5 = {next: t3.pop().next};
        run("update first", () => diff(t10, f1[++i])), i = -1;
        run("update", () => diff(++i%2 ? t10 : t11, f1[0])), i = -1;
        run("update memoized", () => diff(++i%2 ? m1 : m2, f2[0])), i = -1;
        run("mount", () => diff(t10)), i = -1;
        run("unmount", () => diff(null, f1[++i])), i = -1;
        run("entangle one to many", () => f2[0].entangle(f2[++i])), i = -1;
        run("update entangled", () => diff(t20, f2[++i])), i = -1;
        run("detangle one to many", () => f2[0].detangle(f2[++i])), i = -1;
        run("update first sync", () => f3[++i].setState(state4)), i = -1;
        run("update first sync (fn)", () => f3[++i].setState(upd1)), i = -1;
        run("update sync", () => f3[0].setState(++i%2 ? state3 : state4)), i = -1;
        run("update sync (fn)", () => f3[0].setState(++i%2 ? upd1 : upd2)), i = SAMPLES-1;
        run("schedule polycolor", () => f3[0].setState(state3, --i));
        run("schedule monocolor", () => f3[0].setState(state4, ++i === SAMPLES ? -1 : 1)), i = -1;
        run("schedule immediate", () => f3[0].setState(state3, ++i === SAMPLES ? -1 : 0)), i = -1;
        runAsync("update first async", done => {
          f3[++i].done = done;
          f3[i].setState(state4, 0)
        }, () => runAsync("update async", done => {
          f3[0].done = done;
          f3[0].setState(++i%2 ? state3 : state5, 0)
        }, () => taskDone()))
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
      const { t1, t2, t3, f1, f2, f3 } = cases[c][s];
      expect(t1).to.be.empty;
      expect(t2).to.be.empty;
      expect(t3).to.be.empty;
      for (let i = SAMPLES; i--;) {
        expect(f1[i].temp).to.be.null
        expect(count(f1[i])).to.equal(1);
        expect(count(f2[i])).to.equal(s);
        expect(count(f3[i])).to.equal(s);
        expect(f2[i].affs).to.equal(null)
        f1[i] = f2[i] = f3[i] = null
      }
    }
  }
  gc();
  printHeap();
})
