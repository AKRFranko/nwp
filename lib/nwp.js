var util = require('util');
var async = require('async');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var merge = require('merge');
var chalk = require('chalk');


(function() {
    var childProcess = require("child_process");
    oldSpawn = childProcess.spawn;
    function mySpawn() {
        console.log('spawn called');
        console.log(arguments);
        var result = oldSpawn.apply(this, arguments);
        return result;
    }
    spawn = mySpawn;
})();


var quote = function( arr ){
  var isFlag = /^-/;
  return arr.reduce( function( str, s, i ){
    if( isFlag.test( s ) ){ //isKey
      str += s;
      hasNext = typeof arr[i+1] !== 'undefined';
      if( !hasNext || isFlag.test( arr[i+1] ) ){
        str += ' '
      }else{
        str += '='
      }
    }else{
      str += util.format( '"%s" \n' , util.format( "%s", s ) ); 
    }
    return str;
  },'').split("\n")
}

var ShellArgs = function( data ){
  this.__type = 'shellargs';
  data = data ? data : data.args ? data.args : {};
  Object.keys( data ).reduce( function( it, k ){ 
    it.values = it.values || [];
    var value = data[k];
    if( /\$[^_]/.test( value ) ){
      it.requires = it.requires || [];
      it.requires.push( k );
    }
    it.values.push( data[k] )
    return it;
  }, this );
  return this;
}


var ShellOpts = function( data ){
  this.__type = 'shellopts';
  data = data ? data : data.opts ? data.opts : {};
  Object.keys( data ).reduce( function( it, k ){ 
    var value = data[k];
    if( /\$[^_]/.test( value ) ){
      it.requires = it.requires || [];
      it.requires = it.requires.concat( value.split(/\s*,\s*/)  );
      
    }
    it.values = it.values || [];    
    if( 'boolean' === typeof value ){
      it.values.push( '--' + k );
    }else{
      it.values.push( '--' + k );
      it.values.push( value );
    }
    return it;
  }, this );
  return this;
}


var Target = function( k, v ){
  this.target = k;
    this.data = v;
    this.__type = 'target';
    return this;
}

Target.prototype.toCommand = function( prefix, config  ){
  var command = new Command( prefix || '' + this.command, this.data, config );
  if( this.target[0] === '$'){
    command.provides=this.target;
    command.procures=this.target.split('').slice(1).join('');
    command.shellopts = command.shellopts||[];
    command.shellopts.push('--porcelain');
    command.shellopts.push('--quiet');
  }
  return command;
}

Target.prototype.toString = function( ){
  return '[target]';
}



var Command = function( command, data, config ){
  var cmd = this;
  cmd.__type = 'command';
  cmd.command = command || '';

  Object.keys( data ).reduce( function( d, k ){
    if( d[k].__type ){
      if( d[k].__type === 'shellopts' || d[k].__type === 'shellargs'){
        if( cmd[d[k].__type] ){ 
          cmd[d[k].__type] = cmd[d[k].__type].concat( cmd[d[k].__type] )
        }else{
          cmd[d[k].__type] = d[k].values;
        }
        if( d[k].requires ){
          if( !cmd.requires ){ cmd.requires = [] }
          cmd.requires = cmd.requires.concat( d[k].requires );
        }
      }
      if( d[k].__type === 'target'){
        cmd.targets = cmd.targets || [];
        d[k].command = cmd.command;
        cmd.targets.push(d[k])
      }
      if( d[k].__type === 'command'){
        d[k].command = (cmd.command + ' '  + d[k].command).trim();
        cmd.subcommands = cmd.subcommands || [];
        cmd.subcommands.push( d[k] )
      }
      
      if( d[k].subcommands ){
        d[k].subcommands.forEach( function( sub ){
          sub.command = (cmd.command + ' ' +sub.command).trim();
          if( config[sub.command]){
            var cmdOpts = new ShellOpts( config[sub.command] ).values;
            if( !sub.shellopts ){
              sub.shellopts = cmdOpts;
            }else{
              var checkVal = /^[^-]/;
              cmdOpts.forEach( function( opt, index ){
                var isValue = checkVal.test( opt );
                var next = cmdOpts[index+1];
                var nextIsValue = next && /^[^-]/.test( next );
                if( !isValue ){
                  if( ~sub.shellopts.indexOf( opt ) ){    
                    if( !nextIsValue ){
                      sub.shellopts[ sub.indexOf( opt )+1 ]=next;
                    }
                  }else{
                    sub.shellopts.push( opt );
                  } 
                }
                if( nextIsValue ){
                  sub.shellopts.push( next );
                }               
              })
              
            }
            //process.exit()
          }
          return sub;
        })
      }
      //console.log( data[k].__type )
    }
    return d;
  }, data )
  if( this.targets ){
    cmd.subcommands = cmd.subcommands || [];
    this.targets.forEach( function( target ){ 
    cmd.subcommands.push( target.toCommand( cmd.command, config ) )
    })
  }
  if( this.subcommands ){
    this.subcommands = this.subcommands.reduce( function( all, one ){ 
      if( one.subcommands ){
        return one.subcommands.reduce( arguments.callee, all )
      }else{
        all.push( one )
      }
      return all;
    }, [] )
  }
  if( !this.shellopts ){
    this.shellopts = new ShellOpts( config.globOpts ).values;
  }
  // this.data = data;
  return this;
}


Command.prototype.toString = function( ){

  return [
    'wp',
    this.command,
    this.shellargs ? quote(this.shellargs).join('') : '',
    this.shellopts ? quote(this.shellopts).join('') : '',
  ].join(' ')
}

Command.prototype.run = function( callback ){
  var current = this;
  if( current.subcommands ){
    var complete = function( err, outputs ){
      if( err ){
        callback( err )
        process.exit( 1 );
      }else{
        callback( null, "All commands ran with success!");
      }
    }
    async.mapSeries( current.subcommands , function( sub, next ){
      sub.run( next );
    }, complete );
  }else{
    var shargs = current.shellargs||[];
    var shopts = current.shellopts||[];
    var params = shargs.concat( shopts );
    
    var command = ['wp',  current.command ].concat( quote( params ) ).join(' ');
    var copts = {  env: process.env, cwd: process.cwd() };
    if( current.requires ){
      var missing = current.requires.filter( function( req  ){
        return process.env[req.replace(/^\$/,'').trim()] === 'undefined';
      });
      if( missing.length ){
        console.log( process.env )
        return callback( "Missing: " + missing.join( ', ') )
      }
    }
    console.log( chalk.bold.cyan( "\nRunning:\n") )
    console.log( chalk.white(  command ) )
    var operation = exec( command, copts, function( err, stdout, stderr ){
      if( err ) return callback( err  );
      if( !stdout ) return callback( stderr );
      if( current.provides ){
        if( !stdout ) return callback( new Error( "Could not procure: " + current.procures ) )
        console.log( chalk.bold.cyan("\nProcured:\n") )
        console.log( chalk.bold.yellow( current.procures ) + '=' + '"' + chalk.white(stdout.trim()) + '"');
        process.env[current.procures]=stdout.trim();
        //console.log( process.env )
      }
      callback( null, stdout );
    })
  }
  return this;
}

var globArgs = ['path','url','user', 'skip-plugins','skip-themes','require', 'color', 'no-color', 'debug', 'prompt', 'quiet'];

Command.parse = function( recipe, config ){
  var globOpts = Object.keys( config ).reduce( function( opts, k){
    if( ~globArgs.indexOf( k) ){
      opts[k] = config[k]
    }
    return opts;
  }, {});
  config.globOpts = globOpts;
  // globOpts.quiet = true;
  var parsed = JSON.parse( recipe, function( k, v ){
      var recurse = arguments.callee;  
      if( v && v.__type ) return v;
      if( Array.isArray( v ) ){
        v = v.reduce( function( o, a, b ){ 
          o[b] = recurse( b, a );
          return o; 
        }, {} );
      }
      if( k === 'args' ){
        return new ShellArgs( v )
      }else if( k === 'opts' ){
        return new ShellOpts( merge( v, globOpts ) );
      }else if( k[0] === '$' || /^\d+$/.test( k ) ){
        //console.log('target:', k )
        return new Target( k, v );
      }else if( typeof v === 'object'){
        return new Command( k, v, config )
      }
      return v;
    });
  return parsed;
}


// c = JSON.stringify({
//  "post": {"create": {"$bob": { opts: {} , args: {} }} }
// })
module.exports = function( recipe, config ){ 
  recipe = recipe || {}
  config = config || {}
  return { recipe: recipe, config: config, run: function( callback ){
    Command.parse( recipe, config ).run( function( err, succ ){
      if( err ){
        console.log( chalk.red("FAIL!"), err );
      }else{
        console.log( chalk.green("DONE!"), succ );
      }
      callback( err, succ );
    })
  } }
}
// var c = stripJsonComments( fs.readFileSync( './example/edb.json', 'utf8' ) );
// var config =  YAML.parse( fs.readFileSync(  './example/development.yml'  , 'utf8') );
// Command.parse( c , config ).run( function( err, succ ){
//  if( err ){
//    console.log( chalk.red("FAIL!"), err );
//  }else{
//    console.log( chalk.green("DONE!"), succ );
//  }
// })
