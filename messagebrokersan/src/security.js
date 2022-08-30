/**
 *  checks if the token JWT contains authorization for the application specified in conf.app_name, if it's expired andp ut the decoded token in request ovject
 */

var commons = require("../../commons/src/commons");
const conf = commons.merge(require('./conf/mb'),require('./conf/mb-' + (process.env.ENVIRONMENT || 'localhost')));
const obj = commons.obj(conf);

var jwt = require('express-jwt');

var express = require('express');
var router = express.Router();
var fs = require('fs');
const logger = obj.logger();
const utility = obj.utility();
var crypto = obj.cryptoAES_cbc();

/**
 * check if is encrypted with the right key, specified in conf.security.secret , and put the decoded token in req.user
 */
router.use(jwt({
    secret: conf.security.secret,
    getToken: function fromHeaderOrQuerystring(req) {
        try {
            return utility.checkNested(conf,"security.crypto.password") ? crypto.decrypt(req.headers['x-authentication'], conf.security.crypto.password):req.headers['x-authentication'];
        } catch (e) {
            logger.debug("error decrypting JWT token: ", e.message);
            e.name = "Decrypting Error";
            throw e;
        }
    }
}));

/**
 * check for application authorization, expire date and if permissions contains "backend"
 */
router.use(function (req, res, next) {
        //logger.debug("applications: ", req.user);

        if (!req.user.applications ||!(Object.keys(req.user.applications)).includes(conf.app_name)) {
            logger.error("user doesn't have application permissions");
            res.status(401);
            return res.end("you don't have applications permissions");
        }

        return next();
    }
);


/**
 * if rise an authorization error it will be sent
 */
router.use(function (err, req, res, next) {

    logger.error("Error caught in access: ", err);
    if (err.name === 'UnauthorizedError') {
        logger.error("Attempt from unauthorized");
        return res.status(401).send('Invalid token');
    } else if (err.name === "Decrypting Error") {
        logger.error("Decrypting Error in JWT token");
        return res.status(401).send("Wrong Token");
    } else {
        logger.error("Internal Server Error in security:", err);
        return res.status(500).send("Internal error");

    }
});


module.exports = router;
