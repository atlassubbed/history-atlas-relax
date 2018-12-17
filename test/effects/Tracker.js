// Tracker is used to log mutation events in order.
//   * many edit permuations may lead to a correct outcome
//     use this effect when the order matters
//   * when testing final trees, use Renderer instead
module.exports = class Tracker {
  constructor(events){
    this.events = events; 
  }
  log(type, f){
    const e = {[type]: f._id != null ? f._id : f.temp.data.id};
    this.events.push(e);
  }
  willReceive(f){this.log("mWR", f)}
  willMove(f){this.log("mWM", f)}
  willAdd(f){f._id = f.temp.data.id, this.log("mWA", f)}
  willRemove(f){this.log("mWP", f)}
}
