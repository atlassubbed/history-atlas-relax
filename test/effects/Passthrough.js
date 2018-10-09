// PassThrough is used to attach useful lifecycle methods onto frames.
module.exports = class Passthrough {
  willReceive(f, t){f.willReceive && f.willReceive(f, t)}
  willAdd(f, p){f.willAdd && f.willAdd(f, p)}
  didAdd(f){f.didAdd && f.didAdd(f)}
  willUpdate(f){f.willUpdate && f.willUpdate(f)}
  didUpdate(f){f.didUpdate && f.didUpdate(f)}
}
