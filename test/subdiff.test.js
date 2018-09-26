const { prevCases, nextCases } = require("./cases/subdiff");

// for each prev case, test diffing into each next case
// use a dumb, brute force (probably quadratic) method to figure out expected moves/matches
// the linear-time subdiff algorithm should achieve the same result