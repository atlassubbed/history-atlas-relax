const { Timer } = require("atlas-basic-timer");
const serial = require("atlas-serial");
const { TemplateFactory, DoublyLinkedList, 
  count, printHeap, printTitle, doWork, asap, makeEntangled } = require("./helpers");
const { diff, Frame } = require("../../src/index");
const { expect } = require("chai");
const { copy, isArr } = require("../util")

// TODO: 
//   1. add rebasing tests, particularly for updates
//      theoretically, should be faster since no path is filled and no subdiff is done
//   2. fix state-update tests
const SCALES = [50];
const SAMPLES = 2e4;
const RENDER_WORK = 0; // set to zero to compare just the implementation
const DEC = 1;
const PAD_AMT = 25;
const timer = Timer({dec: DEC});
const tasks = [];

// don't wanna doWork during initialization
let init = true;

class Subframe extends Frame {
  render(data, next){
    if (RENDER_WORK) init || doWork(RENDER_WORK);
    return this.state || next;
  }
  setState(next, tau){
    this.state = next, this.diff(tau);
  }
}

const cleanup = (node, cb) => {
  diff({name: (d, n, self) => {
    if (node.path > 1) {
      const c = node.cache;
      if (isArr(c)) for (let i = c.length; i--;) diff(null, c[i], node);
      else diff(null, c, node);
      self.unsub(node), diff(node.cache = null, self)
    };
  }}).sub(node)
}

// updates single root, uses auxiliary frame for cleanup
class ManagedSubframe extends Frame {
  render(data, next, node, isFirst){
    if (RENDER_WORK) init || doWork(RENDER_WORK);
    if (isFirst) {
      cleanup(node);
      if (isArr(next)) {
        const c = node.cache = [], n = next.length;
        for (let i = next.length; i--;) c.push(diff(next[i], null, node))
      } else node.cache = diff(next, null, node)
    } else {
      if (isArr(next)) diff(next[next.length-1], node.cache[0], node);
      else diff(next, node.cache, node)
    }
  }
}

const factory = new TemplateFactory(Subframe);

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
    const temps = [], managedFrames = [], frames = [];
    cache[s] = { temps, managedFrames, frames };
    for (let i = 0; i < 8; i++) temps.push(factory[c](s));
    for (let i = 0; i < 3; i++) {
      const temp = factory[c](s-1);
      temp.name = ManagedSubframe;
      temps.push(temp)
    }
    cache[s].entRoot = makeEntangled(factory[c](s))
    cache[s].schedRoot = diff(factory[c](s))
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
        const { temps, entRoot, schedRoot, managedFrames, frames } = cases[c][s];
        let i = -1;
        const manTemp1 = temps.pop(), manTemp2 = temps.pop(), manTemp3 = temps.pop();
        const temp1 = temps.pop(), temp2 = temps.pop(), temp3 = temps.pop();
        const entTemp1 = temps.pop(), entTemp2 = temps.pop();
        entTemp1.next = entTemp2.next = null;
        const memoTemp1 = Object.assign({}, temp1), memoTemp2 = Object.assign({}, temp1);
        const state3 = temps.pop().next;
        const state4 = temps.pop().next;
        const state5 = temps.pop().next;
        run("mount managed", () => managedFrames[++i] = diff(manTemp1)), i = -1;
        run("update 1 managed child", () => diff(++i%2 ? manTemp2 : manTemp3, managedFrames[0])), i = -1;
        run("unmount managed", () => diff(null, managedFrames[++i])), i = -1;
        run("mount", () => frames[++i] = diff(temp1)), i = -1;
        run("update", () => diff(++i%2 ? temp2 : temp3, frames[0])), i = -1;
        run("update memoized", () => diff(++i%2 ? memoTemp1 : memoTemp2, frames[0])), i = -1;
        run("unmount", () => diff(null, frames[++i])), i = -1;
        run("update entangled", () => diff(++i%2 ? entTemp1 : entTemp2, entRoot)), i = -1;
        run("update sync", () => schedRoot.setState(++i%2 ? state4 : state5));
        run("schedule polycolor", () => schedRoot.setState(state3, --i));
        run("schedule monocolor", () => schedRoot.setState(state4, ++i === SAMPLES ? -1 : 1)), i = -1;
        run("schedule immediate", () => schedRoot.setState(state5, ++i === SAMPLES ? -1 : 0)), i = -1;
        runAsync("update async", done => {
          schedRoot.setState(++i%2 ? state4 : state3, 0)
          asap(done)
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
      const cur = cases[c][s];
      const { temps, entRoot, schedRoot, managedFrames, frames } = cur;
      expect(temps).to.be.empty;
      expect(count(schedRoot)).to.equal(s);
      expect(count(entRoot)).to.equal(1);
      diff(null, schedRoot)
      diff(null, entRoot);
      for (let i = SAMPLES; i--;) {
        expect(frames[i].temp).to.be.null
        expect(managedFrames[i].temp).to.be.null
        expect(count(frames[i])).to.equal(1);
        expect(count(managedFrames[i])).to.equal(1);
      }
      managedFrames.length = frames.length = 0;
    }
  }
  gc();
  printHeap();
})
