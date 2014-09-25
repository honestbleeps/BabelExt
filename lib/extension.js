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
  var recognizedFeatures = ['save','load','tabCreate','notificationCreate','historyAdd', 'cssAdd'];
  for (var i=0, len=features.length; i<len; i++) {
    if (recognizedFeatures.indexOf(features[i].getAttribute('id')) != -1) {
      features[i].querySelector('form').style.display = 'block';
    } else {
      features[i].innerHTML = '<strong>This feature is unrecognized. It looks like your BabelExt extension is out of date!</strong>';
    }
  }

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

  BabelExt.contextMenu.create({
    type: 'normal',
    title: 'Say hi',
    onclick: function() {
      alert('Hi.');
    }
  });

  /* END KITCHEN SINK DEMO CODE */
})();