/**
 * nosh - copyright(c) 2012 truepattern.
 * MIT Licensed
 */

/** Todo's 
 *  ================
 *  -  make it plugin based arch
 *  -  load the whole rest as a pluggable unit
 *  -  set the prompt configurable
 */

// dependencies
var fs = require('fs');


this.version = fs.readFileSync(require('path').join(__dirname, '..', 'package.json'))
                 .toString().match(/"version"\s*:\s*"([\d.]+)"/)[1];
