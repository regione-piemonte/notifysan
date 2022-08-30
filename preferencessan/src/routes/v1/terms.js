module.exports = function (conf, obj) {

    const logger = obj.logger();
    const express = require('express');
    const router = express.Router();

    var fs = require("fs");

    /**
     *  get terms of service
     */
    router.get('/', async function (req, res, next) {

        try {
            var terms = fs.readFileSync(process.cwd() + "/terms/terms", 'utf8');
        } catch (err) {
            logger.error(err.message);
            return next({type: "system_error", status: 500, message: err});
        }
        next({type: "ok", status: 200, message: terms});
    });

    return router;
}