const field = {};

// "field" is defined as a collection of oscillators 
//   * data structure: maps tau -> doubly-linked frames (O(1) insert/remove)
//   * nodes with pending updates become "excited"
//   * nodes of the same frequency "oscillate coherently"
//   * during a diff cycle, affected nodes "relax"

let asap = typeof Promise === "function" ? Promise.resolve() : false;
asap = asap && asap.then.bind(asap);
const reject = e => setTimeout(() => {throw e}); // i don't like this

// XXX ideally we would have three separate relax functions:
//   * relax(f) for normal relaxation
//   * prelax(f, tau) when relaxing right before excitation
//   * relaxAll(tau) when relaxing all oscillators for tau
// but we'll keep the internal API and file size small by overloading relax
const relax = (f, tau, t) => {
  if (t = f.top){
    if (t.bot = f.bot) f.bot.top = t;
    else if (t === field[t.tau] && t.tau !== tau)
      field[t.tau] = t.timer && clearTimeout(t.timer);
    return f.top = f.bot = null, f;
  }
  // XXX this allows us to get rid of "pop"
  // if (t = f ? f.top : field[tau]){
  //   if (!f) f = t.bot, tau = null; // code smell
  //   if (t.bot = f.bot) f.bot.top = t;
  //   else if (t === field[t.tau] && t.tau !== tau) 
  //     field[t.tau] = t.timer && clearTimeout(t.timer);
  //   return f.top = f.bot = null, f;
  // }
}
const excite = (f, tau, cb, t) => {
  relax(f, tau), t = field[tau] = field[tau] || 
    {tau, timer: tau || !asap ? setTimeout(cb(tau), tau) : !asap(cb(tau)).catch(reject)};
  if (t.bot) (f.bot = t.bot).top = f;
  (f.top = t).bot = f;
}

// XXX this results in an unecessary clearTimeout during fill path.
// not a huge deal, since timer has already gone off at this point.
const pop = tau => field[tau] && relax(field[tau].bot)

module.exports = { relax, excite, pop }
