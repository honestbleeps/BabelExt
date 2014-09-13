exports.include = ["http://babelext.com/*","https://babelext.com/*"];
exports.contentScriptWhen = "ready";
exports.contentScriptFile = ["self.data.url('BabelExt.js')","self.data.url('extension.js')"];
