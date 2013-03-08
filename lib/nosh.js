/**
 * nosh - copyright(c) 2012 openmason.
 * MIT Licensed
 */

/* Todo's 
 * ================
 * 
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
var cli      = require('optimist');
var async    = require('async');
var semver   = require('semver');

var handy    = require('handy');
var panda    = require('panda-lang');

// globals
var SHELL_NAME = 'nosh';
var historyFile= '.'+SHELL_NAME+'-history';
var HISTORY_LIMIT = 50;
var PROMPT     = '> ';

var help = [
  '.alias      ' +  'display aliases.'.grey,
  '.history    ' +  'display last 10 commands.'.grey,
  '.modules    ' +  'display available modules.'.grey,
  '.switch     ' +  'switch to another module.'.grey,
  '.help       ' +  'display this message.'.grey,
  '.quit       ' +  'exit console.'.grey
].join('\n');
var commands = '.alias .modules .switch .history .help .quit'.split(' ');

Nosh.prototype.version = handy.getVersion();

Nosh.prototype.completer = function completer(line) {
  line = line.trim();
  var tabCompletions = this.completions.concat(Object.keys(panda.ast()));
  var hits = tabCompletions.filter(function(c) {
    if (c.indexOf(line) == 0) {
      return c;
    }
  });
  return [hits && hits.length ? hits : tabCompletions, line];
};

Nosh.prototype.loadHistory = function() {
  var filePath = path.join(process.env.HOME, historyFile);
  if (!fs.existsSync(filePath)) return [];
  var cmdHistory=fs.readFileSync(filePath, 'utf8').split('\n');
  // filter and reverse and limit
  var prevLine = '';
  cmdHistory = cmdHistory.filter(function(line) { 
    var keep=(line.trim().length>0 && line!=prevLine);
    prevLine=line; return keep; 
  });
  // @todo: also filter two identical commands one after another
  return cmdHistory.reverse().slice(0, HISTORY_LIMIT); 
};

Nosh.prototype.writeHistory = function(line) {
  if(line.trim().length>0 && 
     !(this.previousLine && this.previousLine==line) &&
     line.toLowerCase() != '.history') {
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
  // make sure the version of shell
  // is as per requirement
  if(config.application.version && !semver.satisfies(this.version, config.application.version)) {
    util.puts((SHELL_NAME + " v"+this.version+", whereas config requires "+config.application.version).red);
    process.exit(-1);
  }

  // i/o
  process.stdin.setEncoding('utf8');
  this.stdin = process.stdin;
  this.stdout = process.stdout;

  // check if history file is set in config
  if(config.application.history) {
    historyFile = "." + config.application.history;
  }

  // set up history & prompt
  this.history = fs.createWriteStream(path.join(process.env.HOME, historyFile), { flags: 'a' });
  this.rl = readline.createInterface({
    input: this.stdin,
    output: this.stdout,
    completer: this.completer.bind(this),
    terminal: true
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
    var m = loadableModules[i];
    this.loadPlugin(m, config[m]);
    // instantiate an object if its not present already
    if(!this.objects[m]) {
      this.objects[m]=new this.modules[m](config[m]);
    }
  }

  // setup headers
  this.initApp(config, module);
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
 * load and init nosh app settings
 */
Nosh.prototype.initApp = function(config, module) {
  if(module) {
    this.switchToModule(module);
  }
  // lets load the init list
  var initList = (config.application && config.application.init) || [];
  for(var i=0;i<initList.length;i++) {
    this.exec(initList[i]);
  }
  this.prompt();
};

/*
 * switch to a given module
 */
Nosh.prototype.switchToModule = function(module) {
  if(!module || !this.objects.hasOwnProperty(module)) {
    util.puts('unable to switch to module: ' + module.red);
    return;
  }
  // point to the correct module
  this.curr = this.objects[module];
  this.currentModule = module;
  this.completions = commands.concat(this.curr.commands() || []);
  util.puts('context switched to: ' + module.green);
};

Nosh.prototype.exec = function(cmd) {
  cmd = cmd.trim();
  var self=this;
  if(cmd.length==0) return self.prompt();
  // try to load it into panda environment
  try {
    var ast=panda.load(cmd);
    // looks like parsing went thru
    // at this stage the ast is loaded
    return self.prompt();
  } catch(err) {
    // lets try to see if there is ast
    ast = panda.ast(cmd);
    if(ast) {
      panda.execute(ast);
      var cmds = panda.lookup(cmd);
      if(cmds) {
        // if m is a list, need to take care of that
        if(handy.getType(cmds)=='array') {
          // iterator over index, not the commands
          var cmdIndexes = [];
          for(var i=0;i<cmds.length;i++) cmdIndexes.push(i);
          async.forEachSeries(cmdIndexes, function(cmdIdx, nxt) { 
            var subcmd = cmds[cmdIdx];
            var subcmdast = panda.ast(subcmd);
            if(subcmdast) panda.execute(subcmdast);
            self.dispatch(subcmd, function(err) {
              // lets fire the full ast of list
              // to make sure updates from subcmd
              // is reflected
              panda.execute(ast);
              cmds = panda.lookup(cmd);
              nxt();
            });
          }, function(err) {
            return self.prompt();
          });
          return;
        } else {
          cmd=cmds;
        }
      }
    }
  }
  // execute the command
  self.dispatch(cmd, function(err) { 
    return self.prompt(); 
  });
};

Nosh.prototype.ask = function(prompts, cb) {
  var self = this;
  var results = {};
  function doInput(prompt, cb) {
    var inputPrompt = '(input) ' + prompt + ' ? ';
    self.rl.question(inputPrompt, function(answer) {
      if(answer.trim().length<=0) {
        cb('empty input');
      } else {
        results[prompt]=answer.trim();
        cb();
      }
    });
  }
  async.forEachSeries(prompts, doInput, function (err) {
    cb(results);
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

Nosh.prototype.extractWords = function(command) {
  // split the command into words
  var words = command.match(/[^\s]+|"[^"]+"/g);
  var n = words.length;
  while(n--)  words[n] = words[n].replace(/"/g,"");
  return words;
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
  } else if(/^(INPUT)/i.test(command)) {
    var words = self.extractWords(command);
    var argv = cli.parse(words);
    if(argv._.length>1) {
      var inpList = argv._.slice(1);
      self.ask(inpList, function(answer) {
        panda.symbols()['input'] = answer;
        done();
      });
    } else {
      done();
    }
  } else if(/^(.HISTORY)/i.test(command)) {
    var h = this.rl.history;
    for(var i=0;i<h.length;i++) {
      util.puts(i+1, h[i]);
    }
    done();
  } else if(/^(.MODULES)/i.test(command)) {
    var modules = Object.keys(this.modules);
    for(i=0;i<modules.length;i++) {
      util.puts(modules[i].cyan);
    }
    done();
  } else if(/^(.SWITCH)/i.test(command)) {
    argv = cli.parse(self.extractWords(command));
    if(argv._.length==2) {
      var m = argv._.slice(1)[0];
      self.switchToModule(m);
    }
    done();
  } else if(/^(.ALIAS)/i.test(command)) {
    var helpStr = panda.source();
    for(var symbol in helpStr) {
      var parts=helpStr[symbol].split('=');
      var kwd = parts.shift();
      var help = parts.join('=');
      console.log(kwd.cyan, '\t', help.grey);
    }
    done();
  } else {
    if(this.curr && this.curr.dispatch) {
      this.curr.dispatch(command, this, done);
    } else {
      util.puts(command.green+' not yet implemented');
      done();
    }
  }
};
