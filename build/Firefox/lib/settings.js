exports.include = ["http://babelext.com/*","https://babelext.com/*"];
exports.contentScriptWhen = "ready";
exports.contentScriptFile = ["lib/BabelExt.js","src/extension.js"];
exports.contentStyleFile = ["src/extension.css"];
