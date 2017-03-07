'use strict';
const reportError = function( error ) {
    if ( error !== null ) {
        console.log( error );
    }
};
const Redis = require( 'redis' ).createClient().on( 'error', reportError );
const cacheInMemory = {};
const REQUEST_OPTIONS = {};
let cloudQuery;

Redis.keys('cache:userAgentParser:*', function( error, userAgentKeyList ) {
    if ( error !== null ) {
        return reportError( { from:'Load userAgentKeyList', error: error } );
    }

    for ( let i = 0, j = userAgentKeyList.length; i < j; i++ ) {
        userAgentKeyList[i] = [ 'get', userAgentKeyList[i] ];
    }

    Redis.multi( userAgentKeyList ).exec( function( error, userAgentKeyCacheValues ) {
        if ( error !== null ) {
            return reportError( { from:'Load userAgentKeyCacheValues', error: error } );
        }

        for ( let i = 0, j = userAgentKeyCacheValues.length; i < j; i++ ) {
            cacheInMemory[
                userAgentKeyList[i][1].slice( 22 )
            ] = JSON.parse( userAgentKeyCacheValues[i] );
        }
    });
});
function updateCache( userAgent ) {
    cloudQuery( userAgent, function( error, UA_DATA ) {
        if ( error === null && UA_DATA !== undefined ) {
            cacheInMemory[ userAgent ] = UA_DATA;
            Redis.set( 'cache:userAgentParser:' + userAgent, JSON.stringify( UA_DATA ), reportError );

            const twentyDays = Math.floor( ( Date.now() + 86400 * 1000 * 20 ) / 1000 );
            Redis.expireat( 'cache:userAgentParser:' + userAgent, twentyDays, reportError );
        } else {
            setImmediate( reportError, error );
        }
    });
}

function parseUserAgent( userAgent ) {
    if ( cacheInMemory[ userAgent ] !== undefined ) {
        return cacheInMemory[ userAgent ];
    } else {
        setImmediate( updateCache, userAgent );
        return null;
    }
}

module.exports = function( requestOptions, onlyLoad ) {
    for ( let option in requestOptions ) {
        REQUEST_OPTIONS[ option ] = requestOptions[ option ];
    }
    cloudQuery = require( './cloud.js' )( REQUEST_OPTIONS, onlyLoad );
    return parseUserAgent;
};