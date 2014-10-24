#!/usr/bin/phantomjs --ssl-protocol=any

/*
 * Phantom JS build script
 *
 * Usage: phantomjs <build|release>
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

var chrome_command =
    ( system.os.name == 'windows' )
    ? 'chrome.exe'
    : 'google-chrome'
;

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
 * Create a symbolic link from source to target
 */
function symbolicLink( source, target ) {
    if ( ! fs.isLink(target) ) {
        if ( system.os.name == 'windows' ) {
            childProcess.execFile('mklink', [target,source], function(err, stdout, stderr) {
                if ( stderr != '' ) console.log(stderr.replace(/\n$/,''));
            });
        } else {
            childProcess.execFile('ln', ["-s",source,target], null, function(err, stdout, stderr) {
                if ( stderr != '' ) console.log(stderr.replace(/\n$/,''));
            });
        }
    }
}

/*
 * Create a hard link from source to target
 */
function hardLink( source, target ) {
    if ( fs.exists(target) ) fs.remove(target);
    if ( system.os.name == 'windows' ) {
        childProcess.execFile('mklink', ['/H',target,source], function(err, stdout, stderr) {
            if ( stderr != '' ) console.log(stderr.replace(/\n$/,''));
        });
    } else {
        childProcess.execFile('ln', [source,target], null, function(err, stdout, stderr) {
            if ( stderr != '' ) console.log(stderr.replace(/\n$/,''));
        });
    }
}

/*
 * Utility functions for pages
 */

function _waitForEvent( test, callback ) { // low-level interface - see waitFor* below

    // originally based on http://newspaint.wordpress.com/2013/04/05/waiting-for-page-to-load-in-phantomjs/

    var timeout = 10000;
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
            return program_counter.end();
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
            var missing_elements = [];
            selectors.forEach(
                function(selector) {
                    if ( ! page.evaluate(function(selector) {return document.querySelector(selector)}, selector ) )
                        missing_elements.push(selector);
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

    return page.open( url, function(status) {
        if (status == 'success') {
            callback(page);
        } else {
            console.log( "Couln't connect to " + url );
            return program_counter.end();
        }
    });
}

/*
 * Keep track of asynchronous jobs, and exit when the last one finishes:
 */

function AsyncCounter(zero_callback) {
    this.count = 0;
    this.zero_callback = zero_callback
}
AsyncCounter.prototype.begin = function() {       ++this.count };
AsyncCounter.prototype.end   = function() { if ( !--this.count ) this.zero_callback() };

var program_counter = new AsyncCounter(function() { phantom.exit(0) });

/*
 * Load settings from lib/settings.json
 */
var settings;
try {
    settings = eval('('+fs.read('lib/settings.json')+')');
} catch (e) {
    console.error(
        "Error in lib/settings.json: " + e + "\n" +
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
        'Please specify build environment using the ENVIRONMENT environment variable,\n' +
        'or comment out the "environment_specific" section in settings.json'
    );
    phantom.exit(1);
};
settings.contentScriptFiles.unshift('BabelExt.js');
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


/*
 * Load settings from lib/local_settings.json
 */
var local_settings;
try {
    local_settings = eval('('+fs.read('lib/local_settings.json')+')');
} catch (e) {
    console.error(
        "Error in lib/local_settings.json: " + e + "\n" +
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
            if ( stderr != '' ) console.log(stderr.replace(/\n$/,''));
            if (err) throw err;
            if ( changelog == '' ) {
                console.log( "Error: empty changelog" );
                return program_counter.end();
            } else {
                callback( local_settings.changelog = changelog );
            }
        }
    );
}

/*
 * BUILD COMMANDS
 */

function build_safari() {

    var when_string = {
        'early' : 'Start',
        'middle': 'End',
        'late'  : 'End'
    };

    var document = new DOMParser().parseFromString(fs.read('Safari.safariextension/Info.plist'),"text/xml");

    function get_node( key ) {
        return document
            .evaluate( '//dict/key[.="' + key + '"]/following-sibling::*[1]', document, null, XPathResult.ANY_UNORDERED_NODE_TYPE, null )
            .singleNodeValue
        ;
    }

    function set_key( key, value ) {
        get_node(key).textContent = value;
    }

    get_node('Author').textContent = settings.author;

    get_node('CFBundleDisplayName'       ).textContent = settings.title;
    get_node('CFBundleIdentifier'        ).textContent = 'com.honestbleeps.' + settings.id;
    get_node('CFBundleShortVersionString').textContent = settings.version;
    get_node('CFBundleVersion'           ).textContent = settings.version;
    get_node('Description'               ).textContent = settings.description;
    get_node('Website'                   ).textContent = settings.website;

    var match_domains = get_node('Allowed Domains');
    while (match_domains.firstChild) match_domains.removeChild(match_domains.firstChild);
    var domain = document.createElement("string");
    domain.textContent = settings.match_domain;
    match_domains.appendChild( document.createTextNode('\n\t\t\t\t') );
    match_domains.appendChild(domain);
    match_domains.appendChild( document.createTextNode('\n\t\t\t') );

    var match_secure_domain = get_node('Include Secure Pages');
    match_secure_domain.parentNode.replaceChild(document.createElement((settings.match_secure_domain||false).toString()),match_secure_domain);

    var start_scripts = get_node('Start');
    var   end_scripts = get_node('End');

    while (start_scripts.firstChild) start_scripts.removeChild(start_scripts.firstChild);
    while (  end_scripts.firstChild)   end_scripts.removeChild(  end_scripts.firstChild);

    settings.contentScriptFiles.forEach(function(file) {
        hardLink( 'lib/'+file, 'Safari.safariextension/' + file )

        var script = document.createElement("string");
        script.textContent = file;


        if ( file == 'BabelExt.js' || when_string[ settings.contentScriptWhen ] == 'Start' ) {
            start_scripts.appendChild( document.createTextNode('\n\t\t\t\t') );
            start_scripts.appendChild(script);
        } else {
              end_scripts.appendChild( document.createTextNode('\n\t\t\t\t') );
              end_scripts.appendChild(script);
        }
    });

    start_scripts.appendChild( document.createTextNode('\n\t\t\t') );
      end_scripts.appendChild( document.createTextNode('\n\t\t\t') );

    var xml_txt = '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(document).replace(">",">\n") + "\n";
    fs.write( 'Safari.safariextension/Info.plist', xml_txt );

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
            'Safari.safariextension/Settings.plist',
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

}

function build_firefox() {

    var when_string = {
        'early' : 'start',
        'middle': 'ready',
        'late'  : 'end'
    };

    // Create settings.js:
    fs.write(
        'Firefox/lib/settings.js',
        ( settings.match_secure_domain
          ? 'exports.include = ["http://' + settings.match_domain + '/*","https://' + settings.match_domain + '/*"];\n'
          :  'exports.include = ["http://' + settings.match_domain + '/*"];\n'
        ) +
        'exports.contentScriptWhen = "' + when_string[settings.contentScriptWhen] + '";\n' +
        'exports.contentScriptFile = ' + JSON.stringify(settings.contentScriptFiles) + ";\n"
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
    if (settings.icons[48]  ) { pkg.icon        = settings.icons[48]; symbolicLink( '../lib/'+pkg.icon   , 'Firefox/'+pkg.icon    ); }
    if (settings.icons[64]  ) { pkg.icon_64     = settings.icons[64]; symbolicLink( '../lib/'+pkg.icon_64, 'Firefox/'+pkg.icon_64 ); }
    if (settings.preferences) { pkg.preferences = settings.preferences; }
    fs.write( 'Firefox/package.json', JSON.stringify(pkg, null, '    ' ) + "\n", 'w' );

    // Copy scripts into place:
    fs.removeTree('Firefox/data'); // PhantomJS won't list dangling symlinks, so we have to just delete the directory and recreate it
    fs.makeDirectory('Firefox/data');
    settings.contentScriptFiles.forEach(function(file) { symbolicLink( '../../lib/'+file, 'Firefox/data/' + file ) });

    program_counter.begin();

    // Check whether the Addon SDK is up-to-date:
    var page = webPage.create();
    page.onResourceError = function(resourceError) {
        console.log('Unable to load resource (' + resourceError.url + ')');
        console.log('Error code: ' + resourceError.errorCode + '. Description: ' + resourceError.errorString);
        return program_counter.end();
    };
    page.onResourceReceived = function(response) {
        if ( fs.exists('firefox-addon-sdk-url.txt') && fs.read('firefox-addon-sdk-url.txt') == response.redirectURL ) {
            console.log( 'Firefox Addon SDK is up-to-date.' );
            build_xpi();
        } else {
            console.log( 'Downloading Firefox Addon SDK...' );
            // PhantomJS refuses to download any file as large as the SDK (I think it's either about the encoding or the file size)
            // do it with `curl` instead:
            console.log( 'Unpacking Firefox Addon SDK...', status );
            childProcess.execFile( 'curl', ['--silent',response.redirectURL,'-o','temporary_file.tar.gz'], null, function(err, stdout, stderr) {
                if ( stderr != '' ) { console.log(stderr.replace(/\n$/,'')); return program_counter.end(); }
                fs.makeDirectory('firefox-addon-sdk');
                childProcess.execFile( 'tar', ["zxf",'temporary_file.tar.gz','-C','firefox-addon-sdk','--strip-components=1'], null, function(err,stdout,stderr) {
                    if ( stderr != '' ) { console.log(stderr.replace(/\n$/,'')); return program_counter.end(); }
                    fs.remove('temporary_file.tar.gz');
                    fs.write( 'firefox-addon-sdk-url.txt', response.redirectURL, 'w' );
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
            childProcess.execFile( 'cmd' , [     'cd firefox-addon-sdk  ;        bin\activate  ; cd ../Firefox  ; cfx xpi'], null, finalise_xpi );
        } else {
            childProcess.execFile( 'bash', ['-c','cd firefox-addon-sdk && source bin/activate && cd ../Firefox && cfx xpi'], null, finalise_xpi );
        }
    }

    // Move the .xpi into place, fix its install.rdf, and update firefox-unpacked:
    function finalise_xpi(err, stdout, stderr) {
        if ( stderr != '' ) { console.log(stderr.replace(/\n$/,'')); return program_counter.end(); }
        fs.makeDirectory('build');
        var xpi = 'build/' + settings.name + '.xpi';
        if ( fs.exists(xpi) ) fs.remove(xpi);
        fs.list('Firefox').forEach(function(file) { if ( file.search(/\.xpi$/) != -1 ) fs.move( 'Firefox/' + file, xpi ); });
        fs.removeTree('firefox-unpacked');
        fs.makeDirectory('firefox-unpacked');
        childProcess.execFile( 'unzip', ['-d','firefox-unpacked',xpi], null, function(err,stdout,stderr) {
            if ( stderr != '' ) { console.log(stderr.replace(/\n$/,'')); return program_counter.end(); }
            fs.write(
                'firefox-unpacked/install.rdf',
                fs.read('firefox-unpacked/install.rdf').replace( /<em:maxVersion>.*<\/em:maxVersion>/, '<em:maxVersion>' + settings.firefox_max_version + '</em:maxVersion>' )
            );
            settings.contentScriptFiles.forEach(function(file) {
                fs.remove('firefox-unpacked/resources/'+settings.name+'/data/'+file);
                symbolicLink( '../../../../lib/'+file, 'firefox-unpacked/resources/'+settings.name+'/data/'+file )
            });
            fs.changeWorkingDirectory('firefox-unpacked');
            childProcess.execFile( 'zip', ['../'+xpi,'install.rdf'], null, function(err,stdout,stderr) {
                fs.changeWorkingDirectory('..');
                if ( stderr != '' ) { console.log(stderr.replace(/\n$/,'')); return program_counter.end(); }
                console.log('Built ' + xpi + '\n\033[1mRemember to restart Firefox if you added/removed any files!\033[0m');
                return program_counter.end();
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

    var match_url = ( settings.match_secure_domain ? "*://" : "http://" ) + settings.match_domain + '/*';

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
		"matches": [ match_url ],
		"js": settings.contentScriptFiles,
		"run_at": when_string[settings.contentScriptWhen]
	    }
	],
	"icons": settings.icons,
	"permissions": [
            match_url,
	    "contextMenus",
	    "tabs",
	    "history",
	    "notifications"
	]
    };

    if ( settings.preferences ) {
        manifest.options_page = "options.html";
        manifest.permissions.push('storage');
        manifest.background.scripts.unshift('preferences.js');

        fs.write(
            'Chrome/' + manifest.background.scripts[0],
            "var default_preferences = {" +
            settings.preferences.map(function(preference) {
                switch ( preference.type ) {
                case 'bool'   : return "'" + preference.name + "':" + (preference.value?'true':'false');
                case 'boolint': return "'" + preference.name + "':" + (preference.value?'1'   :'0'    );
                default       : return "'" + preference.name + "':" +  JSON.stringify(preference.value);
                }
            }).join(', ') +
            "};\n",
            'w'
        );

        fs.write(
            'Chrome/' + manifest.options_page,
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
    fs.write( 'Chrome/manifest.json', JSON.stringify(manifest, null, '\t' ) + "\n", 'w' );

    // Copy scripts and icons into place:
    settings.contentScriptFiles.forEach(function(file) { hardLink( 'lib/'+file               , 'Chrome/' + file                ) });
    Object.keys(settings.icons).forEach(function(key ) { hardLink( 'lib/'+settings.icons[key], 'Chrome/' + settings.icons[key] ) });

    program_counter.begin();

    // Create a Chrome key:
    if (fs.exists('Chrome.pem')) {
        build_crx();
    } else {
        childProcess.execFile(chrome_command, ["--pack-extension=Chrome"], null, function (err, stdout, stderr) {
            if ( stderr != '' ) { console.log(stderr.replace(/\n$/,'')); return program_counter.end(); }
            build_crx();
        });
    };

    // Build the .crx, move it into place, and build the upload zip file:
    function build_crx() {
        childProcess.execFile(chrome_command, ["--pack-extension=Chrome","--pack-extension-key=Chrome.pem"], null, function (err, stdout, stderr) {
            if ( stderr != '' ) { console.log(stderr.replace(/\n$/,'')); return program_counter.end(); }
            if ( stdout != 'Created the extension:\n\nChrome.crx\n' ) console.log(stdout.replace(/\n$/,''));
            var crx = 'build/' + settings.name + '.crx';
            if ( fs.exists(crx) ) fs.remove(crx);
            fs.move( 'Chrome.crx', crx );
            console.log('Built ' + crx);
            if ( fs.exists('build/chrome-store-upload.zip') ) fs.remove('build/chrome-store-upload.zip');
            childProcess.execFile(
                'zip',
                ['build/chrome-store-upload.zip','Chrome/background.js','Chrome/manifest.json']
                    .concat( settings.contentScriptFiles.map(function(file) { return 'Chrome/'+file }) )
                    .concat( Object.keys(settings.icons).map(function(key ) { return 'Chrome/' + settings.icons[key] }) )
                ,
                null,
                function(err,stdout,stderr) {
                    if ( stderr != '' ) { console.log(stderr.replace(/\n$/,'')); return program_counter.end(); }
                    console.log('Built build/chrome-store-upload.zip');
                    return program_counter.end();
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
            return program_counter.end();
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
                                            '#id_icon_upload': 'lib/'+best_icon
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
                        '#upload-addon': 'build/' + settings.name + '.xpi'
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
                                                return program_counter.end();
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
            return program_counter.end();
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
                        '#cx-img-uploader-input': 'lib/' + settings.icons[128]
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
                                        get_auth_key( page.evaluate(function() { return document.getElementById('code').value }) );
                                    }
                                )
                            },
                            3000
                        );
                    }
                );

            }
        );

        function get_auth_key(code) {
            var post_data = "grant_type=authorization_code&redirect_uri=urn:ietf:wg:oauth:2.0:oob&client_id=" + login_info.client_id + "&client_secret=" + login_info.client_secret + "&code=" + code;

            // PhantomJS refuses to download chunked data, do it with `curl` instead:
            childProcess.execFile( 'curl', ["--silent","https://accounts.google.com/o/oauth2/token",'-d',post_data], null, function(err, json, stderr) {
                if ( stderr != '' ) { console.log(stderr.replace(/\n$/,'')); return program_counter.end(); }
                upload_and_publish( JSON.parse(json) );
            });
        }

        function upload_and_publish(data) {

            var page = webPage.create();
            page.customHeaders = {
                "Authorization": "Bearer " + data.access_token,
                "x-goog-api-version": 2,
            };

            page.open(
                "https://www.googleapis.com/upload/chromewebstore/v1.1/items/" + login_info.id,
                'PUT',
                fs.open('build/chrome-store-upload.zip', 'rb').read(),
                function (status) {
                    if ( status == "success" ) {
                        var result = JSON.parse(page.plainText);
                        if ( result.error ) {
                            console.log( page.plainText );
                            return program_counter.end();
                        }
                        page.open(
                            "https://www.googleapis.com/chromewebstore/v1.1/items/" + login_info.id + "/publish",
                            'POST',
                            '',
                            function (status) {
                                if ( result.error ) {
                                    console.log( page.plainText );
                                    return program_counter.end();
                                }
                                if ( status == "success" ) {
                                    console.log('Released to https://chrome.google.com/webstore/detail/' + login_info.id);
                                    return program_counter.end();
                                } else {
                                    console.log( "Couln't upload new version" );
                                    return program_counter.end();
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
            return program_counter.end();
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
                    '#id_package_file': 'build/' + settings.name + '.crx'
                },
                function() {
                    page.submit_form(
                        '.submit-button',
                        {
                            '#id_translations-0-short_description': settings.description,
                            '#id_translations-0-long_description' : settings.long_description,
                            '#id_translations-0-changelog'        : changelog,
                            '#id_target_platform-comment'         : login_info.tested_on,
                            '#id_icons-0-icon'                    : settings.icons[64] ? 'lib/' + settings.icons[64] : undefined,
                        },
                        function() {
                            page.click('input.submit-button[type="submit"][name="approve_widget"]');
                            page.waitForElementsPresent(
                                [ '#dev-sel-container' ],
                                function() {
                                    console.log('Released to https://addons.opera.com/en-gb/extensions/details/' + settings.name);
                                    return program_counter.end();
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
    /*
     * Safari support is limited at the moment, as it's the least-used browser and the hardest to support.
     *
     * To release a Safari extension, start here: https://developer.apple.com/programs/safari/
     * For instructions on building a Safari extension package on the command line, start here: http://developer.streak.com/2013/01/how-to-build-safari-extension-using.html
     *
     * Patches welcome!
     *
     */
}

/*
 * MAIN SECTION
 */

var args = system.args;

function usage() {
    console.log(
        'Usage: ' + args[0] + ' <command> [<arguments>]\n' +
        'Commands:\n' +
        '    build - builds extensions for all browsers\n' +
        '    release <target> - release extension to either "amo" (addons.mozilla.org) "chrome" (Chrome store) or "opera" (Opera site)'
    );
    phantom.exit(1);
}

program_counter.begin();
switch ( args[1] || '' ) {

case 'build':
    if ( args.length != 2 ) usage();
    build_safari();
    build_firefox();
    build_chrome ();
    break;

case 'release':
    if ( args.length != 3 ) usage();
    switch ( args[2] ) {
    case 'amo'   : release_amo   (local_settings.   amo_login_info); break;
    case 'chrome': release_chrome(local_settings.chrome_login_info); break;
    case 'opera' : release_opera (local_settings. opera_login_info); break;
    case 'safari': release_safari(local_settings.safari_login_info); break;
    }
    break;

default:
    usage();

}
program_counter.end();
