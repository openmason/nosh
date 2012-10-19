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
var _        = require('underscore');

// rest specific
var restClient = require('restler');

// globals
var SHELL_NAME = 'nosh';
var historyFile= '.'+SHELL_NAME+'-history';
var HISTORY_LIMIT = 200;
var PROMPT     = '> ';

var help = [
    '.help       ' +  'display this message.'.grey,
    '.quit       ' +  'exit console.'.grey
].join('\n');
var commands = '.help .quit'.split(' ');

Nosh.prototype.version = fs.readFileSync(path.join(__dirname, '..', 'package.json'))
  .toString().match(/"version"\s*:\s*"([\d.]+)"/)[1];


var url = '';

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
  cmdHistory = cmdHistory.filter(function(line) { return line.trim().length>0; });
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
              "= .help for help",
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
  this.cookies = {};
  this.headers = {'Accept':'application/json', 'Content-Type':'application/json'};
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
    if(config && config[module]) {
      url = config[module].url || '';
      if(config[module].prompt) {
        PROMPT = config[module].prompt + ' ';
      }
    }
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

var username = '';
var password = '';
var verbose = false;
var resultObj = {};
var requestObj = {};
var http = require('http');
var queryString = require('querystring');

Nosh.prototype.printHeaders = function (headers) {
  Object.keys(headers).forEach(function (k) {
    var key = k.replace(/\b([a-z])/g, function (_, m) {
      return m.toUpperCase();
    }).bold;
    util.puts(key + ': ' + headers[k]);
  });
};

Nosh.prototype.printResponse = function(res, body, callback) {
  var status = ('HTTP/' + res.httpVersion +
                ' '     + res.statusCode  +
                ' '     + http.STATUS_CODES[res.statusCode]).bold, output;

  if      (res.statusCode >= 500) { status = status.red }
  else if (res.statusCode >= 400) { status = status.yellow }
  else if (res.statusCode >= 300) { status = status.cyan }
  else                            { status = status.green }

  util.puts(status);
  this.rememberCookies(res.headers);
  if(verbose) {
    this.printHeaders(res.headers);
    util.print('\n');
  }

  try       { output = JSON.parse(body) }
  catch (_) { output = body.trim() }

  if (typeof(output) === 'string') {
    output.length > 0 && util.print(output.white + '\n');
  } else {
    resultObj = output;
    util.puts(JSON.stringify(output,null,2));
  }

  // Make sure the buffer is flushed before
  // we display the prompt.
  if (process.stdout.write('')) {
    callback();
  } else {
    process.stdout.on('drain', function () {
      callback();
    });
  }
};

Nosh.prototype.rememberCookies = function (headers) {
  var that = this;
  var parts, cookie, name, value, keys;

  if ('set-cookie' in headers) {
    headers['set-cookie'].forEach(function (c) {
      parts  = c.split(/; */);
      cookie = parts.shift().match(/^(.+?)=(.*)$/).slice(1);
      name   = cookie[0];
      value  = queryString.unescape(cookie[1]);
      
      cookie = that.cookies[name] = {
        value: value,
        options: {}
      };

      parts.forEach(function (part) {
        part = part.split('=');
        cookie.options[part[0]] = part.length > 1 ? part[1] : true;
      });

      if (cookie.options.expires) {
        cookie.options.expires = new(Date)(cookie.options.expires);
      }
    });
  }
};

Nosh.prototype.setCookies = function (headers) {
  var that = this, header;
  if ((keys = Object.keys(this.cookies)).length) {
    header = keys.filter(function (k) {
      var options = that.cookies[k].options;
      return (!options.expires || options.expires >= Date.now()) &&
        (!options.path    || ('/' + that.path.join('/')).match(new(RegExp)('^' + options.path)));
    }).map(function (k) {
      return [k, queryString.escape(that.cookies[k].value) || ''].join('=');
    }).join(', ');
    header && (headers['Cookie'] = header);
  }
};

Nosh.prototype.dispatch = function(command, done) {
  var self = this;

  if(/^(GET|POST|PUT|HEAD|DELETE)/i.test(command)) {
    command = command.split(/\s+/);
    var method  = command.shift().toUpperCase();
    var path = url;
    if(command.length>0) { 
      path = path + '/'+ command.join('/'); 
    }
    var options = { method: method, username:username, password:password, data:JSON.stringify(requestObj) };
    this.setCookies(this.headers);
    options = _.extend(options, this.headers, options);
    if(verbose) {
      util.puts((method+' '+path).grey);
      this.printHeaders(options);
      util.puts('\n');
    }    
    restClient.request(path, options).on('complete', function(result, response) {
      self.printResponse(response, result, done);
    });
  } else if(/^(AUTH)/i.test(command)) {
    self.rl.question("... username ", function(answer) {
      username = answer;
      self.rl.question("... password ", function(answer) {
        password = answer;
        util.puts('auth for '+username.green+' set');
        done();
      });
    });
  } else if(/^(VERBOSE)/i.test(command)) {
    verbose = !verbose;
    util.puts('verbose set to '+verbose);
    done();
  } else if(/^(.QUIT)/i.test(command)) {
    this.close();
  } else if(/^(.HELP)/i.test(command)) {
    this.help();
    done();
  } else if(/^(REQUEST)/i.test(command)) {
    util.puts(JSON.stringify(requestObj));
    self.rl.question("... key  ", function(answer) {
      var k = answer.trim();
      if(k.length>0) {
        self.rl.question("... value ", function(answer) {
          var v=answer.trim();
          if(v.length==0) {
            delete requestObj[k];
          } else {
            requestObj[k] = v;
            util.puts(JSON.stringify(requestObj));
          }
          done();
        });
      } else {
        done();
      }
    });
  } else if(/^(RESULT)/i.test(command)) {
    util.puts(JSON.stringify(resultObj));
    done();
  } else {
    if(this.curr && this.curr.dispatch) {
      this.curr.dispatch(command, done);
    } else {
      util.puts(command.green+' not yet implemented');
      done();
    }
  }
}
