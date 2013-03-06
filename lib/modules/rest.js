/**
 * nosh - copyright(c) 2012 openmason.
 * MIT Licensed
 */

// dependencies
var util     = require('util');
var cli      = require('optimist');
var to       = require('to');
var handy    = require('handy');
var _        = require('underscore');

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
  'output json/yaml ' +  'set output type to json | yaml'.grey,
  'filter   ' +  'filter screen output to specified fields (space separated)'.grey,
  'get/post/put/head/delete ' +  'http commands.'.grey,
  'read <fname> ' +  'read file contents to request object.'.grey
].join('\n');

var _commands = 'headers verbose auth get post put head delete request filter result'.split(' ');

/*
 * Constructor to create new module.
 * New module would receive the config as argument.
 */
function RestCli(config) {
  // setup default headers
  this.cookies = {};
  this.headers = { 'Accept':'*/*' };
  this.username = undefined;
  this.password = undefined;
  this.verbose = false;
  this.resultObj = {};
  this.requestObj = undefined;
  this.url = '';
  this.filter=[];
  this.ps1 = 'http. ';
  this.limitItems = 10;
  this.outputFormat='json';
  if(config) {
    this.url = config.url || 'http://localhost:8000';
    this.ps1 = config.prompt || this.ps1;
    this.outputFormat = config.outputFormat || this.outputFormat;
    this.limitItems = config.limitItems || this.limitItems;
    if(config.headers) {
      this.headers = handy.deepMerge(this.headers, config.headers);
    }
    if(config.user) {
      this.username = config.user;
    }
    if(config.password) {
      this.password = config.password;
    }
    if(!this.url.match(/^http:/)) {
      // prepend protocol
      this.url='http://'+this.url;
    }
    var urlPath = url.parse(this.url);
    if(urlPath) {
      if(!config.prompt) this.ps1 = urlPath.protocol;
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
  Object.keys(this.headers).forEach(function (k) {
    /*
    var key = k.replace(/\b([a-z])/g, function (_, m) {
      return m.toUpperCase();
    }).bold;
    */
    var key = k.bold;
    util.puts(key + ': ' + headers[k]);
  });
};

RestCli.prototype.printResponse = function(res, body, callback) {
  var self = this;
  if(!res) {
    util.puts('unable to connect to '.red + this.url.grey);
    callback();
    return;
  }
  var status = ('HTTP/' + res.httpVersion +
                ' '     + res.statusCode  +
                ' '     + http.STATUS_CODES[res.statusCode]).bold, output;

  if      (res.statusCode >= 500) { status = status.red; }
  else if (res.statusCode >= 400) { status = status.yellow; }
  else if (res.statusCode >= 300) { status = status.cyan; }
  else                            { status = status.green; }

  util.puts(status);
  this.rememberCookies(res.headers);
  if(this.verbose) {
    this.printHeaders(res.headers);
    util.print('\n');
  }

  try       { output = JSON.parse(body); }
  catch (_) { output = body.trim(); }

  if (typeof(output) === 'string') {
    output.length > 0 && util.print(output.white + '\n');
  } else {
    this.resultObj = output;
    if(this.filter && this.filter.length > 0) {
      if(handy.getType(output)=='object') {
        output=_.pick(output, self.filter);
      } else if(handy.getType(output)=='array') {
        output=_.map(_.first(output, self.limitItems), function(o) { return _.pick(o, self.filter); });
      } 
    }
    util.puts(to.format[self.outputFormat].stringify(output));
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
RestCli.prototype.dispatch = function(command, nosh, done) {
  var rl = nosh.rl;
  var self = this;
  // split the command into words
  var words = nosh.extractWords(command);

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
    var options = { method: method };
    if(self.username) {
      options.username = self.username;
      options.password = self.password;
    }
    if(self.requestObj) { 
      options.data = JSON.stringify(self.requestObj);
    }
    this.setCookies(this.headers);
    if(!options.headers) options.headers={};
    options.headers = handy.deepMerge(this.headers, options.headers);
    if(this.verbose) {
      util.puts((method+' '+path).grey);
      this.printHeaders(options);
      util.puts(''); // will insert an empty line
    }
    restClient.request(path, options).on('complete', function(result, response) {
      self.printResponse(response, result, done);
    });
  } else if(/^(AUTH)/i.test(command)) {
    nosh.ask(["username", "password"], function(answer) {
      if(answer && answer.username) {
        self.username = answer.username;
        self.password = answer.password || '';
        util.puts('auth for '+self.username.green+' set');
      }
      done();
    });
  } else if(/^(VERBOSE)/i.test(command)) {
    self.verbose = !self.verbose;
    util.puts('verbose set to '+self.verbose);
    done();
  } else if(/^(FILTER)/i.test(command)) {
    var argv = cli.parse(words);
    if(argv._.length>1) {
      self.filter = argv._.slice(1);
      util.puts('filter set to ' + self.filter);
    } else {
      self.filter=[];
      util.puts('filter reset to none');
    }
    done();
  } else if(/^(OUTPUT)/i.test(command)) {
    argv = cli.parse(words);
    if(argv._.length>1 && argv._[1]=='yaml') {
      self.outputFormat='yaml';
    } else {
      self.outputFormat='json';
    }
    util.puts("output format set to "+self.outputFormat);
    done();
  } else if(/^(READ)/i.test(command)) {
    // read the file name
    argv = cli.parse(words);
    if(argv._.length>1) {
      var fname = argv._[1];
      var fileContents = to.format.json.load(fname);
      if(fileContents) {
        this.requestObj = fileContents;
        util.puts('loaded ' + fname);
        util.puts(JSON.stringify(self.requestObj));
      }
    } else {
      util.puts('missing filename'.red);
    }
    done();
  } else if(/^(REQUEST)/i.test(command)) {
    if(self.requestObj) util.puts(JSON.stringify(self.requestObj));
    nosh.ask(["key", "value"], function(answer) {
      if(answer && answer.key) {
        if(!self.requestObj) self.requestObj={};
        if(answer.value) {
          self.requestObj[answer.key] = answer.value;
        } else {
          delete self.requestObj[answer.key];
        }
        util.puts(JSON.stringify(self.requestObj));
      }
      done();
    });
  } else if(/^(RESULT)/i.test(command)) {
    util.puts(JSON.stringify(self.resultObj));
    done();
  } else {
    util.puts(command.green+' not yet implemented');
    done();
  }
};
