/**
 * Evaluate JavaScript as ContentScript
 * @param {string} js Scripnt to eval
 *
 * The easiest way to manipulate your contentscript
 * (and sometimes the only way that doesn't involve nasty code changes)
 * is to pass some JavaScript across and eval() it on the other side.
 * This is nasty and insecure, which is one reason why test JS should
 * be configured out before compiling your final extension.
 */
function eval_js_as_contentscript(js) {
    var dispatcher = document.getElementById('rendezvous');
    dispatcher.setAttribute( 'data-args', JSON.stringify(js) );
    dispatcher.click();
}

/**
 * Get values from BabelExt
 * @return {string}
 *
 * By default, BabelExt is mocked by the test helper.
 * Data is stored in an attribute so we can get it back.
 */
function get_stored_values() {
    return document.getElementById('rendezvous').getAttribute( 'data-stored-values' );
}

QUnit.test( "My test", function( assert ) {
    run_js_in_contentscript_context( 'my_func()' );
});
