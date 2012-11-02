/**
 * nosh - copyright(c) 2012 openmason.
 * MIT Licensed
 */

/* Todo's 
 * ================
 * 
 * show list of modules
 * show history (history <n>)
 * execute historical command
 * 
 */

// dependencies
var fs       = require('fs');
var readline = require('readline');
var util     = require('util');
var colors   = require('colors');
var path     = require('path');
var handy    = require('handy');

// globals
var SHELL_NAME = 'nosh';
var historyFile= '.'+SHELL_NAME+'-history';
var HISTORY_LIMIT = 50;
var PROMPT     = '> ';

var help = [
  '.history    ' +  'display last 10 commands.'.grey,
  '.help       ' +  'display this message.'.grey,
  '.quit       ' +  'exit console.'.grey
].join('\n');
var commands = '.history .help .quit'.split(' ');

Nosh.prototype.version = handy.getVersion();

Nosh.prototype.completer = function completer(line) {
  line = line.trim();
  var hits = this.completions.filter(function(c) {
    if (c.indexOf(line) == 0) {
      // console.log('bang! ' + c);
      return c;
    }
  });
  return [hits && hits.length ? hits : this.completions, line];
};

Nosh.prototype.loadHistory = function() {
  var filePath = path.join(process.env.HOME, historyFile);
  if (!fs.existsSync(filePath)) return [];
  var cmdHistory=fs.readFileSync(filePath, 'utf8').split('\n');
  // filter and reverse and limit
  var prevLine = '';
  cmdHistory = cmdHistory.filter(function(line) { var keep=(line.trim().length>0 && line!=prevLine); prevLine=line; return keep; });
  // @todo: also filter two identical commands one after another
  return cmdHistory.reverse().slice(0, HISTORY_LIMIT); 
};

Nosh.prototype.writeHistory = function(line) {
  if(line.trim().length>0 && !(this.previousLine && this.previousLine==line)) {
    this.previousLine = line;
    this.history.write(line + '\n');
  }
};

Nosh.prototype.prompt = function(){
  var ps1 = PROMPT;
  if(this.curr && this.curr.prompt) {
    ps1=this.curr.prompt();
  }
  this.rl.setPrompt(ps1.blue, ps1.length);
  this.rl.prompt();
};

module.exports = Nosh;

/*
 * Constructor to create a new shell. 
 * - Load all the modules that are specified in config
 */
function Nosh(config, module) {
  // i/o
  process.stdin.setEncoding('utf8');
  this.stdin = process.stdin;
  this.stdout = process.stdout;

  // set up history & prompt
  this.history = fs.createWriteStream(path.join(process.env.HOME, historyFile), { flags: 'a' });
  this.rl = readline.createInterface({
    input: this.stdin,
    output: this.stdout,
    completer: this.completer.bind(this)
  });
  this.rl.history = this.loadHistory();
  this.rl.on('line',  this.writeHistory.bind(this));
  this.rl.on('line',  this.exec.bind(this));
  this.rl.on('close', this.close.bind(this));

  // display initial text string
  util.puts([ "= " + SHELL_NAME + " v"+this.version,
              "= .help for help, TAB for completions",
              "= ctrl+d to close the shell"
            ].join('\n').grey);

  // load all the modules
  this.modules={};
  this.objects={};
  // curr is a pointer to current module
  this.currentModule = "";
  this.curr = "";
  this.completions = [];
  var loadableModules = (config.application && config.application.modules) || [];
  for(var i=0;i<loadableModules.length;i++) {
    this.loadPlugin(loadableModules[i], config[loadableModules[i]]);
  }

  // setup headers
  this.start(config, module);
}

Nosh.prototype.error = function (errstr) {
  util.puts(errstr.red);
};

/*
 * Load a plugin - just loads the module (require.js) 
 */
Nosh.prototype.loadPlugin = function(module) {
  var filename = __dirname + '/modules/'+module+'.js';
  try {
    // check if file present first
    var stats = fs.lstatSync(filename);
    if(stats.isFile()) {
      function load() {
        return require(filename);
      }
      this.modules.__defineGetter__(module, load);
    } else {
      this.error('invalid module :'+module);
    }
  }
  catch(e) {
    this.error('unable to load  module :'+module + ' // ' + e);
  }
};

/*
 * Start/switch to a given module
 */
Nosh.prototype.start = function(config, module) {
  if(module) {
    // instantiate an object if its not present already
    if(!this.objects[module]) {
      this.objects[module]=new this.modules[module](config[module]);
    }
    // point to the correct module
    this.curr = this.objects[module];
    this.currentModule = module;
    this.completions = commands.concat(this.curr.commands() || []);
  }
  this.prompt();
};

Nosh.prototype.exec = function(cmd) {
  cmd = cmd.trim();
  var self=this;
  if(cmd.length==0) return self.prompt();
  this.dispatch(cmd, function() { 
    return self.prompt(); 
  });
};

Nosh.prototype.close = function() {
  // only gets triggered by ^C or ^D
  util.puts('goodbye!'.green);
  process.exit(0);
};

Nosh.prototype.help = function() {
  // display general help and then
  // module specific 
  util.puts('global commands:'.yellow);
  util.puts(help);
  if(this.curr && this.curr.help) {
    util.puts('\n' + this.currentModule.green + ' commands'.yellow);
    util.puts(this.curr.help());
  }
};

/*
 * Dispatch the command.
 * - common commands here (or)
 * - call the plugin to execute the rest of the command
 */
Nosh.prototype.dispatch = function(command, done) {
  var self = this;

  if(/^(.QUIT)/i.test(command)) {
    this.close();
  } else if(/^(.HELP)/i.test(command)) {
    this.help();
    done();
  } else if(/^(.HISTORY)/i.test(command)) {
    console.log(util.inspect(this.rl.history, false, 10, true));
    done();
  } else {
    if(this.curr && this.curr.dispatch) {
      this.curr.dispatch(command, this.rl, done);
    } else {
      util.puts(command.green+' not yet implemented');
      done();
    }
  }
};
