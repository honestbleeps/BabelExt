// Import the APIs we need.

var pageMod = require("sdk/page-mod");
var XMLHttpRequest = require("sdk/net/xhr").XMLHttpRequest;
var notifications = require("sdk/notifications");
var self = require("sdk/self");
var tabs = require("sdk/tabs");
var ss = require("sdk/simple-storage");
var workers = [];
var contextMenu = require("sdk/context-menu");
var priv = require("sdk/private-browsing");
var windows = require("sdk/windows").browserWindows;
var prefs = require("sdk/simple-prefs").prefs;

// require chrome allows us to use XPCOM objects...
const {Cc, Ci, Cu, Cr} = require("chrome");

var historyService = Cc["@mozilla.org/browser/history;1"].getService(Ci.mozIAsyncHistory);

// this function takes in a string (and optional charset, paseURI) and creates an nsURI object, which is required by historyService.addURI...
function makeURI(aURL, aOriginCharset, aBaseURI) {
	var ioService = Cc["@mozilla.org/network/io-service;1"].getService(Ci.nsIIOService);
	return ioService.newURI(aURL, aOriginCharset, aBaseURI);
}


function detachWorker(worker, workerArray) {
	var index = workerArray.indexOf(worker);
	if(index != -1) {
		workerArray.splice(index, 1);
	}
}
var localStorage = ss.storage;

// these aliases are just for simplicity, so that the code here looks just like background code
// for all of the other browsers...
localStorage.   getItem = function(key       ) { return ss.storage[key] };
localStorage.   setItem = function(key, value) { ss.storage[key] = value };
localStorage.removeItem = function(key       ) { delete ss.storage[key] };

var memoryStorage = { storage: {} };
memoryStorage.   getItem = function(key       ) { return memoryStorage.storage[key] };
memoryStorage.   setItem = function(key, value) { memoryStorage.storage[key] = value };
memoryStorage.removeItem = function(key       ) { delete memoryStorage.storage[key] };

var settings = require("./settings.js");

pageMod.PageMod({
  include: settings.include,
  contentScriptWhen: settings.contentScriptWhen,
  contentScriptFile: settings.contentScriptFile.map(function(file) { return self.data.url(file) }),
  contentStyleFile: settings.contentStyleFile.map(function(file) { return self.data.url(file) }),
  onAttach: function(worker) {
	tabs.on('activate', function(tab) {
		// run some code when a tab is activated...
	});

	workers.push(worker);
	worker.on('detach', function () {
		detachWorker(this, workers);
		// console.log('worker detached, total now: ' + workers.length);
    });

	worker.on('message', function(data) {
		var request = data;
		switch(request.requestType) {
			case 'xmlhttpRequest':
				var responseObj = {
					callbackID: request.callbackID,
					name: request.requestType
				};
				var xhr = new XMLHttpRequest();
				xhr.open(request.method, request.url, true, request.user, request.password);
				if (request.method === "POST") {
					xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
				}
				Object.keys(request.headers).forEach(function(header) { xhr.setRequestHeader(header, request.headers[header]) });
				if ( typeof(request.overrideMimeType) != 'undefined' ) xhr.overrideMimeType = request.overrideMimeType;
				xhr.onload = function() {
					responseObj.response = {status: xhr.status, statusText: xhr.statusText, responseText: xhr.responseText, _response_headers: xhr.getAllResponseHeaders()};
					worker.postMessage(responseObj);
				}
				xhr.onerror = function() {
					responseObj.response = {status: xhr.status, statusText: xhr.statusText, responseText: xhr.responseText, _response_headers: xhr.getAllResponseHeaders(), error: true};
					worker.postMessage(responseObj);
				}
				xhr.send(request.data);
				break;
			case 'createTab':
				var focus = (request.background !== true);
				tabs.open({url: request.url, inBackground: !focus });
				worker.postMessage({status: "success"});
				break;
			case 'createNotification':
				if (!request.icon) {
					// if no icon specified, make a single pixel empty gif so we don't get a broken image link.
					request.icon = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
				}
				notifications.notify({
					title: request.title,
					text: request.text,
					iconURL: request.icon
				});
				break;
			case 'localStorage':
				switch (request.operation) {
					case 'getItem':
						worker.postMessage({
							name: 'localStorage',
							callbackID: request.callbackID,
							status: true,
							key: request.itemName,
							value: localStorage.getItem(request.itemName)
						});
						break;
					case 'removeItem':
						localStorage.removeItem(request.itemName);
						worker.postMessage({
							name: 'localStorage',
							callbackID: request.callbackID,
							status: true,
							value: null
						});
						break;
					case 'setItem':
						localStorage.setItem(request.itemName, request.itemValue);
						worker.postMessage({
							name: 'localStorage',
							callbackID: request.callbackID,
							status: true,
							key: request.itemName,
							value: request.itemValue
						});
						break;
				}
				break;
			case 'memoryStorage':
				switch (request.operation) {
					case 'getItem':
						worker.postMessage({
							name: 'memoryStorage',
							callbackID: request.callbackID,
							status: true,
							key: request.itemName,
							value: memoryStorage.getItem(request.itemName)
						});
						break;
					case 'removeItem':
						memoryStorage.removeItem(request.itemName);
						worker.postMessage({
							name: 'memoryStorage',
							callbackID: request.callbackID,
							status: true,
							value: null
						});
						break;
					case 'setItem':
						memoryStorage.setItem(request.itemName, request.itemValue);
						worker.postMessage({
							name: 'memoryStorage',
							callbackID: request.callbackID,
							status: true,
							key: request.itemName,
							value: request.itemValue
						});
						break;
				}
				break;
			case 'preferences':
				switch (request.operation) {
					case 'getItem':
						worker.postMessage({
							name: 'preferences',
							callbackID: request.callbackID,
							status: true,
							key: request.itemName,
							value: prefs[request.itemName]
						});
						break;
					case 'setItem':
						prefs[request.itemName] = request.itemValue;
						worker.postMessage({
							name: 'preferences',
							callbackID: request.callbackID,
							status: true,
							key: request.itemName,
							value: request.itemValue
						});
						break;
				}
				break;
			case 'addURLToHistory':
				var isPrivate = priv.isPrivate(windows.activeWindow);
				if (isPrivate) {
					// do not add to history if in private browsing mode!
					return false;
				}
				var uri = makeURI(request.url);
				historyService.updatePlaces({
					uri: uri,
					visits: [{
						transitionType: Ci.nsINavHistoryService.TRANSITION_LINK,
						visitDate: Date.now() * 1000
					}]
				});
				break;
			case 'contextMenus.create':
				contextMenu.Item({
					label: request.obj.title,
					context: contextMenu.PageContext(),
					data: request.obj.onclick,
					contentScript: 'self.on("click", function (node, data) {' +
									'self.postMessage(data);' +
									'});',
					onMessage: function(onclick) {
						worker.postMessage({
							name: 'contextMenus.click',
							callbackID: onclick
						});
					}

				});
				break;
			case 'contextMenus.remove':
				// Run through the current context items and destroy the one with a matching name
				contextItems = contextMenu.contentContextMenu.items;
				var len = contextItems.length;
				for(var i =0; i < len; ++i){
					if(request.obj.title == contextItems[i].label){
						contextMenu.contentContextMenu.destroy(contextItems[i]);
						break;
					}
				}

				break;
			default:
				worker.postMessage({status: "unrecognized request type"});
				break;
		}

	});
  }
});
