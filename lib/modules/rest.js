/**
 * nosh - copyright(c) 2012 openmason.
 * MIT Licensed
 */

// dependencies
var util     = require('util');
var _        = require('underscore');

// rest specific
var http        = require('http');
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

var _help = [
  'headers  ' +  'show active request headers.'.grey,
  'cookies  ' +  'show client cookies.'.grey,
  'json     ' +  'set \'Content-Type\' header to \'application/json\'.'.grey
].join('\n');

var _commands = 'headers cookies json verbose auth get post put head delete request result'.split(' ');

/*
 * Constructor to create new module.
 * New module would receive the config as argument.
 */
function RestCli(config) {
  // setup default headers
  this.cookies = {};
  this.headers = {'Accept':'application/json', 'Content-Type':'application/json'};
  this.username = '';
  this.password = '';
  this.verbose = false;
  this.resultObj = {};
  this.requestObj = {};
}

RestCli.prototype.commands = function () {
  return _commands;
};

RestCli.prototype.help = function() {
  return _help;
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

RestCli.prototype.dispatch = function(command, done) {
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
