import nacl from 'tweetnacl';
import bs58 from 'bs58';
import _ from 'lodash';

import api from '../api';
import { isEmpty } from '../../utils';
import db from '../db';

const bo = chrome || browser;
const FIXED_USER_NAME = 'librevent';

bo.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'localLookup') {
        userLookup(request.payload ? request.payload : { userId: FIXED_USER_NAME }, sendResponse);
    } else if (request.type === 'remoteLookup') {
        serverLookup(request.payload, sendResponse);
    } else if (request.type === 'ConfigUpdate') {
        configUpdate(request.payload, sendResponse);
    } else {
        console.warn(`Warning: Request type unhandled ${request.type}, part of ${JSON.stringify(request)}, from ${JSON.stringify(sender)}`);
    }
    return true;
});

function initializeKey() {
    var newKeypair = nacl.sign.keyPair();
    console.log("Initializing new key pair:", bs58.encode(newKeypair.publicKey));
    return {
        publicKey: bs58.encode(newKeypair.publicKey),
        secretKey: bs58.encode(newKeypair.secretKey)
    };
}

// defaults of the settings stored in 'config' and controlled by popup
const DEFAULT_SETTINGS = {
    active: true,
    ux: false,
    backend: 'https://libr.events',
    login: 'dummy',
    password: '',
    moblizon: 'https://mobilizon.libr.events',
};

function setDefaults(val) {
    console.log('Setting the defaults! but we got', val);
    val = { ...DEFAULT_SETTINGS, ...val };
    return val;
}

function userLookup ({ userId }, sendResponse) {

    db.get(userId).then(val => {
        if (isEmpty(val)) {
            const newk = initializeKey();
            val = setDefaults(newk);
            db.set(userId, val).then(val => {
                console.log('First access attempted, created config', val);
                sendResponse(val);
            });
        } else {
            // console.log(`sending back from userLookup userId=${userId} ret=${JSON.stringify(val)}`);
            sendResponse(val);
        }
    });
};

function serverLookup (payload, sendResponse) {

    /* remoteLookup might be call as first function after the extension has been
     * installed, and the keys not be yet instanciated */
    const userId = FIXED_USER_NAME;
    db.get(userId).then(val => {
        if (isEmpty(val)) {
            var val = initializeKey();
            val = setDefaults(val);
            console.log("serverLookup isn't used since a while and have been trimmed: double check!");
            return db.set(userId, val).then(function() { return val; });
        }
        return val;
    })
    .then(function (x) {
        return api
            .handshake(payload, FIXED_USER_NAME)
            .then(response => sendResponse({type: 'handshakeResponse', response: response}))
            .catch(error => sendResponse({type: 'handshakeError', response: error}));
    });
};

function configUpdate (payload, sendResponse) {

    const userId = FIXED_USER_NAME;
    db.get(userId).then(val => {
        return db.set(userId, {...val, ...payload });
    }).then(val => {
        console.log("ConfigUpdate completed and return", val)
        sendResponse(val);
    })
}
