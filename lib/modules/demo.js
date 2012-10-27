/**
 * nosh - copyright(c) 2012 openmason.
 * MIT Licensed
 */

var cli = require('optimist');
var asciimo = require('asciimo').Figlet;
var util = require('util');

/*
 * This is a sample nosh plugin. Use this as a sample
 * to implement your own extensions.
 */

module.exports = Demo;

var _help = [
  'banner text [font]  ' +  'banner ascii art.'.grey
].join('\n');

var _commands = 'banner'.split(' ');

/*
 * Constructor to create new module.
 * New module would receive the config as argument.
 */
function Demo(config) {
  // any local variables to be inited here
}

Demo.prototype.commands = function () {
  return _commands;
};

Demo.prototype.help = function() {
  return _help;
};

// call done, once the command is handled
// rl - readline interface
Demo.prototype.dispatch = function(command, rl, done) {
  // split the command into words
  var words = command.match(/\w+|"[^"]+"/g);
  var n = words.length;
  while(n--)  words[n] = words[n].replace(/"/g,"");

  var argv = cli.parse(words);
  var cmd  = (argv._[0] && argv._[0].toLowerCase()) || '';
  switch(cmd) {
   case "banner": 
    if(argv._.length>1) {
      var font = argv._[2] || 'doom';
      console.log('banner '+argv._[1]);
      /*
      asciimo.write(argv._[1], font, function(art) {
        console.trace(done);
        util.puts(art);
        //done();
        return;
      });
      */
    } else {
      console.log('see help for banner command');
    }
    break;
  default: console.log('unknown command issued'); break;
  }
  done();
};