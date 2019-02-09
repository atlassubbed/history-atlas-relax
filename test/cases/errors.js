const { Frame } = require("../../src/index");

class BadCtor extends Frame {
  constructor(temp, effs){
    super(temp, effs)
    throw new Error("ctor");
  }
}
class BadMount extends Frame {
  render(temp, node, isFirst){
    if (Frame.isFrame(this) && isFirst) throw new Error("mount");
  }
}
class BadUpdate extends Frame {
  render(temp, node, isFirst){
    if (Frame.isFrame(this) && !isFirst) throw new Error("update");
  }
}
class ErrorBoundary extends Frame {
  catch(err){
    this.err = err;
    this.diff();
  }
  render(temp){
    return this.err ? {name: "error", data: {id: "err"}} : temp.next;
  }
}
class BadCtorBoundary extends ErrorBoundary {
  constructor(temp, effs){
    super(temp, effs)
    throw new Error("ctor");
  }
}
class BadMountBoundary extends ErrorBoundary {
  render(temp){
    if (this.err){
      return {name: BadMounter}
    } else return temp.next;
  }
}
class BadUpdateBoundary extends ErrorBoundary {
  render(temp){
    if (this.err){
      return {name: BadUpdater}
    } else return temp.next;
  }
}

module.exports = { 
  BadCtor, BadMount, BadUpdate, ErrorBoundary, 
  BadCtorBoundary, BadMountBoundary, BadUpdateBoundary
};
