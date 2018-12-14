// Tracker is used to log lifecycle events in order.
//   * many edit permuations may lead to a correct outcome
//     use this effect when the order matters
//   * when testing final trees, use Renderer instead
module.exports = class Tracker {
  constructor(events){
    this.events = events; 
  }
  log(type, f){
    const e = {[type]: f.temp.data.id};
    this.events.push(e);
  }
  willReceive(f){this.log("wR", f)}
}
