// Timer is used to record update times.
class Timer {
  constructor(events){
    this.events = events;
    this.start = Date.now()
  }
  log(type, f){
    const e = {[type]: f.temp.data.id};
    e.dt = Date.now() - this.start;
    e.tau = f.tau;
    e.state = f.state && Object.assign({}, f.state);
    this.events.push(e);
  }
  willReceive(f){this.log("wR", f)}
  willUpdate(f){this.log("wU", f)}
  didUpdate(f){this.log("dU", f)}
}

class FullTimer extends Timer {
  willAdd(f){this.log("wA", f)};
  didAdd(f){this.log("dA", f)}
}

module.exports = { Timer, FullTimer }
