// Import the APIs we need.
var pageMod = require("page-mod");
var Request = require('request').Request;
var self = require("self"); 
var tabs = require("tabs");
var ss = require("simple-storage");
var workers = new Array();

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
}
localStorage.setItem = function(key, value) {
	ss.storage[key] = value;
}
localStorage.removeItem = function(key) {
	delete ss.storage[key];
}



pageMod.PageMod({
  include: ["*.babelext.com"],
  contentScriptWhen: 'ready',
  contentScriptFile: [self.data.url('extension.js')],
  onAttach: function(worker) {
	tabs.on('activate', function(tab) {
		// run some code when a tab is activated...
	});

	workers.push(worker);
	worker.on('detach', function () {
		detachWorker(this, workers);
		// console.log('worker detached, total now: ' + workers.length);
    });
	// console.log('total workers: ' + workers.length);
	// worker.postMessage('init');

	worker.on('message', function(data) {
		var request = data;
		switch(request.requestType) {
			case 'xmlhttpRequest':
				var responseObj = {
					XHRID: request.XHRID,
					name: request.requestType
				}
				if (request.method == 'POST') {
					Request({
						url: request.url,
						onComplete: function(response) {
							responseObj.response = {
								responseText: response.text,
								status: response.status
							}
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
							}
							worker.postMessage(responseObj);
						},
						headers: request.headers,
						content: request.data
					}).get();
				}
				
				break;
			case 'localStorage':
				switch (request.operation) {
					case 'getItem':
						worker.postMessage({status: true, key: request.itemName, value: localStorage.getItem(request.itemName)});
						break;
					case 'removeItem':
						localStorage.removeItem(request.itemName);
						worker.postMessage({status: true, key: request.itemName, value: null});
						break;
					case 'setItem':
						localStorage.setItem(request.itemName, request.itemValue);
						worker.postMessage({status: true, key: request.itemName, value: request.itemValue});
						break;
				}
				break;
			default:
				worker.postMessage({status: "unrecognized request type"});
				break;
		}

	});
  }
});


