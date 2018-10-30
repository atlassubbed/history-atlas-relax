const { describe, it, before } = require("mocha")
const { expect } = require("chai")
const { FullTimer, Passthrough } = require("./effects");
const { diff } = require("../src/index");
const { StemCell, Oscillator } = require("./cases/Frames");
const { pretty } = require("./util");
const DeferredTests = require("./DeferredTests")

const T = 500
const CHECK = T*3; // at least 2T
const ALLOW = T*4; // at least CHECK
const ASYNC_ERROR = t => t ? t*.1 : 25 // setTimeout(0) given leeway
const SYNC_ERROR = 10
const taus = [-1, 0, T];
const preAdd = ["ctor", "willAdd"];

const disjoinTime = event => {
  const ev = {}, copy = {event: ev, time: event.dt};
  for (let f in event) if (f !== "dt") ev[f] = event[f];
  return copy;
}
const verify = (events, expected) => {
  let n = events.length;
  expect(n).to.equal(expected.length, pretty(events));
  for (let i = 0; i < n; i++){
    const actual = disjoinTime(events[i]), exp = disjoinTime(expected[i]);
    expect(actual.event).to.deep.equal(exp.event);
    if (exp.time < 0) expect(actual.time).to.be.closeTo(0, SYNC_ERROR);
    else expect(actual.time).to.be.closeTo(exp.time, ASYNC_ERROR(exp.time));
  }
} 

const h = StemCell.h, p = Oscillator.p;
const data = (hook, job) => ({[hook]: function(){job(this)}})

describe("multidiff", function(){
  this.timeout(ALLOW);
  const tests = buildMochaScaffold();
    before(function(done){
    tests.forEach(testCase => {
      const { task } = testCase;
      let events = testCase.events = [];
      testCase.task([new Passthrough, new FullTimer(events)]);
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
  preAdd.forEach(hook => {
    scaffold.describe(`calling setState during ${hook}`, () => {
      taus.forEach(tau => {
        const rel = tau < 0 ? "<" : tau > 0 ? ">" : "===", id = 0;
        scaffold.push({
          desc: `should immediately reflect new state without triggering a new update for tau ${rel} 0 nodes`,
          task: effs => {
            diff(h(id, data(hook, f => f.setState({n: 0}))), null, {effs, tau: tau})
          },
          result: [
            {wA: id, dt: -1, tau, state: {n: 0}}, {dA: id, dt: -1, tau, state: {n: 0}}
          ]
        })
        scaffold.push({
          desc: `should immediately coalesce all new state updates without triggering a new update for tau ${rel} 0 nodes`,
          task: effs => {
            const job = f => {f.setState({n: 0}), f.setState({n: 1})}
            diff(h(id, data(hook, job)), null, {effs, tau: tau})
          },
          result: [
            {wA: id, dt: -1, tau, state: {n: 1}}, {dA: id, dt: -1, tau, state: {n: 1}}
          ]
        })
      })
    })
  })
  scaffold.describe(`calling setState during diff`, () => {
    taus.forEach(tau => {
      const rel = tau < 0 ? "<" : tau > 0 ? ">" : "===", id = 0;
      scaffold.push({
        desc: `should immediately reflect new state in postorder events without triggering a new update for tau ${rel} 0 nodes`,
        task: effs => {
          diff(h(id, data("diff", f => f.setState({n: 0}))), null, {effs, tau: tau})
        },
        result: [
          {wA: id, dt: -1, tau, state: null}, {dA: id, dt: -1, tau, state: {n: 0}}
        ]
      })
      scaffold.push({
        desc: `should immediately coalesce all new state updates in postorder events without triggering a new update for tau ${rel} 0 nodes`,
        task: effs => {
          const job = f => {f.setState({n: 0}), f.setState({n: 1})}
          diff(h(id, data("diff", job)), null, {effs, tau: tau})
        },
        result: [
          {wA: id, dt: -1, tau, state: null}, {dA: id, dt: -1, tau, state: {n: 1}}
        ]
      })
    })
  })
  scaffold.describe(`calling setState during willReceive`, () => {
    taus.forEach(tau => {
      const rel = tau < 0 ? "<" : tau > 0 ? ">" : "===", id = 0;
      scaffold.push({
        desc: `should immediately reflect new state without triggering a new update for tau ${rel} 0 nodes`,
        task: effs => {
          const f = diff(h(id, data("willReceive", f => f.setState({n: 0}))), null, {effs, tau: tau});
          diff(h(id), f);
        },
        result: [
          {wA: id, dt: -1, tau, state: null}, {dA: id, dt: -1, tau, state: null},
          {wR: id, dt: -1, tau, state: {n: 0}},
          {wU: id, dt: -1, tau, state: {n: 0}}, {dU: id, dt: -1, tau, state: {n: 0}}
        ]
      })
      scaffold.push({
        desc: `should immediately coalesce all new state updates without triggering a new update for tau ${rel} 0 nodes`,
        task: effs => {
          const job = f => {f.setState({n: 0}), f.setState({n: 1})}
          const f = diff(h(id, data("willReceive", job)), null, {effs, tau: tau});
          diff(h(id), f);
        },
        result: [
          {wA: id, dt: -1, tau, state: null}, {dA: id, dt: -1, tau, state: null},
          {wR: id, dt: -1, tau, state: {n: 1}},
          {wU: id, dt: -1, tau, state: {n: 1}}, {dU: id, dt: -1, tau, state: {n: 1}}
        ]
      })
    })
  })
  scaffold.describe(`calling setState during willUpdate`, () => {
    taus.forEach(tau => {
      const rel = tau < 0 ? "<" : tau > 0 ? ">" : "===", id = 0;
      scaffold.push({
        desc: `should immediately reflect new state without triggering a new update for tau ${rel} 0 nodes`,
        task: effs => {
          const f = diff(h(id, data("willUpdate", f => f.setState({n: 0}))), null, {effs, tau: tau});
          diff(h(id), f);
        },
        result: [
          {wA: id, dt: -1, tau, state: null}, {dA: id, dt: -1, tau, state: null},
          {wR: id, dt: -1, tau, state: null},
          {wU: id, dt: -1, tau, state: {n: 0}}, {dU: id, dt: -1, tau, state: {n: 0}}
        ]
      })
      scaffold.push({
        desc: `should immediately coalesce all new state updates without triggering a new update for tau ${rel} 0 nodes`,
        task: effs => {
          const job = f => {f.setState({n: 0}), f.setState({n: 1})}
          const f = diff(h(id, data("willUpdate", job)), null, {effs, tau: tau});
          diff(h(id), f);
        },
        result: [
          {wA: id, dt: -1, tau, state: null}, {dA: id, dt: -1, tau, state: null},
          {wR: id, dt: -1, tau, state: null},
          {wU: id, dt: -1, tau, state: {n: 1}}, {dU: id, dt: -1, tau, state: {n: 1}}
        ]
      })
    })
  })
  scaffold.describe(`calling setState during didAdd`, () => {
    taus.forEach(tau => {
      const rel = tau < 0 ? "<" : tau > 0 ? ">" : "===", id = 0;
      scaffold.push({
        desc: `should update the node in a future diff cycle for tau ${rel} 0 nodes`,
        task: effs => {
          diff(h(id, data("didAdd", f => f.setState({n:0}))), null, {effs, tau: tau});
        },
        result: [
          {wA: id, dt: -1, tau, state: null}, {dA: id, dt: -1, tau, state: null},
          {wU: id, dt: tau, tau, state: {n: 0}}, {dU: id, dt: tau, tau, state: {n: 0}}
        ]
      })
      scaffold.push({
        desc: `should coalesce all state updates into a future diff cycle for tau ${rel} 0 nodes`,
        task: effs => {
          const job1 = f => {f.setState({n: 0}), f.setState({n: 1})}
          const t1 = h(1, data("didAdd", job1)), t2 = h(2, data("didAdd", f => f.setState({n: 2})));
          diff(h(id, null, [t1, t2]), null, {effs, tau: tau})
        },
        result: [
          {wA: id, dt: -1, tau, state: null}, 
          {wA: 1, dt: -1, tau, state: null},
          {wA: 2, dt: -1, tau, state: null},
          {dA: 1, dt: -1, tau, state: null},
          {dA: 2, dt: -1, tau, state: null},
          {dA: id, dt: -1, tau, state: null},
          {wU: 2, dt: tau, tau, state: {n: 2}},
          {wU: 1, dt: tau, tau, state: {n: 1}}, 
          {dU: 1, dt: tau, tau, state: {n: 1}},
          {dU: 2, dt: tau, tau, state: {n: 2}}
        ]
      })
    })
    scaffold.push({
      desc: `should coalesce state updates into the same future diff cycle for tau < 0 and tau === 0 nodes`,
      task: effs => {
        const d1 = {hooks: data("didAdd", f => {f.setState({n: 0}), f.setState({n: 1})}), tau: 0};
        const d2 = {hooks: data("didAdd", f => f.setState({n:2})), tau: -1};
        diff(h(0, null, [p(1, d1), p(2, d2)]), null, {effs})
      },
      result: [
        {wA: 0, dt: -1, tau: -1, state: null}, 
        {wA: 1, dt: -1, tau: 0, state: null},
        {wA: 2, dt: -1, tau: -1, state: null},
        {dA: 1, dt: -1, tau: 0, state: null},
        {dA: 2, dt: -1, tau: -1, state: null},
        {dA: 0, dt: -1, tau: -1, state: null},
        {wU: 2, dt: 0, tau: -1, state: {n: 2}},
        {wU: 1, dt: 0, tau: 0, state: {n: 1}}, 
        {dU: 1, dt: 0, tau: 0, state: {n: 1}},
        {dU: 2, dt: 0, tau: -1, state: {n: 2}}
      ]
    })
    scaffold.push({
      desc: `should separate state updates into different future diff cycles for different frequency nodes`,
      task: effs => {
        const d1 = {hooks: data("didAdd", f => {f.setState({n: 0}), f.setState({n: 1})}), tau: T};
        const d2 = {hooks: data("didAdd", f => f.setState({n:2})), tau: -1};
        diff(h(0, null, [p(1, d1), p(2, d2)]), null, {effs})
      },
      result: [
        {wA: 0, dt: -1, tau: -1, state: null}, 
        {wA: 1, dt: -1, tau: T, state: null},
        {wA: 2, dt: -1, tau: -1, state: null},
        {dA: 1, dt: -1, tau: T, state: null},
        {dA: 2, dt: -1, tau: -1, state: null},
        {dA: 0, dt: -1, tau: -1, state: null},
        {wU: 2, dt: 0, tau: -1, state: {n: 2}},
        {dU: 2, dt: 0, tau: -1, state: {n: 2}},
        {wU: 1, dt: T, tau: T, state: {n: 1}}, 
        {dU: 1, dt: T, tau: T, state: {n: 1}}
      ]
    })
  })
  scaffold.describe(`calling setState during didUpdate`, () => {
    taus.forEach(tau => {
      const rel = tau < 0 ? "<" : tau > 0 ? ">" : "===", id = 0;
      scaffold.push({
        desc: `should update the node in a future diff cycle for tau ${rel} 0 nodes`,
        task: effs => {
          const f = diff(h(id, data("didUpdate", f => f.state || f.setState({n:0}))), null, {effs, tau: tau});
          diff(h(id), f)
        },
        result: [
          {wA: id, dt: -1, tau, state: null}, {dA: id, dt: -1, tau, state: null},
          {wR: id, dt: -1, tau, state: null},
          {wU: id, dt: -1, tau, state: null}, {dU: id, dt: -1, tau, state: null},
          {wU: id, dt: tau, tau, state: {n: 0}}, {dU: id, dt: tau, tau, state: {n: 0}}
        ]
      })
      scaffold.push({
        desc: `should coalesce all state updates into a future diff cycle for tau ${rel} 0 nodes`,
        task: effs => {
          const job1 = f => {if (!f.state) f.setState({n: 0}), f.setState({n: 1});}
          const t1 = h(1, data("didUpdate", job1)), t2 = h(2, data("didUpdate", f => f.state || f.setState({n: 2})));
          const f = diff(h(id, null, [t1, t2]), null, {effs, tau: tau});
          diff(h(id, null, [h(1), h(2)]), f)
        },
        result: [
          {wA: id, dt: -1, tau, state: null}, 
          {wA: 1, dt: -1, tau, state: null},
          {wA: 2, dt: -1, tau, state: null},
          {dA: 1, dt: -1, tau, state: null},
          {dA: 2, dt: -1, tau, state: null},
          {dA: id, dt: -1, tau, state: null},
          {wR: id, dt: -1, tau, state: null},
          {wU: id, dt: -1, tau, state: null},
          {wR: 1, dt: -1, tau, state: null},
          {wR: 2, dt: -1, tau, state: null},
          {wU: 2, dt: -1, tau, state: null},
          {wU: 1, dt: -1, tau, state: null}, 
          {dU: 1, dt: -1, tau, state: null},
          {dU: 2, dt: -1, tau, state: null},
          {dU: id, dt: -1, tau, state: null},
          {wU: 2, dt: tau, tau, state: {n: 2}},
          {wU: 1, dt: tau, tau, state: {n: 1}}, 
          {dU: 1, dt: tau, tau, state: {n: 1}},
          {dU: 2, dt: tau, tau, state: {n: 2}}
        ]
      })
    })
    scaffold.push({
      desc: `should coalesce state updates into the same future diff cycle for tau < 0 and tau === 0 nodes`,
      task: effs => {
        const d1 = {hooks: data("didUpdate", f => {if (!f.state) f.setState({n: 0}), f.setState({n: 1});}), tau: 0};
        const d2 = {hooks: data("didUpdate", f => f.state || f.setState({n:2})), tau: -1};
        const f = diff(h(0, null, [p(1, d1), p(2, d2)]), null, {effs})
        diff(h(0, null, [p(1, d1), p(2, d2)]), f)
      },
      result: [
        {wA: 0, dt: -1, tau: -1, state: null}, 
        {wA: 1, dt: -1, tau: 0, state: null},
        {wA: 2, dt: -1, tau: -1, state: null},
        {dA: 1, dt: -1, tau: 0, state: null},
        {dA: 2, dt: -1, tau: -1, state: null},
        {dA: 0, dt: -1, tau: -1, state: null},
        {wR: 0, dt: -1, tau: -1, state: null},
        {wU: 0, dt: -1, tau: -1, state: null},
        {wR: 1, dt: -1, tau: 0, state: null},
        {wR: 2, dt: -1, tau: -1, state: null},
        {wU: 2, dt: -1, tau: -1, state: null},
        {wU: 1, dt: -1, tau: 0, state: null}, 
        {dU: 1, dt: -1, tau: 0, state: null},
        {dU: 2, dt: -1, tau: -1, state: null},
        {dU: 0, dt: -1, tau: -1, state: null},
        {wU: 2, dt: 0, tau: -1, state: {n: 2}},
        {wU: 1, dt: 0, tau: 0, state: {n: 1}}, 
        {dU: 1, dt: 0, tau: 0, state: {n: 1}},
        {dU: 2, dt: 0, tau: -1, state: {n: 2}}
      ]
    })
    scaffold.push({
      desc: `should separate state updates into different future diff cycles for different frequency nodes`,
      task: effs => {
        const d1 = {hooks: data("didUpdate", f => {if (!f.state) f.setState({n: 0}), f.setState({n: 1});}), tau: T};
        const d2 = {hooks: data("didUpdate", f => f.state || f.setState({n:2})), tau: -1};
        const f = diff(h(0, null, [p(1, d1), p(2, d2)]), null, {effs})
        diff(h(0, null, [p(1, d1), p(2, d2)]), f)
      },
      result: [
        {wA: 0, dt: -1, tau: -1, state: null}, 
        {wA: 1, dt: -1, tau: T, state: null},
        {wA: 2, dt: -1, tau: -1, state: null},
        {dA: 1, dt: -1, tau: T, state: null},
        {dA: 2, dt: -1, tau: -1, state: null},
        {dA: 0, dt: -1, tau: -1, state: null},
        {wR: 0, dt: -1, tau: -1, state: null},
        {wU: 0, dt: -1, tau: -1, state: null},
        {wR: 1, dt: -1, tau: T, state: null},
        {wR: 2, dt: -1, tau: -1, state: null},
        {wU: 2, dt: -1, tau: -1, state: null},
        {wU: 1, dt: -1, tau: T, state: null}, 
        {dU: 1, dt: -1, tau: T, state: null},
        {dU: 2, dt: -1, tau: -1, state: null},
        {dU: 0, dt: -1, tau: -1, state: null},
        {wU: 2, dt: 0, tau: -1, state: {n: 2}},
        {dU: 2, dt: 0, tau: -1, state: {n: 2}},
        {wU: 1, dt: T, tau: T, state: {n: 1}}, 
        {dU: 1, dt: T, tau: T, state: {n: 1}}
      ]
    })
  })
  scaffold.describe(`calling setTau during a diff cycle`, () => {
    taus.forEach(tau => {
      const rel = tau < 0 ? "<" : tau > 0 ? ">" : "===", id = 0;
      scaffold.push({
        desc: `should reschedule updates with new tau ${rel} 0 in a future diff for nodes that aren't in the render path`,
        task: effs => {
          const job = f => {if (!f.state) f.setState({n: 0}), f.setTau(tau);}
          const f = diff(h(id, data("didUpdate", job)), null, {effs, tau: T/2});
          diff(h(id), f);
        },
        result: [
          {wA: id, dt: -1, tau: T/2, state: null},
          {dA: id, dt: -1, tau: T/2, state: null},
          {wR: id, dt: -1, tau: T/2, state: null},
          {wU: id, dt: -1, tau: T/2, state: null},
          {dU: id, dt: -1, tau, state: null},
          {wU: id, dt: tau, tau, state: {n: 0}},
          {dU: id, dt: tau, tau, state: {n: 0}}
        ]
      })
      scaffold.push({
        desc: `should not reschedule updates with new tau ${rel} 0 for nodes that are still in the render path`,
        task: effs => {
          const job = f => {if (!f.state) f.setState({n: 0}), f.setTau(tau);}
          const f = diff(h(id, data("willUpdate", job)), null, {effs, tau: T/2});
          diff(h(id), f);
        },
        result: [
          {wA: id, dt: -1, tau: T/2, state: null},
          {dA: id, dt: -1, tau: T/2, state: null},
          {wR: id, dt: -1, tau: T/2, state: null},
          {wU: id, dt: -1, tau, state: {n: 0}},
          {dU: id, dt: -1, tau, state: {n: 0}},
        ]
      })
    })
    scaffold.push({
      desc: `should coalesce state updates into the same future diff cycle for nodes set to tau < 0 and tau === 0`,
      task: effs => {
        const j1 = data("didUpdate", f => {if (!f.state) f.setState({n: 1}), f.setTau(0);})
        const j2 = data("didUpdate", f => {if (!f.state) f.setState({n: 2}), f.setTau(-1);})
        const f = diff(h(0, null, [h(1, j1), h(2, j2)]), null, {effs, tau: T/2});
        diff(h(0, null, [h(1, j1), h(2, j2)]), f)
      },
      result: [
        {wA: 0, dt: -1, tau: T/2, state: null},
        {wA: 1, dt: -1, tau: T/2, state: null},
        {wA: 2, dt: -1, tau: T/2, state: null},
        {dA: 1, dt: -1, tau: T/2, state: null},
        {dA: 2, dt: -1, tau: T/2, state: null},
        {dA: 0, dt: -1, tau: T/2, state: null},
        {wR: 0, dt: -1, tau: T/2, state: null},
        {wU: 0, dt: -1, tau: T/2, state: null},
        {wR: 1, dt: -1, tau: T/2, state: null},
        {wR: 2, dt: -1, tau: T/2, state: null},
        {wU: 2, dt: -1, tau: T/2, state: null},
        {wU: 1, dt: -1, tau: T/2, state: null},
        {dU: 1, dt: -1, tau: 0, state: null},
        {dU: 2, dt: -1, tau: -1, state: null},
        {dU: 0, dt: -1, tau: T/2, state: null},
        {wU: 2, dt: 0, tau: -1, state: {n: 2}},
        {wU: 1, dt: 0, tau: 0, state: {n: 1}}, 
        {dU: 1, dt: 0, tau: 0, state: {n: 1}},
        {dU: 2, dt: 0, tau: -1, state: {n: 2}}
      ]
    })
    scaffold.push({
      desc: `should separate state updates into different future diff cycles for nodes set to different frequencies`,
      task: effs => {
        const j1 = data("didUpdate", f => {if (!f.state) f.setState({n: 1}), f.setTau(T);})
        const j2 = data("didUpdate", f => {if (!f.state) f.setState({n: 2}), f.setTau(-1);})
        const f = diff(h(0, null, [h(1, j1), h(2, j2)]), null, {effs, tau: T/2});
        diff(h(0, null, [h(1, j1), h(2, j2)]), f)
      },
      result: [
        {wA: 0, dt: -1, tau: T/2, state: null},
        {wA: 1, dt: -1, tau: T/2, state: null},
        {wA: 2, dt: -1, tau: T/2, state: null},
        {dA: 1, dt: -1, tau: T/2, state: null},
        {dA: 2, dt: -1, tau: T/2, state: null},
        {dA: 0, dt: -1, tau: T/2, state: null},
        {wR: 0, dt: -1, tau: T/2, state: null},
        {wU: 0, dt: -1, tau: T/2, state: null},
        {wR: 1, dt: -1, tau: T/2, state: null},
        {wR: 2, dt: -1, tau: T/2, state: null},
        {wU: 2, dt: -1, tau: T/2, state: null},
        {wU: 1, dt: -1, tau: T/2, state: null},
        {dU: 1, dt: -1, tau: T, state: null},
        {dU: 2, dt: -1, tau: -1, state: null},
        {dU: 0, dt: -1, tau: T/2, state: null},
        {wU: 2, dt: 0, tau: -1, state: {n: 2}},
        {dU: 2, dt: 0, tau: -1, state: {n: 2}},
        {wU: 1, dt: T, tau: T, state: {n: 1}}, 
        {dU: 1, dt: T, tau: T, state: {n: 1}}
      ]
    })
  })
  return scaffold;
}
