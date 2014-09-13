/*
 * You can't log to the normal console from within a content script.
 * Console logging is extremely useful during development,
 * so this script makes console logging work as expected.
 * Remember to remove this script in production.
 */
window.console = (function() {

    function log_in_embedded_page(command, args) {
        var script = document.createElement('script');
        script.textContent = 'console.' + command + '.apply( console, ' + JSON.stringify(Array.prototype.slice.call( args, 0 )) + ')';
        document.documentElement.appendChild(script);
    }

    return {

        assert: function() { return log_in_embedded_page( 'assert', arguments ) },

        log   : function() { return log_in_embedded_page( 'log'   , arguments ) },

        trace : function() { return log_in_embedded_page( 'trace' , arguments ) },
        info  : function() { return log_in_embedded_page( 'info'  , arguments ) },
        warn  : function() { return log_in_embedded_page( 'warn'  , arguments ) },
        error : function() { return log_in_embedded_page( 'error' , arguments ) }

    };

})();
