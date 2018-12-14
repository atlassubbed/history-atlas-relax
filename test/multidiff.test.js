const { describe, it, before } = require("mocha")
const { expect } = require("chai")
const { Timer } = require("./effects");
const { diff } = require("../src/index");
const { StemCell } = require("./cases/Frames");
const DeferredTests = require("./DeferredTests")
const { ALLOW, CHECK, T, taus, verify } = require("./time");

const initialHooks = ["ctor", "willAdd"];
const p = StemCell.h
const h = (id, hooks, next) => p(id, {hooks}, next);
const hooks = (hook, job) => ({[hook]: function(){job(this)}})

describe("multidiff", function(){
  this.timeout(ALLOW);
  const tests = buildMochaScaffold();
    before(function(done){
    tests.forEach(testCase => {
      const { task } = testCase;
      let events = testCase.events = [];
      testCase.task(new Timer(events));
    })
    setTimeout(() => {
      done();
    }, CHECK)
  })
  tests.forEach(testCase => {
    it(testCase.desc, function(){
      verify(testCase.events, testCase.result)
    })
  }, describe)
})

// XXX Can refactor these repetitive tests later. Let's just get them working for now.
function buildMochaScaffold(){
  const scaffold = new DeferredTests;
  initialHooks.forEach(hook => {
    scaffold.describe(`calling frame.diff during ${hook}`, () => {
      taus.forEach(tau => {
        const rel = tau < 0 ? "<" : tau > 0 ? ">" : "===", id = 0;
        scaffold.push({
          desc: `should immediately reflect new state without triggering a new update for tau ${rel} 0 nodes`,
          task: effs => {
            diff(h(id, hooks(hook, f => f.diff({n: 0}, tau))), null, {effs})
          },
          result: [
            {wA: id, dt: -1, state: {n: 0}}, {dA: id, dt: -1, state: {n: 0}}
          ]
        })
        scaffold.push({
          desc: `should immediately coalesce all new state updates without triggering a new update for tau ${rel} 0 nodes`,
          task: effs => {
            const job = f => {f.diff({n: 0}, tau), f.diff({n: 1}, tau)}
            diff(h(id, hooks(hook, job)), null, {effs})
          },
          result: [
            {wA: id, dt: -1, state: {n: 1}}, {dA: id, dt: -1, state: {n: 1}}
          ]
        })
      })
    })
  })
  scaffold.describe(`calling frame.diff during willUpdate`, () => {
    taus.forEach(tau => {
      const rel = tau < 0 ? "<" : tau > 0 ? ">" : "===", id = 0;
      scaffold.push({
        desc: `should immediately reflect new state without triggering a new update for tau ${rel} 0 nodes`,
        task: effs => {
          const f = diff(h(id, hooks("willUpdate", f => f.diff({n: 0}, tau))), null, {effs});
          diff(h(id), f);
        },
        result: [
          {wA: id, dt: -1, state: null}, {dA: id, dt: -1, state: null},
          {wR: id, dt: -1, state: null},
          {wU: id, dt: -1, state: {n: 0}}, {dU: id, dt: -1, state: {n: 0}}
        ]
      })
      scaffold.push({
        desc: `should immediately coalesce all new state updates without triggering a new update for tau ${rel} 0 nodes`,
        task: effs => {
          const job = f => {f.diff({n: 0}, tau), f.diff({n: 1}, tau)}
          const f = diff(h(id, hooks("willUpdate", job)), null, {effs});
          diff(h(id), f);
        },
        result: [
          {wA: id, dt: -1, state: null}, {dA: id, dt: -1, state: null},
          {wR: id, dt: -1, state: null},
          {wU: id, dt: -1, state: {n: 1}}, {dU: id, dt: -1, state: {n: 1}}
        ]
      })
    })
  })
  scaffold.describe(`calling frame.diff during didAdd`, () => {
    taus.forEach(tau => {
      const rel = tau < 0 ? "<" : tau > 0 ? ">" : "===", id = 0;
      scaffold.push({
        desc: `should update the node in a future diff cycle for tau ${rel} 0 nodes`,
        task: effs => {
          diff(h(id, hooks("didAdd", f => f.diff({n:0}, tau))), null, {effs});
        },
        result: [
          {wA: id, dt: -1, state: null}, {dA: id, dt: -1, state: null},
          {wU: id, dt: tau, state: {n: 0}}, {dU: id, dt: tau, state: {n: 0}}
        ]
      })
      scaffold.push({
        desc: `should coalesce all state updates into a future diff cycle for tau ${rel} 0 nodes`,
        task: effs => {
          const job1 = f => {f.diff({n: 0}, tau), f.diff({n: 1}, tau)}
          const t1 = h(1, hooks("didAdd", job1)), t2 = h(2, hooks("didAdd", f => f.diff({n: 2}, tau)));
          diff(h(id, null, [t1, t2]), null, {effs})
        },
        result: [
          {wA: id, dt: -1, state: null},
          {wA: 2, dt: -1, state: null},
          {wA: 1, dt: -1, state: null},
          {dA: 1, dt: -1, state: null},
          {dA: 2, dt: -1, state: null},
          {dA: id, dt: -1, state: null},
          {wU: 2, dt: tau, state: {n: 2}},
          {wU: 1, dt: tau, state: {n: 1}},
          {dU: 1, dt: tau, state: {n: 1}},
          {dU: 2, dt: tau, state: {n: 2}}
        ]
      })
    })
    scaffold.push({
      desc: `should coalesce state updates into the same future diff cycle for tau < 0 and tau === 0 nodes`,
      task: effs => {
        const d1 = {hooks: hooks("didAdd", f => {f.diff({n: 0}, 0), f.diff({n: 1}, 0)})};
        const d2 = {hooks: hooks("didAdd", f => f.diff({n:2}, -1))};
        diff(h(0, null, [p(1, d1), p(2, d2)]), null, {effs})
      },
      result: [
        {wA: 0, dt: -1, state: null},
        {wA: 2, dt: -1, state: null},
        {wA: 1, dt: -1, state: null},
        {dA: 1, dt: -1, state: null},
        {dA: 2, dt: -1, state: null},
        {dA: 0, dt: -1, state: null},
        {wU: 2, dt: 0, state: {n: 2}},
        {wU: 1, dt: 0, state: {n: 1}},
        {dU: 1, dt: 0, state: {n: 1}},
        {dU: 2, dt: 0, state: {n: 2}}
      ]
    })
    scaffold.push({
      desc: `should separate state updates into different future diff cycles for different frequency nodes`,
      task: effs => {
        const d1 = {hooks: hooks("didAdd", f => {f.diff({n: 0}, T), f.diff({n: 1}, T)})};
        const d2 = {hooks: hooks("didAdd", f => f.diff({n:2}, -1))};
        diff(h(0, null, [p(1, d1), p(2, d2)]), null, {effs})
      },
      result: [
        {wA: 0, dt: -1, state: null},
        {wA: 2, dt: -1, state: null},
        {wA: 1, dt: -1, state: null},
        {dA: 1, dt: -1, state: null},
        {dA: 2, dt: -1, state: null},
        {dA: 0, dt: -1, state: null},
        {wU: 2, dt: 0, state: {n: 2}},
        {dU: 2, dt: 0, state: {n: 2}},
        {wU: 1, dt: T, state: {n: 1}},
        {dU: 1, dt: T, state: {n: 1}}
      ]
    })
  })
  scaffold.describe(`calling frame.diff during didUpdate`, () => {
    taus.forEach(tau => {
      const rel = tau < 0 ? "<" : tau > 0 ? ">" : "===", id = 0;
      scaffold.push({
        desc: `should update the node in a future diff cycle for tau ${rel} 0 nodes`,
        task: effs => {
          const f = diff(h(id, hooks("didUpdate", f => f.state || f.diff({n:0}, tau))), null, {effs});
          diff(h(id), f)
        },
        result: [
          {wA: id, dt: -1, state: null}, {dA: id, dt: -1, state: null},
          {wR: id, dt: -1, state: null},
          {wU: id, dt: -1, state: null}, {dU: id, dt: -1, state: null},
          {wU: id, dt: tau, state: {n: 0}}, {dU: id, dt: tau, state: {n: 0}}
        ]
      })
      scaffold.push({
        desc: `should coalesce all state updates into a future diff cycle for tau ${rel} 0 nodes`,
        task: effs => {
          const job1 = f => {if (!f.state) f.diff({n: 0}, tau), f.diff({n: 1}, tau);}
          const t1 = h(1, hooks("didUpdate", job1)), t2 = h(2, hooks("didUpdate", f => f.state || f.diff({n: 2}, tau)));
          const f = diff(h(id, null, [t1, t2]), null, {effs});
          diff(h(id, null, [h(1), h(2)]), f)
        },
        result: [
          {wA: id, dt: -1, state: null},
          {wA: 2, dt: -1, state: null},
          {wA: 1, dt: -1, state: null},
          {dA: 1, dt: -1, state: null},
          {dA: 2, dt: -1, state: null},
          {dA: id, dt: -1, state: null},
          {wR: id, dt: -1, state: null},
          {wU: id, dt: -1, state: null},
          {wR: 1, dt: -1, state: null},
          {wR: 2, dt: -1, state: null},
          {wU: 2, dt: -1, state: null},
          {wU: 1, dt: -1, state: null},
          {dU: 1, dt: -1, state: null},
          {dU: 2, dt: -1, state: null},
          {dU: id, dt: -1, state: null},
          {wU: 2, dt: tau, state: {n: 2}},
          {wU: 1, dt: tau, state: {n: 1}},
          {dU: 1, dt: tau, state: {n: 1}},
          {dU: 2, dt: tau, state: {n: 2}}
        ]
      })
    })
    scaffold.push({
      desc: `should coalesce state updates into the same future diff cycle for tau < 0 and tau === 0 nodes`,
      task: effs => {
        const d1 = {hooks: hooks("didUpdate", f => {if (!f.state) f.diff({n: 0}, 0), f.diff({n: 1}, 0);})};
        const d2 = {hooks: hooks("didUpdate", f => f.state || f.diff({n:2}, -1))};
        const f = diff(h(0, null, [p(1, d1), p(2, d2)]), null, {effs})
        diff(h(0, null, [p(1, d1), p(2, d2)]), f)
      },
      result: [
        {wA: 0, dt: -1, state: null},
        {wA: 2, dt: -1, state: null},
        {wA: 1, dt: -1, state: null},
        {dA: 1, dt: -1, state: null},
        {dA: 2, dt: -1, state: null},
        {dA: 0, dt: -1, state: null},
        {wR: 0, dt: -1, state: null},
        {wU: 0, dt: -1, state: null},
        {wR: 1, dt: -1, state: null},
        {wR: 2, dt: -1, state: null},
        {wU: 2, dt: -1, state: null},
        {wU: 1, dt: -1, state: null},
        {dU: 1, dt: -1, state: null},
        {dU: 2, dt: -1, state: null},
        {dU: 0, dt: -1, state: null},
        {wU: 2, dt: 0, state: {n: 2}},
        {wU: 1, dt: 0, state: {n: 1}},
        {dU: 1, dt: 0, state: {n: 1}},
        {dU: 2, dt: 0, state: {n: 2}}
      ]
    })
    scaffold.push({
      desc: `should separate state updates into different future diff cycles for different frequency nodes`,
      task: effs => {
        const d1 = {hooks: hooks("didUpdate", f => {if (!f.state) f.diff({n: 0}, T), f.diff({n: 1}, T);})};
        const d2 = {hooks: hooks("didUpdate", f => f.state || f.diff({n:2}, -1))};
        const f = diff(h(0, null, [p(1, d1), p(2, d2)]), null, {effs})
        diff(h(0, null, [p(1, d1), p(2, d2)]), f)
      },
      result: [
        {wA: 0, dt: -1, state: null},
        {wA: 2, dt: -1, state: null},
        {wA: 1, dt: -1, state: null},
        {dA: 1, dt: -1, state: null},
        {dA: 2, dt: -1, state: null},
        {dA: 0, dt: -1, state: null},
        {wR: 0, dt: -1, state: null},
        {wU: 0, dt: -1, state: null},
        {wR: 1, dt: -1, state: null},
        {wR: 2, dt: -1, state: null},
        {wU: 2, dt: -1, state: null},
        {wU: 1, dt: -1, state: null},
        {dU: 1, dt: -1, state: null},
        {dU: 2, dt: -1, state: null},
        {dU: 0, dt: -1, state: null},
        {wU: 2, dt: 0, state: {n: 2}},
        {dU: 2, dt: 0, state: {n: 2}},
        {wU: 1, dt: T, state: {n: 1}},
        {dU: 1, dt: T, state: {n: 1}}
      ]
    })
  })
  return scaffold;
}
