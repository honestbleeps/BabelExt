#!/bin/sh

ln -sv ../lib/extension.js ./Chrome/extension.js
ln -sv ../../lib/extension.js ./Opera/includes/extension.user.js
ln -sv ../../lib/extension.js ./Firefox/data/extension.js
ln -v ./lib/extension.js ./Safari.safariextension/extension.js 

ln -sv ../lib/BabelExt.js ./Chrome/BabelExt.js
ln -sv ../../lib/BabelExt.js ./Opera/includes/BabelExt.js
ln -sv ../../lib/BabelExt.js ./Firefox/data/BabelExt.js
ln -v ./lib/BabelExt.js ./Safari.safariextension/BabelExt.js
