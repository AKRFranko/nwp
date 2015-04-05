#!/bin/env node

var cli = require('cli');
var nwp = require('../index.js');
var stripJsonComments = require('strip-json-comments');
var fs = require('fs')
var yaml, json;

var options = cli.parse({
    yaml:  ['y', 'The wp-cli.yml to use.', 'path' ],
    json: [ 'j', 'The JSON file to parse.', 'path' ]
});

json = options.json ? stripJsonComments( fs.readFileSync( options.json, 'utf8' ) ) : '{}';
yaml = options.yaml ? YAML.parse( fs.readFileSync(  options.json  , 'utf8') ) : {};

nwp( json, yaml ).run( function( err, out ){
	console.log("\n");
})


