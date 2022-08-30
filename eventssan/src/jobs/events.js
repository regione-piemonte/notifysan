var commons = require("../../../commons/src/commons");
console.log(JSON.stringify(process.env, null, 4));
const conf = commons.merge(require('../conf/events'), require('../conf/events-' + (process.env.ENVIRONMENT || 'localhost')));
console.log(JSON.stringify(conf, null, 4));
const obj = commons.obj(conf);

const logger = obj.logger();
const db = obj.db();
const Utility = obj.utility();
const queryBuilder = obj.query_builder();

const dateformat = require("dateformat");

var to_continue_insert = true;
var hostname = require('os').hostname();
console.log("instrumentazione per appdynamics: ", process.env.APPDYNAMICS_HOSTS, hostname)
logger.info("instrumentazione per appdynamics: ", process.env.APPDYNAMICS_HOSTS, hostname)

var env_dynamics = {
    "dev" : "DEV",
    "tst" : "TEST",
    "prod": "PROD"
}

if(process.env.APPDYNAMICS_HOSTS && process.env.APPDYNAMICS_HOSTS.indexOf(hostname) !== -1){
    require("appdynamics").profile({
        controllerHostName: 'csi-net.saas.appdynamics.com',
        controllerPort: 443,
        controllerSslEnabled: true,
        accountName: 'csi-net',
        accountAccessKey: '00dfb3669f59',
        applicationName: 'NOTIFY_' + env_dynamics[process.env.ENVIRONMENT] + '_CSI-01',
        tierName: 'notify-' + conf.app_name,
        nodeName: 'notify-'+ conf.app_name + '-' + hostname,
        proxyHost: conf.appdynamics.proxyHost,
        proxyPort: conf.appdynamics.proxyPort
    })


}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function checkEvent(payload) {
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
    if (!pl.source) result.push("source is mandatory");
    if (typeof pl.source !== 'string') result.push("source must be a string");
    if (!pl.type) result.push("type is mandatory");
    if (typeof pl.type !== 'string') result.push("type must be a string");
    if (!payload.description) result.push("description is mandatory");
    if (typeof payload.description !== 'string') result.push("description must be a string");
    return result;
}

async function insert(data) {
    try {
        var event = data.payload;
        event.uuid = data.uuid;

        if(!event || !event.payload) {
            logger.warn("event or event's payload empty or null");
            return;
        }

        event.payload = JSON.parse(event.payload);
        
        let bulk = [];
        let eventSql = insertEventSQL(event);
        if(eventSql) bulk.push(eventSql);

        let messageResultSql = insertMessagesResultSQL(createMexResult(event));
        if(messageResultSql) bulk.push(messageResultSql);

        let statsSql = insertStatsSQL(event);
        if(statsSql) bulk.push(statsSql);

        if(bulk.length > 0) {
            let sql = bulk.join(";");
            db.execute(sql).then(() => logger.debug("event sucessfully stored")).catch(e => logger.error("error while inserting event: ", e.message));
            logger.debug("Insert event finished successfully");
        }
    } catch(err) {
        logger.error("error while preparing event: ", err.message);
    }
}

function insertStatsSQL(event) {

    let sql_stats = null;
    var pl = event.payload;

    if (event.source.includes("consumer") && (pl.user || pl.sender)) {
        sql_stats = queryBuilder.insert().table("stats").values({
            sender: pl.user ? pl.user.preference_service_name : pl.sender,
            date: dateformat(new Date(), "yyyymmdd"),
            source: event.source,
            type: event.type,
            counter: 1
        }).sql;
        sql_stats += " ON CONFLICT(sender,date,source,type) DO UPDATE SET counter=stats.counter+1;";
    }
    
    return sql_stats;
}

function insertEventSQL(event) {

    let pl = event.payload;
    let sql = null;
    if (pl.message) {
        let values_to_insert = {
            uuid: event.uuid,
            created_at: Utility.getDateFormatted(new Date(event.created_at)),
            description: event.description,
            payload: event.payload,
            source: event.source,
            type: event.type
        };

        values_to_insert.msg_uuid = pl.message.id;
        values_to_insert.bulk_id = pl.message.bulk_id;
        values_to_insert.user_id = pl.message.user_id;
        values_to_insert.tag = pl.message.tag;
        if(pl.message.mex) values_to_insert.title = pl.message.mex.title;
        values_to_insert.correlation_id = pl.message.correlation_id;

        values_to_insert.me_payload = JSON.stringify(pl.message);
        values_to_insert.error = typeof pl.error === 'object' ? JSON.stringify(pl.error) : pl.error;
        
        sql = queryBuilder.insert().table("events").values(values_to_insert).sql;
    }

    return sql;
}

logger.debug(JSON.stringify(process.env, null, 4));
logger.debug(JSON.stringify(conf, null, 4));
obj.consumer("events", checkEvent, null, insert, true)();

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

function createMexResult(event){

    if(!event.payload.message) return null;
    
    if(!event.source.includes("consumer") || event.type === "INFO") return null;
    let message_result = {
      message_id : event.payload.message.id,
      bulk_id : event.payload.message.bulk_id || null,
      send_date: Utility.getDateFormatted(new Date()),
      note: ""
    };
    message_result[event.source.replace("consumer","") + '_result'] = event.type.includes("ERROR")? false : true;
    return message_result;
}

function insertMessagesResultSQL(message_result) {
  if(!message_result || message_result === null) return null;
  let sql = queryBuilder.insert().table("messages_status").values(message_result).sql;
  sql += " ON CONFLICT(message_id) DO UPDATE SET " +
    (message_result.io_result !== undefined && message_result.io_result !== null? " io_result = " + message_result.io_result + "," : "") +
    (message_result.mex_result !== undefined && message_result.mex_result !== null? " mex_result = " + message_result.mex_result + "," : "") +
    (message_result.push_result !== undefined && message_result.push_result !== null? " push_result = " + message_result.push_result + "," : "") +
    (message_result.sms_result !== undefined && message_result.sms_result !== null? " sms_result = " + message_result.sms_result + "," : "") +
    (message_result.email_result !== undefined && message_result.email_result !== null ? " email_result = " + message_result.email_result + "," : "") +
    (message_result.note ? " note = '" + message_result.note + "'," : "") +
    " send_date = '" + message_result.send_date + "'";

  return sql;
}

process.on("SIGINT",shutdown);
process.on("SIGTERM",shutdown);
