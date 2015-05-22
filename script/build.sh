#!/bin/sh

get_password() {
    echo -n "Password for $1: "
    stty -echo
    trap 'stty echo' EXIT
    read "${2}_PASSWORD"
    stty echo
    trap - EXIT
    echo
}

if test "x$1" = "xrelease"
then
    if grep -q chrome_login_info conf/local_settings.json && test -z "$CHROME_PASSWORD"
    then
        get_password chrome.google.com CHROME
    fi
    export CHROME_PASSWORD

    if grep -q amo_login_info conf/local_settings.json && test -z "$AMO_PASSWORD"
    then
        get_password addons.mozilla.org AMO
    fi
    export AMO_PASSWORD

    if grep -q opera_login_info conf/local_settings.json && test -z "$OPERA_PASSWORD"
    then
        get_password developer.opera.com OPERA
    fi
    export OPERA_PASSWORD
fi

exec /usr/bin/phantomjs --ssl-protocol=any ./script/build.js "$@"
