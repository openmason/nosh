/**
 * nosh - copyright(c) 2012 openmason.
 * MIT Licensed
 */

// dependencies
var util     = require('util');
var _        = require('underscore');
var cli      = require('optimist');
var to       = require('to');

// rest specific
var http        = require('http');
var url         = require('url');
var restClient  = require('restler');
var queryString = require('querystring');

/**
 * HTTP REST nosh cli plugin.
 * 
 * Todo's 
 * ================
 * set output format to json/yaml/inspect on screen
 * output limit to first 10 lines ?
 */

module.exports = RestCli;

//  'cookies  ' +  'show client cookies.'.grey,
//  'url      ' +  'set the connection url.'.grey,
//  'json     ' +  'set \'Content-Type\' header to \'application/json\'.'.grey

var _help = [
  'headers  ' +  'show active request headers.'.grey,
  'verbose  ' +  'set verbose flag (show headers for both request/response).'.grey,
  'auth     ' +  'set basic auth.'.grey,
  'request  ' +  'set request object attributes.'.grey,
  'result   ' +  'result object from last http command.'.grey,
  'get/post/put/head/delete ' +  'http commands.'.grey,
  'read <fname> ' +  'read file contents to request object.'.grey
].join('\n');

var _commands = 'headers verbose auth get post put head delete request result'.split(' ');

/*
 * Constructor to create new module.
 * New module would receive the config as argument.
 */
function RestCli(config) {
  // setup default headers
  this.cookies = {};
  this.headers = { 'Accept':'*/*' };
//{'Accept':'application/json', 'Content-Type':'application/json'};
  this.username = '';
  this.password = '';
  this.verbose = false;
  this.resultObj = {};
  this.requestObj = {};
  this.url = '';
  this.ps1 = 'http. ';
  if(config) {
    this.url = config.url || 'http://localhost:8000';
    this.ps1 = config.prompt || this.ps1;
    if(config.headers) {
      this.headers = _.extend(this.headers, this.headers, config.headers);
    }
    var urlPath = url.parse(this.url);
    if(urlPath) {
      this.ps1 = this.ps1 + urlPath.hostname + ' ' + urlPath.pathname + ' > ';
    }
  }
}

RestCli.prototype.commands = function () {
  return _commands;
};

RestCli.prototype.help = function() {
  return _help;
};

// return the prompt string
RestCli.prototype.prompt = function() {
  return this.ps1;
};

/* ------------ rest methods and helpers ------------- */

RestCli.prototype.printHeaders = function (headers) {
  Object.keys(headers).forEach(function (k) {
    var key = k.replace(/\b([a-z])/g, function (_, m) {
      return m.toUpperCase();
    }).bold;
    util.puts(key + ': ' + headers[k]);
  });
};

RestCli.prototype.printResponse = function(res, body, callback) {
  if(!res) {
    util.puts('unable to connect to '.red + this.url.grey);
    callback();
    return;
  }
  var status = ('HTTP/' + res.httpVersion +
                ' '     + res.statusCode  +
                ' '     + http.STATUS_CODES[res.statusCode]).bold, output;

  if      (res.statusCode >= 500) { status = status.red }
  else if (res.statusCode >= 400) { status = status.yellow }
  else if (res.statusCode >= 300) { status = status.cyan }
  else                            { status = status.green }

  util.puts(status);
  this.rememberCookies(res.headers);
  if(this.verbose) {
    this.printHeaders(res.headers);
    util.print('\n');
  }

  try       { output = JSON.parse(body) }
  catch (_) { output = body.trim() }

  if (typeof(output) === 'string') {
    output.length > 0 && util.print(output.white + '\n');
  } else {
    this.resultObj = output;
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

RestCli.prototype.rememberCookies = function (headers) {
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

RestCli.prototype.setCookies = function (headers) {
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

/*
 * Dispatch/Handle REST commands
 */
RestCli.prototype.dispatch = function(command, rl, done) {
  var self = this;
  // split the command into words
  var words = command.match(/[^\s]+|"[^"]+"/g);
  var n = words.length;
  while(n--)  words[n] = words[n].replace(/"/g,"");

  if(/^(HEADERS)/i.test(command)) {
    this.printHeaders(this.headers); 
    done();
  } else if(/^(GET|POST|PUT|HEAD|DELETE)/i.test(command)) {
    command = command.split(/\s+/);
    var method  = command.shift().toUpperCase();
    var path = this.url;
    if(command.length>0) { 
      path = path + '/'+ command.join('/'); 
    }
    var options = { method: method, 
                    username:self.username, 
                    password:self.password,
                    data:JSON.stringify(self.requestObj) 
                  };
    this.setCookies(this.headers);
    options = _.extend(options, this.headers, options);
    if(this.verbose) {
      util.puts((method+' '+path).grey);
      this.printHeaders(options);
      util.puts(''); // will insert an empty line
    }    
    restClient.request(path, options).on('complete', function(result, response) {
      self.printResponse(response, result, done);
    });
  } else if(/^(AUTH)/i.test(command)) {
    rl.question("... username ", function(answer) {
      self.username = answer;
      rl.question("... password ", function(answer) {
        self.password = answer;
        util.puts('auth for '+self.username.green+' set');
        done();
      });
    });
  } else if(/^(VERBOSE)/i.test(command)) {
    self.verbose = !self.verbose;
    util.puts('verbose set to '+self.verbose);
    done();
  } else if(/^(READ)/i.test(command)) {
    // read the file name
    var argv = cli.parse(words);
    if(argv._.length>1) {
      var fname = argv._[1];
      var fileContents = to.format.json.load(fname);
      if(fileContents) {
        this.requestObj = fileContents;
        util.puts('loaded ' + fname);
        util.puts(JSON.stringify(self.requestObj));
      }
    } else {
      console.log('missing filename'.red);
    }
    done();
  } else if(/^(REQUEST)/i.test(command)) {
    util.puts(JSON.stringify(self.requestObj));
    rl.question("... key  ", function(answer) {
      var k = answer.trim();
      if(k.length>0) {
        rl.question("... value ", function(answer) {
          var v=answer.trim();
          if(v.length==0) {
            delete self.requestObj[k];
          } else {
            self.requestObj[k] = v;
            util.puts(JSON.stringify(self.requestObj));
          }
          done();
        });
      } else {
        done();
      }
    });
  } else if(/^(RESULT)/i.test(command)) {
    util.puts(JSON.stringify(self.resultObj));
    done();
  } else {
    util.puts(command.green+' not yet implemented');
    done();
  }
};
