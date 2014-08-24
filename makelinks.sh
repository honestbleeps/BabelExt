#!/bin/bash

while read -r MKLINK H TO FROM
do
    if [ "$MKLINK" == "mklink" ]
    then
        SYMLINK=""
        if [ "$H" != "/H" ]
        then
            SYMLINK="-s"
            FROM="$TO"
            TO="$H"
        fi
        rm -f "${TO//\\//}"
        ln $SYMLINK "${FROM//\\//}" "${TO//\\//}"
    fi
done < makelinks.bat
