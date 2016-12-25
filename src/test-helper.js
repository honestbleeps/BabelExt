/*
 * Example test helper - you will probably need to edit this for yor own script
 */
(function() {

    var stored_values;

    // Run any JS specified by the test runner
    $(document).on( 'click', '#rendezvous', function( event ) {
        eval(this.getAttribute('data-args'));
    });

    // Mock whatever BabelExt functions you need:
    BabelExt.storage = {
        set: function( key, value, callback ) {
            if ( callback ) {
                stored_values[key] = value;
                document
                    .getElementById('rendezvous')
                    .setAttribute( 'data-stored-values', JSON.stringify(stored_values) );
                callback();
            }
        },
        get: function( key, callback ) {
            if ( callback ) {
                callback({ value: stored_values[key] });
            }
        }
    };

})();
