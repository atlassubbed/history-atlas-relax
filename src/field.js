const field = {};

// "field" is defined as a collection of oscillators 
//   * data structure: maps tau -> doubly-linked frames (O(1) insert/remove)
//   * nodes with pending updates become "excited"
//   * nodes of the same frequency "oscillate coherently"
//   * during a diff cycle, affected nodes "relax"

// TODO: remove this check for Promise, since we can just rely on babel?
let asap = typeof Promise === "function" ? Promise.resolve() : false;
asap = asap && asap.then.bind(asap);
const reject = e => setTimeout(() => {throw e}); // i don't like this

// XXX ideally we would have two separate relax functions:
//   * relax(f) for normal relaxation
//   * prelax(f, tau) when relaxing right before excitation
// but we'll keep the internal API and file size small by overloading relax

// remove a node from an oscillator
const relax = (f, tau, t) => {
  if (t = f.top){
    if (t.bot = f.bot) f.bot.top = t;
    else if (t === field[t.tau] && t.tau !== tau)
      field[t.tau] = t.timer && clearTimeout(t.timer);
    f.top = f.bot = null;
  }
}

// add/move a node to an oscillator
const excite = (f, tau, cb, t) => {
  relax(f, tau), t = field[tau] = field[tau] || 
    {tau, timer: tau || !asap ? setTimeout(cb(tau), tau) : !asap(cb(tau)).catch(reject)};
  if (t.bot) (f.bot = t.bot).top = f;
  (f.top = t).bot = f;
}

// pop a triggered oscillator off the field
const pop = (tau, cb, f=field[tau]) => {
  if (f) while(f=f.bot) cb(f);
  field[tau] = null;
}

module.exports = { relax, excite, pop }
