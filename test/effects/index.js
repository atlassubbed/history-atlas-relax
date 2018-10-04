/* Effects (e.g. renderers) are pivotal to this library
   * We use effects in order to "self-test" the library.
   * Effects should be as dumb as possible, but not too dumb.
     * They should be able to requeue and proxy events.
     * They shouldn't have to do this; an effect can be a thoughtless worker.
   * Effects don't care about how the internal diff, subdiff, etc. functions work.
     * Effects are only concerned with whether or not they can maintain the correct state.
     * If they can't do this, then we must change the internal code until they can. */

module.exports = {
  Tracker: require("./Tracker"),
  Timer: require("./Timer"),
  Cache: require("./Cache"),
  Passthrough: require("./Passthrough"),
  ArrayRenderer: require("./ArrayRenderer"),
  LCRSRenderer: require("./LCRSRenderer")
}
