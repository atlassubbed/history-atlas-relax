// Tracker is used to log lifecycle events in order.
//   * many edit permuations may lead to a correct outcome
//     use this effect when the order matters
//   * when testing final trees, use Renderer instead
module.exports = class Tracker {
  constructor(events){
    this.events = events; 
    this.root = null;
  }
  log(type, f){
    const e = {[type]: f.temp.data.id};
    this.events.push(e);
  }
  willAdd(f, p){
    this.log("wA", f)
    if (!p) this.root = f
  }
  willRemove(f){this.log("wP", f)}
  willReceive(f){this.log("wR", f)}
  didAdd(f){this.log("dA", f)}
  willUpdate(f){this.log("wU", f)}
  didUpdate(f){this.log("dU", f)}
}
