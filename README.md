# nosh
Node.js Shell
A readline based shell with history support. 

## Install

    sudo npm install -g nosh

## Start the shell

    $ nosh
                         _     
                        | |    
      _ __    ___   ___ | |__  
     | '_ \  / _ \ / __|| '_ \ 
     | | | || (_) |\__ \| | | |
     |_| |_| \___/ |___/|_| |_|

## Features
A basic list of commands to handle REST

## Configuration
The configuration is specified in the following order (last file overrides any previous config)

    1. <installation-path>/config/settings.yaml
    2. <HOME>/.noshrc
    3. <current-directory>/noshrc

Please refer to the config/settings.yaml for all the options and override them as required.

## Supported commands

start the shell with 

    nosh <url>

### auth
Currently basic auth is supported using this command.

    ...
    > auth
    ... username <key-in-username-here>
    ... password <key-in-password-here>
    auth for <username> set
    # This command would set the basic auth headers based on 
    # input username, password
    # to the subsequent commands

### verbose
Toggle verbose mode. In verbose mode, you could see the full request and response from server.

### get
Issues a 'GET' request. 

    $ nosh http://localhost:8000/api
    ...
    > auth
    ...
    > get students
    # This would issue a GET request to http://localhost:8000/api/students
    # with authentication headers set appropriately (based on auth command)

### put/post
Issues a 'PUT'/'POST' request with request object.  This is equivalent to -d '<requestobj>' from curl command line.

### delete
Issues a 'DELETE' request with request object.

### request
Show and manipulate request object. 

    .. > request
    {}   // <-- displays current object 
    ... key   <enter key name>
    ... value <key value>
    
    ...> request
    {}
    ... key  xyz
    ... value 123
    {"xyz":"123"}
        
    # if value is empty, the key is removed from the request obj

#### read request object from file
To simply read a json file to request object, use this command

    .. > read /home/test/my.json
    loaded /home/test/my.json
    {"name":"me", "value":.... }
    .. >

### Output

#### Format
Output from the response object can be printed in json (default) or yaml

    .. > output yaml
    output format set to yaml
    .. > ...command..producing..output...
    - id: xyz 
      ...

#### Filtering
Output fields can be filtered using this command (only first level entities given are shown)

    .. > filter id name
    filter set to id,name
    .. > ...command..producing..output...
    - id: xyz 
      name: abc
    - id: 123
      name: 333

##### Limit output entries
While filter is on, the list of entries to screen can be limited via configuration limitItems

### History
Command history is stored and loaded from ~/.nosh-history

### alias
To add an alias to a command

    .. > newname="command and arguments"
    ...
    .. > .alias
    newname   command and arguments
    ..    
    
#### substitution
Use mustache syntax within string for subtitutions

    .. > a="abc"
    .. > b="get students/{{a}}"
    .. > b
    would issue 'get students/abc'
    
