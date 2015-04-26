// ==UserScript==
// @name          BabelExt Extension
// @namespace     http://babelext.com/
// @description   An extension built with BabelExt
// @copyright     2013, Steve Sobel (http://babelext.com/)
// @author        honestbleeps
// @include       http://babelext.com/*
// @version       0.95
// ==/UserScript==

/*
 * extension.js - contains your code to be run on page load
 *
 */
(function(u) {
  // Any code that follows will run on document ready...

  /*
   * GREASEMONKEY COMPATIBILITY SECTION - you can remove these items if you're not porting a GM script.
   *
   * WARNING: GM_setValue, GM_getValue, GM_deleteValue are NOT ideal to use! These are only present
   * for the sake of easy porting/compatibility, but they will use localStorage, which can easily be erased
   * by the user if he/she clears cookies or runs any "privacy" software...
   *
   * Ideally, you should update any Greasemonkey scripts you want to port to perform asynchronous calls to
   * BabelExt.storage.get and .set instead of using localStorage, but a simple replacement won't work due
   * to the asynchronous nature of extension-based localStorage (and similar) calls.
   *
   */
  GM_xmlhttpRequest = BabelExt.xhr;
  GM_setValue = localStorage.setItem;
  GM_getValue = localStorage.getItem;
  GM_deleteValue = localStorage.removeItem;
  GM_log = console.log;
  GM_openInTab = BabelExt.tabs.create;
  // NOTE: you'll want to add a render() function call at the end of your GM script for compatibility.
  GM_addStyle = BabelExt.css.add;

  /* BEGIN KITCHEN SINK DEMO CODE */

 /*
  * The code below is for testing / execution on the BabelExt website at:
  * http://babelext.com/demo.html
  *
  * You should remove this code, and replace it with your own!
  *
  */
  // hide the "install BabelExt" message, and show the kitchen sink demos...
  var installBabelExt = document.getElementById('installBabelExt');
  var container = document.getElementById('container');
  if (installBabelExt && container) {
    container.style.display = 'block';
    installBabelExt.style.display = 'none';
  }

  // show each available kitchen sink demo, let the user know the extension is out of date if there's an unrecognized demo...
  var features = document.body.querySelectorAll('.featureContainer');
  var recognizedFeatures = ['save','load','savePref','loadPref','tabCreate','notificationCreate','historyAdd', 'cssAdd'];
  for (var i=0, len=features.length; i<len; i++) {
    if (recognizedFeatures.indexOf(features[i].getAttribute('id')) != -1) {
      features[i].querySelector('form').style.display = 'block';
    } else {
      features[i].innerHTML = '<strong>This feature is unrecognized. It looks like your BabelExt extension is out of date!</strong>';
    }
  }

  // BabelExt.storage stores data like localStorage:
  var setValueForm = document.getElementById('setValueForm');
  if (setValueForm) {
    setValueForm.addEventListener('submit', function(e) {
      e.preventDefault();
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

  var getValueForm = document.getElementById('getValueForm');
  if (getValueForm) {
    getValueForm.addEventListener('submit', function(e) {
      e.preventDefault();
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

  // BabelExt.memoryStorage is similar to BabelExt.storage, but only stores data in memory
  // This is useful for sensitive data that needs to persist for the duration of the browser
  // WARNING: during development, memoryStorage is cleared when you reload the extension
  var setMemoryValueForm = document.getElementById('setMemoryValueForm');
  if (setMemoryValueForm) {
    setMemoryValueForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var keyEle = document.getElementById('setMemoryKey');
      var valueEle = document.getElementById('setMemoryValue');
      if (keyEle && valueEle) {
        var key = keyEle.value;
        var val = valueEle.value;
        BabelExt.storage.set(key, val, function() {
          var keyEle = document.getElementById('setMemoryKey');
          var valueEle = document.getElementById('setMemoryValue');
          keyEle.value = '';
          valueEle.value = '';
          alert('value set successfully');
        });
      }
    });
  }

  var getMemoryValueForm = document.getElementById('getMemoryValueForm');
  if (getMemoryValueForm) {
    getMemoryValueForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var keyEle = document.getElementById('getMemoryKey');
      if (keyEle) {
        var key = keyEle.value;
        var val = BabelExt.storage.get(key, function(returnData) {
          var retreivedMemoryValueEle = document.getElementById('retreivedmemoryvalue');
          retreivedMemoryValueEle.innerHTML = returnData.value || '';
        });
      }
    });
  }

  var setPrefValueForm = document.getElementById('setPrefValueForm');
  if (setPrefValueForm) {
    setPrefValueForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var keyEle = document.getElementById('setPrefKey');
      var valueEle = document.getElementById('setPrefValue');
      if (keyEle && valueEle) {
        var key = keyEle.value;
        var val = valueEle.value;
        if ( key == 'myBool' ) val = !!val
        else if ( key != 'myRadio' && key != 'myString' ) val = parseInt(val,10);
        BabelExt.preferences.set(key, val, function() {
          var keyEle = document.getElementById('setPrefKey');
          var valueEle = document.getElementById('setPrefValue');
          keyEle.value = '';
          valueEle.value = '';
          alert('value set successfully');
        });
      }
    });
  }

  var getPrefValueForm = document.getElementById('getPrefValueForm');
  if (getPrefValueForm) {
    getPrefValueForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var keyEle = document.getElementById('getPrefKey');
      if (keyEle) {
        var key = keyEle.value;
        var val = BabelExt.preferences.get(key, function(returnData) {
          var retreivedPrefValueEle = document.getElementById('retreivedprefvalue');
          retreivedPrefValueEle.innerHTML = returnData.value;
        });
      }
    });
  }

  var setResValueForm = document.getElementById('setResValueForm');
  if (setResValueForm) {
    setResValueForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var keyEle = document.getElementById('setResKey');
      var valueEle = document.getElementById('setResValue');
      if (keyEle && valueEle) {
        var key = keyEle.value;
        var val = valueEle.value;
        if ( key == 'myBool' ) val = !!val
        else if ( key != 'myRadio' && key != 'myString' ) val = parseInt(val,10);
        BabelExt.resources.set(key, val );
        var keyEle = document.getElementById('setResKey');
        var valueEle = document.getElementById('setResValue');
        keyEle.value = '';
        valueEle.value = '';
        alert('value set successfully');
      }
    });
  }

  var getResValueForm = document.getElementById('getResValueForm');
  if (getResValueForm) {
    getResValueForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var keyEle = document.getElementById('getResKey');
      if (keyEle) {
        var key = keyEle.value;
        var val = BabelExt.resources.get(key);
        var retreivedResValueEle = document.getElementById('retreivedresvalue');
        retreivedResValueEle.innerHTML = val;
      }
    });
  }

  var createTabForm = document.getElementById('createTabForm');
  if (createTabForm) {
    createTabForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var urlEle = document.getElementById('url');
      var bgEle = document.getElementById('background');
      if (urlEle && bgEle) {
        var url = urlEle.value;
        var bg = bgEle.checked;
        BabelExt.tabs.create(url, bg);
      }
    });
  }

  var createNotificationForm = document.getElementById('createNotificationForm');
  if (createNotificationForm) {
    createNotificationForm.addEventListener('submit', function(e) {
      e.preventDefault();
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

  var historyAddForm = document.getElementById('historyAddForm');
  if (historyAddForm) {
    historyAddForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var urlEle = document.getElementById('historyurl');
      if (urlEle) {
        url = urlEle.value;
        BabelExt.history.add(url, function(url) { alert('url added to history: ' + url); });
      }
    });
  }

  var cssAddForm = document.getElementById('cssAddForm');
  if (cssAddForm) {
    cssAddForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var css = document.getElementById('css');
      if (css) {
        var cssText = css.value;
        BabelExt.css.add(cssText);
        BabelExt.css.render();
        css.value = '';
      }
    });
  }

  // clean stale menu in case user reloads page
  BabelExt.contextMenu.remove({
    title: 'Say hi',
  });

  BabelExt.contextMenu.create({
    type: 'normal',
    title: 'Say hi',
    onclick: function() {
      alert('Hi.');
    }
  });

  // Information about the extension (e.g. version, build time)
  console.log( BabelExt.about );

  // Simple framework for logging issues to the page:
  var debugLog = BabelExt.debugLog();
  debugLog.log( 'hello, world!' );
  debugLog.show();

  // XMLHttpRequest-compatible API (supports cross-site requests and mixed content):
  // see also BabelExt.xhr()
  var same_site_xhr = new BabelExt.XMLHttpRequest();
  same_site_xhr.open( 'GET', location.origin );
  same_site_xhr.onreadystatechange = function() {
      console.log( this.readyState, this.responseText );
  }
  same_site_xhr.send();

  var cross_site_xhr = new BabelExt.XMLHttpRequest();
  cross_site_xhr.open( 'GET', 'http://www.w3.org/' );
  cross_site_xhr.onreadystatechange = function() {
      console.log( this.readyState, this.responseText );
  }
  cross_site_xhr.send();

  /*
   * Dispatcher
   *
   * If you need to run different code on different pages,
   * this utility provides a convenient way to dispatch
   * different handler based on page properties...
   */
  BabelExt.utils.dispatch(

    {
      callback: function(stash) {
        console.log('this handler is called on every page');
        stash.myValue = "stashed values are available to later callbacks";
      }
    },

    {
      callback: function(stash) {
        console.log('handlers are called in the order they are defined - this is called second.');
        console.log(stash.myValue);
        }
    },

    {
      // handlers must match at least one of the rules in each of match_pathname and match_params,
      // and also match every rule in match_elements.  So for the rule below:
      // 'mypage.html' - does not match match_params, callback will not be called
      // 'nomatch.html?myparam=foo' - does not match match_pathname, callback will not be called
      // 'mypage.html?myparam=foo' - matches, callback will be called
      match_pathname: [ 'mypage.html', /otherpage/ ], // handler is only called on /mypage.html and pages matching the regexp /otherpage/
      match_params: {
        myparam: [ 'foo', /bar/ ], // handler is only called on pages that contain a matching 'myparam' parameter
        requiredparam: true, // handler is only called if 'requiredparam' is present
        disallowedparam: false // handler is only called if 'disallowedparam' is not present
      },
      match_elements: [ '#foo', '.bar' ], // handler is only called when both matching elements are found (see "gotcha" below)
      pass_storage: [ 'foo', 'bar' ], // pass stored variables 'foo' and 'bar' to the callback
      pass_preferences: [ 'baz', 'qux' ], // pass preferences 'baz' and 'qux' to the callback
      callback: function( stash, pathname, params, foo, bar, baz, qux ) {
        return false; // skip callbacks after this one
      }
    },

    {
      callback: function() {
        console.log('this handler will never be called, because the previous handler returned false.');
      }
    }

  );

  // Consider putting each group of handlers in a different dispatch() call.
  // BabelExt.utils.dispatch() runs commands in order and waits forever for "match_elements" to appear.
  // So if an element doesn't exist on a page, it will block all later handlers in the same dispatch()

  /* END KITCHEN SINK DEMO CODE */
})();
