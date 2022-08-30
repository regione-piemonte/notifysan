module.exports = function (conf, obj, locales) {
    const express = require('express');
    const router = express.Router();

    const services = require('./services.js')(conf, obj);
    const users = require('./users.js')(conf, obj, locales);
    const terms = require('./terms.js')(conf, obj);
    const broadcast_batch = require('../v2/broadcast_batch.js')(conf, obj);

    router.use('/services', services);
    router.use('/users', users);
    router.use('/terms', terms);
    router.use('/broadcast_batch', broadcast_batch);
    
    return router;
}