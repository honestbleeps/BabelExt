/*
 * BabelExt.js - contains the BabelExt object
 *
 */
var Global = typeof window !== 'undefined' ? window : this;
var unsafeGlobal = typeof unsafeWindow !=='undefined' ? unsafeWindow : (Global||this);

/*
 * You can't log to the normal console from within a content script.
 * Console logging is extremely useful during development,
 * so this script makes console logging work as expected.
 */
var console = (function() {

    function log_in_embedded_page(command, args) {
        BabelExt.utils.runInEmbeddedPage('console.' + command + '.apply( console, ' + JSON.stringify(Array.prototype.slice.call( args, 0 )) + ')');
    }

    return {

        assert: function() { return log_in_embedded_page( 'assert', arguments ) },

        log   : function() { return log_in_embedded_page( 'log'   , arguments ) },

        trace : function() { return log_in_embedded_page( 'trace' , arguments ) },
        info  : function() { return log_in_embedded_page( 'info'  , arguments ) },
        warn  : function() { return log_in_embedded_page( 'warn'  , arguments ) },
        error : function() { return log_in_embedded_page( 'error' , arguments ) }

    };

})();

var BabelExt = (function(Global, unsafeGlobal) {
  'use strict';
  // define private variables here...
  var instance = {};

  instance.detectedBrowser = '';
  // detect browser type and initialize accordingly...
  var self = Global.self;
  var console = Global.console ? Global.console:{log:function(){}};
  var document = Global.document;
  var chrome = Global.chrome;
  var safari = Global.safari;
  var delayedMessagePort;
  var entityMap = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': '&quot;',
      "'": '&#39;',
      "/": '&#x2F;'
  };

  if (typeof(self.on) !== 'undefined') {
    // firefox addon SDK
    instance.detectedBrowser = 'Firefox';
    // Firefox's DOM manipulation will be faster if we use unsafeWindow, so we'll shortcut
    // references to document and window to the appropriate unsafeWindow calls.
    var window = unsafeGlobal;
    document = window.document;

    // add an event listener for messages from the background page
    self.on('message', function(msgEvent) {
      switch (msgEvent.name) {
        case 'xmlhttpRequest':
          // Fire the appropriate onload function for this xmlhttprequest.
          instance.callbackQueue.callbacks[msgEvent.callbackID](msgEvent.response);
          break;
        case 'localStorage':
        case 'preferences':
          instance.callbackQueue.callbacks[msgEvent.callbackID](msgEvent);
          break;
        case 'createTab':
          // we don't need to do anything here, but we could if we wanted to add something...
          break;
        case 'contextMenus.click':
          instance.callbackQueue.callbacks[msgEvent.callbackID](msgEvent);
          break;
        default:
          console.log('unknown event type in self.on');
          break;
      }
    });
  } else if (typeof(chrome) !== 'undefined') {
    // chrome
    instance.detectedBrowser = 'Chrome';
    // listen for events from Chrome's background page...
    chrome.runtime.onMessage.addListener(
      function(request, sender, sendResponse) {
        switch(request.requestType) {
          case "contextMenu.click":
            if (request.callbackID) {
              callbackQueue.callbacks[request.callbackID]();
            }
            break;
          default:
            // sendResponse({status: "unrecognized request type"});
            break;
        }
      }
    );
    delayedMessagePort = chrome.runtime.connect({name: "delayedMessage"});
      delayedMessagePort.onMessage.addListener(function(message) {
      switch(message.request.requestType) {
        case "preferences":
          if (message.request.callbackID) {
            callbackQueue.callbacks[message.request.callbackID](message.response);
          }
          break;
        default:
          // sendResponse({status: "unrecognized request type"});
          break;
      }
    });
  } else if (typeof(safari) !== 'undefined') {
    // safari
    instance.detectedBrowser = 'Safari';
    // This is the message handler for Safari - the background page calls this function with return data...
    instance.safariMessageHandler = function(msgEvent) {
      switch (msgEvent.name) {
        case 'xmlhttpRequest':
          // Fire the appropriate onload function for this xmlhttprequest.
          instance.callbackQueue.callbacks[msgEvent.message.callbackID](msgEvent.message);
          break;
        case 'localStorage':
        case 'preferences':
          instance.callbackQueue.callbacks[msgEvent.message.callbackID](msgEvent.message);
          break;
        case 'createTab':
          // we don't need to do anything here, but we could if we wanted to add something...
          break;
        case 'contextMenu.click':
          instance.callbackQueue.callbacks[msgEvent.message.obj.target.command](msgEvent.message.obj);
          break;
        default:
          console.log('unknown event type in safariMessageHandler');
          break;
      }
    };
    // listen for messages from safari's background page...
    safari.self.addEventListener("message", instance.safariMessageHandler, false);

  }

  /*
   * callbackQueue is a queue of callbacks to be executed on return data from the background page.
   * This is necessary due to the double-layered asynchronous calls we're making.  Calls to 
   * background pages are asynchronous as it is, so when we make an asynchronous call from the
   * foreground page to the background, we need to hold on to a reference to our callback that lives
   * in the context of the foreground, because Safari and Firefox do not allow you to pass
   * a foreground callback function to the background page.
   *
   * Note that this is not necessary in Chrome, because Chrome allows you to pass
   * a callback function to your background page, ostensibly handling this task
   * for the extension developer.
   */
  var callbackQueue = instance.callbackQueue = {
    callbacks: {},
    createId: function(prefix) {
      var rnd = Math.floor((Math.random()*65535)+1);
      if (prefix) rnd = prefix+rnd;
      
      if (this.callbacks.hasOwnProperty(rnd)) {
        return this.createId(prefix);
      }
      return rnd;
    },
    add: function(callback, id) {
      // TODO: although unlikely, we should probably ensure this id isn't
      // already in use and handle that accordingly.
      // if no id is specified, create one
      if (!id) {
        id = callbackQueue.createId();
      }
      this.callbacks[id] = callback;
      return id;
    }
  };

  // define private functions here...

  /*
   * bgMessage - sends a message to the browser's background page, expects:
   *              thisJSON - JSON formatted as follows:
   *              {
   *                requestType: 'localStorage',
   *                  // [other relevant data] depending on request type... for example, if requestType is localStorage:
   *                  operation: 'getItem'|'setItem'|'removeItem',
   *                  key: [key of item],
   *                  value: [value of item, if relevant]
   *              }
   */ 
  switch(instance.detectedBrowser) {
    case 'Firefox':
      instance.bgMessage = function(thisJSON, callback) {
        if (typeof(callback) === 'function') {
          thisJSON.callbackID = callbackQueue.add(callback);
        }
        self.postMessage(thisJSON);
      };
      break;
    case 'Chrome':
      instance.bgMessage = function(thisJSON, callback) {
        if (typeof(callback) === 'function') {
          thisJSON.callbackID = callbackQueue.add(callback);
        } else {
          callback = function() {};
        }
        switch ( thisJSON.requestType ) {
          case 'preferences':
            delayedMessagePort.postMessage(thisJSON);
            break;
          default:
            chrome.runtime.sendMessage(thisJSON, callback);
            break;
        }
      };
      break;
    case 'Safari':
      instance.bgMessage = function(thisJSON, callback) {
        if (typeof(callback) === 'function') {
          thisJSON.callbackID = callbackQueue.add(callback);
        }
        safari.self.tab.dispatchMessage(thisJSON.requestType, thisJSON);
      };
      break;
    default:
      console.log("Something has gone horribly wrong. I can't detect your browser.");
      break;
  }

  /*
   * check the xmlHttpRequest function to see if it's cross domain, and pass to
   * the background page if appropriate.  If it's not, run as a normal xmlHttpRequest.
   * xmlhttpRequest = function(obj) {
  */
  instance.BabelXHR = function(obj) {
    var crossDomain = (location) ? (obj.url.indexOf(location.hostname) === -1) : true;
    if (crossDomain) {
      obj.requestType = 'xmlhttpRequest';
      if (typeof(obj.onload) === 'undefined') {
        obj.onload = function() {}; // anon function that does nothing, since none was specified...
      }
      instance.bgMessage(obj, obj.onload);
    } else {
      var request=new XMLHttpRequest();
      request.onreadystatechange=function() {
        if(obj.onreadystatechange) {
          obj.onreadystatechange(request);
        }
        if(request.readyState==4 && obj.onload) {
          obj.onload(request);
        }
      };
      request.onerror=function() {if(obj.onerror) { obj.onerror(request); } };
      try {
        request.open(obj.method,obj.url,true);
      } catch(e) {
        if(obj.onerror) {
          obj.onerror( {
            readyState:4,
            responseHeaders:'',
            responseText:'',
            responseXML:'',
            status:403,
            statusText:'Forbidden'} );
        }
        return;
      }
      if(obj.headers) { for(var name in obj.headers) { request.setRequestHeader(name,obj.headers[name]); } }
      request.send(obj.data); return request;
    }
  };

  /*
   * tabs - abstracted functions for creating tabs, choosing if focused, and when applicable 
   *        assigning them an index (not supported in Firefox or Safari)
   */
  instance.browserTabs = {
    create: function(url, background, index) {
      var thisJSON = {
        requestType: 'createTab',
        url: url,
        background: background,
        index: index
      };
      instance.bgMessage(thisJSON); // todo: add callback support
    }
  };

  /*
   * notifications - abstracted functions for creating notifications, though they are not natively
   *                 supported in all browsers, so they are "faked" in Safari
   *
   */
  instance.browserNotification = {
    create: function(title, text, icon) {
      var thisJSON;
      switch(instance.detectedBrowser) {
        case 'Firefox':
          thisJSON = {
            requestType: 'createNotification',
            icon: icon,
            title: title,
            text: text
          };
          instance.bgMessage(thisJSON);
          break;
        case 'Chrome':
          thisJSON = {
            requestType: 'createNotification',
            icon: icon,
            title: title,
            text: text
          };
          instance.bgMessage(thisJSON);
          break;
        case 'Safari':
          thisJSON = {
            requestType: 'createNotification',
            icon: icon,
            title: title,
            text: text
          };
          instance.bgMessage(thisJSON);
          break;
      }
    }
  };

  /*
   * browserStorage - abstracted functions for get/set/remove based on browser...
   */
  instance.browserStorage = {
    get: function(key, callback) {
        var thisJSON =  {
          requestType: 'localStorage',
          operation: 'getItem',
          itemName: key
        };
        instance.bgMessage(thisJSON, callback);
    },
    set: function(key, value, callback) {
        var thisJSON =  {
          requestType: 'localStorage',
          operation: 'setItem',
          itemName: key,
          itemValue: value
        };
        instance.bgMessage(thisJSON, callback);
    },
    remove: function(key, callback) {
        var thisJSON =  {
          requestType: 'localStorage',
          operation: 'removeItem',
          itemName: key
        };
        instance.bgMessage(thisJSON, callback);
    }
  };

  /*
   * browserPreferences - abstracted functions for get/set/remove based on browser...
   */
  instance.browserPreferences = {
    get: function(key, callback) {
        var thisJSON =  {
          requestType: 'preferences',
          operation: 'getItem',
          itemName: key
        };
        instance.bgMessage(thisJSON, callback);
    },
    set: function(key, value, callback) {
        var thisJSON =  {
          requestType: 'preferences',
          operation: 'setItem',
          itemName: key,
          itemValue: value
        };
        instance.bgMessage(thisJSON, callback);
    }
  };

  /*
   * browserHistory - abstracted function for adding a URL to history
   *                  note: Only "add" is supported, because only Chrome supports any
   *                  other functionality beyond that. "add" is added to other browsers
   *                  as an iFrame hack.
   */
  instance.browserHistory = {
    add: function(url, callback) {
      if (!(/^[a-zA-Z][^:]+:/.test(url))) {
        url = 'http://' + url;
      }
      var thisJSON;
      switch (instance.detectedBrowser) {
        case 'Chrome':
          // do not add to history if browsing incognito!
          if (!(chrome.extension.inIncognitoContext)) {
            thisJSON = {
              requestType: 'addURLToHistory',
              url: url
            };
            instance.bgMessage(thisJSON);
            callback(url);
          }
          break;
        case 'Firefox':
            thisJSON = {
              requestType: 'addURLToHistory',
              url: url
            };
            instance.bgMessage(thisJSON);
            callback(url);
            break;
        case 'Safari':
          instance.callbackQueue.callbacks[instance.callbackQueue.count] = callback;
          if (!instance.browserHistory.initialized) {
            instance.browserHistory.initialized = true;
            instance.browserHistory.init(url, instance.callbackQueue.count);
          } else {
            // note: would like to use .contentWindow.location.replace() here, but cannot if it's a different
            // domain name than the one we're browsing due to security restrictions...
            // it may make sense to conditionally check that and act accordingly, but for now this will work.
            instance.browserHistory.historyFrame.setAttribute('callbackID',instance.callbackQueue.count);
            instance.browserHistory.historyFrame.src = url;
          }
          instance.callbackQueue.count++;
      }
    },
    init: function(url, callbackID) {
      instance.browserHistory.historyFrame = document.createElement('iframe');
      instance.browserHistory.historyFrame.setAttribute('ID', 'BabelExtHistoryFrame');
      instance.browserHistory.historyFrame.setAttribute('callbackID', callbackID);
      instance.browserHistory.historyFrame.addEventListener('load', function(e) {
        var callbackID = e.target.getAttribute('callbackID');
        instance.callbackQueue.callbacks[callbackID](e.target.src);
      }, false);
      instance.browserHistory.historyFrame.style.display = 'none';
      instance.browserHistory.historyFrame.style.width = '0px';
      instance.browserHistory.historyFrame.style.height = '0px';
      instance.browserHistory.historyFrame.src = url;
      document.body.appendChild(instance.browserHistory.historyFrame);
    }
  };

  /*
   * contextMenu - abstracted functions for adding a contextMenu item
   */
  instance.contextMenu = {
    /**
     * Creates a context menu with the provided parameters, and calls the
     * provided callback function upon click
     * 
     * @param  {Object}   obj      An object that specifies type, id, title and "checked" - optional default boolean
     * @param  {Function} callback [description]
     * @return {[type]}            [description]
     */
    create: function(obj, callback) {
      var thisJSON, callbackID;

      switch (instance.detectedBrowser) {
        case 'Chrome':
          // send a message to the background page to create this context menu
          if (typeof obj.onclick === 'function') {
            callbackID = callbackQueue.add(obj.onclick);
            obj.onclick = callbackID;
          }

          thisJSON = {
            requestType: 'contextMenus.create',
            obj: obj,
            callback: callback
          };
          instance.bgMessage(thisJSON); // todo: add callback support

          break;
        case 'Firefox':
          // send a message to the background page to create this context menu
          if (typeof obj.onclick === 'function') {
            callbackID = callbackQueue.add(obj.onclick);
            obj.onclick = callbackID;
          }

          thisJSON = {
            requestType: 'contextMenus.create',
            obj: obj,
            callback: callback
          };
          instance.bgMessage(thisJSON); // todo: add callback support

          break;
        case 'Safari':
          // send a message to the background page to create this context menu
          if (typeof obj.onclick === 'function') {
            callbackID = callbackQueue.add(obj.onclick);
            obj.onclick = callbackID;
          }

          thisJSON = {
            requestType: 'contextMenus.create',
            obj: obj,
            callback: callback
          };
          instance.bgMessage(thisJSON); // todo: add callback support

          break;
      }

    }
  };

  instance.params = {};
  location.search.substr(1).replace( /([^&=]*)=([^&]*)/g, function(match, key, value) {
    instance.params[ decodeURIComponent(key) ] = decodeURIComponent(value);
  });

  return { // public interface
    /*
     * utility functions - useful functions used by BabelExt to perform certain operations...
     *                     these functions are exposed publicly since they may be useful to a developer.
     */
    utils: {
      /*
       * merge: merges two objects (useful for creating defaults for functions that take a data object as a parameter)
       *  - 
       *
       */
      merge: function(objA, objB) {
        for (var key in objA) { 
          if (key in objB) { continue; }
          objB[key] = objA[key];
        }
        return objB;
      },
      /*
       * Escape HTML characters in a string
       */
      escapeHTML: function(text) {
        return String(text).replace(/[&<>"'\/]/g, function (c) {
          return entityMap[c];
        });
      },
      /* For security reasons, some scripts need to be run in the context of the embedded page
       * NOTE: do not use this to inject run content loaded remotely -
       * the reviewers at addons.mozilla.org will reject your code because they can't check said code.
       */
      runInEmbeddedPage: function(content) {
        var script = document.createElement('script');
        script.textContent = '(function() {' + content + '})();';
        document.documentElement.appendChild(script);
        // remove the script so developers don't see thousands of redundant tags cluttering the DOM:
        setTimeout(function() { document.documentElement.removeChild(script) }, 0 );
      },
      params: instance.params,

      /*
       * If your plugin needs to perform different actions on different pages,
       * You can use this to dispatch page-specific actions.
       */
      dispatch: function() {

        var pathname = location.pathname,
            params = instance.params,
            handlers = Array.prototype.slice.call( arguments, 0 ),
            stash = {};

        // check whether a string meets the specified test(s)
        function check_match( string, tests ) {
          if ( tests instanceof Array ) {
            for ( var n=0; n!=tests.length; ++n )
              if ( check_match(string, tests[n]) ) return true;
          } else if ( typeof(tests) == 'string' ) {
            return string == tests;
          } else if ( typeof(tests) == "number" ) {
            return string == (""+tests);
          } else if ( tests instanceof RegExp ) {
            return tests.test(string);
          } else if ( typeof(tests) == "boolean" ) {
              return tests;
          } else {
            throw "Only arrays, strings, numbers, RegExps and booleans are allowed in match_*";
          }
        }

        function next_handler() { // check and execute the next handler

          if ( !handlers.length ) return;
          var handler = handlers.shift();

          // Check match_* to see if this handler should be executed:
          if ( handler.match_pathname && !check_match(pathname, handler.match_pathname) )
            return next_handler();
          if ( handler.match_params ) {
            for ( var param in handler.match_params )
              if ( handler.match_params.hasOwnProperty(param) )
                  if ( !params.hasOwnProperty(param) || !check_match( params[param], handler.match_params[param] ) )
                  return next_handler();
          }

          // handler should be executed, retrieve arguments
          var args = [ stash, pathname, params ];
          next_handler_elements();

          // match, wait for and retrieve elements:
          function next_handler_elements() {
            if ( !handler.hasOwnProperty('match_elements') ) return next_handler_storage();
            if ( !( handler.match_elements instanceof Array ) ) handler.match_elements = [ handler.match_elements ];

            var next_match = 0, observer;

            if      ( typeof(      MutationObserver) != 'undefined' ) observer = new       MutationObserver(observe_mutation);
            else if ( typeof(WebKitMutationObserver) != 'undefined' ) observer = new WebKitMutationObserver(observe_mutation);
            else throw 'ERROR: This browser does not have a MutationObserver - cannot wait for elements to exist';

            function observe_mutation() {
              while ( next_match != handler.match_elements.length ) {
                var element = document.querySelector(handler.match_elements[next_match]);
                if ( !element ) return;
                args.push( element );
                ++next_match;
              }
              observer.disconnect();
              return next_handler_storage();
            }
            observe_mutation();
            if ( next_match != handler.match_elements.length ) {
                observer.observe(document, { childList: true, subtree: true });
            }

          }

          function next_handler_storage() {
            function get(data) {
              args.push(data ? data.value : undefined);
              if ( handler.pass_storage.length )
                BabelExt.storage.get(handler.pass_storage.shift(), get );
              else
                next_handler_preferences();
            }
            // retrieve arguments from storage:
            if ( handler.hasOwnProperty('pass_storage') ) {
              if ( !( handler.pass_storage instanceof Array ) ) handler.pass_storage = [ handler.pass_storage ];
              BabelExt.storage.get(handler.pass_storage.shift(), get );
            } else {
              next_handler_preferences();
            }
          }

          // retrieve arguments from preferences:
          function next_handler_preferences() {
            function get(data) {
              args.push(data ? data.value : undefined);
              if ( handler.pass_preferences.length )
                BabelExt.preferences.get(handler.pass_preferences.shift(), get );
              else
                next_handler_handle();
            }
            if ( handler.hasOwnProperty('pass_preferences') ) {
              if ( !( handler.pass_preferences instanceof Array ) ) handler.pass_preferences = [ handler.pass_preferences ];
              BabelExt.preferences.get(handler.pass_preferences.shift(), get );
            } else {
              next_handler_handle();
            }
          }

          // execute handler:
          function next_handler_handle() {
              try {
                  if ( handler.callback.apply( document, args ) !== false )
                    return next_handler();
              } catch (error) {
                  console.error( 'handler failed', handler, error.toString() );
                  throw error;
              };
          }

        }

        next_handler();

      }

    },

    /*
     * tab functions - handles opening and closing tabs, choosing if they're focused, etc.
     */
    tabs: {
      /*
       * open:
       *  - url - URL to open tab to
       *  - focused - boolean, true = focused, false = background
       *  - index - index to open tab at (i.e. 0th tab? nth tab?)
       *            note: index is not supported in Firefox, so it will be ignored
       */
      create: function(url, focused, index) {
        instance.browserTabs.create(url, focused, index);
      }
    },

    /*
     * notification functions - handles triggering notifications.
     */
    notification: {
      /*
       * create:
       *  - title - title of notification
       *  - text - text to display in notification
       *  - icon - icon to display in notifiction
       */
      create: function(title, text, icon) {
        instance.browserNotification.create(title, text, icon);
      }
    },

    /*
     * xhr - takes an object containing any of the typically accepted GM_xmlHttpRequest parameters
     *       - see documentation here: http://wiki.greasespot.net/GM_xmlhttpRequest
     *
     */
    xhr: function(obj) {
      var defaultObj = {
        method: 'GET'
      };
      var finalObj = BabelExt.utils.merge(defaultObj, obj);
      instance.BabelXHR(obj);
    },


    /*
     * storage functions
     */
    storage: {
      /*
       * storage.get - gets storage for [key], calls callback with [return value] as parameter
       */
      get: function(key, callback) {
        if (typeof(callback) !== 'function') {
          throw 'ERROR: no callback provided for BabelExt.storage.get()';
        }
        instance.browserStorage.get(key, callback);
      },
      /*
       * storage.set - sets storage for [key] to [value], calls callback with key, value as parameters
       */
      set: function(key, value, callback) {
        instance.browserStorage.set(key, value, callback || function() {});
      },
      /*
       * storage.remove - deletes storage item at [key], calls callback with key as parameter
       */
      remove: function(key, callback) {
        instance.browserStorage.remove(key, callback || function() {});
      }
    },

    /*
     * preference functions
     */
    preferences: {
      /*
       * preferences.get - gets preferences for [key], calls callback with [return value] as parameter
       */
      get: function(key, callback) {
        if (typeof(callback) !== 'function') {
          throw 'ERROR: no callback provided for BabelExt.preferences.get()';
        }
        instance.browserPreferences.get(key, callback);
      },
      /*
       * preferences.set - sets preferences for [key] to [value], calls callback with key, value as parameters
       */
      set: function(key, value, callback) {
        instance.browserPreferences.set(key, value, callback || function() {});
      }
    },

    /*
     * history functions - handles adding a URL to browser history
     */
    history: {
      /*
       * add:
       *  - url - URL to open tab to
       *  - callback - this function will be called (with url as a parameter) when history addition is complete
       */
      add: function(url, callback) {
        instance.browserHistory.add(url, callback);
      }
    },

    /*
     * css functions - handles adding css to the current page
     */
    css: {
      // the CSS text content that will get added...
      content: '',
      /*
       * add:
       *  - css - css rules to be added to the queue - NOTE: you must call the render function for it to get to the page!
       *          this is for efficiency's sake, as adding style tags repeatedly can be computationally expensive.
       */
      add: function(css) {
        this.content += css;
      },
      /*
       * render - this adds the current css queue to the page, then clears the queue. Usually you'll just want to call this once
       *          at the end of your script.
       */
      render: function() {
        var style = document.createElement('style');
        style.textContent = this.content;
        // clear out the css content in case render might be called multiple times (although it shouldn't, it's less efficient)
        this.content = '';
        var head = document.getElementsByTagName('head')[0];
        if (head) {
          head.appendChild(style);
        }
      }

    },

    contextMenu: {
      create: function(obj, callback) {
        instance.contextMenu.create(obj, callback);
      }
    },

    detectedBrowser: instance.detectedBrowser
  };
})(Global, unsafeGlobal);
