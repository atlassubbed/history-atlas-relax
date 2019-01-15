// Timer is used to record update times.
// TODO: log didDiff events in timer, also
module.exports = class Timer {
  constructor(events){
    this.events = events;
    this.start = Date.now()
  }
  log(type, f){
    const e = {[type]: f.temp.data.id};
    e.dt = Date.now() - this.start;
    e.state = f.state && Object.assign({}, f.state);
    this.events.push(e);
  }
  willReceive(f){this.log("wR", f)}
}
