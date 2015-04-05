var nwp = require( __dirname + '/lib/nwp.js' );
var stripJsonComments = require('strip-json-comments');
var fs = require('fs');
var YAML = require('yamljs');
var _ = require('lodash');

var render = function( string, data ){
	return _.template( string )( data );
}

nwp.readJSONFile = function( file, options ){
	return render( stripJsonComments( fs.readFileSync( file , 'utf8' ) ),  options || {} );
}
nwp.readYAMLFile = function( file, options ){
	var rendered = render( fs.readFileSync(  file  , 'utf8'), options || {} );
	return YAML.parse( rendered );	
}

module.exports = nwp;


