#!/bin/sh
files=("BabelExt.js" "extension.js")
paths=("Chrome" "XPI/data" "Opera" "Safari.safariextension")

for i in "${files[@]}"
do
        for j in "${paths[@]}"
        do
                if [ "$j" == "Opera" ];
                then
                        if [[ "$i" == *.user.js || "$i" == *.css ]];
                        then
                                dest="./$j/includes/"
                        else
                                dest="./$j/modules/"
                        fi
                else
                        dest="./$j/"
                fi
                echo "Re-linking:" $dest$i
                if [ -f $dest$i ];
                then
                        rm $dest$i
                fi

                if [ "clean" != "$1" ];
                then
                        mkdir -p $dest
                        ln ./lib/$i $dest
                fi
        done
done


