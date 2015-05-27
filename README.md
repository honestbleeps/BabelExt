### LICENSE ###

MIT (X11) license. See LICENSE.txt

### Building ###

To build run ./script/build.sh build chrome|safari|amo


### What is BabelExt? ###

BabelExt is a library (or perhaps more of a boilerplate) meant to simplify the
development of cross-browser "userscript" style extensions for the following browsers:

- Chrome
- Firefox
- Opera
- Safari

You can see a "kitchen sink" demonstration at [http://BabelExt.com/demo/](http://BabelExt.com/demo/)

### Who is BabelExt for? ###

It's likely that BabelExt will appeal most to either new extension developers, or
to the existing pool of Greasemonkey script developers - which is how I got started
with extension development.  The transition from Greasemonkey development to browser
extension development wasn't too difficult - but there are a few nuances in each
browser that are a bit of a pain to circumvent if you're in a "Greasemonkey mindset"

BabelExt is definitely more suited for developers wanting to create "content enhancement"
extensions that enhance websites.  It's not made for creating addons such as AdBlock Plus, etc.

### What does BabelExt do to help me? ###

BabelExt takes care of commonly used functionality that you might want to perform
in content-script-like extension.  Some of these things seem simple, but each browser
has its own function calls and way of working, including, but not limited to:

- Accessing and controlling tabs (i.e. opening a link in a new one and choosing if it's focused)
- Cross domain http requests (extensions require)
- Storing data (using HTML5 localStorage or similar/equivalent engines)
- Managing resources (like large HTML snippets that are hard to read in raw JavaScript)
- Managing add-on preferences (which some browsers call options or settings)
- Triggering notifications (desktop or browser, depending on the browser's particular level of support)
- Adding URLs to history (to mark links as visited)
	- Note: this is a bit of a hack in all non-Chrome browsers...
- Adding CSS to the page

### What does BabelExt NOT do? ###

Well, a lot! Most things, in fact! However, I have some clear goals, and some clear
things I'm probably not interested in adding to BabelExt... Specifically, it's geared
towards assisting in content script development - extensions that enhance specific
websites or functionality on the web.  For this reason, functionality that is not supported
by one or more of the 4 BabelExt browsers (Chrome, Firefox, Opera, Safari) may not be added
to BabelExt.

Because each browser implements preferences in a slightly different way, BabelExt only supports
the baseline functionality that can be supported across all browsers.  That might be enough if
you only need a few buttons and options, but with the 4 supported browsers all handling modern
HTML/CSS/Javascript so well - it makes sense (to me, anyhow) to build preference pages into the
site your extension is for.

That's what I did with Reddit Enhancement Suite, and it has worked rather well. I am considering
adding the automatic form rendering code from RES into BabelExt, but I will need to devote some
thought to how to make it more universally useful.

### Great, now how do I get started? ###

First, download all of the source from Github and put it together within a folder.

Then, download [PhantomJS](http://phantomjs.org), which is used to build and deploy extensions.

Next, rename `conf/local_settings.json.example` to `conf/local_settings.json`.  You will need
to edit this when you release your extension, but the defaults should be fine for now.

In UNIX-based OSes, run `./script/build.sh build <browser>` to build packages for each browser,
and `./script/build.sh release <site>` to release them to the various extension sites.

The build system hasn't been tested under Windows yet - your best bet is probably to look at
the scripts and write a Windows equivalent.  If it's any good, please send in a patch!

The build system maintains browser-specific `build` directories based on `conf/settings.json`.
It uses symbolic links where possible, but falls back to hard links for Chrome and Safari
(which silently ignore symlinks).

It is recommended run `./script/build.sh maintain &` in the background.
This automatically fixes broken hard links and updates `BabelExt.resources` every few seconds.

## Instructions for loading/testing an extension in each browser ##

- You need to build the package before you start - the initial build
  process configures some files that aren't stored in git

### Chrome / Opera ###

- Go to about://extensions

- Check "Developer Mode"

- Click "load unpacked extension" and choose the build/Chrome directory

- You're good to go! If you just want to try out the BabelExt kitchen sink demo, navigate to [http://babelext.com/demo/](http://babelext.com/demo/)

- Further Chrome development information can be found at [http://code.google.com/chrome/extensions/index.html](http://code.google.com/chrome/extensions/index.html)

### Firefox ###

- Go to about:addons, click the "Tools" icon in the top-right and install the add-on from file

- Go to about:support and click the "Open Directory" to go to your profile directory

- Open the "extensions" subdirectory and look for a subdirectory matching the "id" in your settings.json file

- Delete the file and replace it with a link to your extension's "build/firefox-unpacked" directory

- Restart Firefox

- You're good to go! If you just want to try out the BabelExt kitchen sink demo, navigate to [http://babelext.com/demo/](http://babelext.com/demo/)

- Further Firefox development information: [Add-on SDK](https://addons.mozilla.org/en-US/developers/docs/sdk/latest/) and [setting up an extension development environment](https://developer.mozilla.org/en-US/Add-ons/Setting_up_extension_development_environment)

### Safari ###

- Click the gear icon, and choose Settings -> Preferences -> Advanced

- Check the box that reads "Show Develop menu in menu bar"

- Click the menu button (left of the gear icon), and choose Develop -> Show Extension Builder

- Click the + button at the bottom left, and choose "Add Extension"

- Choose the build/Safari.safariextension folder from BabelExt

- You're good to go! If you just want to try out the BabelExt kitchen sink demo, navigate to [http://babelext.com/demo/](http://babelext.com/demo/)

- Further Safari development information can be found at [https://developer.apple.com/library/safari/#documentation/Tools/Conceptual/SafariExtensionGuide/Introduction/Introduction.html](https://developer.apple.com/library/safari/#documentation/Tools/Conceptual/SafariExtensionGuide/Introduction/Introduction.html)

#### Certificates ####

Safari requires all packages to be signed with a private key that's been registered with Apple.
You can develop unpacked extensions without a license, but you will need a (free) Apple Developer
account to build a package.  You will also need to create a private key, which you can do with:

    openssl req -new -nodes -newkey rsa:2048 -keyout build/safari-info/id.rsa -out apple-cert.csr

Apple seems to prefer you have a single private key per Apple Developer account.
If you maintain several projects with one account, consider linking build/safari-certs to a central location.

BabelExt will automatically register your key and download extra certificates if you pass in your
username and password.  Here are the steps if you prefer to do it by hand:

- Go through [Apple's Certificate Request process](https://developer.apple.com/account/safari/certificate/certificateRequest.action) and save your certificate as `build/safari-certs/local.cer`
- Download [Apple's Worldwide Developer Relations Certificate](https://developer.apple.com/certificationauthority/AppleWWDRCA.) to `build/safari-certs/AppleIncRootCertificate.cer`
- Download [Apple's Root Certificate](https://www.apple.com/appleca/AppleIncRootCertificate.cer) to `build/safari-certs/AppleWWDRCA.cer`
- Download and compile [a modified version of the "xar" tool](http://mackyle.github.io/xar/) as `build/xar`

Note: some online documentation refers to these keys as `cert00`, `cert01` and `cert02`
(these are the names `xar` uses when extracting them from a package)

## Resetting extension data ##

If your extension uses storage or preferences, you will need to test the extension data with
different stored values.  Apart from Safari, all the browsers let you create multiple
profiles ("users" in Chrome), so you might want to create throwaway profiles for use during
testing.

Private browsing isn't much help here, as some private browsing data will be initialised from
your public data.  If you find profiles too much effort, Chrome/Opera also let you clear
extension data by deleting all files matching <profile_directory>/Local*/*<extension_ID>*

## Releasing packages ##

You need to release the first version of your extension by hand, because each site has slightly
different requirements for their extensions.

After the initial release, fill in `local_settings.json` and run `script/build.sh release <site>`
to release and update metadata.
