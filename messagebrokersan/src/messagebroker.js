/**
 * Main class that runs the server and expose API to control the Message Broker
 */

var commons = require("../../commons/src/commons");
console.log(JSON.stringify(process.env, null, 4));
const conf = commons.merge(require('./conf/mb'), require('./conf/mb-' + (process.env.ENVIRONMENT || 'localhost')));
console.log(JSON.stringify(conf, null, 4));
const obj = commons.obj(conf);

var heapdump = require('heapdump');
var express = require('express');
var bodyParser = require('body-parser');
var message_broker = require("./redis-mb");
const logger = obj.logger();

var app = express();
app.use(bodyParser.json({ limit: conf.request_limit }));

app.use((req, res, next) => {
    // Set the timeout for all HTTP requests
    req.setTimeout(50000, () => {
        logger.error('Request has timed out.');
        res.send(408);
    });
    // Set the server response timeout for all HTTP requests
    res.setTimeout(50000, () => {
        logger.error('Response has timed out.');
        res.send(503);
    });

    next();
});

var blacklist = {};

async function updateBlacklist() {
    logger.debug("updating blacklist");
    try {
        blacklist = await hget(conf.security.blacklist.url);
        if (logger.isTraceEnabled) logger.trace("blacklist: ", blacklist);
    } catch (e) {
        logger.error("error in updating blacklist:", e.message);
    }
}

updateBlacklist();

setInterval(updateBlacklist, 60 * 1000);

if (conf.security) {
    app.use(require('./security'));
    if (conf.security.blacklist) app.use(async function (req, res, next) {
        logger.debug("check blacklist");
        let tok_array = Object.values(blacklist);
        if (tok_array.includes(req.headers['x-authentication'])) return res.status(403).send("The token has been blacklisted");
        next();
    });
}

const security_checks = require("./security-checks")(logger);

var hostname = require('os').hostname();
console.log("instrumentazione per appdynamics: ", process.env.APPDYNAMICS_HOSTS, hostname)
logger.info("instrumentazione per appdynamics: ", process.env.APPDYNAMICS_HOSTS, hostname)

var env_dynamics = {
    "dev": "DEV",
    "tst": "TEST",
    "prod": "PROD"
}

if (process.env.APPDYNAMICS_HOSTS && process.env.APPDYNAMICS_HOSTS.indexOf(hostname) !== -1) {
    require("appdynamics").profile({
        controllerHostName: 'csi-net.saas.appdynamics.com',
        controllerPort: 443,
        controllerSslEnabled: true,
        accountName: 'csi-net',
        accountAccessKey: '00dfb3669f59',
        applicationName: 'NOTIFY_' + env_dynamics[process.env.ENVIRONMENT] + '_CSI-01',
        tierName: 'notify-' + conf.app_name,
        nodeName: 'notify-' + conf.app_name + '-' + hostname,
        proxyHost: conf.appdynamics.proxyHost,
        proxyPort: conf.appdynamics.proxyPort
    })
}

function sleep(ms) {
    return new Promise(resolve => {
        setTimeout(resolve, ms)
    })
}

/**
 * parse message in input to message to be used in notify system
 * @param body message input
 * @param user token decoded
 * @returns {*}
 */
function toMessages(body, user) {
    var messages = body;
    if (!Array.isArray(body)) {
        messages = [body];
    }
    for (var i = 0; i < messages.length; i++) {

        if (!messages[i].uuid) throw "uuid is mandatory";
        if (!messages[i].payload) throw "payload is mandatory";
        if (messages[i].expire_at && !messages[i].expire_at.match(/^(-?(?:[1-9][0-9]*)?[0-9]{4})-(1[0-2]|0[1-9])-(3[01]|0[1-9]|[12][0-9])T(2[0-3]|[01][0-9]):([0-5][0-9]):([0-5][0-9])(\.[0-9]+)?((Z)|([\+\-][0-5][0-9]\:[0-5][0-9])|([\+\-][0-5][0-9])|([\+\-][0-5][0-9][0-5][0-9]))?$/g)) throw "invalid date format for property expire_at, correct format i.e: 2019-02-25T14:30:00";
        messages[i].timestamp = new Date().getTime();
        var d = new Date();
        d.setDate(d.getDate() + 5);
        if (!messages[i].expire_at) messages[i].expire_at = d.toISOString().replace('Z', '');
        if (user) messages[i].user = messages[i].user ? messages[i].user : user;
    }
    return messages;
}

/**
 * execute the get function on messages broker
 * @param req request
 * @param res response
 * @returns {Promise<*|void>} message from queue
 */
async function doGet(req, res) {
    logger.debug("get from '" + req.params.queue + "'");
    try {
        var n = conf.timeout;
        while (n > 0) {
            var result = await message_broker.get_message(conf.redis.keyPrefix, req.params.queue, parseInt(req.query.count || "1"));
            if (result) return res.json(result);
            await sleep(1000);
            n--;
        }
        res.status(204).send("no data");
    }
    catch (err) {
        logger.error("error in getting message:", err.message);
        return res.status(500).send(err);
    }
}

/**
 * add message to message broker
 * @param is_topic flag if is a topic or queue
 * @param req request
 * @param res response
 * @returns {Promise<*|void>}
 */
async function doAddMessage(is_topic, req, res) {
    var messages = null;
    try {
        messages = toMessages(req.body, req.user);
    } catch (e) {
        logger.error("error in adding message:", e.message);
        return res.status(400).send(e);
    }

    if (req.params.queue_or_topic === "messages" && messages.map(mex => JSON.stringify(mex).length).filter(e => e > 64000).length > 0) return res.status(413).send("At least one message is too big");
    try {
        let result = await message_broker.add_message(req.params.queue_or_topic, messages, is_topic);
        if (result === "OK") return res.status(201).send("message added to the queue '" + req.params.queue_or_topic + "'")

        return res.status(406).send(result);
    } catch (error) {

        if (JSON.stringify(error).length > 10000) delete error.command.args;
        logger.error("error storing message into broker:", error.message);
        res.status(500).send(error);
    }
}

async function hget(key) {
    return await message_broker.hgetall(key);
}

/**
 * get message from specified queue
 */
app.get("/api/v1/queues/:queue", function (req, res) {
    if (conf.security) {
        let err = security_checks.checkDequeue(req, conf);
        if (err) return res.status(401).end(err.message);
    }
    doGet(req, res);
});

/**
 * get value from an hashmap key
 */
app.get("/api/v1/keys/:key", async function (req, res) {
    if (conf.security) {
        let err = security_checks.checkDequeue(req, conf);
        if (err) return res.status(401).end(err.message);
    }
    try {
        let result = await hget(req.params.key);
        return res.status(200).json(result)
    } catch (err) {
        logger.error("error in get key:", err.message);
        return res.status(500).send(err);
    }
});

/**
 * insert new hashmap
 */
app.post("/api/v1/keys/:key", async function (req, res) {
    if (conf.security) {
        let err = security_checks.checkDequeue(req, conf);
        if (err) return res.status(401).end(err.message);
    }
    try {
        await message_broker.del(req.params.key);
        let result = await message_broker.hmset(req.params.key, req.body);
        return res.status(200).json(result)
    } catch (err) {
        logger.error("error in get key: ", err.message);
        return res.status(500).send(err);
    }
});

/**
 * add message to queue
 */
app.post("/api/v1/queues/:queue_or_topic", function (req, res) {
    if (conf.security) {
        let err = security_checks.checkDequeue(req, conf);
        if (err) return res.status(401).end(err.message);
    }
    doAddMessage(false, req, res);
});

/**
 * add message to topic
 */
app.post("/api/v1/topics/:queue_or_topic", function (req, res) {
    if (conf.security) {
        let err = security_checks.checkEnqueue(req, conf);
        if (err) return res.status(401).end(err.message);
    }
    doAddMessage(true, req, res);
});

app.listen(conf.server_port, async function () {
    logger.info("environment:", JSON.stringify(process.env, null, 4));
    logger.info("configuration: ");
    logger.info(JSON.stringify(conf, null, 4));
    logger.info("mb started on port", conf.server_port);

    /**
     * do setup of message broker in script/setup.lua
     */
    if (conf.redis.do_setup) {
        logger.info("creating configuration on redis ...");
        try {
            await message_broker.setup(conf.redis.keyPrefix);
            logger.info("configuration on redis created");
        }
        catch (err) {
            logger.error("error in setup: ", err.message);
            console.log("error in setup:", err.message);
            process.exit(1);
        }
    }
});

/**
 * move message from queues:to_be_retried to normal queues
 */
async function retry() {
    logger.debug("moving messages ...");
    try {
        await message_broker.move_messages(conf.redis.keyPrefix);
    } catch (e) {
        logger.error("error moving messages: ", e.message);
    }
}

setInterval(retry, 1000 * 60);
