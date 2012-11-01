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

   * <installation-path>/config/settings.yaml
   * <HOME>/.noshrc
   * <current-directory>/noshrc

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

### History
Command history is stored and loaded from ~/.nosh-history
