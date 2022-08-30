var commons = require("../../commons/src/commons");
const conf = commons.merge(require('./conf/preferences'), require('./conf/preferences-' + (process.env.ENVIRONMENT || 'localhost')));
const obj = commons.obj(conf);
const logger = obj.logger();
const locales = commons.locales;

var prefix = "/api";

var heapdump = require('heapdump');
var express = require('express');
var bodyParser = require('body-parser');

var app = express();
// configure body parser
app.use(bodyParser.json());

//const send_sched = require("./sendScheduledNotifications");
//var schedule = require('node-schedule');
//var sendMessages = schedule.scheduleJob('*/1 * * * *', send_sched.execute);

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

// initialize response time header
app.use(function (req, res, next) {
    res.set("X-Response-Time", new Date().getTime());
    next();
});

var hostname = require('os').hostname();
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

if (conf.security) {
    if (conf.security.blacklist) obj.blacklist(app);

    var permissionMap = [];
    if (conf.security.resourcesPermissions) permissionMap = conf.security.resourcesPermissions;

    obj.security(permissionMap, app);
}

// configure api versions
const apiv1 = require('./api_v1.js'); //./api_v1.js
const apiv2 = require('./api_v2.js'); //./api_v2.js
apiv1(conf, app, obj, locales);
apiv2(conf, app, obj, locales);

app.use(function (req, res, next) {
    next({ type: "error", status: 404, message: "resource not found" });
});

obj.response_handler(app);

app.listen(conf.server_port, function () {
    logger.info("environment:", JSON.stringify(process.env, null, 4));
    logger.info("configuration:", JSON.stringify(conf, null, 4));
    logger.info("%s listening on port: %s", conf.app_name, conf.server_port);
});
