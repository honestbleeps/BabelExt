#!/usr/bin/env phantomjs --ssl-protocol=any

/*
 * Phantom JS build script
 *
 * Usage: phantomjs <build|release> <firefox|chrome|safari>
 *
 *
 * PhantomJS is a headless web browser, which allows us to automate
 * the release process even for sites without a release API.
 * Using it as a build system is a bit clunky, but less so than
 * adding a second dependency
 *
 */

// Required modules:
var childProcess = require('child_process');
var fs           = require('fs');
var system       = require('system');
var webPage      = require('webpage');

/*
 * OS INTERACTION
 * improve PhantomJS' ability to interact with the operating system
 */

var chrome_command;
switch ( system.os.name ) {
case 'windows': chrome_command = 'chrome.exe'   ; break;
case 'linux'  : chrome_command = 'google-chrome'; break;
case 'mac'    : chrome_command = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'; break;
default:
   console.error( "Sorry, but your operating system (" + system.os.name + ") is not supported."  );
   phantom.exit(1);
}

// script-wide debugging:
phantom.onError = function(msg, trace) {
    var msgStack = ['PHANTOM ERROR: ' + msg];
    if (trace && trace.length) {
        msgStack.push('TRACE:');
        trace.forEach(function(t) {
            msgStack.push(' -> ' + (t.file || t.sourceURL) + ': ' + t.line + (t.function ? ' (in function ' + t.function +')' : ''));
        });
    }
    console.error(msgStack.join('\n'));
    phantom.exit(1);
};

/*
 * Replace PhantomJS' execFile() with something more useful:
 */
var execFile = childProcess.execFile;
childProcess.execFile = function(cmd, args, opts, cb) {

    // need to check both the callback and value of "exit":
    var calls = 0, err, stdout, stderr, code, has_finished = false;

    // run the command and get stdout/stderr:
    var ctx = execFile.call( childProcess, cmd, args, opts, function(_err,_stdout,_stderr) {
        setTimeout(function() {
            if ( !has_finished ) {
                console.log( cmd + ' returned but did not exit - does the command exist?' );
                code = 100;
                run_callback();
            }
        }, 1000 );
        err    = _err;
        stdout = _stdout;
        stderr = _stderr;
        if ( calls++ ) run_callback();
    });

    // also get the exit code:
    ctx.on("exit", function (_code) {
        code = _code;
        if ( calls++ ) run_callback();
    });

    // once we've got all the information, print STDERR and continue if there was no error:
    function run_callback() {
        if ( !has_finished ) {
            has_finished = true;
            if ( stderr != '' ) console.log(stderr.replace(/\n$/,''));
            if ( code ) program_counter.end(code);
            else if ( cb ) cb(null, stdout, stderr, code);
        }
    }

    return ctx;
}

/*
 * Create a symbolic link from source to target
 */
function symbolicLink( source, target ) {
    target.replace(/\//g, function() { source = '../' + source });
    if ( ! fs.isLink(target) ) {
        if ( system.os.name == 'windows' ) {
            childProcess.execFile('mklink',  [target,source] );
        } else {
            childProcess.execFile('ln', ["-s",source,target] );
        }
    }
}

/*
 * Create a hard link from source to target
 */
function hardLink( source, target ) {
    if ( fs.exists(target) ) fs.remove(target);
    if ( system.os.name == 'windows' ) {
        childProcess.execFile('mklink', ['/H',target,source]);
    } else {
        childProcess.execFile('ln'    ,      [source,target]);
    }
}

/*
 * Create a tree of directories
 */
function makeTree( directory ) {
    directory = directory.split( '/' );
    for ( var n=0; n!=directory.length; ++n ) {
        if ( !fs.exists( directory.slice( 0, n ).join( '/' ) ) )
            fs.makeDirectory(directory.slice( 0, n ).join( '/' ));
    }
}

// Sugar functions to make the containing directory and file link:
function makeTreeHardLink    ( source, target ) { makeTree( target.replace( /[^\/]+$/, '' ) );     hardLink( source, target ); }
function makeTreeSymbolicLink( source, target ) { makeTree( target.replace( /[^\/]+$/, '' ) ); symbolicLink( source, target ); }


/*
 * Return information about the specified files.
 * Currently returns an array of { name: ..., id: ..., modified: ... }
 * 'name' is the passed-in name, 'id' is the file's inode, and 'modified' is the modification time relative to the epoch.
 */
function stat( files, callback ) {
    // TODO: no idea how you'd do this on Windows
    files = files.filter( fs.exists );
    childProcess.execFile( 'stat', [ '--printf=%i %Y\n' ].concat(files), null, function(err,stdout,stderr) {
        var lines = stdout.split("\n");
        lines.pop(); // eat trailing newline
        callback( lines.map(function(line, index) {
            var rows = line.split(' ');
            return { name: files[index], id: rows[0], modified: rows[1] };
        }) );
    });
}

/*
 * PAGE UTILITIES
 * Functions to better interact with web pages
 */

function _waitForEvent( test, callback ) { // low-level interface - see waitFor* below

    // originally based on http://newspaint.wordpress.com/2013/04/05/waiting-for-page-to-load-in-phantomjs/

    var timeout = 20000;
    var expiry = new Date().getTime() + timeout;

    var interval = setInterval(checkEvent,100);

    var page = this;

    function checkEvent() {
        var failure_reason = test(this);
        if ( !failure_reason ) {
            clearInterval(interval);
            interval = undefined;
            if ( callback ) callback('success');
            return true;
        } else if ( new Date().getTime() > expiry ) {
            clearInterval(interval);
            //callback('fail');
            console.log('Waited for ' + timeout + 'ms, but ' + failure_reason + ' - see fail.png and fail.html');
            fs.write( 'fail.html', page.content );
            page.render('fail.png');
            return program_counter.end(1);
        }
        return false;
    };

    return checkEvent();

}

function _waitForElementsPresent( selectors, callback ) { // call callback when all selectors exist on the page

    if ( typeof(selectors) == "string" )
        selectors = [ selectors ];

    var page = this;

    return this.waitForEvent(
        function() {
            var missing_elements = selectors.filter(
                function(selector) {
                    return ! page.evaluate(function(selector) { return document.querySelector(selector) }, selector );
                }
            );
            if ( missing_elements.length )
                return JSON.stringify(missing_elements) + ' did not appear';
            else
                return null;
        },
        callback
    );

}

function _waitForElementsNotPresent( selectors, callback ) { // call callback when no selecters exist on the page

    if ( typeof(selectors) == "string" )
        selectors = [ selectors ];

    var page = this;

    return this.waitForEvent(
        function() {
            var present_elements = [];
            selectors.forEach(
                function(selector) {
                    if ( page.evaluate(function(selector) {return document.querySelector(selector)}, selector ) )
                        present_elements.push(selector);
                }
            );
            if ( present_elements.length )
                return JSON.stringify(present_elements) + ' remained present';
            else
                return null;
        },
        callback
    );

}

function _click(selector) { // click an HTML element
    var page = this;
    return this.waitForElementsPresent(
        [ selector ],
        function () {
            page.evaluate(function(selector) {
                var element = document.querySelector(selector);
                var event = document.createEvent("MouseEvent");
                event.initMouseEvent( "click", true, true, window, null, 0, 0, 0, 0, false, false, false, false, 0, null );
                element.dispatchEvent(event);
            }, selector);
        }
    );
}

function _submit_form(submit_selector, fields, callback) { // fill in the relevant fields, then click the submit button
    var page = this;
    return this.waitForElementsPresent(
        Object.keys(fields).concat([submit_selector]),
        function() {
            var file_inputs =
                page.evaluate(function(fields) {
                    return Object.keys(fields).filter(function(key) {
                        var element = document.querySelector(key);
                        if ( element.type == 'file' ) {
                            return true;
                        } else {
                            element.value = fields[key];
                            return false;
                        }
                    });
                }, fields);
            file_inputs.forEach(function(field) {
                var filename = fields[field];
                if ( filename ) {
                    if ( fs.exists(filename) ) {
                        page.uploadFile(field, filename);
                    } else {
                        console.log( "Tried to upload non-existent file: " + filename );
                        phantom.exit(1);
                    }
                }
            });
            page.click(submit_selector);
            if ( callback ) callback();
        }
    );
}

function _showConsoleMessage() { // show console.log() commands from page context (enabled by default)
    this.onConsoleMessage = function(message) {
        if ( message.search("\n") != -1 )
            message = ( "\n" + message ).replace( /\n(.)/g, "\n\t$1" );
        system.stderr.writeLine('console: ' + message);
    };
}

function _showResourceError() { // show errors loading resources
    console.log('Started logging resorce error');
    this.onResourceError = function(resourceError) {
        console.log('Unable to load resource (' + resourceError.url + ')');
        console.log('Error code: ' + resourceError.errorCode + '. Description: ' + resourceError.errorString);
    };
}
function _showResourceReceived() { // show information when resources are received from the web
    console.log('Started logging resorce received');
    this.onResourceReceived = function(response) {
        if ( response.stage == 'start' )
            console.log('Received ' + response.url + ': bodySize=' + response.bodySize)
    };
}

function _hideResourceError   () { console.log('Stopped logging resorce error'   ); this.onResourceError    = function() {} }
function _hideResourceReceived() { console.log('Stopped logging resorce received'); this.onResourceReceived = function() {} }
function _hideConsoleMessage  () {                                                  this.onConsoleMessage   = function() {} }

// Initialise a page object:
function page( url, callback ) {
    var page = require('webpage').create();
    page.onError = function(msg, trace) {
        var msgStack = ['PAGE ERROR: ' + msg];
        if (trace && trace.length) {
            msgStack.push('TRACE:');
            trace.forEach(function(t) {
                msgStack.push(' -> ' + (t.file || t.sourceURL) + ': ' + t.line + (t.function ? ' (in function ' + t.function +')' : ''));
            });
        }
        console.error(msgStack.join('\n'));
        phantom.exit(1);
    };
    page.waitForEvent              = _waitForEvent;
    page.waitForElementsPresent    = _waitForElementsPresent;
    page.waitForElementsNotPresent = _waitForElementsNotPresent;
    page.click                     = _click;
    page.submit_form               = _submit_form;
    page.showResourceError         = _showResourceError;
    page.showResourceReceived      = _showResourceReceived;
    page.hideResourceError         = _hideResourceError;
    page.hideResourceReceived      = _hideResourceReceived;
    page.showConsoleMessage        = _showConsoleMessage;
    page.hideConsoleMessage        = _hideConsoleMessage;

    page.showConsoleMessage();

    page.settings.loadImages = false;

    page.openBinary = function(url, settings, callback) {

        // PhantomJS refuses to download chunked data, do it with `curl` instead (TODO: make this work in Windows):

        if ( !callback ) {
            callback = settings;
            settings = {};
        }

        var args = [ "--silent", url, '-L' ];

        if ( settings.data     ) args = args.concat([ '-d', settings.data     ]);
        if ( settings.out_file ) args = args.concat([ '-o', settings.out_file ]);
        if ( settings.cookies  ) args = args.concat([ '-H', 'Cookie: ' + settings.cookies  ]);

        childProcess.execFile( 'curl', args, null, callback );
    }

    return page.open( url, function(status) {
        if (status == 'success') {
            callback(page);
        } else {
            console.log( "Couln't connect to " + url );
            return program_counter.end(1);
        }
    });
}

/*
 * MISCELLANEOUS BABELEXT-SPECIFIC UTILITIES
 */

/*
 * Keep track of asynchronous jobs, and exit when the last one finishes:
 */

function AsyncCounter(zero_callback) {
    this.count = 0;
    this.errors = 0;
    this.zero_callback = zero_callback
}
AsyncCounter.prototype.begin = function(      ) {                                   ++this.count };
AsyncCounter.prototype.end   = function(errors) { this.errors += (errors||0); if ( !--this.count ) this.zero_callback(this.errors) };

var program_counter = new AsyncCounter(function(errors) { phantom.exit(errors||0) });

/*
 * Build a resources.js file
 */
function build_resources() {
    var about = "BabelExt.about = " + JSON.stringify({
        version   : settings.version,
        build_time: new Date().toString()
    }) + ";\n";
    var xhr_regexp = "BabelExt._xhr_regexp = new RegExp('" + ( settings.xhr_regexp || '(?!)' ) + "');\n";

    if ( settings.resources ) {
        var resources = {};
        settings.resources.forEach(function(filename) {
            resources[filename] = fs.open(filename, 'r').read();
        });
        fs.write(
            'lib/BabelExtResources.js', "BabelExt.resources._resources = " +
                // prettify our JavaScript a bit, for the benefit of reviewers:
                JSON.stringify(resources, null, ' ').replace( /\\n(?!")/g, "\\n\" +\n    \"" ) + ";\n" +
                about + xhr_regexp,
            'w'
        );
    } else {
        fs.write( 'lib/BabelExtResources.js', about + xhr_regexp, 'w' );
    }
}

/*
 * Load settings from conf/settings.json
 */
var settings;
function update_settings() {

    try {
        settings = eval('('+fs.read('conf/settings.json')+')');
    } catch (e) {
        console.error(
            "Error in conf/settings.json: " + e + "\n" +
            "Please make sure the file is formatted correctly and try again."
        );
        phantom.exit(1);
    }
    if ( system.env.hasOwnProperty('ENVIRONMENT') ) {
        var environment_specific = settings.environment_specific[ system.env.ENVIRONMENT ];
        if ( !environment_specific ) {
            console.log(
                'Please specify one of the following build environments: ' +
                Object.keys(settings.environment_specific).join(' ')
            );
            phantom.exit(1);
        }
        Object.keys(environment_specific)
            .forEach(function(property, n, properties) {
                settings[ property ] =
                    ( Object.prototype.toString.call( settings[ property ] ) === '[object Array]' )
                    ? settings[ property ].concat( environment_specific[property] )
                    : environment_specific[property]
                ;
            });
    } else if ( settings.environment_specific ) {
        console.log(
            'Please specify build environment using the ENVIRONMENT environment variable, e.g.:\n\n' +
            '\texport ENVIRONMENT=' + Object.keys(settings.environment_specific)[0] + "\n\n" +
            'Alternatively, comment out the "environment_specific" section in settings.json'
        );
        phantom.exit(1);
    };
    settings.contentScriptFiles.unshift('lib/BabelExt.js');
    delete settings.environment_specific;

    if (
        settings.version.search(/^[0-9]+(?:\.[0-9]+){0,3}$/) ||
        settings.version.split('.').filter(function(number) { return number > 65535 }).length
    ) {
        console.log(
            'Google Chrome will not accept version number "' + settings.version + '"\n' +
            'Please specify a version number containing 1-4 dot-separated integers between 0 and 65535'
        );
        phantom.exit(1);
    }

    if ( settings.xhr_patterns ) {
        /*
         * Convert a "match pattern" to a regular expression
         * Different browsers implement this differently.
         * We treat Chrome's implementation as canonical: https://developer.chrome.com/extensions/match_patterns
         */
        var regexps = [];
        settings.xhr_patterns.forEach(function(pattern) {
            if ( pattern.replace( /^(\*|https?|file|ftp):\/\/(\*|(?:\*\.)?[^\/*]*)\/(.*)$/, function( url, protocol, domain, path ) {
                protocol = ( protocol == '*' ) ? 'https?' : protocol.replace( /[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g , "\\$&");
                domain   = domain.replace( /[\-\[\]\/\{\}\(\)\+\?\.\\\^\$\|]/g , "\\$&").replace( '*', '[^/]*' );
                path     = path  .replace( /[\-\[\]\/\{\}\(\)\+\?\.\\\^\$\|]/g , "\\$&").replace( '*', '.*' );
                regexps.push( protocol + '://' + domain + '/' + path );
                return url + ' ';
            }) == pattern ) {
                console.log( 'Ignoring invalid match pattern: ' + pattern );
            }
        });
        settings.xhr_regexp = '^(?:' + regexps.join('|') + ')$';
    }


    settings.preferences.forEach(function(preference) {
        /*
         * Known-but-unsupported types:
         * color - not supported by Safari
         * file - not supported by Safari
         * directory - not supported by Safari
         * control - not supported by Safari, not clear what we'd do with it anyway
         */
        if ( preference.type.search(/^(bool|boolint|integer|string|menulist|radio)$/) == -1 ) {
            console.log(
                'Preference type "' + preference.type + ' is not supported.\n' +
                'Please specify a valid preference type: bool, boolint, integer, string, menulist, radio\n'
            );
            phantom.exit(1);
        }
    });

}
update_settings();

/*
 * Load settings from conf/local_settings.json
 */
var local_settings;
if ( !fs.exists('conf/local_settings.json') ) {
    console.error(
        "Please create conf/local_settings.json (you can probably just rename conf/local_settings.json.example)"
    );
    phantom.exit(1);
}
try {
    local_settings = eval('('+fs.read('conf/local_settings.json')+')');
} catch (e) {
    console.error(
        "Error in conf/local_settings.json: " + e + "\n" +
        "Please make sure the file is formatted correctly and try again."
    );
    phantom.exit(1);
}

function get_changelog(callback) { // call the callback with the changelog text as its only argument

    if ( !local_settings.changelog_command )
        return console.log("Please specify the changelog command");
    if ( local_settings.changelog )
        return callback(local_settings.changelog);

    childProcess.execFile(
        local_settings.changelog_command[0],
        local_settings.changelog_command.splice(1),
        null,
        function(err,changelog,stderr) {
            if ( changelog == '' ) {
                console.log( "Error: empty changelog" );
                return program_counter.end(1);
            } else {
                callback( local_settings.changelog = changelog );
            }
        }
    );
}

/*
 * BUILD COMMANDS
 */

function build_safari(login_info) {

    var when_string = {
        'early' : 'Start',
        'middle': 'End',
        'late'  : 'End'
    };

    var document = new DOMParser().parseFromString(fs.read('build/Safari.safariextension/Info.plist'),"text/xml");

    function get_node( key ) {
        return document
            .evaluate( '//dict/key[.="' + key + '"]/following-sibling::*[1]', document, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null )
            .singleNodeValue
        ;
    }

    function set_key( key, value ) {
        get_node(key).textContent = value;
    }

    /*
     * PART ONE: build the Safari.safariextension directory:
     */

    // BabelExt IDs are UUIDs, but Safari IDs must be alphabetical:
    var map = {
        '0': 'a',
        '1': 'b',
        '2': 'c',
        '3': 'd',
        '4': 'e',
        '5': 'f',
        '6': 'g',
        '7': 'h',
        '8': 'i',
        '9': 'j',
        'a': 'k',
        'b': 'l',
        'c': 'm',
        'd': 'n',
        'e': 'o',
        'f': 'p',
        '-': 'q'
    };

    get_node('Author').textContent = settings.author;

    get_node('CFBundleDisplayName'       ).textContent = settings.title;
    get_node('CFBundleIdentifier'        ).textContent = 'com.honestbleeps.' + settings.id.replace( /(.)/g, function(char) { return map[char] });
    get_node('CFBundleShortVersionString').textContent = settings.version;
    get_node('CFBundleVersion'           ).textContent = settings.version;
    get_node('Description'               ).textContent = settings.description;
    get_node('Website'                   ).textContent = settings.website;
    get_node('DeveloperIdentifier'       ).textContent = settings.safari_team_id || '(not set)';

    var match_domains = get_node('Allowed Domains');
    while (match_domains.firstChild) match_domains.removeChild(match_domains.firstChild);
    settings.match_domains.forEach(function(match_domain) {
        var domain = document.createElement("string");
        domain.textContent = match_domain;
        match_domains.appendChild( document.createTextNode('\n\t\t\t\t') );
        match_domains.appendChild(domain);
    });
    match_domains.appendChild( document.createTextNode('\n\t\t\t') );

    var match_secure_domain = get_node('Include Secure Pages');
    match_secure_domain.parentNode.replaceChild(document.createElement((settings.match_secure_domain||false).toString()),match_secure_domain);

    var start_scripts = get_node('Start');
    var   end_scripts = get_node('End');

    while (start_scripts.firstChild) start_scripts.removeChild(start_scripts.firstChild);
    while (  end_scripts.firstChild)   end_scripts.removeChild(  end_scripts.firstChild);

    settings.contentScriptFiles.forEach(function(file) {

        makeTreeHardLink( file, 'build/Safari.safariextension/' + file )

        var script = document.createElement("string");
        script.textContent = file;

        if ( file == 'lib/BabelExt.js' || when_string[ settings.contentScriptWhen ] == 'Start' ) {
            start_scripts.appendChild( document.createTextNode('\n\t\t\t\t') );
            start_scripts.appendChild(script);
        } else {
              end_scripts.appendChild( document.createTextNode('\n\t\t\t\t') );
              end_scripts.appendChild(script);
        }
    });

    start_scripts.appendChild( document.createTextNode('\n\t\t\t') );
      end_scripts.appendChild( document.createTextNode('\n\t\t\t') );

    var stylesheets = get_node('Stylesheets');

    while (stylesheets.firstChild) stylesheets.removeChild(stylesheets.firstChild);

    settings.contentStyleFiles.forEach(function(file) {
        makeTreeHardLink( file, 'build/Safari.safariextension/' + file )

        var sheet = document.createElement("string");
        sheet.textContent = file;

        stylesheets.appendChild( document.createTextNode('\n\t\t\t') );
        stylesheets.appendChild(sheet);
    });

    stylesheets.appendChild( document.createTextNode('\n\t\t') );

    var xml_txt = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(document).replace(">",">\n") + "\n";
    fs.write( 'build/Safari.safariextension/Info.plist', xml_txt );

    if ( settings.preferences )
        function build_dict( preference, values ) {
            return '\t<dict>\n\t\t<key>DefaultValue</key>\n\t\t<string>' + preference.value + '</string>\n\t\t<key>Key</key>\n\t\t<string>' + preference.name + '</string>\n\t\t<key>Title</key>\n\t\t<string>' + preference.title + '</string>' +
                Object.keys(values).map(function(value) {
                    if      ( typeof(values[value]) == 'string'  ) return '\n\t\t<key>' + value + '</key>\n\t\t<string>' + values[value] + '</string>';
                    else if ( typeof(values[value]) == 'number'  ) return '\n\t\t<key>' + value + '</key>\n\t\t<real>' + values[value] + '</real>';
                    else if ( typeof(values[value]) == 'boolean' ) return '\n\t\t<key>' + value + '</key>\n\t\t<' + values[value] + '/>';
                    else    /* must be an array */                 return '\n\t\t<key>' + value + '</key>\n\t\t<array>' + values[value].map(function(v) { return '\n\t\t\t<string>'+v+'</string>'; }).join('') + '\n\t\t</array>'
                }).join('') +
	        '\n\t</dict>\n'
        }
        fs.write(
            'build/Safari.safariextension/Settings.plist',
            '<?xml version="1.0" encoding="UTF-8"?>\n' +
            '<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n' +
            '<plist version="1.0">\n' +
                '<array>\n' +
            settings.preferences.map(function(preference) {
                switch ( preference.type ) {
                case 'bool'    : return build_dict( preference, { Type: 'CheckBox' } );
                case 'boolint' : return build_dict( preference, { Type: 'CheckBox', FalseValue: 0, TrueValue: 1 } );
                case 'integer' : return build_dict( preference, { Type: 'Slider'   } );
                case 'string'  : return build_dict( preference, { Type: 'TextField', Password: false } );
                case 'menulist': return build_dict( preference, { Type: 'ListBox', Titles: preference.options.map(function(o) { return o.label }), Values: preference.options.map(function(o) { return o.value }),  } );
                case 'radio'   : return build_dict( preference, { Type: 'RadioButtons', Titles: preference.options.map(function(o) { return o.label }), Values: preference.options.map(function(o) { return o.value }),  } );
                }
            }).join('') +
                '</array>\n' +
            '</plist>\n',
            'w'
        );


    /*
     * PART TWO: build a signed .safariextz file
     */

    program_counter.begin();

    if ( fs.exists('build/safari-certs/AppleWWDRCA.cer') ) {
        check_xar();
    } else {

        if ( !login_info || login_info.skip ) {
            console.log( 'Please add Safari login details to local_settings.json to build a Safari package' );
            return program_counter.end(0);
        }

        if ( !login_info.password ) {
            if ( system.env.hasOwnProperty('APPLE_PASSWORD') ) {
                login_info.password = system.env.APPLE_PASSWORD;
            } else {
                console.log("Please specify a password for apple.com");
                return program_counter.end(1);
            }
        }

        if ( !fs.exists('build/safari-certs/id.rsa') ) {
            console.log(
                "Please generate a private key and Certificater Signature Request.\n" +
                "The private key should not have an associated password.\n" +
                "Example command:\n" +
                "openssl req -new -nodes -newkey rsa:2048 -keyout build/safari-certs/id.rsa -out build/safari-certs/request.csr"
            );
            return program_counter.end(1);
        }

        console.log( 'Generating keys...' );
        page( 'https://developer.apple.com/account/safari/certificate/certificateRequest.action', function(page) {

            var onError = page.onError;
            page.onError = function(msg, trace) {
                // Ignore expected error
                if ( msg != "TypeError: 'undefined' is not an object (evaluating 'document.form1.submit')" ) {
                    onError.call( page, msg, trace );
                }
            };

            page.submit_form(
                '#submitButton2',
                {
                    '#accountname'    : login_info.username,
                    '#accountpassword': login_info.password
                },
                function() {
                    page.onError = onError;
                    page.waitForElementsPresent(
                        [ 'form[name="certificateRequest"]' ],
                        function() {
                            page.click('a.submit');
                            page.waitForElementsPresent(
                                [ '#certificateSubmit' ],
                                function() {

                                    page.submit_form(
                                        'a.submit',
                                        {
                                            'input[name="upload"]': 'build/safari-certs/request.csr',
                                        },
                                        function() {
                                            page.waitForElementsPresent(
                                                [ '.downloadForm' ],
                                                function() {
                                                    var download_url = page.evaluate(function() {
                                                        return document.getElementsByClassName('blue')[0].getAttribute('href')
                                                    });
                                                    var cookies = page.cookies.map(function(cookie) { return cookie.name + '=' + cookie.value });
                                                    page.openBinary( 'https://developer.apple.com' + download_url, { cookies: cookies.join('; '), out_file: 'build/safari-certs/local.cer' }, function() {
                                                        page.openBinary(    'https://www.apple.com/appleca/AppleIncRootCertificate.cer', { out_file: 'build/safari-certs/AppleIncRootCertificate.cer' }, function() {
                                                            page.openBinary('https://developer.apple.com/certificationauthority/AppleWWDRCA.cer', { out_file: 'build/safari-certs/AppleWWDRCA.cer' }, check_xar );
                                                        });
                                                    });
                                                });
                                        });
                                }
                            );
                        }
                    );
                }
            );

        });

    }

    function check_xar() {
        page( 'http://mackyle.github.io/xar/', function(page) {

            var xar_url = page.evaluate(function() {
                return document.getElementsByClassName('down')[0].parentNode.getAttribute('href')
            });

            if ( fs.exists('build/xar-url.txt') && fs.read('build/xar-url.txt') == xar_url ) {
                console.log( 'XAR is up-to-date.' );
                build_safariextz();
            } else {
                console.log( 'Downloading xar archiver...' );
                page.openBinary(xar_url, { out_file: 'temporary_file.tar.gz' }, function() {
                    console.log( 'Unpacking xar archiver...', status );
                    if ( fs.exists( 'build/xar' ) ) fs.removeTree('build/xar');
                    fs.makeDirectory('build/xar');
                    childProcess.execFile( 'tar', ["zxf",'temporary_file.tar.gz','-C','build/xar','--strip-components=1'], null, function(err,stdout,stderr) {
                        console.log( 'Building xar archiver...', status );
                        if ( system.os.name == 'windows' ) {
                            // TODO: fill in real Windows values here (the following line is just a guess):
                            childProcess.execFile( 'cmd' , [    'cd build\\xar  ; ./configure  ; make'], null, finalise_xar );
                        } else {
                            childProcess.execFile( 'bash', ['-c','cd build/xar && ./configure && make'], null, finalise_xar );
                        }

                        function finalise_xar(err,stdout,stderr) {
                            fs.remove('temporary_file.tar.gz');
                            fs.write( 'build/xar-url.txt', xar_url, 'w' );
                            build_safariextz();
                        }

                    });
                });
            }

        });
    }

    function build_safariextz() {

        function run_commands(commands, then) {
            function run_command(err, stdout, stderr) {
                if ( commands.length ) {
                    var command = commands.shift();
                    return childProcess.execFile( command[0], command.splice(1), null, run_command );
                } else {
                    return then(err, stdout, stderr)
                }
            }
            run_command();
        }

        fs.changeWorkingDirectory('build');

        var xar = './xar/src/xar';
        var safariextz = '../out/' + settings.name + '.safariextz';

        run_commands([
            [ xar, '-czf', safariextz, '--distribution', 'Safari.safariextension' ],
            [ xar,   '-f', safariextz, '--sign', '--digestinfo-to-sign', 'safari-certs/tmp.dat', '--sig-size', 256, '--cert-loc', 'safari-certs/local.cer', '--cert-loc', 'safari-certs/AppleWWDRCA.cer', '--cert-loc', 'safari-certs/AppleIncRootCertificate.cer' ],
            [ 'openssl', 'rsautl', '-sign', '-inkey', 'safari-certs/id.rsa', '-in', 'safari-certs/tmp.dat', '-out', 'safari-certs/tmp.sig' ],
            [ xar,   '-f', safariextz, '--inject-sig', 'safari-certs/tmp.sig' ]
        ], function() {
            fs.remove('safari-certs/tmp.dat');
            fs.remove('safari-certs/tmp.sig');
            fs.changeWorkingDirectory('..');
            console.log('Built ' + safariextz.substr(3));
            return program_counter.end(0);
        });
    }


}

function build_firefox() {

    var when_string = {
        'early' : 'start',
        'middle': 'ready',
        'late'  : 'end'
    };

    // Copy scripts into place:
    fs.removeTree('build/Firefox/data'); // PhantomJS won't list dangling symlinks, so we have to just delete the directory and recreate it
    fs.makeDirectory('build/Firefox/data');

    var contentFiles = settings.contentScriptFiles.concat( settings.contentStyleFiles || [] );

    contentFiles.forEach(function(file) {
        makeTreeSymbolicLink( file, 'build/Firefox/data/' + file );
    });

    // Create settings.js:
    fs.write(
        'build/Firefox/lib/settings.js',
        'exports.include = [' +
        settings.match_domains.map(function(domain) {
            return (
                settings.match_secure_domain
                ? '"http://' + domain + '/*","https://' + domain + '/*"'
                : '"http://' + domain + '/*"'
            )
        }).join(',') +
        '];\n' +
        'exports.contentScriptWhen = "' + when_string[settings.contentScriptWhen] + '";\n' +
        'exports.contentScriptFile = ' + JSON.stringify(settings.contentScriptFiles) + ";\n" +
        'exports.contentStyleFile = ' + JSON.stringify(settings.contentStyleFiles || []) + ";\n"
        ,
        'w'
    );

    // Create package.json and copy icons into place:
    var pkg = {
        "description": settings.description,
        "license": settings.license,
        "author": settings.author,
        "version": settings.version,
        "title": settings.title,
        "id": settings.id,
        "name": settings.name
    };
    if (settings.icons[48]  ) { pkg.icon        = settings.icons[48]; makeTreeSymbolicLink( pkg.icon   , 'build/Firefox/'+pkg.icon    ); }
    if (settings.icons[64]  ) { pkg.icon_64     = settings.icons[64]; makeTreeSymbolicLink( pkg.icon_64, 'build/Firefox/'+pkg.icon_64 ); }
    if (settings.preferences) { pkg.preferences = settings.preferences; }
    fs.write( 'build/Firefox/package.json', JSON.stringify(pkg, null, '    ' ) + "\n", 'w' );

    program_counter.begin();

    // Check whether the Addon SDK is up-to-date:
    var page = webPage.create();
    page.onResourceError = function(resourceError) {
        console.log('Unable to load resource (' + resourceError.url + ')');
        console.log('Error code: ' + resourceError.errorCode + '. Description: ' + resourceError.errorString);
        return program_counter.end(1);
    };
    page.onResourceReceived = function(response) {
        if ( fs.exists('build/firefox-addon-sdk-url.txt') && fs.read('build/firefox-addon-sdk-url.txt') == response.redirectURL ) {
            console.log( 'Firefox Addon SDK is up-to-date.' );
            build_xpi();
        } else {
            console.log( 'Downloading Firefox Addon SDK...' );
            page.openBinary( response.redirectURL, { out_file: 'temporary_file.tar.gz' }, function() {
                fs.makeDirectory('build/firefox-addon-sdk');
                childProcess.execFile( 'tar', ["zxf",'temporary_file.tar.gz','-C','build/firefox-addon-sdk','--strip-components=1'], null, function(err,stdout,stderr) {
                    fs.remove('temporary_file.tar.gz');
                    fs.write( 'build/firefox-addon-sdk-url.txt', response.redirectURL, 'w' );
                    build_xpi();
                });
            });
        }
        page.stop(); // TODO: check which of these two we need
        page.close();
    };
    page.openUrl('https://ftp.mozilla.org/pub/mozilla.org/labs/jetpack/addon-sdk-latest.tar.gz', 'HEAD', page.settings);

    // Build the .xpi file:
    function build_xpi() {
        if ( system.os.name == 'windows' ) {
            // TODO: fill in real Windows values here (the following line is just a guess):
            childProcess.execFile( 'cmd' , [     'cd build\firefox-addon-sdk  ;        bin\activate  ; cd ../Firefox  ; cfx xpi'], null, finalise_xpi );
        } else {
            childProcess.execFile( 'bash', ['-c','cd build/firefox-addon-sdk && source bin/activate && cd ../Firefox && cfx xpi'], null, finalise_xpi );
        }
    }

    // Move the .xpi into place, fix its install.rdf, and update firefox-unpacked:
    function finalise_xpi(err, stdout, stderr) {
        fs.makeDirectory('out');
        var xpi = 'out/' + settings.name + '.xpi';
        if ( fs.exists(xpi) ) fs.remove(xpi);
        fs.list('build/Firefox').forEach(function(file) { if ( file.search(/\.xpi$/) != -1 ) fs.move( 'build/Firefox/' + file, xpi ); });
        fs.removeTree('build/firefox-unpacked');
        fs.makeDirectory('build/firefox-unpacked');
        childProcess.execFile( 'unzip', ['-d','build/firefox-unpacked',xpi], null, function(err,stdout,stderr) {
            fs.write(
                'build/firefox-unpacked/install.rdf',
                fs.read('build/firefox-unpacked/install.rdf').replace( /<em:maxVersion>.*<\/em:maxVersion>/, '<em:maxVersion>' + settings.firefox_max_version + '</em:maxVersion>' )
            );
            contentFiles.forEach(function(file) {
                fs.remove('build/firefox-unpacked/resources/'+settings.name+'/data/'+file);
                makeTreeSymbolicLink( file, 'build/firefox-unpacked/resources/'+settings.name+'/data/'+file )
            });
            fs.changeWorkingDirectory('build/firefox-unpacked');
            childProcess.execFile( 'zip', ['../../'+xpi,'install.rdf'], null, function(err,stdout,stderr) {
                fs.changeWorkingDirectory('../..');
                if ( stderr != '' ) { console.log(stderr.replace(/\n$/,'')); return program_counter.end(1); }
                console.log('Built ' + xpi + '\n\033[1mRemember to restart Firefox if you added/removed any files!\033[0m');
                return program_counter.end(0);
            });
        });
    }

}

function build_chrome() {

    var when_string = {
        'early' : 'document_start',
        'middle': 'document_end',
        'late'  : 'document_idle'
    };

    var match_urls = settings.match_domains.map(function(domain) {
        return ( settings.match_secure_domain ? "*://" : "http://" ) + domain + '/*';
    });

    var manifest = {
        "name": settings.title,
        "author": settings.author,
        "version": settings.version,
	"manifest_version": 2,
        "description": settings.description,
	"background": {
	    "scripts": ["background.js"]
	},
	"content_scripts": [
	    {
		"matches": match_urls,
		"js": settings.contentScriptFiles,
		"run_at": when_string[settings.contentScriptWhen],
		// Chrome defaults to only loading in the main frame, Firefox can only load in all frames.
		// Not sure which behaviour is better, but this at least makes it standard across browsers:
		"all_frames": true
	    }
	],
	"icons": settings.icons,
	"permissions": match_urls.concat([
	    "contextMenus",
	    "tabs",
	    "history",
	    "notifications"
	])
    };

    var contentFiles = settings.contentScriptFiles.concat(
        Object.keys(settings.icons).map(function(key) { return settings.icons[key] })
    );
    if ( settings.contentStyleFiles ) {
        manifest.content_scripts[0].css = settings.contentStyleFiles;
        contentFiles = contentFiles.concat( settings.contentStyleFiles );
    }


    var extra_files = [];

    if ( settings.xhr_patterns )
        manifest.permissions = settings.xhr_patterns.concat(manifest.permissions);

    if ( settings.preferences ) {
        manifest.options_page = "options.html";
        manifest.permissions.push('storage');
        manifest.background.scripts.unshift('preferences.js');
        extra_files.push('build/Chrome/'+manifest.background.scripts[0]);
        extra_files.push('build/Chrome/'+manifest.options_page);

        fs.list('build/Chrome').forEach(function(file) {
            if ( file[0] == '.' ) return;
            if ( file.search( /^(?:background\.js|chrome-bootstrap\.css|options\.js)$/ ) == 0 ) return;
            if ( fs.isDirectory(file) )
                fs.removeTree('build/Chrome/' + file);
            else
                fs.remove    ('build/Chrome/' + file);
        });

        if ( settings.autoReload ) manifest.permissions.push('webNavigation');

        fs.write(
            'build/Chrome/' + manifest.background.scripts[0],
            "var default_preferences = {" +
            settings.preferences.map(function(preference) {
                switch ( preference.type ) {
                case 'bool'   : return "'" + preference.name + "':" + (preference.value?'true':'false');
                case 'boolint': return "'" + preference.name + "':" + (preference.value?'1'   :'0'    );
                default       : return "'" + preference.name + "':" +  JSON.stringify(preference.value);
                }
            }).join(', ') +
            "};\n" +
            "var auto_reload = " + (settings.autoReload == 'timeout') + ";\n",
            'w'
        );

        fs.write(
            'build/Chrome/' + manifest.options_page,
            "<!DOCTYPE html>\n" +
            "<html>\n" +
            "<head><title>" + settings.title + " Options</title></head>\n" +
            '<link rel="stylesheet" type="text/css" href="chrome-bootstrap.css" />\n' +
            '<body class="chrome-bootstrap">\n' +
            '<div class="overlay">\n' +
            '<form class="page">\n' +
            '<h1>' + settings.title + '</h1>\n' +
            '<div class="content-area">\n' +
            settings.preferences.map(function(preference) {
                switch ( preference.type ) {
                case 'bool'   : return '<div class="checkbox"><span class="controlled-setting-with-label"><input class="pref" id="' + preference.name + '" ' + (preference.value?' checked':'') + ' type="checkbox"><label for="' + preference.name + '">' + preference.title + '</label></span></div>\n';
                case 'boolint': return '<div class="checkbox"><span class="controlled-setting-with-label"><input class="pref" id="' + preference.name + '" data-on="1" data-off="0"' + (preference.value?' checked':'') + ' type="checkbox"><label for="' + preference.name + '">' + preference.title + '</label></span></div>\n';
                case 'integer': return '<label title="' + preference.description + '">' + preference.title + ': <input id="' + preference.name + '" class="pref" type="number" value="' + preference.value + '"></label><br>\n';
                case 'string': return '<label title="' + preference.description + '">' + preference.title + ': <input id="' + preference.name + '" class="pref" type="text" value="' + preference.value + '"></label><br>\n';
                case 'menulist':
                    return '<div class="media-device-control"><span>' + preference.title + ':</span><select id="' + preference.name + '" class="pref weakrtl">' +
                        preference.options.map(function(option) {
                            return ' <option value="' + option.value + '"' + ( option.value == preference.value ? ' selected' : '' ) + '>' + option.label + '</option>\n';
                        }).join('') +
                        '</select></div>'
                    ;
                case 'radio':
                    return '<section><h3>' + preference.title + '</h3>' +
                        preference.options.map(function(option,index) {
                            return '<div class="radio"><span class="controlled-setting-with-label"><input id="' + preference.name + '-' + index + '" class="pref" type="radio" name="' + preference.name + '" value="' + option.value + '"' + ( option.value == preference.value ? ' checked' : '' ) + '><label for="' + preference.name + '-' + index + '">' + option.label + ( option.value == preference.value ? ' (recommended)' : '' ) + '</label></span></div>'
                        }).join('') + '</section>';
                }
            }).join('') +

            '</div>\n' +
            '<div class="action-area"></div>\n' + // no buttons because we apply changes on click, but the padding makes the page look better
            '</form>\n' +
            '</div>\n' +
            "<script src=\"options.js\"></script>\n" +
            "</body>\n" +
            "</html>\n",
            'w'
        );

    }

    // Create manifest.json:
    fs.write( 'build/Chrome/manifest.json', JSON.stringify(manifest, null, '\t' ) + "\n", 'w' );

    // Copy scripts and icons into place:
    contentFiles.forEach(function(file) { makeTreeHardLink( file, 'build/Chrome/' + file ) });

    program_counter.begin();

    // Create a Chrome key:
    if (fs.exists('build/Chrome.pem')) {
        build_crx();
    } else {
        childProcess.execFile(chrome_command, ["--pack-extension=build/Chrome"], null, build_crx );
    };

    // Build the .crx, move it into place, and build the upload zip file:
    function build_crx() {
        childProcess.execFile(chrome_command, ["--pack-extension=build/Chrome","--pack-extension-key=build/Chrome.pem"], null, function (err, stdout, stderr) {
            if ( stdout != 'Created the extension:\n\nbuild/Chrome.crx\n' ) console.log(stdout.replace(/\n$/,''));
            var crx = 'out/' + settings.name + '.crx';
            if ( fs.exists(crx) ) fs.remove(crx);
            fs.move( 'build/Chrome.crx', crx );
            console.log('Built ' + crx);
            if ( fs.exists('out/chrome-store-upload.zip') ) fs.remove('out/chrome-store-upload.zip');
            childProcess.execFile(
                'zip',
                ['out/chrome-store-upload.zip','build/Chrome/background.js','build/Chrome/manifest.json']
                    .concat( extra_files )
                    .concat( contentFiles.map(function(file) { return 'build/Chrome/'+file }) )
                ,
                null,
                function(err,stdout,stderr) {
                    console.log('Built out/chrome-store-upload.zip');
                    return program_counter.end(0);
                }
            );
        });
    };

}


/*
 * RELEASE COMMANDS
 */

function release_amo(login_info) {

    program_counter.begin();
    if ( !login_info.password ) {
        if ( system.env.hasOwnProperty('AMO_PASSWORD') ) {
            login_info.password = system.env.AMO_PASSWORD;
        } else {
            console.log("Please specify a password for addons.mozilla.org");
            return program_counter.end(1);
        }
    }

    var name = settings.name.substr(0,30);

    page( 'https://addons.mozilla.org/en-US/developers/addon/' + name + '/edit', function(page) { get_changelog(function(changelog) {

        page.evaluate( function() { Tabzilla.disableEasterEgg() });

        page.submit_form(
            "#login-submit",
            {
                "#id_username": login_info.username,
                "#id_password": login_info.password,
            }
        );

        page.waitForElementsPresent(
            [ '#edit-addon-basic a.button', '#edit-addon-media a.button' ],
            function() {
                setTimeout(function() {

                    function submit_section(section, values) {
                        // Doing the AJAX request manually turns out less hassle than clicking the buttons:
                        page.evaluate(function(addon, section, values) {
                            $.ajax({
                                async: false,
                                url: 'https://addons.mozilla.org/en-US/developers/addon/' + addon + '/edit_' + section + '/edit',
                                dataType: 'html',
                                success: function(html) {
                                    var data = {};
                                    $(html).find('[name]').each(function() {
                                        if ( $(this).filter(':radio,:checkbox').length ) {
                                            if ( $(this).prop('checked') ) {
                                                if ( !data.hasOwnProperty($(this).attr('name')) )
                                                    data[ $(this).attr('name') ]  =  [ $(this).val() ];
                                                else
                                                    data[ $(this).attr('name') ].push( $(this).val() );
                                            }
                                        } else {
                                            data[ $(this).attr('name') ] = $(this).val();
                                        };
                                    });
                                    Object.keys(values).forEach(function(key) {
                                        data[key] = values[key];
                                    });
                                    $.ajax({
                                        async: false,
                                        type: "POST",
                                        url: 'https://addons.mozilla.org/en-US/developers/addon/' + addon + '/edit_' + section + '/edit',
                                        headers: { 'X-CSRFToken': $('meta[name=csrf]').attr('content') },
                                        data: data,
                                        dataType: 'html',
                                        //success: function(html) { console.log(html) },
                                        traditional: true
                                    });
                                }
                            });
                        }, name, section, values);
                    }

                    submit_section( 'basic', {
                        'form-INITIAL_FORMS': 1,
                        'form-MAX_NUM_FORMS': 1000,
                        'form-TOTAL_FORMS'  : 1,
                        'name_en-us'        : settings.title,
                        'slug'              : settings.name.substr(0,30),
                        'summary_en-us'     : settings.description,
                    });

                    submit_section( 'details', {
                        'description_en-us': settings.long_description
                    });

                    var best_icon = settings.icons[64] || settings.icons[128] || settings.icons[32] || settings.icons[48] || settings.icons[16];
                    if ( best_icon ) {
                        page.click('#edit-addon-media a.button');
                        page.waitForElementsPresent(
                            [ '#id_icon_upload', '.edit-media-button.listing-footer button' ],
                            function() {
                                setTimeout(function() {
                                    page.submit_form(
                                        '#id_icon_upload',
                                        {
                                            '#id_icon_upload': best_icon
                                        },
                                        function() {
                                            setTimeout(function() {
                                                page.click('.edit-media-button.listing-footer button');
                                                page.waitForElementsNotPresent('#id_icon_upload', function() {
                                                    release_new_version();
                                                })
                                            }, 2000);
                                        }
                                    );
                                }, 2000 );
                            }
                        )
                    } else {
                        release_new_version();
                    };

                }, 1000 );

            }
        );

        function release_new_version() {
            page.open( 'https://addons.mozilla.org/en-US/developers/addon/' + name + '/versions#version-upload', function() {
                page.submit_form(
                    '#upload-addon',
                    {
                        '#upload-addon': 'out/' + settings.name + '.xpi'
                    },
                    function() {
                        page.waitForElementsPresent(
                            '#upload-status-results.status-pass',
                            function() {
                                page.click('#upload-file-finish');
                                page.submit_form(
                                    '.listing-footer button[type="submit"]',
                                    {
                                        '#id_releasenotes_0': changelog
                                    },
                                    function() {
                                        page.waitForElementsPresent(
                                            '.notification-box.success',
                                            function() {
                                                console.log('Released to https://addons.mozilla.org/en-US/firefox/addon/' + name);
                                                return program_counter.end(0);
                                                }
                                        );
                                    }
                                );
                            }
                        );
                    }
                );
            });
        }
    })});

}

function release_chrome(login_info) {

    program_counter.begin();
    if ( !login_info.password ) {
        if ( system.env.hasOwnProperty('CHROME_PASSWORD') ) {
            login_info.password = system.env.CHROME_PASSWORD;
        } else {
            console.log("Please specify a password for the Chrome store");
            return program_counter.end(1);
        }
    }

    page( 'https://chrome.google.com/webstore/developer/edit/' + login_info.id, function(page) {

        page.hideConsoleMessage();

        page.submit_form(
            "#signIn",
            {
                "#Email" : login_info.username,
                "#Passwd": login_info.password,
            },
            function() { change_details(page) }
        );

    });

    function change_details(page) {

        if ( settings.icons[128] ) {
            page.click(".id-upload-icon-image");
            setTimeout(function() {
                page.submit_form(
                    '.id-upload-image.cx-bold',
                    {
                        '#cx-img-uploader-input': settings.icons[128]
                    },
                    function() {
                        page.waitForElementsPresent(
                            [ 'b#cx-error-html' ],
                            function() {
                                setTimeout( publish_details, 1000 );
                            }
                        );
                    }
                );
            }, 100 );
        } else {
            publish_details();
        }

        function publish_details() {
            page.submit_form(
                '.id-publish',
                {
                    '#cx-dev-edit-desc': settings.description
                },
                function() {
                    setTimeout(function() {
                        page.click('.id-confirm-dialog-publish-ok');
                        page.waitForElementsPresent(
                            [ '#hist_state' ],
                            get_access_code
                        )
                    }, 100 );
                }
            );
        }

    };

    function get_access_code() {

        page(
            'https://accounts.google.com/o/oauth2/auth?response_type=code&scope=https://www.googleapis.com/auth/chromewebstore&redirect_uri=urn:ietf:wg:oauth:2.0:oob&client_id=' + login_info.client_id,
            function(page) {

                page.waitForElementsPresent(
                    '#submit_approve_access',
                    function() {
                        page.hideConsoleMessage();
                        setTimeout(
                            function() {
                                page.click('#submit_approve_access');
                                page.waitForElementsPresent(
                                    '#code',
                                    function() {
                                        var code = page.evaluate(function() { return document.getElementById('code').value });
                                        var post_data = "grant_type=authorization_code&redirect_uri=urn:ietf:wg:oauth:2.0:oob&client_id=" + login_info.client_id + "&client_secret=" + login_info.client_secret + "&code=" + code;
                                        page.openBinary( 'https://accounts.google.com/o/oauth2/token', { data: post_data }, upload_and_publish );
                                    }
                                )
                            },
                            3000
                        );
                    }
                );

            }
        );

        function upload_and_publish(err, data) {

            data = JSON.parse(data);

            var page = webPage.create();
            page.customHeaders = {
                "Authorization": "Bearer " + data.access_token,
                "x-goog-api-version": 2,
            };

            page.open(
                "https://www.googleapis.com/upload/chromewebstore/v1.1/items/" + login_info.id,
                'PUT',
                fs.open('out/chrome-store-upload.zip', 'rb').read(),
                function (status) {
                    if ( status == "success" ) {
                        var result = JSON.parse(page.plainText);
                        if ( result.error ) {
                            console.log( page.plainText );
                            return program_counter.end(1);
                        }
                        page.open(
                            "https://www.googleapis.com/chromewebstore/v1.1/items/" + login_info.id + "/publish",
                            'POST',
                            '',
                            function (status) {
                                if ( result.error ) {
                                    console.log( page.plainText );
                                    return program_counter.end(1);
                                }
                                if ( status == "success" ) {
                                    console.log('Released to https://chrome.google.com/webstore/detail/' + login_info.id);
                                    return program_counter.end(0);
                                } else {
                                    console.log( "Couln't upload new version" );
                                    return program_counter.end(1);
                                }
                            }
                        );
                    }
                }
            );

        }

    }

}

function release_opera(login_info) {

    program_counter.begin();
    if ( !login_info.password ) {
        if ( system.env.hasOwnProperty('OPERA_PASSWORD') ) {
            login_info.password = system.env.OPERA_PASSWORD;
        } else {
            console.log("Please specify a password for the Opera Developer site");
            return program_counter.end(1);
        }
    }

    get_changelog(function(changelog) {

        page( 'https://addons.opera.com/en-gb/developer/upgrade/' + settings.name, function(page) {

            page.submit_form(
                'button[type="submit"]',
                {
                    "#login-page-username": login_info.username,
                    "#login-page-password": login_info.password,
                }
            );

            page.submit_form(
                '.submit-button',
                {
                    '#id_package_file': 'out/' + settings.name + '.crx'
                },
                function() {
                    page.submit_form(
                        '.submit-button',
                        {
                            '#id_translations-0-short_description': settings.description,
                            '#id_translations-0-long_description' : settings.long_description,
                            '#id_translations-0-changelog'        : changelog,
                            '#id_target_platform-comment'         : login_info.tested_on,
                            '#id_icons-0-icon'                    : settings.icons[64] ? settings.icons[64] : undefined,
                        },
                        function() {
                            page.click('input.submit-button[type="submit"][name="approve_widget"]');
                            page.waitForElementsPresent(
                                [ '#dev-sel-container' ],
                                function() {
                                    console.log('Released to https://addons.opera.com/en-gb/extensions/details/' + settings.name);
                                    return program_counter.end(0);
                                }
                            );
                        }
                    );
                }
            );
        });

    });

}

function release_safari() {
    console.log(
        'The Safari extensions gallery just links to your actual download site.\n' +
        'This function is included only for completeness'
    );
}

/*
 * MAINTAIN COMMANDS
 */

function maintain() {

    program_counter.begin();

    function maintain_resources() {
        update_settings();
        if ( settings.resources ) {
            stat( [ 'lib/BabelExtResources.js' ].concat( settings.resources ), function(files) {
                var resources_file = files.shift();
                if ( files.filter(function(file) { return file.modified > resources_file.modified } ).length ) {
                    console.log( 'Rebuilding lib/BabelExtResources.js' );
                    build_resources();
                }
                maintain_content_files();
            });
        } else {
            maintain_content_files();
        }
    }

    function maintain_content_files() {
        var files = settings.contentScriptFiles.concat( settings.contentStyleFiles || [] );
        files = files.concat(
            files.map(function(name) { return 'build/Chrome/' + name })
        ).concat(
            files.map(function(name) { return 'build/Safari.safariextension/' + name })
        );

        stat( files, function(files) {
            var id_links = {}, name_links = {}; // list of file IDs that are valid hardlink targets
            files.forEach(function(file) {
                if ( file.name.search( '^build/' ) == -1 ) {
                     // source file - set hardlink target
                      id_links[ file.id   ] = file;
                    name_links[ file.name ] = file;
                } else if ( !id_links.hasOwnProperty(file.id) ) {
                    var source = name_links[ file.name.replace( /^build\/(?:[^\/]+)\//, '' ) ];
                    // need to recreate
                    if ( file.modified > source.modified ) {
                        console.log( file.name + ' is newer than ' + source.name + ' - please save the built contents back to the original' );
                    } else {
                        console.log( 'Relinking ' + file.name + ' to ' + source.name );
                        fs.remove( file.name );
                        hardLink(  source.name, file.name );
                    }
                }
            });

        });
    }

    maintain_resources();
    setInterval(maintain_resources, settings.maintenanceInterval );

}

/*
 * MAIN SECTION
 */

var args = system.args;

function usage() {
    console.log(
        settings.name + ' v' + settings.version + ' (built on BabelExt)\n' +
        'Usage: ' + args[0] + ' <command> <build|release> <firefox|chrome|safari>\n' +
        'Commands:\n' +
        '    build <target> - builds extensions for "amo" (Firefox) "chrome" or "safari"\n' +
        '    release <target> - release extension to "amo" (addons.mozilla.org) "chrome" (Chrome store), "opera" (opera site) or "safari" (extensions gallery)\n' +
        '    maintain - keep various files up-to-date'
    );
    phantom.exit(1);
}

program_counter.begin();

switch ( args[1] || '' ) {

case 'build':
    if ( args.length != 3 ) usage();
    build_resources();
    settings.contentScriptFiles.splice(1, 0, 'lib/BabelExtResources.js');
    switch ( args[2] ) {
    case 'firefox': build_firefox(local_settings.   amo_login_info); break;
    case 'chrome' : build_chrome (local_settings.chrome_login_info); break;
    case 'safari' : build_safari (local_settings.safari_login_info); break;
    default       : console.log( "Please specify 'firefox', 'chrome' or 'safari', not '" + args[2] + "'" ); break;
    }
    break;

case 'release':
    if ( args.length != 3 ) usage();
    switch ( args[2] ) {
    case 'amo'   : release_amo   (local_settings.   amo_login_info); break;
    case 'chrome': release_chrome(local_settings.chrome_login_info); break;
    case 'opera' : release_opera (local_settings. opera_login_info); break;
    case 'safari': release_safari(local_settings.safari_login_info); break;
    default       : console.log( "Please specify 'amo', 'chrome', 'opera' or 'safari', not '" + args[2] + "'" ); break;
    }
    break;

case 'maintain':

    maintain();
    break;

default:
    usage();

}
program_counter.end(0);
