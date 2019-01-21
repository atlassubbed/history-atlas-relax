// Tracker is used to log mutation events in order.
//   * many edit permuations may lead to a correct outcome
//     use this effect when the order matters
//   * when testing final trees, use Renderer instead
module.exports = class Tracker {
  constructor(events){
    this.events = events; 
  }
  log(type, f, t=f.temp){
    const e = {[type]: t && t.data.id};
    this.events.push(e);
  }
  willReceive(f, t){this.log("mWR", f, t)}
  willMove(f){this.log("mWM", f)}
  willAdd(f, p, s, t){this.log("mWA", f, t)}
  willRemove(f, p, s, t){this.log("mWP", f, t)}
}
