var contextMenuClick = function(info, tab, callbackID) {
	chrome.tabs.sendMessage(tab.id, {
		requestType: "contextMenu.click",
		callbackID: callbackID
	});
};

chrome.runtime.onMessage.addListener(
	function(request, sender, sendResponse) {
		// all requests expect a JSON object with requestType and then the relevant
		// companion information...
		switch(request.requestType) {
			case 'xmlhttpRequest':
				var xhr = new XMLHttpRequest();
				xhr.open(request.method, request.url, true);
				if (request.method === "POST") {
					xhr.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
					// xhr.setRequestHeader("Content-length", request.data.length);
					// xhr.setRequestHeader("Connection", "close");
				}
				xhr.onreadystatechange = function() {
					if (xhr.readyState === 4) {
						// Only store 'status' and 'responseText' fields and send them back.
						var response = {status: xhr.status, responseText: xhr.responseText};
						sendResponse(response);
					}
				};
				xhr.send(request.data);
				return true; // true must be returned here to indicate successful XHR
				break;
			case 'createTab':
				var newIndex,
					focus = (request.background !== true);

				if (typeof(request.index) !== 'undefined') {
					newIndex = request.index;
				} else {
					// If index wasn't specified, get the selected tab so we can get the index of it.
					// This allows us to open our new tab as the "next" tab in order rather than at the end.
					newIndex = sender.tab.index+1;
				}
				chrome.tabs.create({url: request.url, selected: focus, index: newIndex});
				sendResponse({status: "success"});
				break;
			case 'createNotification':
				if (!request.icon) {
					// if no icon specified, make a single pixel empty gif so we don't get a broken image link.
					request.icon = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
				}
				var notification = window.webkitNotifications.createNotification(
					request.icon,  // icon url - can be relative
					request.title,  // notification title
					request.text  // notification body text
				);
				notification.show();
				break;
			case 'localStorage':
				switch (request.operation) {
					case 'getItem':
						sendResponse({status: true, key: request.itemName, value: localStorage.getItem(request.itemName)});
						break;
					case 'removeItem':
						localStorage.removeItem(request.itemName);
						sendResponse({status: true, key: request.itemName, value: null});
						break;
					case 'setItem':
						localStorage.setItem(request.itemName, request.itemValue);
						sendResponse({status: true, key: request.itemName, value: request.itemValue});
						break;
				}
				break;
			case 'addURLToHistory':
				chrome.history.addUrl({url: request.url});
				break;
			case 'contextMenus.create':
				if (typeof request.obj.onclick === 'number') {
					var callbackID = request.obj.onclick;
					request.obj.onclick = function(info, tab) {
						contextMenuClick(info, tab, callbackID);
					};
				}
				// id not available on firefox but title is, use it as common id
				request.obj.id = request.obj.title;
				chrome.contextMenus.create(request.obj);
				break;
			case 'contextMenus.remove':
				chrome.contextMenus.remove(request.obj.title);
				break;
			default:
				sendResponse({status: "unrecognized request type"});
				break;
		}
	}
);

// chrome.storage.local should return almost instantly, but has been seen in the wild timing out.
// We do a test request first, and use a fallback implementation if that takes too long.
// The fallback implementation always returns default values.
var storage_local_works = true, storage_start_time = new Date().getTime();
try {
	chrome.storage.local.get('', function() {
		storage_local_works = new Date().getTime() - storage_start_time < 1000;
		if (!storage_local_works) {
			console.log( 'chrome.storage.local took too long to respond - disabing.', chrome.runtime.lastError );
		}
	});
} catch (e) {
	storage_local_works = false;
	console.log('chrome.storage.local disabled: ', e);
	console.log('This extension will still work, but will act as if all options have the default value.');
}

// the simple "onMessage" interface only works when the response is sent sychronously.
// Because preferences need to respond after a delay, we have to use the full interface:
chrome.runtime.onConnect.addListener(function(port) {
	console.assert(port.name == "delayedMessage");
	if (storage_local_works) { // default behaviour
		port.onMessage.addListener(function(request) {
			function sendResponse(response) { port.postMessage({ request: request, response: response }) }
			// all requests expect a JSON object with requestType and then the relevant
			// companion information...
			switch(request.requestType) {
				case 'preferences':
					switch (request.operation) {
						case 'getItem':
							chrome.storage.local.get(request.itemName, function(items) {
								sendResponse({status: true, key: request.itemName, value: (items||{}).hasOwnProperty(request.itemName) ? items[request.itemName] : default_preferences[request.itemName]});
							});
							break;
						case 'setItem':
							var toSet = {}; toSet[request.itemName] = request.itemValue;
							chrome.storage.local.set(toSet, function() {
								sendResponse({status: true, key: request.itemName, value: request.itemValue});
							});
							break;
					}
			}
		});
	} else { // fallback behaviour - return default values without waiting for the storage system
		port.onMessage.addListener(function(request) {
			function sendResponse(response) { port.postMessage({ request: request, response: response }) }
			switch(request.requestType) {
				case 'preferences':
					switch (request.operation) {
						case 'getItem':
							sendResponse({status: true, key: request.itemName, value: default_preferences[request.itemName]});
							break;
						case 'setItem':
							sendResponse({status: false, key: request.itemName, value: request.itemValue});
							break;
					}
			}
		});
	}
});
