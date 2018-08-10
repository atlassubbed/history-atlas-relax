// Tracker creates effects that track diffs.
module.exports = class Tracker {
  constructor(){this.events = []}
  reset(){this.events = []}
  willAdd(frame){this.capture("wA", frame)}
  // XXX assert that position, parent and child are correct?
  didAdd(frame){this.capture("dA", frame)}
  willReceive(frame, data){this.capture("wRD", frame, {data})}
  willUpdate(frame, data){this.capture("wU", frame, {data})}
  didUpdate(frame, data){this.capture("dU", frame, {data})}
  willRemove(frame){this.capture("wR", frame)}
  // XXX assert that position, parent and child are correct?
  didRemove(frame){this.capture("dR", frame)}
  capture(type, frame, meta){
    let name = frame.name, id = frame.data;
    if (typeof name === "function") name = name.name;
    if (id && typeof id === "object") id = id.id
    this.events.push(Object.assign({[type]: name, id}, meta));
  }
}
