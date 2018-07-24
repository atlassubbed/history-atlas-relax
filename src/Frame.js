const RSV = ["name", "data", "effects", "key"];
const nRSV = RSV.length;
const EMPTY = {};

// not to be instantiated by users
module.exports = class Frame {
  constructor(effect=EMPTY){
    this.species = Frame
    this.affector = this.affects = this.pos = this.shorts = this.state = null;
    if (effect !== EMPTY) for (let i = nRSV, k, v; i--;)
      this[k = RSV[i]] = (v = effect[k]) != null ? v : null
  }
  short(name, getEffects){

  }
  setState(){

  }
  setTau(){

  }
  evaluate(){
    return this.effects;
  }
  static isFrame(frame){
    return !!frame && frame instanceof Frame
  }
}
