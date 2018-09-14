const { describe, it, before } = require("mocha")
const { expect } = require("chai")
const { Timer } = require("./Effects");
const { diff } = require("../src/index");
const { Oscillator } = require("./cases/Frames");
const { 
  states, pTrans, cTrans, 
  parentCases, parentFirstCases,
  childCases, childFirstCases,
  doubleCases, dynamicTauCases
} = require("./cases/schedule");
const { isFn, pretty } = require("./util");
const DeferredTests = require("./DeferredTests")

const allCases = [...parentCases, ...parentFirstCases, ...childCases, ...childFirstCases, ...doubleCases];
const h = Oscillator.h;

// don't test doing this during diffs yet.

// timescale config
const T = 500
const CHECK = T*5; // at least 4T
const ALLOW = T*6; // at least CHECK
const ASYNC_ERROR = t => t ? t*.1 : 15 // setTimeout(0) given leeway
const SYNC_ERROR = 4

const mount = (pTau, cTau, events) => {
  const t = h(0, pTau, h(1, cTau));
  const f = diff(t, null, events && new Timer(events))
  return { p: f, c: f.children[0]}
}
const entangle = (pTau, cTau, events) => {
  const t1 = h(0, pTau), f1 = diff(t1, null, events && new Timer(events));
  const t2 = h(1, cTau), f2 = diff(t2, null, events && new Timer(events));
  f2.entangle(f1);
  return { p: f1, c: f2 }
}

const hypot = (a, b) => Math.sqrt(a*a + b*b);

// XXX this warrants its own test, so it needs to be rewritten.
const verify = (events, expected) => {
  expect(events.length).to.be.at.least(expected.length, pretty(events));
  let m = 0;
  for (let e of events){
    const a = expected[m];
    if (e.wU == null && e.dU == null || a.wU !== e.wU || a.dU !== e.dU) continue;
    expect(e.state).to.deep.equal(a.state);
    if (e.wU != null){
      expect(e.tau).to.equal(a.tau);
      if (a.dt < 0) expect(e.dt).to.be.closeTo(0, SYNC_ERROR);
      else expect(e.dt).to.be.closeTo(a.dt, ASYNC_ERROR(a.dt))
    }
    m++;
  }
  expect(m).to.equal(expected.length, pretty(events));
}

describe.only("scheduling", function(){
  this.timeout(ALLOW);
  // first, we create a "describe-block skeleton" of the tests we want to run
  //   * building the tree directly allows us to avoid group/sort later
  const tests = buildMochaScaffold();
  
  // second, we run every simulation case in our skeleton to "flesh out" the skeleton with results.
  before(function(done){
    tests.forEach(testCase => {
      const { isEntangled, pTau, cTau } = testCase;
      let events = testCase.events = [];
      const { p, c } = (isEntangled ? entangle : mount)(pTau, cTau, events);
      testCase.action(p, c);
    })
    setTimeout(() => {
      done();
    }, CHECK)
  })

  // third, we generate the actual mocha describe-it tests and verify simulation results
  tests.forEach(testCase => {
    it(testCase.desc, function(){
      verify(testCase.events, testCase.result())
    })
  }, describe)
})

// XXX without the hideous setup code below, these tests take 100 times longer to execute
//   * all of these tests are time consuming and independent of each other
//     * total time taken ~ 5N*T = 5*250*.05 seconds ~ 1 minute
//     * decreasing T is not an option because variance(time) ~ 1/T
//   * mocha does not make it easy to write concurrent async tests
//     * with the DeferredTests skeleton, we run every simulation simulataneously (concurrently)
//     * total time taken becomes ~ 5*T
//     * this allows us to increase T to .5s and enjoy lower variance (higher confidence)

function buildMochaScaffold(){
  const scaffold = new DeferredTests;
  // state upsert functions
  const incr = init => state => state.n ? state.n++ : (state.n = init);
  const incr0 = incr(0);
  const incr1 = incr(1);
  states.forEach(({phase, p, c}, i) => {
    phase = phase.replace("p", "tau_p").replace("c", "tau_c");
    const pTau = p(T), cTau = c(T) <= 0 ? c(T) : T
    scaffold.describe(`phase ${phase}`, () => {
      [false, true].forEach(isEntangled => {
        const makeCase = testCase => Object.assign({isEntangled, pTau, cTau}, testCase);
        scaffold.describe(`where p is root and c is ${isEntangled ? "entangled root" : "child"}`, () => {
          allCases.forEach(({name, action, result, filter}) => {
            if (!filter(pTau, cTau)) return;
            const state = () => [{n: 0}, {n: 1}];
            scaffold.push(makeCase({
              desc: `should ${name}`,
              action: (p, c) => action(p, c, state()),
              result: () => result(pTau, cTau, state())
            }))
            scaffold.push(makeCase({
              desc: `should ${name} (via function)`,
              action: (p, c) => action(p, c, [incr0, incr1]),
              result: () => result(pTau, cTau, state())
            }))
          })
          pTrans[i].forEach((isAdj, j) => {
            if (!isAdj) return;
            let {phase: nextPhase, p: nextP, c: nextC} = states[j]
            nextPhase = nextPhase.replace("p", "tau_p").replace("c", "tau_c");
            const pTauNext = nextC(T) <= 0 && nextP(T) > 0 ? nextP(T) : nextP(cTau)
            const state = () => [{n: 0}]
            parentCases.forEach(({name, action, result, filter}) => {
              if (!filter(pTauNext, cTau)) return;
              scaffold.push(makeCase({
                desc: `should move into new phase when new tau is set on p such that ${nextPhase}`,
                action: (p, c) => (p.setTau(pTauNext), action(p, c, state())),
                result: () => result(pTauNext, cTau, state())
              }))
              if (pTau < 0) return;
              const msg = `${pTauNext < 0 ? "immediately apply" : "reschedule"}`
              scaffold.push(makeCase({
                desc: `should ${msg} pending updates when new tau is set on p such that ${nextPhase}`,
                action: (p, c) => (action(p, c, state()), p.setTau(pTauNext)),
                result: () => result(pTauNext, cTau, state())
              }))          
            })
          })
          cTrans[i].forEach((isAdj, j) => {
            if (!isAdj) return;
            let {phase: nextPhase, p: nextP, c: nextC} = states[j];
            nextPhase = nextPhase.replace("p", "tau_p").replace("c", "tau_c");
            const cTauNext = nextP(T) <= 0 && nextC(T) > 0 ? nextC(T) : nextC(pTau)
            const state = () => [{n: 0}]
            childCases.forEach(({name, action, result, filter}) => {
              if (!filter(pTau, cTauNext)) return;
              scaffold.push(makeCase({
                desc: `should move into new phase when new tau is set on c such that ${nextPhase}`,
                action: (p, c) => (c.setTau(cTauNext), action(p, c, state())),
                result: () => result(pTau, cTauNext, state())
              }))
              if (cTau < 0) return;
              const msg = `${cTauNext < 0 ? "immediately apply" : "reschedule"}`
              scaffold.push(makeCase({
                desc: `should ${msg} pending updates when new tau is set on c such that ${nextPhase}`,
                action: (p, c) => (action(p, c, state()), c.setTau(cTauNext)),
                result: () => result(pTau, cTauNext, state())
              }))
            }) 
          })
          if (isEntangled) return; // tau doesn't propagate to entangled frames
          scaffold.describe("setting new tau on p when c has a dynamic tau getter and both have pending updates", () => {
            pTrans[i].forEach((isAdj, j) => {
              if (pTau < 0 || cTau < 0) return;
              let {phase: nextPhase, p: nextP, c: nextC} = states[j];
              if ((!pTau && !nextP(T)) || (!cTau && !nextC(T))) return;
              nextPhase = nextPhase.replace("p", "tau_p").replace("c", "tau_c");
              let NT;
              if (!pTau && !cTau) NT = T;
              else if (!pTau || !cTau) NT = hypot(pTau || cTau, pTau || cTau)
              else if (pTau === cTau) NT = hypot(pTau, cTau);
              else NT = (pTau + cTau)/2
              const pTauNext = nextP(NT)
              const getCTau = function(next){
                return next <= 0 && nextC(NT) > 0 ? nextC(NT) : nextC(next)
              }
              const cTauNext = getCTau(pTauNext);
              const state = () => [{n: 0}, {n: 1}]
              dynamicTauCases.forEach(({name, action, result, filter}) => {
                if (!filter(pTauNext, cTauNext)) return; 
                scaffold.push(makeCase({
                  desc: `should ${name} such that new ${nextPhase}`,
                  action: (p, c) => (action(p, c, state()), c.getTau = getCTau.bind(c), p.setTau(pTauNext)),
                  result: () => result(pTauNext, cTauNext, state()),
                }))     
              })
            })
          })
        })
      })
    })
  })
  return scaffold;
}
