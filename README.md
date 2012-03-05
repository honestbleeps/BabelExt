### What is BabelExt? ###

BabelExt is a library (or perhaps more of a boilerplate) meant to simplify the
development of cross-browser extensions for the following browsers:

- Chrome
- Firefox
- Opera
- Safari

### Who is BabelExt for? ###

It's likely that BabelExt will appeal most to either new extension developers, or
to the existing pool of Greasemonkey script developers - which is how I got started
with extension development.  The transition from Greasemonkey development to browser
extension development wasn't too difficult - but there are a few nuances in each
browser that are a bit of a pain to circumvent if you're in a "Greasemonkey mindset"

### What does BabelExt do to help me? ###

BabelExt takes care of commonly used functionality that you might want to perform
in content-script-like extension.  Some of these things seem simple, but each browser
has its own function calls and way of working, including, but not limited to:

- Accessing and controlling browser windows
- Accessing and ontrolling tabs (i.e. opening a link in a new one and choosing if it's focused)
- Cross domain http requests (extensions require)
- Storing data (using HTML5 localStorage or similar/equivalent engines)
- Adding URLs to history (to mark visited)
	- Note: this is a bit of a hack in all non-Chrome browsers...

### What does BabelExt NOT do? ###

Well, a lot! Most things, in fact! However, I have some clear goals, and some clear
things I'm probably not interested in adding to BabelExt... Specifically, it's geared
towards assisting in content script development - extensions that enhance specific
websites or functionality on the web.

It's not meant to handle building each browser's native settings consoles/panels, etc.
They're just too different from each other to try and abstract into a nice little package,
and with the 4 supported browsers all handling modern HTML/CSS/Javascript so well - it makes
sense (to me, anyhow) to build settings consoles and the like using those technologies.

That's what I did with Reddit Enhancement Suite, and it has worked rather well.