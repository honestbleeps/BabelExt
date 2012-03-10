/*
 * extension.js - contains the BabelExt object, and your code to be run on page load
 *
 *
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
          instance.callbackQueue.onloads[msgEvent.callbackID](msgEvent.response);
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
   * override the xmlHttpRequest function to check if it's cross domain, and pass to
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

  return { // public interface
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
    xhr: function(obj) {
      instance.BabelXHR(obj);
    },
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
    detectedBrowser: instance.detectedBrowser
  };
})();

(function(u) {
  // this will run on document ready...
  
  /*
   * NOTE: Opera will run this on EVERY page! It does not have a "run only on matching domains" feature
   * like Firefox, Safari and Chrome all have.  If you want to restrict execution to certain sites, this
   * is the place to add some code to check location.href and return false if not a match.
   *
   */

  /*
   * GREASEMONKEY COMPATIBILITY SECTION
   *
   * WARNING: GM_setValue, GM_getValue, GM_deleteValue are NOT ideal to use! These are only being
   * added for easy porting/compatibility, but they will use localStorage, which can easily be erased
   * by the user if he/she clears cookies or runs any "privacy" software...
   *
   */
  GM_xmlhttpRequest = BabelExt.xhr;
  GM_setValue = localStorage.setItem;
  GM_getValue = localStorage.getItem;
  GM_deleteValue = localStorage.removeItem;
  GM_log = console.log;

  /*
   * Simple storage get/set/remove examples...
   *
   * BabelExt.storage.set('hello','world', setCallback);
   * - where setCallback is an optional function that will be called after the data is set
   *
   * BabelExt.storage.get('hello',getCallback);
   * - where getCallback is a *required* function that will receive the value of the 'hello' key, e.g.:
   *  function getCallback(returnData) {
   *     console.log(returnData.value);
   *  }
   *
   * BabelExt.storage.remove('hello',removeCallback);
   * - where removeCallback is an optional function that will be called after the data is removed
   *
   */

  /*
   * Simple tab open example...
   *
   * BabelExt.tab.open('http://www.google.com/', 1); // 1 means open in background
   */
  
  /*
   * Simple xhr example...
   *
   * BabelExt.xhr({
   *   method: "GET",
   *   url: 'http://www.babelext.com/',
   *   onload: function(data) {
   *     console.log(data);
   *   }
   * });
   *
   */

   /* kitchen sink demo code 
    *
    * The code below is for testing / execution on the BabelExt website at: 
    * http://babelext.com/demo.html
    *
    * You should remove this code, and replace it with your own.
    *
    */
    var setValueButton = document.getElementById('setValueButton');
    if (setValueButton) {
      setValueButton.addEventListener('click', function() {
        var keyEle = document.getElementById('setKey');
        var valueEle = document.getElementById('setValue');
        if (keyEle && valueEle) {
          var key = keyEle.value;
          var val = valueEle.value;
          BabelExt.storage.set(key, val, function() {  
            var keyEle = document.getElementById('setKey');
            var valueEle = document.getElementById('setValue');
            keyEle.value = '';
            valueEle.value = '';
            alert('value set successfully');
          });
        }
      });
    }

    var getValueButton = document.getElementById('getValueButton');
    if (getValueButton) {
      getValueButton.addEventListener('click', function() {
        var keyEle = document.getElementById('getKey');
        if (keyEle) {
          var key = keyEle.value;
          var val = BabelExt.storage.get(key, function(returnData) {  
            var retreivedValueEle = document.getElementById('retreivedvalue');
            retreivedValueEle.innerHTML = returnData.value || '';
          });
        }
      });
    }

    var createTabButton = document.getElementById('createTabButton');
    if (createTabButton) {
      createTabButton.addEventListener('click', function() {
        var urlEle = document.getElementById('url');
        var bgEle = document.getElementById('background');
        if (urlEle && bgEle) {
          var url = urlEle.value;
          var bg = bgEle.checked;
          BabelExt.tabs.create(url, bg);
        }
      });
    }
  
    var createNotificationButton = document.getElementById('createNotificationButton');
    if (createNotificationButton) {
      createNotificationButton.addEventListener('click', function() {
        var titleEle = document.getElementById('notificationTitle');
        var textEle = document.getElementById('notificationText');
        var iconEle = document.getElementById('notificationIcon');
        if (titleEle && textEle) {
          var title = titleEle.value;
          var text = textEle.value;
          var icon = iconEle.value;
          BabelExt.notification.create(title, text, icon);
        }
      });
    }

})();

