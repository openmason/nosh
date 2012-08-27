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

var restClient = require('restler');
var userInput  = require('prompt');


this.version = fs.readFileSync(require('path').join(__dirname, '..', 'package.json'))
  .toString().match(/"version"\s*:\s*"([\d.]+)"/)[1];

var url = '';

exports.welcome = function welcome(config) {
  util.puts([ "= nosh v"+this.version,
              "= ctrl+d to close the shell"
            ].join('\n').grey);

  url = config.url;
  process.stdin.setEncoding('utf8');
  userInput.start();
};

function prompt() {
  userInput.message = '>'.blue;
  userInput.delimiter = '';
}

exports.run = function run() {
  prompt();
  userInput.getInput('', function(err, result) {
    if(!err) {
      result = result.trim();
      if(result.length>0) {
        dispatch(result, function() {
          run();
        });
      } else {
        run();
      }
    } else {
      console.log(err);
      run();
    }
  });
};

var username = '';
var password = '';

function dispatch(command, done) {
  if(/^(GET)/i.test(command)) {
    command = command.split(/\s+/);
    var method  = command.shift().toUpperCase();
    var path = url;
    if(command.length>0) { path = path + '/'+ command.join('/'); }
    console.log(path);
    restClient.
      get(path, 
          {
            username:username, 
            password:password
          }).
      on('complete', function(result) {
        util.puts(JSON.stringify(result, null, 2));
        done();
      });
  } else if(/^(AUTH)/i.test(command)) {
    userInput.message = '...'.green;
    userInput.delimiter = ' ';
    userInput.get([{
      name: 'username',
      required: true
    }, {
      name: 'password',
      hidden: true,
      conform: function (value) {
        return true;
      }
    }], function (err, result) {
      util.puts('auth for '+result.username.green+' set');
      username = result.username;
      password = result.password;
      done();
    });
  } else {
    util.puts(command.green+' not yet implemented');
    done();
  }
}
