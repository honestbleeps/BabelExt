#!/bin/bash

if [ "$1" == "release" ]
then
    if grep -q chrome_info lib/local_settings.json && [ -z "$CHROME_PASSWORD" ]
    then
        read -p 'Password for chrome.google.com: ' -s CHROME_PASSWORD
        echo
    fi
    export CHROME_PASSWORD

    if grep -q amo_info lib/local_settings.json && [ -z "$AMO_PASSWORD" ]
    then
        read -p 'Password for addons.mozilla.org: ' -s AMO_PASSWORD
        echo
    fi
    export AMO_PASSWORD

    if grep -q opera_info lib/local_settings.json && [ -z "$OPERA_PASSWORD" ]
    then
        read -p 'Password for developer.opera.com: ' -s OPERA_PASSWORD
        echo
    fi
    export OPERA_PASSWORD
fi

exec ./bin/build.js "$@"
