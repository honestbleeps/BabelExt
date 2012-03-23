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

BabelExt also isn't meant to handle building each browser's native settings consoles/panels, etc.
They're just too different from each other to try and abstract into a nice little package,
and with the 4 supported browsers all handling modern HTML/CSS/Javascript so well - it makes
sense (to me, anyhow) to build settings consoles and the like using those technologies.

That's what I did with Reddit Enhancement Suite, and it has worked rather well. I am considering
adding the automatic form rendering code from RES into BabelExt, but I will need to devote some
thought to how to make it more universally useful.

### Great, now how do I get started? ###

First, download all of the source from Github and put it together within a folder.

In Windows, run makelinks.bat to create symlinks to extension.js - these links are not
handled by github, which is why you unfortuntately have to make them yourself. 
**NOTE:** You may need to open a command prompt as Administrator for this batch file to
work.

In other OSes, you probably know how to do this on your own - read makelinks.bat in a
text editor to see what directories to link where.

**IMPORTANT OPERA NOTE:** Note that the Opera js file has .user.js in it - that's because without this,
@include and @exclude directives will be ignored and your script will run on every page on
the internet!

**IMPORTANT SAFARI NOTE:** Safari has a "security feature" that is not documented, gives no user
feedback at all, and can be a HUGE time sink if you don't know about it!  If you have any
files in your extension folder that are symlinks, Safari will **silently** ignore them.
With Safari, a hard link will work, but a symbolic link will not.  If you made the links
yourself instead of using the batch file, and your extension is doing nothing at all in
Safari, double check that!

One last Safari quirk: if the directory does not end in ".safariextension", it will not be
recognized by Safari. Don't remove that from the name!

## Instructions for loading/testing an extension in each browser ##

### Chrome ###

- Click the wrench icon and choose Tools -> Extensions

- Check the "Developer Mode" checkbox

- Click "load unpacked extension" and choose the Chrome directory

- You're good to go! If you just want to try out the BabelExt kitchen sink demo, navigate to [http://babelext.com/demo.html](http://babelext.com/demo.html)

- Further Chrome development information can be found at [http://code.google.com/chrome/extensions/index.html](http://code.google.com/chrome/extensions/index.html)

### Firefox ###

- Download the Firefox Addon SDK from [https://addons.mozilla.org/en-US/developers/builder](https://addons.mozilla.org/en-US/developers/builder)

- Follow the installation instructions there, and run the appropriate activation script (i.e. bin\activate.bat in windows)

- Navigate to the Firefox directory under BabelExt, and type: cfx run

- You're good to go! If you just want to try out the BabelExt kitchen sink demo, navigate to [http://babelext.com/demo.html](http://babelext.com/demo.html)

- Further Firefox development information can be found at [https://addons.mozilla.org/en-US/developers/docs/sdk/latest/](https://addons.mozilla.org/en-US/developers/docs/sdk/latest/)

### Opera ###

- Click Tools -> Extensions -> Manage Extensions

- Find the config.xml file in the Opera directory of BabelExt, and drag it to the Extensions window

- You're good to go! If you just want to try out the BabelExt kitchen sink demo, navigate to [http://babelext.com/demo.html](http://babelext.com/demo.html)

- Further Opera development information can be found at [http://dev.opera.com/addons/extensions/](http://dev.opera.com/addons/extensions/)


### Safari ###

- Click the gear icon, and choose Settings -> Preferences -> Advanced

- Check the box that reads "Show Develop menu in menu bar"

- Click the menu button (left of the gear icon), and choose Develop -> Show Extension Builder

- Click the + button at the bottom left, and choose "Add Extension"

- Choose the Safari.safariextension folder from BabelExt

- You're good to go! If you just want to try out the BabelExt kitchen sink demo, navigate to [http://babelext.com/demo.html](http://babelext.com/demo.html)

- Further Safari development information can be found at [https://developer.apple.com/library/safari/#documentation/Tools/Conceptual/SafariExtensionGuide/Introduction/Introduction.html](https://developer.apple.com/library/safari/#documentation/Tools/Conceptual/SafariExtensionGuide/Introduction/Introduction.html)