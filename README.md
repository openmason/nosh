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

## Supported commands

start the shell with 

    nosh <url>

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

### put
Issues a 'PUT' request with request object.

### post
Issues a 'POST' request with request object.

### delete
Issues a 'DELETE' request with request object.

### request
Show and manipulate request object. 

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

### History
Command history is stored and loaded from ~/.nosh-history
