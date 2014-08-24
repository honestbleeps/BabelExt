.PHONY: default build config clean test

# Change this to the name of your Chrome executable:
CHROME=google-chrome

#
# BROWSER-NEUTRAL CONFIG VALUES
#
CONFIG_FILE=lib/config.txt
ID            = $(shell sed -n -e 's/\//\\\//g' -e 's/^id  *//p' ${CONFIG_FILE})
NAME          = $(shell sed -n -e 's/\//\\\//g' -e 's/^name  *//p' ${CONFIG_FILE})
LICENSE       = $(shell sed -n -e 's/\//\\\//g' -e 's/^license  *//p' ${CONFIG_FILE})
TITLE         = $(shell sed -n -e 's/\//\\\//g' -e 's/^title  *//p' ${CONFIG_FILE})
DESCRIPTION   = $(shell sed -n -e 's/\//\\\//g' -e 's/^description  *//p' ${CONFIG_FILE})
WEBSITE       = $(shell sed -n -e 's/\//\\\//g' -e 's/^website  *//p' ${CONFIG_FILE})
VERSION       = $(shell sed -n -e 's/\//\\\//g' -e 's/^version  *//p' ${CONFIG_FILE})
AUTHOR        = $(shell sed -n -e 's/\//\\\//g' -e 's/^author  *//p' ${CONFIG_FILE})
UPDATE_CHROME = $(shell sed -n -e 's/\//\\\//g' -e 's/^update_chrome  *//p' ${CONFIG_FILE})

SCRIPT_WHEN      = $(shell sed -n -e 's/\//\\\//g' -e 's/^contentScriptWhen  *//p' ${CONFIG_FILE})
SCRIPT_FILES     = $(shell sed -n -e 's/\//\\\//g' -e 's/^contentScriptFile  *//p' ${CONFIG_FILE})
SCRIPT_PROTOCOL  = $(shell sed -n -e 's/\//\\\//g' -e 's/^match_protocol  *//p' ${CONFIG_FILE})
SCRIPT_DOMAIN    = $(shell sed -n -e 's/\//\\\//g' -e 's/^match_domain  *//p' ${CONFIG_FILE})
SCRIPT_SUBDOMAIN = $(shell sed -n -e '/^match_include_subdomains/p' ${CONFIG_FILE})

ICON_16  = $(shell sed -n -e 's/\//\\\//g' -e 's/^icon_16  *//p' ${CONFIG_FILE})
ICON_32  = $(shell sed -n -e 's/\//\\\//g' -e 's/^icon_32  *//p' ${CONFIG_FILE})
ICON_48  = $(shell sed -n -e 's/\//\\\//g' -e 's/^icon_48  *//p' ${CONFIG_FILE})
ICON_64  = $(shell sed -n -e 's/\//\\\//g' -e 's/^icon_64  *//p' ${CONFIG_FILE})
ICON_128 = $(shell sed -n -e 's/\//\\\//g' -e 's/^icon_128  *//p' ${CONFIG_FILE})

ifeq ($(SCRIPT_SUBDOMAIN),)
SCRIPT_PRETTY_DOMAIN=$(SCRIPT_DOMAIN)
SCRIPT_SUBDOMAIN=false
else
SCRIPT_PRETTY_DOMAIN="*.$(SCRIPT_DOMAIN)"
SCRIPT_SUBDOMAIN=true
endif

ifeq ($(SCRIPT_PROTOCOL),)
DOMAIN_FF=\"http:\/\/$(SCRIPT_PRETTY_DOMAIN)\/*\",\"https:\/\/$(SCRIPT_PRETTY_DOMAIN)\/*\"
DOMAIN_CHROME=*:\/\/$(SCRIPT_PRETTY_DOMAIN)\/*
else
DOMAIN_FF=\"$(SCRIPT_PROTOCOL):\/\/$(SCRIPT_PRETTY_DOMAIN)\/*\"
DOMAIN_CHROME=$(SCRIPT_PROTOCOL):\/\/$(SCRIPT_PRETTY_DOMAIN)\/*
endif

comma=,
SCRIPT_FILES_FF=self.data.url('BabelExt.js')$(patsubst %,$(comma) self.data.url('%'), $(SCRIPT_FILES))
SCRIPT_FILES_CHROME=\"BabelExt.js\"$(patsubst %,$(comma) \"%\", $(SCRIPT_FILES))

ifeq ($(SCRIPT_WHEN),early)
SCRIPT_WHEN_SAFARI=Start
SCRIPT_WHEN_CHROME=document_start
SCRIPT_WHEN_FF=start
SCRIPT_START_SAFARI=\				$(patsubst %,<string>%<\/string>, $(SCRIPT_FILES))\n
else ifeq ($(SCRIPT_WHEN),late)
SCRIPT_WHEN_CHROME=document_end
SCRIPT_WHEN_FF=ready
SCRIPT_END_SAFARI=\				$(patsubst %,<string>%<\/string>, $(SCRIPT_FILES))\n
else
SCRIPT_WHEN_SAFARI=End
SCRIPT_WHEN_CHROME=document_idle
SCRIPT_WHEN_FF=end
SCRIPT_END_SAFARI=\				$(patsubst %,<string>%<\/string>, $(SCRIPT_FILES))\n
endif

ICON_FILES_FF=
ICON_FILES_CHROME=
ICON_FILES=
ifneq ($(ICON_16),)
ICON_FILES_CHROME+=\"16\":\"$(ICON_16)\",
ICON_FILES+=$(ICON_16)
endif
ifneq ($(ICON_32),)
ICON_FILES_CHROME+=\"32\":\"$(ICON_32)\",
ICON_FILES+=$(ICON_32)
endif
ifneq ($(ICON_48),)
ICON_FILES_CHROME+=\"48\":\"$(ICON_48)\",
ICON_FILES+=$(ICON_48)
ICON_FILES_FF+=\n    \"icon\":\"$(ICON_48)\",
endif
ifneq ($(ICON_64),)
ICON_FILES_CHROME+=\"64\":\"$(ICON_64)\",
ICON_FILES+=$(ICON_64)
ICON_FILES_FF+=\n    \"icon64\":\"$(ICON_64)\",
endif
ifneq ($(ICON_128),)
ICON_FILES_CHROME+=\"128\":\"$(ICON_128)\",
ICON_FILES+=$(ICON_128)
endif

#
# ABSTRACT TARGETS:
#

default: makelinks.bat
	test -e build || mkdir build
	$(MAKE) firefox-addon-sdk build

config: Firefox Chrome Safari.safariextension

BUILD_TARGETS=build/$(NAME).crx build/$(NAME).chrome.zip build/$(NAME).nex build/$(NAME).xpi
build: $(BUILD_TARGETS)
	@echo "\033[1;32mbuilt!\033[0m"

clean:
	rm -rf $(BUILD_TARGETS) tmp/*


#
# CONFIGURATION TARGETS:
#

Firefox/lib/main.js: $(CONFIG_FILE)
	sed -i \
	    -e "s/\(include: \[\)[^]]*/\1$(DOMAIN_FF)/" \
	    -e "s/\(contentScriptWhen: '\)[^\']*/\1$(SCRIPT_WHEN_FF)/" \
	    -e "s/\(contentScriptFile: \[\)[^]]*/\1$(SCRIPT_FILES_FF)/" \
	    $@

Firefox/package.json: $(CONFIG_FILE)
	sed -i \
	    -e "s/\(\"id\": *\"\)[^\"]*\"/\1$(ID)\"/" \
	    -e "s/\(\"name\": *\"\)[^\"]*\"/\1$(NAME)\"/" \
	    -e "s/\(\"license\": *\"\)[^\"]*\"/\1$(LICENSE)\"/" \
	    -e "s/\(\"title\": *\"\)[^\"]*\"/\1$(TITLE)\"/" \
	    -e "s/\(\"description\": *\"\)[^\"]*\"/\1$(DESCRIPTION)\"/" \
	    -e "s/\(\"version\": *\"\)[^\"]*\"/\1$(VERSION)\"/" \
	    -e "s/\(\"author\": *\"\)[^\"]*\"/\1$(AUTHOR)\"/" \
	    -e "/\"icon\(64\)\?\"/d" -e "s/{/{$(ICON_FILES_FF)/" \
	    $@

$(patsubst %,Firefox/data/%,$(SCRIPT_FILES) BabelExt.js): Firefox/data/%: lib/%
	-test -e $@ && rm $@
	ln -s ../../$^ $@

$(patsubst %,Firefox/%,$(ICON_FILES)): Firefox/%: lib/%
	-test -e $@ && rm $@
	ln -s ../$^ $@

Firefox: Firefox/lib/main.js Firefox/package.json $(patsubst %,Firefox/data/%,$(SCRIPT_FILES) BabelExt.js) $(patsubst %,Firefox/%,$(ICON_FILES))



Chrome/manifest.json: $(CONFIG_FILE)
	sed -i \
	    -e "s/\(\"name\": *\"\)[^\"]*\"/\1$(TITLE)\"/" \
	    -e "s/\(\"description\": *\"\)[^\"]*\"/\1$(DESCRIPTION)\"/" \
	    -e "s/\(\"version\": *\"\)[^\"]*\"/\1$(VERSION)\"/" \
	    -e "s/\(\"author\": *\"\)[^\"]*\"/\1$(AUTHOR)\"/" \
	    -e "s/\(\"update_url\": *\"\)[^\"]*\"/\1$(UPDATE_CHROME)\"/" \
	    -e "s/\(\"matches\": *\[\"\)[^\"]*/\1$(DOMAIN_CHROME)/" \
	    -e "s/\(\"icons\": *{\)[^\}]*/\1$(ICON_FILES_CHROME)/" -e 's/,}/ }/' \
	    -e "s/\(\"js\": *\[\)[^]]*/\1$(SCRIPT_FILES_CHROME)/" \
	    -e "s/\(\"run_at\": *\"\)[^\"]*\"/\1$(SCRIPT_WHEN_CHROME)\"/" \
	    $@

Chrome.pem:
	$(CHROME) --pack-extension=Chrome > /dev/null
	rm Chrome.crx

$(patsubst %,Chrome/%,$(SCRIPT_FILES) $(ICON_FILES) BabelExt.js): Chrome/%: lib/%
	-test -e $@ && rm $@
	ln $^ $@

Chrome: Chrome/manifest.json Chrome.pem $(patsubst %,Chrome/%,$(SCRIPT_FILES) $(ICON_FILES) BabelExt.js)


Safari.safariextension/Info.plist: $(CONFIG_FILE)
	sed -i \
	    -e '/<key>Author<\/key>/,/<string>/ s/<string>[^<]*<\/string>/<string>$(AUTHOR)<\/string>/' \
	    -e '/<key>CFBundleDisplayName<\/key>/,/<string>/ s/<string>[^<]*<\/string>/<string>$(TITLE)<\/string>/' \
	    -e '/<key>CFBundleIdentifier<\/key>/,/<string>/ s/<string>[^<]*<\/string>/<string>com.honestbleeps.$(ID)<\/string>/' \
	    -e '/<key>CFBundleShortVersionString<\/key>/,/<string>/ s/<string>[^<]*<\/string>/<string>$(VERSION)<\/string>/' \
	    -e '/<key>CFBundleVersion<\/key>/,/<string>/ s/<string>[^<]*<\/string>/<string>$(VERSION)<\/string>/' \
	    -e '/<key>Description<\/key>/,/<string>/ s/<string>[^<]*<\/string>/<string>$(DESCRIPTION)<\/string>/' \
	    -e '/<key>Website<\/key>/,/<string>/ s/<string>[^<]*<\/string>/<string>$(WEBSITE)<\/string>/' \
	    -e "s/<key>\(Start|End\)<\/key>/<key>$SCRIPT_WHEN_SAFARI<\/key>/" \
	    -e '/<key>Scripts<\/key>/,/<key>Description<\/key>/ { /<dict>/,/<\/dict>/ d ; s/<\/dict>/	<dict>\n			<key>End<\/key>\n			<array>\n$(SCRIPT_END_SAFARI)			<\/array>\n			<key>Start<\/key>\n			<array>\n				<string>BabelExt.js<\/string>\n$(SCRIPT_START_SAFARI)			<\/array>\n		<\/dict>\n	<\/dict>/ }' \
	    $@

$(patsubst %,Safari.safariextension/%,$(SCRIPT_FILES) BabelExt.js): Safari.safariextension/%: lib/%
	-test -L $@ && rm $@
	ln /$^ $@

Safari.safariextension: Safari.safariextension/config.xml $(patsubst %,Safari.safariextension/%,$(SCRIPT_FILES) BabelExt.js)

#
# BUILD TARGETS:
#

firefox-addon-sdk:
	git clone https://github.com/mozilla/addon-sdk.git $@
	cd $@ && git checkout 1.16
	cd $@ && git archive 1.16 python-lib/cuddlefish/_version.py | tar -xvf -

build/$(NAME).crx: Chrome lib/* Chrome.pem
	$(CHROME) --pack-extension=Chrome --pack-extension-key=Chrome.pem > /dev/null
	mv Chrome.crx $@

build/$(NAME).chrome.zip: build/$(NAME).crx
	-rm -rf "tmp/$(NAME)"
	mkdir -p "tmp/$(NAME)"
	-cd "tmp/$(NAME)" && unzip -q ../../$^
	cd tmp && zip -rq ../$@ "$(NAME)"
	rm -rf tmp

build/$(NAME).nex: build/$(NAME).crx
	cp $^ $@

build/$(NAME).xpi: Firefox Firefox/package.json lib/*
	bash -c 'cd firefox-addon-sdk && source bin/activate && cd ../Firefox && cfx xpi'
	mv Firefox/*.xpi $@

firefox-unpacked: build/$(NAME).xpi
	test -d $@ || mkdir $@
	rm -rf $@/*
	cd $@ && unzip ../$^
	rm -f $@/resources/$(NAME)/data/*
	$(foreach FILE,BabelExt.js $(SCRIPT_FILES),ln -s ../../../../lib/$(FILE) $@/resources/$(NAME)/data/$(FILE) ; )
	@echo "\033[1mRemember to restart Firefox if you added/removed any files!\033[0m"
