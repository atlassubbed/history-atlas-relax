// Tracker creates effects that track diffs.
module.exports = class Tracker {
  constructor(){this.events = []}
  reset(){this.events = []}
  willAdd(frame){this.capture("willAdd", frame)}
  didAdd(frame){this.capture("didAdd", frame)}
  willReceive(frame, data){this.capture("willReceive", frame, {data})}
  willUpdate(frame, data){this.capture("willUpdate", frame, {data})}
  didUpdate(frame, data){this.capture("didUpdate", frame, {data})}
  willRemove(frame){this.capture("willRemove", frame)}
  didRemove(frame){this.capture("didRemove", frame)}
  capture(type, frame, meta){
    let name = frame.name, id = frame.data;
    if (typeof name === "function") name = name.name;
    if (id && typeof id === "object") id = id.id;
    this.events.push(Object.assign({[type]: name, id}, meta));
  }
}
