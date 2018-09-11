const { Frame } = require("./Frame");

let curId = 0;

// XXX these aren't called a lot; prefer indexOf/splice? (O(|affects|))
Frame.prototype.entangle = function(f){
  if (f === this.parent || f === this) return;
  const affs = this.affs = this.affs || {};
  const id = f.id = f.id || ++curId;
  if (affs[id]) return;
  (f.affects = f.affects || []).push(this)
  this.affCount++, affs[id] = f;
}
Frame.prototype.detangle = function(f){
  const affs = this.affs, id = f.id;
  if (!affs || !affs[id]) return;
  affs[id] = null
  if (!--this.affCount) this.affs = null;
}
