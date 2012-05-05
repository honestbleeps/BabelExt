/*
 * BabelExt.js - contains the BabelExt object
 *
 */
var BabelExt = (function() {
  // define private variables here...
  var instance   = this;

  instance.detectedBrowser = '';
  // detect browser type and initialize accordingly...
  if (typeof(self.on) != 'undefined') {
    // firefox addon SDK
    instance.detectedBrowser = 'Firefox';
    // Firefox's DOM manipulation will be faster if we use unsafeWindow, so we'll shortcut
    // references to document and window to the appropriate unsafeWindow calls.
    document = unsafeWindow.document;
    window = unsafeWindow;
    // add an event listener for messages from the background page
    self.on('message', function(msgEvent) {
      switch (msgEvent.name) {
        case 'xmlhttpRequest':
          // Fire the appropriate onload function for this xmlhttprequest.
          instance.callbackQueue.onloads[msgEvent.callbackID](msgEvent.data);
          break;
        case 'localStorage':
          instance.callbackQueue.onloads[msgEvent.callbackID](msgEvent);
          break;
        case 'createTab':
          // we don't need to do anything here, but we could if we wanted to add something...
          break;
        default:
          console.log('unknown event type in self.on');
          break;
      }
    });
  } else if (typeof(chrome) != 'undefined') {
    // chrome
    instance.detectedBrowser = 'Chrome';
    // listen for events from Chrome's background page...
    chrome.extension.onRequest.addListener(
      function(request, sender, sendResponse) {
        switch(request.requestType) {
          default:
            // sendResponse({status: "unrecognized request type"});
            break;
        }
      }
    );
  } else if (typeof(opera) != 'undefined') {
    // opera
    instance.detectedBrowser = 'Opera';
    /*
     * Opera compatibility hacks
     *
     * Note: it's not recommended you use the localStorage function since that can easily be deleted
     * when the user clears history, etc. localStorage on its own is tied to the domain name
     * of the site and is more likely to be cleared.  You should instead use the BabelExt.storage API.
     *
     */
      localStorage = window.localStorage;
      location = window.location;
      XMLHttpRequest = window.XMLHttpRequest;

    // console.log = opera.postError;
    // listen for messages from opera's background page...
    // This is the message handler for Opera - the background page calls this function with return data...
    instance.operaMessageHandler = function(msgEvent) {
        var eventData = msgEvent.data;
        switch (eventData.msgType) {
          case 'xmlhttpRequest':
            // Fire the appropriate onload function for this xmlhttprequest.
            instance.callbackQueue.onloads[eventData.callbackID](eventData.data);
            break;
          case 'localStorage':
            instance.callbackQueue.onloads[eventData.callbackID](eventData);
            break;
          case 'createTab':
            // we don't need to do anything here, but we could if we wanted to add something...
            break;
          default:
            console.log('unknown event type in operaMessageHandler');
            break;
        }
    }
    opera.extension.addEventListener( "message", instance.operaMessageHandler, false); 
  } else if (typeof(safari) != 'undefined') {
    // safari
    instance.detectedBrowser = 'Safari';
    // This is the message handler for Safari - the background page calls this function with return data...
    instance.safariMessageHandler = function(msgEvent) {
      switch (msgEvent.name) {
        case 'xmlhttpRequest':
          // Fire the appropriate onload function for this xmlhttprequest.
          instance.callbackQueue.onloads[msgEvent.message.callbackID](msgEvent.message);
          break;
        case 'localStorage':
          instance.callbackQueue.onloads[msgEvent.message.callbackID](msgEvent.message);
          break;
        case 'createTab':
          // we don't need to do anything here, but we could if we wanted to add something...
          break;
        default:
          console.log('unknown event type in safariMessageHandler');
          break;
      }
    }
  // listen for messages from safari's background page...
    safari.self.addEventListener("message", safariMessageHandler, false);
  }

  /*
   * callbackQueue is a queue of callbacks to be executed on return data from the background page.
   * This is necessary due to the double-layered asynchronous calls we're making.  Calls to 
   * background pages are asynchronous as it is, so when we make an asynchronous call from the
   * foreground page to the background, we need to hold on to a reference to our callback that lives
   * in the context of the foreground, because Opera, Safari and Firefox do not allow you to pass
   * a foreground callback function to the background page.
   *
   * Note that this is not necessary in Chrome, because Chrome allows you to pass
   * a callback function to your background page, ostensibly handling this task
   * for the extension developer.
   */
  instance.callbackQueue = { count: 0, onloads: [] };

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
        if (typeof(callback) == 'function') {
          thisJSON.callbackID = callbackQueue.count;
          callbackQueue.onloads[callbackQueue.count] = callback;
          callbackQueue.count++;
        }
        self.postMessage(thisJSON);
      }
      break;
    case 'Chrome':
      instance.bgMessage = function(thisJSON, callback) {
        if (typeof(callback) != 'function') {
          var callback = function() {};
        }
        chrome.extension.sendRequest(thisJSON, callback);
      }
      break;
    case 'Opera':
      instance.bgMessage = function(thisJSON, callback) {
        if (typeof(callback) == 'function') {
          thisJSON.callbackID = callbackQueue.count;
          callbackQueue.onloads[callbackQueue.count] = callback;
          callbackQueue.count++;
        }
        opera.extension.postMessage(JSON.stringify(thisJSON));
      }
      break;
    case 'Safari':
      instance.bgMessage = function(thisJSON, callback) {
        if (typeof(callback) == 'function') {
          thisJSON.callbackID = callbackQueue.count;
          callbackQueue.onloads[callbackQueue.count] = callback;
          callbackQueue.count++;
        }
        safari.self.tab.dispatchMessage(thisJSON.requestType, thisJSON);
      }
      break;
    default:
      console.log("Something has gone horribly wrong. I can't detect your browser.")
      break;
  }

  /*
   * check the xmlHttpRequest function to see if it's cross domain, and pass to
   * the background page if appropriate.  If it's not, run as a normal xmlHttpRequest.
   * xmlhttpRequest = function(obj) {
  */
  instance.BabelXHR = function(obj) {
    var crossDomain = (obj.url.indexOf(location.hostname) == -1);

    if (crossDomain) {
      obj.requestType = 'xmlhttpRequest';
      if (typeof(obj.onload) == 'undefined') {
        obj.onload = function() {}; // anon function that does nothing, since none was specified...
      }
      instance.bgMessage(obj, obj.onload);
    } else {
      var request=new XMLHttpRequest();
      request.onreadystatechange=function() { if(obj.onreadystatechange) { obj.onreadystatechange(request); }; if(request.readyState==4 && obj.onload) { obj.onload(request); } }
      request.onerror=function() { if(obj.onerror) { obj.onerror(request); } }
      try { request.open(obj.method,obj.url,true); } catch(e) { if(obj.onerror) { obj.onerror( {readyState:4,responseHeaders:'',responseText:'',responseXML:'',status:403,statusText:'Forbidden'} ); }; return; }
      if(obj.headers) { for(name in obj.headers) { request.setRequestHeader(name,obj.headers[name]); } }
      request.send(obj.data); return request;
    }
  }

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
      }
      instance.bgMessage(thisJSON); // todo: add callback support
    }
  }

  /*
   * notifications - abstracted functions for creating notifications, though they are not natively
   *                 supported in all browsers, so they are "faked" in Safari and Opera
   *
   */
  instance.browserNotification = {
    create: function(title, text, icon) {
      switch(instance.detectedBrowser) {
        case 'Firefox':
          var thisJSON = {
            requestType: 'createNotification',
            icon: icon,
            title: title,
            text: text
          }
          instance.bgMessage(thisJSON);
          break;
        case 'Chrome':
          var thisJSON = {
            requestType: 'createNotification',
            icon: icon,
            title: title,
            text: text
          }
          instance.bgMessage(thisJSON);
          break;
        case 'Opera':
          var thisJSON = {
            requestType: 'createNotification',
            icon: icon,
            title: title,
            text: text
          }
          instance.bgMessage(thisJSON);
          break;
        case 'Safari':
          var thisJSON = {
            requestType: 'createNotification',
            icon: icon,
            title: title,
            text: text
          }
          instance.bgMessage(thisJSON);
          break;
      }
    }
  }

  /*
   * browserStorage - abstracted functions for get/set/remove based on browser...
   */
  instance.browserStorage = {
    get: function(key, callback) {
        var thisJSON =  {
          requestType: 'localStorage',
          operation: 'getItem',
          itemName: key
        }
        instance.bgMessage(thisJSON, callback);
    },
    set: function(key, value, callback) {
        var thisJSON =  {
          requestType: 'localStorage',
          operation: 'setItem',
          itemName: key,
          itemValue: value
        }
        instance.bgMessage(thisJSON, callback);
    },
    remove: function(key, callback) {
        var thisJSON =  {
          requestType: 'localStorage',
          operation: 'removeItem',
          itemName: key
        }
        instance.bgMessage(thisJSON, callback);
    }
  }

  /*
   * browserHistory - abstracted function for adding a URL to history
   *                  note: Only "add" is supported, because only Chrome supports any
   *                  other functionality beyond that. "add" is added to other browsers
   *                  as an iFrame hack.
   */
  instance.browserHistory = {
    add: function(url, callback) {
      switch (instance.detectedBrowser) {
        case 'Chrome':
          // do not add to history if browsing incognito!
          if (!(chrome.extension.inIncognitoContext)) {
            thisJSON = {
              requestType: 'addURLToHistory',
              url: url
            }
            instance.bgMessage(thisJSON);
            callback(url);
          }
          break;
        case 'Firefox':
            thisJSON = {
              requestType: 'addURLToHistory',
              url: url
            }
            instance.bgMessage(thisJSON);
            callback(url);
            break;
        case 'Opera':
        case 'Safari':
          instance.callbackQueue.onloads[instance.callbackQueue.count] = callback;
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
        instance.callbackQueue.onloads[callbackID](e.target.src);
      }, false);
      instance.browserHistory.historyFrame.style.display = 'none';
      instance.browserHistory.historyFrame.style.width = '0px';
      instance.browserHistory.historyFrame.style.height = '0px';
      instance.browserHistory.historyFrame.src = url;
      document.body.appendChild(instance.browserHistory.historyFrame);
    }
  }

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
        for (key in objA) { 
          if (key in objB) { continue; }
          objB[key] = objA[key];
        }
        return objB;
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
       *            note: index is not supported in Firefox or Opera, so it will be ignored
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
      }
      var finalObj = BabelExt.utils.merge(defaultObj, obj);
      instance.BabelXHR(obj);
    },


    /*
     * storage functions - handles opening and closing tabs, choosing if they're focused, etc.
     */
    storage: {
      /*
       * storage.get - gets storage for [key], calls callback with [return value] as parameter
       */
      get: function(key, callback) {
        if (typeof(callback) != 'function') {
          console.log('ERROR: no callback provided for BabelExt.storage.get()');
          return false;
        }
        instance.browserStorage.get(key, callback);
      },
      /*
       * storage.set - sets storage for [key] to [value], calls callback with key, value as parameters
       */
      set: function(key, value, callback) {
        if (typeof(callback) != 'function') {
          console.log('ERROR: no callback provided for BabelExt.storage.set()');
          return false;
        }
        instance.browserStorage.set(key, value, callback);
      },
      /*
       * storage.remove - deletes storage item at [key], calls callback with key as parameter
       */
      remove: function(key, callback) {
        if (typeof(callback) != 'function') {
          console.log('ERROR: no callback provided for BabelExt.storage.remove()');
          return false;
        }
        instance.browserStorage.remove(key, callback);
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

    detectedBrowser: instance.detectedBrowser
  };
})();
