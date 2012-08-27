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
var fs       = require('fs');
var readline = require('readline');
var util     = require('util');
var colors   = require('colors');

var rl = readline.createInterface(process.stdin, process.stdout, completer);

function completer(line) {
  var completions = '.help .error .exit .quit .q'.split(' ')
	var hits = completions.filter(function(c) {
		if (c.indexOf(line) == 0) {
		  // console.log('bang! ' + c);
		  return c;
		}
	});
  return [hits && hits.length ? hits : completions, line];
}

this.version = fs.readFileSync(require('path').join(__dirname, '..', 'package.json'))
  .toString().match(/"version"\s*:\s*"([\d.]+)"/)[1];

this.welcome = function welcome() {
  util.puts([ "= nosh "
            ].join('\n').grey);
  prompt();
}

function prompt() {
  var arrow    = '> ', length = arrow.length ;

  rl.setPrompt(arrow.grey, length);
  rl.prompt();
}


rl.on('line', function(cmd) {
  console.log(cmd.trim());
  prompt();
}).on('close', function() {
  // only gets triggered by ^C or ^D
  util.puts('goodbye!'.green);
  process.exit(0);
});
