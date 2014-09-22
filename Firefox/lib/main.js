// Import the APIs we need.

var pageMod = require("sdk/page-mod");
var Request = require("sdk/request").Request;
var notifications = require("sdk/notifications");
var self = require("sdk/self");
var tabs = require("sdk/tabs");
var ss = require("sdk/simple-storage");
var workers = [];
var contextMenu = require("sdk/context-menu");
var priv = require("sdk/private-browsing");
var windows = require("sdk/windows").browserWindows;

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
localStorage.getItem = function(key) {
	return ss.storage[key];
};
localStorage.setItem = function(key, value) {
	ss.storage[key] = value;
};
localStorage.removeItem = function(key) {
	delete ss.storage[key];
};

var settings = require("./settings.js");

pageMod.PageMod({
  include: settings.include,
  contentScriptWhen: settings.contentScriptWhen,
  contentScriptFile: settings.contentScriptFile.map(function(file) { return self.data.url(file) }),
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
				if (request.method == 'POST') {
					Request({
						url: request.url,
						onComplete: function(response) {
							responseObj.response = {
								responseText: response.text,
								status: response.status
							};
							worker.postMessage(responseObj);
						},
						headers: request.headers,
						content: request.data
					}).post();
				} else {
					Request({
						url: request.url,
						onComplete: function(response) {
							responseObj.response = {
								responseText: response.text,
								status: response.status
							};
							worker.postMessage(responseObj);
						},
						headers: request.headers,
						content: request.data
					}).get();
				}
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
			default:
				worker.postMessage({status: "unrecognized request type"});
				break;
		}

	});
  }
});
