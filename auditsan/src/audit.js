var commons = require("../../commons/src/commons");
console.log(JSON.stringify(process.env, null, 4));
const conf = commons.merge(require('./conf/audit'), require('./conf/audit-' + (process.env.ENVIRONMENT || 'localhost')));
console.log(JSON.stringify(conf, null, 4));
const obj = commons.obj(conf);

const logger = obj.logger();
const db = obj.db();
const queryBuilder = obj.query_builder();
var to_continue_insert = true;

var hostname = require('os').hostname();
console.log("instrumentazione per appdynamics: ", process.env.APPDYNAMICS_HOSTS, hostname)
logger.info("instrumentazione per appdynamics: ", process.env.APPDYNAMICS_HOSTS, hostname)

var env_dynamics = {
    "dev" : "DEV",
    "tst" : "TEST",
    "prod": "PROD"
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

if(process.env.APPDYNAMICS_HOSTS && process.env.APPDYNAMICS_HOSTS.indexOf(hostname) !== -1){
    require("appdynamics").profile({
        controllerHostName: 'csi-net.saas.appdynamics.com',
        controllerPort: 443,
        controllerSslEnabled: true,
        accountName: 'csi-net',
        accountAccessKey: '00dfb3669f59',
        applicationName: 'NOTIFYSAN_' + env_dynamics[process.env.ENVIRONMENT] + '_CSI-01',
        tierName: 'notifysan-' + conf.app_name,
        nodeName: 'notifysan-'+ conf.app_name + '-' + hostname,
        proxyHost: conf.appdynamics.proxyHost,
        proxyPort: conf.appdynamics.proxyPort
    })


}

function checkAudit(payload) {
    var result = [];
    if (!payload) {
        result.push("payload of the body is mandatory");
        return result;
    }

    if (typeof payload !== 'object' || Array.isArray(payload)) {
        result.push("payload of the body must be an object");
        return result;
    }

    var pl = payload;
    if (!pl.uuid) result.push("uuid is mandatory");
    if (!pl.timestamp) result.push("timestamp is mandatory");
    return result;
}

var bulk = [];
async function insert(data) {
    var audit = data.payload;
    // stringify inner object
    Object.keys(audit).filter( e=> typeof audit[e] === 'object').forEach(e => audit[e] = JSON.stringify(audit[e]));
    bulk.push(queryBuilder.insert().table("audit").values(audit).sql);
    while(bulk.length >= 500) await sleep(1000);
    //await db.execute(sql);

}

async function doInsert()
{
    if(!to_continue_insert) return;

    if(bulk.length == 0) return setTimeout(doInsert, 1000);
    try {
        logger.info("bulk of " + bulk.length + " audits");
        let sql = bulk.join(";");
        bulk = [];
        await db.execute(sql);
        logger.debug("insert audits completed");
    } catch (e) {
        logger.error("error in query: ", e.message);
    }
    setTimeout(doInsert, 0);
}

doInsert();

logger.debug(JSON.stringify(process.env, null, 4));
logger.debug(JSON.stringify(conf, null, 4));
obj.consumer("audit", checkAudit, null, insert, true)();


async function shutdown(){
    to_continue_insert = false;
    try{
        await sleep(2000);
        logger.debug("STOPPING DATABASE");
        await db.end();
        logger.debug("STOPPED DATABASE");
    }catch(e){
        logger.error("error closing connection: ", e.message);
        process.exit(1);
    }
}

process.on("SIGINT",shutdown);
process.on("SIGTERM",shutdown);