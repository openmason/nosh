/**
 * nosh - copyright(c) 2012 openmason.
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
var path     = require('path');
var _        = require('underscore');

// rest specific
var restClient = require('restler');

// globals
var SHELL_NAME = 'nosh';
var historyFile= '.'+SHELL_NAME+'-history';
var HISTORY_LIMIT = 200;
var PROMPT     = '> ';

Nosh.prototype.version = fs.readFileSync(path.join(__dirname, '..', 'package.json'))
  .toString().match(/"version"\s*:\s*"([\d.]+)"/)[1];

var help = [
    '.h[eaders]  ' +  'show active request headers.'.grey,
    '.o[ptions]  ' +  'show options.'.grey,
    '.c[ookies]  ' +  'show client cookies.'.grey,
    '.j[son]     ' +  'set \'Content-Type\' header to \'application/json\'.'.grey,
    '.help       ' +  'display this message.'.grey,
    '.q[uit]     ' +  'exit console.'.grey
].join('\n');

var url = '';

Nosh.prototype.completer = function completer(line) {
  line = line.trim();
  var completions = 'verbose auth get post put head delete request result .quit'.split(' ');
  var hits = completions.filter(function(c) {
    if (c.indexOf(line) == 0) {
      // console.log('bang! ' + c);
      return c;
    }
  });
  return [hits && hits.length ? hits : completions, line];
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

  // load all the modules


  // setup headers
  this.cookies = {};
  this.headers = {'Accept':'application/json', 'Content-Type':'application/json'};
  this.start(config, module);
}

/*
 * Start the module
 */
Nosh.prototype.start = function(config, module) {
  util.puts([ "= nosh v"+this.version,
              "= ctrl+d to close the shell"
            ].join('\n').grey);

  url = config[module].url;
  if(config[module].prompt) {
    PROMPT = config[module].prompt + ' ';
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
    util.puts(command.green+' not yet implemented');
    done();
  }
}
