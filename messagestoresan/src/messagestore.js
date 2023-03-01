var commons = require("../../commons/src/commons");
const conf = commons.merge(require('./conf/mex'), require('./conf/mex-' + (process.env.ENVIRONMENT || 'localhost')));
const obj = commons.obj(conf);

const logger = obj.logger();
const db = obj.db();
const security_checks = obj.security_checks();
const Utility = obj.utility();
const buildQuery = obj.query_builder();

var servicesEnforcedTags = null;

const req_promise = require('request-promise');
var heapdump = require('heapdump');
var uuid = require('uuid');
var escape = require('escape-html');

function pattern(x){
    return x.substring(0,x.indexOf("/messages")+"/messages".length) + "*";
}

const util = require("util");

var express = require('express');
var bodyParser = require('body-parser');

const crypto = obj.cryptoAES_cbc();
const encrypt = function (text) {
    if (!text || text === null) return null;
    return crypto.encrypt(text, conf.security.passphrase)
};
const decrypt = function(text){ 
    try{
        if(!text || text ==null) return text;
        return crypto.decrypt(text,conf.security.passphrase)
    }catch(e){
        return text;
    }
};

var hostname = require('os').hostname();
logger.info("instrumentazione per appdynamics: ", process.env.APPDYNAMICS_HOSTS, hostname);
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


var app = express();
app.use(bodyParser.json({limit: conf.request_limit}));

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

app.use(function(req, res, next){
    res.set("X-Response-Time", new Date().getTime());
    next();
});

var prefix = "/api/v1/users/";
var prefix_mex = "/api/v1/message-users/"

if (conf.security) {
    if(conf.security.blacklist) obj.blacklist(app);

    var permissionMap = [];
    permissionMap.push({
        url: prefix_mex + ":mex_id",
        method: "get",
        permissions: ["read"]
    });
    permissionMap.push({
        url: prefix + ":user_id/messages/:mex_id",
        method: "get",
        permissions: ["read"]
    });
    permissionMap.push({
        url: prefix + ":user_id/messages",
        method: "get",
        permissions: ["read"]
    });

    permissionMap.push({
        url: prefix + ":user_id/messages/:mex_uuid",
        method: "delete",
        permissions: ["write"]
    });

    permissionMap.push({
        url: prefix + ":user_id/messages/status",
        method: "put",
        permissions: ["write"]
    });

    permissionMap.push({
        url: prefix + ":user_id/messages/:mex_id",
        method: "put",
        permissions: ["write"]
    });

    obj.security(permissionMap, app);
    app.use(prefix + ':user_id/messages', security_checks.checkHeader);
}


/**
 * convert message taken from db to message well formatted
 * @param m message to  format
 * @returns {*}
 */
function toMessage(m) {
    
    try{
        logger.info("message: ", m);
        var mex_io = JSON.parse(decrypt(m.io));
    }catch(e){
        logger.error("m.io is not a valid JSON: ", m.io, e.message);
        throw e;
    }
    var x = {
        id: m.id,
        uuid: m.m_id,
        bulk_id: m.bulk_id,
        user_id: m.user_id,
        email: {
            to: m.email_to,
            subject: decrypt(m.email_subject),
            body: decrypt(m.email_body),
            template_id: m.email_template_id
        },
        sms: {
            phone: m.sms_phone,
            content: decrypt(m.sms_content)
        },
        push: {
            token: m.push_token,
            title: decrypt(m.push_title),
            body: decrypt(m.push_body),
            call_to_action: m.push_call_to_action
        },
        mex: {
            title: decrypt(m.mex_title),
            body: decrypt(m.mex_body),
            call_to_action: m.mex_call_to_action
        },
        io: mex_io,
        memo: m.memo && typeof m.memo === "object"?JSON.parse(m.memo):null,
        tag: m.tag? m.tag.join(","): m.tag,
        correlation_id: m.correlation_id,
        read_at: m.read_at,
        timestamp: m.timestamp,
        ruolo: m.ruolo,
        collocazione: m.collocazione,
        applicazione: m.applicazione
    };
    let client_token = decrypt(m.client_token);
    if (client_token) {
        try {
            let payload = JSON.parse(client_token);
            x.sender = payload.preference_service_name;
        } catch (err) {
            logger.error("client_token is not a valid JSON: ", client_token, err.message);
            throw err;
        }
    }
    return x;
}

function getOffset(url, offset, new_offset) {
    if (!url.includes("offset=" + offset)) url += "&offset=" + offset;
    return url.replace("offset=" + offset, "offset=" + new_offset);

}

app.get(prefix + ':user_id/messages/:mex_id', async function (req, res, next) {

    if(servicesEnforcedTags === null) return next({type: "system_error", status: 500, message: "internal error"});

    if(!uuid.validate(req.params.mex_id)) {
        logger.warn("not a valid uuid");
        return next({
            type: "client_error",
            status: 400,
            message: escape(req.params.mex_id) + " is not a valid message id"
        });
    }

    let user_id = Utility.hashMD5(req.params.user_id);
    let service_name = req.user.preference_service_name;
    try {
        let customFilter = null;
        if(servicesEnforcedTags.get(service_name)) customFilter = servicesEnforcedTags.get(service_name);

        var sql = "select *, messages.id as m_id from messages  "+
                    "left join messages_cf on  messages.id=messages_cf.id_message  "+
                    "left join messages_splitted on messages.id=messages_splitted.id_message and messages_splitted.cf='"+user_id+"'"+
        " where 1=1 and (messages.user_id = '"+user_id+"' OR messages_cf.cf = '"+user_id+"'  or messages_cf.id_message is null) and messages.id = '"+req.params.mex_id+"'";
        
        if(customFilter){
            sql+=  " AND (" + customFilter + ")";
        }
        logger.debug("sql: ",sql);
    } catch (err) {
        return next({type: "client_error", status: 400, message: err});
    }

    try {
        var result = await db.execute(sql);

        if (!result || result.length === 0) {
            return next({
                type: "client_error",
                status: 404,
                message: "the user " + escape(req.params.user_id) + " tried to retrieve the message " + escape(req.params.mex_id) + " that doesn't exist"
            });
        }
    } catch (err) {
        return next({type: "db_error", status: 500, message: err});
    }

    let message = result[0];
    message.user_id = req.params.user_id;
    try {
        return next({type: "ok", status: 200, message: toMessage(message)});
    } catch (err) {
        logger.error("system error: ", err.message);
        return next({type: "system_error", status: 500, message: err});
    }
});

/**
 * get a specific message from a user
 */
app.get(prefix_mex + ':mex_id', async function (req, res, next) {

    if(servicesEnforcedTags === null) return next({type: "system_error", status: 500, message: "internal error"});

    if(!uuid.validate(req.params.mex_id)) {
        logger.warn("not a valid uuid");
        return next({
            type: "client_error",
            status: 400,
            message: escape(req.params.mex_id) + " is not a valid message id"
        });
    }

    let service_name = req.user.preference_service_name;
    try {
        let customFilter = null;
        if(servicesEnforcedTags.get(service_name)) customFilter = servicesEnforcedTags.get(service_name);

        var sql = "select *, messages.id as m_id from messages  "+
        " where 1=1 and messages.id = '"+req.params.mex_id+"'";
        
        if(customFilter){
            sql+=  " AND (" + customFilter + ")";
        }
        logger.debug("sql: ",sql);
    } catch (err) {
        return next({type: "client_error", status: 400, message: err});
    }

    try {
        var result = await db.execute(sql);

        if (!result || result.length === 0) {
            return next({
                type: "client_error",
                status: 404,
                message: "the user " + escape(req.params.user_id) + " tried to retrieve the message " + escape(req.params.mex_id) + " that doesn't exist"
            });
        }
    } catch (err) {
        return next({type: "db_error", status: 500, message: err});
    }

    let message = result[0];
    try {
        let messageToReturn = toMessage(message);
        let destinations = await loadMultipleDestinations(req.params.mex_id);
        messageToReturn.destinations = destinations;
        return next({type: "ok", status: 200, message: messageToReturn});
    } catch (err) {
        logger.error("system error: ", err.message);
        return next({type: "system_error", status: 500, message: err});
    }
});


async function loadMultipleDestinations(uuid){
    let options = {
        url: conf.preferences.url + "/broadcast_batch/messages/batch/"+uuid,
        method: "GET",
        headers: {
            'x-authentication': conf.preferences.token,
            'Authorization': 'Basic ' + Buffer.from(conf.preferences.basicauth.username.trim() + ":" + conf.preferences.basicauth.password.trim()).toString('base64')
        },
        json: true
    };
    try{
        let destinazioni = await req_promise(options);
        logger.debug("loaded destinations: ", destinazioni);
        return destinazioni;
    }catch(e){
        logger.error("error in loading destinations: ", e.message);
    }
}

/**
 * Cache per il recupero del numero di records totali (select count(*))
 */
class CountData {

    constructor(minutesToLive = 3) {
        /**
         * La cache ha una durata di 3 minuti
         */
        this.millisecondsToLive = minutesToLive * 60 * 1000;
        this.cacheCount = {};
    }

    async getCount(sql) {
        var count = 0;
        /**
         * Se esiste un dato nella cache viene restituito, altrimenti si procede
         *   ad effettuare una select count(*)
        
        if (this.cacheCount[sql]) {
            var cache = this.cacheCount[sql];
            logger.debug("Found cacheCount: ", cache);
            count = cache.count;
            cache.fetched = new Date().getTime();
        } else {
         */    
            var res = await db.execute(sql);
            count = res[0].count;
            var cache = {"count": count, "fetched": new Date().getTime()};
        //}
        logger.debug("new cacheCount: ", cache);
        this.cacheCount[sql] = cache;
        this.resetCache();
        return count;
    }

    /**
     * Gli elementi vengono rimossi quando la cache non è più valida
     */
    resetCache() {
        Object.entries(this.cacheCount).forEach(([key, value]) => {
            if ((this.cacheCount[key].fetched + this.millisecondsToLive) < new Date().getTime()) {
                delete this.cacheCount[key];
            }
        })
    }
}

var countData = new CountData();

/**
 * get list of messages of the user
 */
app.get(prefix + ':user_id/messages', async function (req, res, next) {

    if(servicesEnforcedTags === null) return next({type: "system_error", status: 500, message: "internal error"});

    let user_id = Utility.hashMD5(req.params.user_id);
    let service_name = req.user.preference_service_name;

    try {
        var filter = req.query.filter ? JSON.parse(req.query.filter) : {};
        var sort = req.query.sort ? "messages."+req.query.sort : "messages.timestamp";
        var limit = req.query.limit ? parseInt(req.query.limit) : 10;
        var offset = req.query.offset ? parseInt(req.query.offset) : 0;
        var ruolo=req.query.ruolo;
        var ruoli=req.query.ruoli;
        var ruolo_attivo = req.query.ruolo_attivo;
        var collocazione = req.query.collocazione;
        var collocazioni = req.query.collocazioni;
        var collocazione_attivo = req.query.collocazione_attivo;
        var applicazione = req.query.applicazione;
        var applicazioni = req.query.applicazioni;
        var applicazione_attivo = req.query.applicazione_attivo; 
        var filter_read_at = req.query.read_at;
        var read_status = req.query.read_status;
        var personali = req.query.personali;
        var timestamp_from = req.query.timestamp_from;
        var timestamp_to = req.query.timestamp_to;
        var all_notifications = req.query.all_notifications;
    } catch(err) {
        logger.error("invalid data in query parameters:", JSON.stringify(req.query));
        return next({type: "client_error", status: 400, message: "invalid data in query parameters"});
    }

    filter.user_id = {eq: user_id};
    
    let filter_tag = filter.tag;
    let filter_not_tag = filter.not_tag ; 
    logger.debug("filter tag:",filter.tag);  
    logger.debug("filter not tag:",filter.not_tag); 

    try {
        let customFilter = null;
        if(servicesEnforcedTags.get(service_name)) customFilter = servicesEnforcedTags.get(service_name);
        var sqlCount = null;
        var sql_total = null;
        if(all_notifications){
            let parameter = "";
            if(applicazioni){
                let applicazioneSplitted=applicazioni.split(",");
                applicazioneSplitted.forEach((element,index) => {
                    if(applicazioneSplitted.length==index+1){
                        parameter += "'"+element+"'";
                    }else{
                        parameter += "'"+element+"',";
                    }
                });
            }
            let parameterRuoli = "";
            if(ruoli){
                let ruoliSplitted=ruoli.split(",");
                ruoliSplitted.forEach((element,index) => {
                    if(ruoliSplitted.length==index+1){
                        parameterRuoli += "'"+element+"'";
                    }else{
                        parameterRuoli += "'"+element+"',";
                    }
                });
            }
            let parameterCollocazioni = "";
            if(collocazioni){
                let collocazioniSplitted=collocazioni.split(",");
                collocazioniSplitted.forEach((element,index) => {
                    if(collocazioniSplitted.length==index+1){
                        parameterCollocazioni += "'"+element+"'";
                    }else{
                        parameterCollocazioni += "'"+element+"',";
                    }
                });
            }
            sql_total = "select * from ("
            sqlCount = "select sum(count) as count from ("
            
            if(ruolo_attivo){
                sql_total += " select *, messages.id as m_id from messages  left join messages_cf on  messages.id=messages_cf.id_message "+
                            " left join messages_splitted on messages.id=messages_splitted.id_message and messages_splitted.cf='"+user_id+"'"+
                            " where 1=1 and collocazione is null and (messages_cf.cf = '"+user_id +"' or messages_cf.id_message is null) " ;
                if(customFilter){              
                    sql_total+=  " AND (" + customFilter + ")";
                }
                if(timestamp_from){
                    sql_total+=" and timestamp >='"+timestamp_from+"'";
                }
                if(timestamp_to){
                    sql_total+=" and timestamp <'"+timestamp_to+"'";
                }
                if(filter_tag){
                    sql_total+=" and (messages_splitted.tag @> '{"+filter_tag+"}' or messages.tag @> '{"+filter_tag+"}') "
                }
                if(filter_not_tag){
                    sql_total+=" and ("+filter_not_tag+" != all (messages_splitted.tag) or messages_splitted.tag is null    )"
                }
                if(read_status=='READ'){
                    sql_total+=" and messages_splitted.read_at is not null";
                }
                if(read_status=='NOT_READ'){
                    sql_total+=" and messages_splitted.read_at is null";
                }
                if(ruoli){
                    sql_total+=" AND ruolo in ("+parameterRuoli+")";
                }
            } 
            if(collocazione_attivo){
                if(ruolo_attivo){
                    sql_total += " union all ";
                }
                sql_total += " select *, messages.id as m_id from messages  left join messages_cf on  messages.id=messages_cf.id_message "+
                            " left join messages_splitted on messages.id=messages_splitted.id_message and messages_splitted.cf='"+user_id+"'"+
                            " where 1=1 and (messages_cf.cf = '"+user_id +"' or messages_cf.id_message is null)" ;
                if(customFilter){              
                    sql_total+=  " AND (" + customFilter + ")";
                }
                if(timestamp_from){
                    sql_total+=" and timestamp >='"+timestamp_from+"'";
                }
                if(timestamp_to){
                    sql_total+=" and timestamp <'"+timestamp_to+"'";
                }
                if(filter_tag){
                    sql_total+=" and (messages_splitted.tag @> '{"+filter_tag+"}' or messages.tag @> '{"+filter_tag+"}') "
                
                }
                if(filter_not_tag){
                    sql_total+=" and ("+filter_not_tag+" != all (messages_splitted.tag) or messages_splitted.tag is null    )"
                }
                if(read_status=='READ'){
                    sql_total+=" and messages_splitted.read_at is not null";
                }
                if(read_status=='NOT_READ'){
                    sql_total+=" and messages_splitted.read_at is null";
                }
                if(ruoli){
                    sql_total+=" AND ruolo in ("+parameterRuoli+")";
                }
                if(collocazioni){
                    sql_total+=" AND collocazione in ("+parameterCollocazioni+")";
                }
            } 
            if(applicazione_attivo){
                if(collocazione_attivo || ruolo_attivo){
                    sql_total += " union all "
                }
                sql_total += " select *, messages.id as m_id from messages  left join messages_cf on  messages.id=messages_cf.id_message "+
                            " left join messages_splitted on messages.id=messages_splitted.id_message and messages_splitted.cf='"+user_id+"'"+
                            " where 1=1  and  (messages_cf.cf = '"+user_id +"' or messages_cf.id_message is null) and messages.user_id is null " ;
                if(customFilter){              
                    sql_total+=  " AND (" + customFilter + ")";
                }
                if(timestamp_from){
                    sql_total+=" and timestamp >='"+timestamp_from+"'";
                }
                if(timestamp_to){
                    sql_total+=" and timestamp <'"+timestamp_to+"'";
                }
                if(filter_tag){
                    sql_total+=" and (messages_splitted.tag @> '{"+filter_tag+"}' or messages.tag @> '{"+filter_tag+"}') "
                
                }
                if(filter_not_tag){
                    sql_total+=" and ("+filter_not_tag+" != all (messages_splitted.tag) or messages_splitted.tag is null    )"
                }
                if(read_status=='READ'){
                    sql_total+=" and messages_splitted.read_at is not null";
                }
                if(read_status=='NOT_READ'){
                    sql_total+=" and messages_splitted.read_at is null";
                }
                if(applicazioni){
                    sql_total+=" AND applicazione in ("+parameter+")";
                }
            }
            if(ruolo_attivo){
                sqlCount +=  "select count (*) as count from messages  left join messages_cf on  messages.id=messages_cf.id_message "+
                            " left join messages_splitted on messages.id=messages_splitted.id_message and messages_splitted.cf='"+user_id+"'"+
                            " where 1=1 and collocazione is null and (messages_cf.cf = '"+user_id +"' or messages_cf.id_message is null) " ;
                if(customFilter){              
                    sqlCount+=  " AND (" + customFilter + ")";
                }
                if(timestamp_from){
                    sqlCount+=" and timestamp >='"+timestamp_from+"'";
                }
                if(timestamp_to){
                    sqlCount+=" and timestamp <'"+timestamp_to+"'";
                }
                if(filter_tag){
                    sqlCount+=" and (messages_splitted.tag @> '{"+filter_tag+"}' or messages.tag @> '{"+filter_tag+"}') "
                
                }
                if(filter_not_tag){
                    sqlCount+=" and ("+filter_not_tag+" != all (messages_splitted.tag) or messages_splitted.tag is null    )"
                }
                if(read_status=='READ'){
                    sqlCount+=" and messages_splitted.read_at is not null";
                }
                if(read_status=='NOT_READ'){
                    sqlCount+=" and messages_splitted.read_at is null";
                }
                if(ruoli){
                    sqlCount+=" AND ruolo in ("+parameterRuoli+")";
                }
            } 
            if(collocazione_attivo){
                if(ruolo_attivo){
                    sqlCount += " union all ";
                }
                sqlCount += "select count (*) as count from messages  left join messages_cf on  messages.id=messages_cf.id_message "+
                            " left join messages_splitted on messages.id=messages_splitted.id_message and messages_splitted.cf='"+user_id+"'"+
                            " where 1=1 and (messages_cf.cf = '"+user_id +"' or messages_cf.id_message is null) " ;
                if(customFilter){              
                    sqlCount+=  " AND (" + customFilter + ")";
                }
        
                if(timestamp_from){
                    sqlCount+=" and timestamp >='"+timestamp_from+"'";
                }
                if(timestamp_to){
                    sqlCount+=" and timestamp <'"+timestamp_to+"'";
                }
                if(filter_tag){
                    sqlCount+=" and (messages_splitted.tag @> '{"+filter_tag+"}' or messages.tag @> '{"+filter_tag+"}') "
                
                }
                if(filter_not_tag){
                    sqlCount+=" and ("+filter_not_tag+" != all (messages_splitted.tag) or messages_splitted.tag is null    )"
                }
                if(read_status=='READ'){
                    sqlCount+=" and messages_splitted.read_at is not null";
                }
                if(read_status=='NOT_READ'){
                    sqlCount+=" and messages_splitted.read_at is null";
                }
                if(ruoli){
                    sqlCount+=" AND ruolo in ("+parameterRuoli+")";
                }
                if(collocazioni){
                    sqlCount+=" AND collocazione in ("+parameterCollocazioni+")";
                }
            } 
            if(applicazione_attivo){
                if(collocazione_attivo || ruolo_attivo){
                    sqlCount += " union all ";
                }
                sqlCount += "select count (*) as count from messages  left join messages_cf on  messages.id=messages_cf.id_message "+
                            " left join messages_splitted on messages.id=messages_splitted.id_message and messages_splitted.cf='"+user_id+"'"+
                            " where 1=1  and  (messages_cf.cf = '"+user_id +"' or messages_cf.id_message is null) and messages.user_id is null " ;
                if(customFilter){              
                    sqlCount+=  " AND (" + customFilter + ")";
                }
                if(timestamp_from){
                    sqlCount+=" and timestamp >='"+timestamp_from+"'";
                }
                if(timestamp_to){
                    sqlCount+=" and timestamp <'"+timestamp_to+"'";
                }
                if(filter_tag){
                    sqlCount+=" and (messages_splitted.tag @> '{"+filter_tag+"}' or messages.tag @> '{"+filter_tag+"}') "
                
                }
                if(filter_not_tag){
                    sqlCount+=" and ("+filter_not_tag+" != all (messages_splitted.tag) or messages_splitted.tag is null    )"
                }
                if(read_status=='READ'){
                    sqlCount+=" and messages_splitted.read_at is not null";
                }
                if(read_status=='NOT_READ'){
                    sqlCount+=" and messages_splitted.read_at is null";
                }
                if(applicazioni){
                    sqlCount+=" AND applicazione in ("+parameter+")";
                }
            }
            sql_total+=") messages ORDER BY "+sort+" desc LIMIT "+limit+" offset "+offset;   
            sqlCount+=") a";        
        } else {
            //inizio query classica
            sqlCount = "select count (*) as count from messages  left join messages_cf on  messages.id=messages_cf.id_message "+
                       "left join messages_splitted on messages.id=messages_splitted.id_message and messages_splitted.cf='"+user_id+"' where 1=1 ";
                        
            sql_total = "select *, messages.id as m_id from messages  left join messages_cf on  messages.id=messages_cf.id_message "+
                        "left join messages_splitted on messages.id=messages_splitted.id_message and messages_splitted.cf='"+user_id+"' where 1=1 ";
            if(customFilter){              
                sql_total+=  " AND (" + customFilter + ")";
                sqlCount+=  " AND (" + customFilter + ")";
            }
            if(personali == 0){
                sql_total+= " and  (messages_cf.cf = '"+user_id +"' or messages_cf.id_message is null)";
                sqlCount+=  " and  (messages_cf.cf = '"+user_id +"' or messages_cf.id_message is null)";
            } 
            if(personali == 1){
                sql_total+= " and messages.user_id = '"+user_id+"'";
                sqlCount+= " and messages.user_id = '"+user_id+"'";
            }
            if(personali == 2){
                sql_total+= " and (messages.user_id = '"+user_id+"' or  messages_cf.cf = '"+user_id +"' or messages_cf.id_message is null)";
                sqlCount+= " and (messages.user_id = '"+user_id+"' or  messages_cf.cf = '"+user_id +"' or messages_cf.id_message is null)";
            }

            if(filter_tag){
                sql_total+=" and (messages_splitted.tag @> '{"+filter_tag+"}' or messages.tag @> '{"+filter_tag+"}') "
                sqlCount+=" and (messages_splitted.tag @> '{"+filter_tag+"}' or messages.tag @> '{"+filter_tag+"}') "
            }
            if(filter_not_tag){
                sql_total+=" and ("+filter_not_tag+" != all (messages_splitted.tag) or messages_splitted.tag is null   )"
                sqlCount+=" and ("+filter_not_tag+" != all (messages_splitted.tag) or messages_splitted.tag is null   )"
            }
            if(timestamp_from){
                sql_total+=" and timestamp >='"+timestamp_from+"'";
                sqlCount+=" and timestamp >='"+timestamp_from+"'";
            }
            if(timestamp_to){
                sql_total+=" and timestamp <'"+timestamp_to+"'";
                sqlCount+=" and timestamp <'"+timestamp_to+"'";
            }
            if(filter_read_at){
                sql_total+=" and messages_splitted.read_at >'"+filter_read_at+"'";
                sqlCount+=" and messages_splitted.read_at >'"+filter_read_at+"'";
            }
            if(read_status=='READ'){
                sql_total+=" and messages_splitted.read_at is not null";
                sqlCount+=" and messages_splitted.read_at is not null";
            }
            if(read_status=='NOT_READ'){
                sql_total+=" and messages_splitted.read_at is null";
                sqlCount+=" and messages_splitted.read_at is null";
            }
            if(ruolo!=null){
                sqlCount+=" AND ruolo='"+ruolo+"'";
                sql_total+=" AND ruolo='"+ruolo+"'";
            }
            if(collocazione!=null){
                sqlCount+=" AND collocazione='"+collocazione+"'";
                sql_total+=" AND collocazione='"+collocazione+"'";
            }else{
                sqlCount+=" AND collocazione is null";
                sql_total+=" AND collocazione is null";          
            }
            if(applicazione!=null){
                sqlCount+=" AND applicazione='"+applicazione+"'";
                sql_total+=" AND applicazione='"+applicazione+"'";
            } 
            if(applicazioni!=null){
                let parameter = "";
                let applicazioneSplitted=applicazioni.split(",");
                applicazioneSplitted.forEach((element,index) => {
                    if(applicazioneSplitted.length==index+1){
                        parameter += "'"+element+"'";
                    }else{
                        parameter += "'"+element+"',";
                    }
                });
                sqlCount+=" AND applicazione in ("+parameter+")";
                sql_total+=" AND applicazione in ("+parameter+")";
            } 
            sql_total+=" ORDER BY "+sort+" desc LIMIT "+limit+" offset "+offset;
        }
    } catch (err) {
        logger.error(JSON.stringify(err));
        return next({type: "client_error", status: 400, message: err});
    }

    try {
        logger.debug("SQL get user messages:" + sql_total);
        logger.debug("SQL count user messages:" + sqlCount);
        let t0 = new Date().getTime();
        var resultCount = (await countData.getCount(sqlCount));
        var result = await db.execute(sql_total);
        let t1 = new Date().getTime();
        logger.debug("QUERY EXECUTION TIME: ",(t1-t0)/1000 + "s");

        if (!result || result.length === 0) return next({type: "ok", status: 200, message: []});
    } catch (err) {
        if(err.errno && err.errno === 1054) return next({type: "client_error", status: 400, message: err});
        return next({type: "db_error", status: 500, message: err});
    }

    res.set('total-elements', resultCount);

    let mex_not_read = result.filter( mex => !mex.read_at);
    let mex_not_noticed = result.filter( mex => !mex.tag || !(mex.tag.includes("noticed")));

    res.set('total-elements-not-read', mex_not_read.length);
    res.set('total-elements-not-noticed', mex_not_noticed.length);

    let total_pages = Math.trunc((resultCount) / limit) + 1;
    let current_page = Math.round(offset / limit);
    res.set('total-pages', total_pages);
    res.set('current-page', current_page);
    res.set('page-size', limit);


    if (current_page < total_pages - 1) res.set("next-page", getOffset(req.url, offset, offset + limit));
    if (current_page > 0) res.set("previous-page", getOffset(req.url, offset, offset - limit));

    try {
        return next({
            type: "ok", status: 200, message: result.map(e => {
                e.user_id = escape(req.params.user_id);
                return toMessage(e)
            })
        });
    } catch (err) {
        logger.error("system error: ", err.message);
        return next({type: "system_error", status: 500, message: err});
    }

});

/**
 * delete a user message
 */
app.delete(prefix + ':user_id/messages/:mex_uuid', async function (req, res, next) {

    if(servicesEnforcedTags === null) return next({type: "system_error", status: 500, message: "internal error"});

    let user_id = Utility.hashMD5(req.params.user_id);

    let service_name = req.user.preference_service_name;
    logger.debug("user_id: "+user_id);
    if(!uuid.validate(req.params.mex_uuid)) {
        logger.warn("not a valid uuid");
        return next({
            type: "client_error",
            status: 400,
            message: escape(req.params.mex_uuid) + " is not a valid message id"
        });
    }

    try {
        let customFilter = null;
        
        if(servicesEnforcedTags.get(service_name)) customFilter = servicesEnforcedTags.get(service_name);

        var getQuery =  "select *, messages.id as m_id from messages  left join messages_cf on  messages.id=messages_cf.id_message "+
        "left join messages_splitted on messages.id=messages_splitted.id_message and messages_splitted.cf='"+user_id+"'"+
        " where 1=1 and (messages.user_id = '"+user_id+"' OR messages_cf.cf = '"+user_id+"' or messages_cf.id_message is null) and messages.id = '"+req.params.mex_uuid+"'";
        if(customFilter){
           
            getQuery+=  " AND (" + customFilter + ")";
        }
        logger.debug("getQuery: "+getQuery);
    } catch (err) {
        return next({type: "client_error", status: 400, message: err});
    }

    try {
        var message = await db.execute(getQuery);
    } catch (err) {
        return next({type: "db_error", status: 500, message: err});
    }

    if (!message || message.length === 0) return next({
        type: "client_error",
        status: 404,
        message: "User message not found"
    });
    var tags = message[0].tag || [];
    if (tags.includes("deleted")) return next({
        type: "client_error",
        status: 400,
        message: "Message already deleted"
    });
    tags.push("deleted");
    let parameter = "";       
    tags.forEach((element,index) => {
        if(tags.length==index+1){
            parameter += "'"+element+"'";
        }else{
            parameter += "'"+element+"',";
        }
    });
            
    try {
        logger.debug("1: ");
        var selectSql = "select count(*) as count from messages_splitted where id_message='"+req.params.mex_uuid+"' and cf='"+user_id+"'";
        logger.debug("selectSql: "+selectSql);
        let count = await db.execute(selectSql);
        logger.debug("count: "+count[0].count);
        var sql = null;
        if(count[0].count==0){
            sql = "insert into messages_splitted (id_message, cf, tag) values ('"+ req.params.mex_uuid+"','"+user_id+"', ARRAY ["+parameter+"])";
        }else{
            sql = "update messages_splitted set tag=ARRAY ["+parameter+"] where id_message='"+message[0].m_id+"' and cf='"+user_id+"'";
            
        }
      
    } catch (err) {
        return next({type: "client_error", status: 400, message: err});
    }

    try {
        logger.debug("sql: "+sql);
        var updateResult = await db.execute(sql);
    } catch (err) {
        return next({type: "db_error", status: 500, message: err});
    }

    next({type: "ok", status: 200, message: "Message deleted"});

});

/**
 * update the status of multiple messages ( only read_at and tags)
 */
app.put(prefix + ':user_id/messages/status', async function (req, res, next) {

    if(servicesEnforcedTags === null) return next({type: "system_error", status: 500, message: "internal error"});

    let service_name = req.user.preference_service_name;
    let messagesToUpdate = req.body;    

    let now = Utility.getDateFormatted(new Date());

    messagesToUpdate = messagesToUpdate.filter( e => e.id && e.id !== "");
    let idMexToGet = messagesToUpdate.map(e => e.id);

    let validKeys = ["read_at","tag"];
    let user_id = Utility.hashMD5(req.params.user_id);

    for(let mexToUpdate of messagesToUpdate) {
        let putMex = {};
        Object.assign(putMex,mexToUpdate);

        if(putMex.tag) putMex.tag = putMex.tag.split(",").map(e => e.trim().replace(/-/g, '_').replace(/\s/g, '_')).filter(e => e.length>0);

        Object.keys(putMex).forEach( elem => {
            if(!validKeys.includes(elem)) delete putMex[elem];
        });

        if(putMex.read_at) putMex.read_at = now;

        try {
            let customFilter = null;
            if(servicesEnforcedTags.get(service_name)) customFilter = servicesEnforcedTags.get(service_name);
            logger.debug("1: ");
            var selectSql = "select count(*) as count from messages_splitted where id_message='"+mexToUpdate.id+"' and cf='"+user_id+"'";
            logger.debug("selectSql: "+selectSql);
            let count = await db.execute(selectSql);
            logger.debug("count: "+count[0].count);
            var sql = null;
            if(count[0].count==0){
                let parameter = "";       
                putMex.tag.forEach((element,index) => {
                    if(putMex.tag.length==index+1){
                        parameter += "'"+element+"'";
                    }else{
                        parameter += "'"+element+"',";
                    }
                });
                sql = "insert into messages_splitted (id_message, cf, tag, read_at) values ('"+ mexToUpdate.id+"','"+user_id+"', ARRAY ["+parameter+"],'"+putMex.read_at+"')";
            }else{
                sql = buildQuery.update().table('messages_splitted').set(putMex).filter({
                    "id_message": {"eq": mexToUpdate.id},
                    "cf": {"eq": user_id},
                }).sqlFilter(customFilter).sql;
            }
        } catch (err) {
            return next({type: "client_error", status: 400, message: err});
        }

        try {
            await db.execute(sql);
        } catch (err) {
            return next({type: "db_error", status: 500, message: err});
        }

    }

    try {
        var select_sql = buildQuery.select().table("messages").filter({"id": {"in": idMexToGet}}).sql;
    } catch (err) {
        return next({type: "client_error", status: 400, message: err});
    }

    try {
        var result = await db.execute(select_sql);
    } catch (err) {
        return next({type: "db_error", status: 500, message: err});
    }

    let messages = [];

    try {
        result.forEach( e => {
            e = toMessage(e);
            e.user_id = req.params.user_id;
            messages.push(e);
        })
        return next({type: "ok", status: 200, message: messages});
    } catch (err) {
        logger.error("system error: ", err.message);
        return next({type: "system_error", status: 500, message: err});
    }
});

/**
 * update the status of "read" to the message, inserting the timestamp
 */
app.put(prefix + ':user_id/messages/:mex_id', async function (req, res, next) {
    if(servicesEnforcedTags === null) return next({type: "system_error", status: 500, message: "internal error"});

    let service_name = req.user.preference_service_name;

    if(!uuid.validate(req.params.mex_id)) {
        logger.warn("not a valid uuid");
        return next({
            type: "client_error",
            status: 400,
            message: escape(req.params.mex_id) + " is not a valid message id"
        });
    }
    let user_id = Utility.hashMD5(req.params.user_id);
    let now = Utility.getDateFormatted(new Date());
    try {
        let customFilter = null;
        if(servicesEnforcedTags.get(service_name)) customFilter = servicesEnforcedTags.get(service_name);
        logger.debug("1: ");
        var selectSql = "select count(*) as count from messages_splitted where id_message='"+req.params.mex_id+"' and cf='"+user_id+"'";
        logger.debug("selectSql: "+selectSql);
        let count = await db.execute(selectSql);
        logger.debug("count: "+count[0].count);
        var sql = null;
        if(count[0].count==0){
            sql = "insert into messages_splitted (id_message, cf, read_at) values ('"+ req.params.mex_id+"','"+user_id+"','"+now+"')";
        }else{
            sql = buildQuery.update().table('messages_splitted').set(["read_at"], [now]).filter({
                "id_message": {"eq": req.params.mex_id},
                "cf": {"eq": user_id},
            }).sqlFilter(customFilter).sql;
        }
        logger.debug("sql: ",sql);
        var select_sql = buildQuery.select().table("messages").filter({"id": {"eq": req.params.mex_id}}).sqlFilter(customFilter).sql;
    } catch (err) {
        return next({type: "client_error", status: 400, message: err});
    }

    try {
        var result = await db.execute(sql + ";" + select_sql + ";");
        if (result[1].length === 0) return next({
            type: "client_error",
            status: 404,
            message: "the user " + escape(req.params.user_id) + " tried to update the message " + escape(req.params.mex_id) + " that doesn't exist"
        });

    } catch (err) {
        return next({type: "db_error", status: 500, message: err});
    }
    try {
        let message = toMessage(result[1][0]);
        message.user_id = escape(req.params.user_id);
        return next({type: "ok", status: 200, message: message});
    } catch (err) {
        logger.error("system error: ", err.message);
        return next({type: "system_error", status: 500, message: err});
    }
});

obj.response_handler(app);

app.listen(conf.server_port, function () {
    logger.info("environment:", JSON.stringify(process.env, null, 4));
    logger.info("configuration:", JSON.stringify(conf, null, 4));
    logger.info('Messagestore server listening on port: ', conf.server_port);
});

async function loadServicesEnforcedTags () {
    let options = {
        url: conf.preferences.url + "/services/tags",
        method: "GET",
        headers: {
            'x-authentication': conf.preferences.token,
            'Authorization': 'Basic ' + Buffer.from(conf.preferences.basicauth.username.trim() + ":" + conf.preferences.basicauth.password.trim()).toString('base64')
        },
        json: true
    };
    try{
        let services = await req_promise(options);

        const regex = /tag:'([a-zA-Z0-9_.-]*)'/g;
        servicesEnforcedTags = new Map();
        for(let service of services) {
            if(service.mex_enforced_tags) {
                let mex_enforced_tags_sql = service.mex_enforced_tags.replace(regex, stringToSql);
                servicesEnforcedTags.set(service.name, mex_enforced_tags_sql);
            } 
        }
        logger.debug("loaded services: ", servicesEnforcedTags);
    }catch(e){
        logger.error("error in loading services: ", e.message);
    }
}

function stringToSql(match, p1, offset, string) {
    return "tag @> '" + p1 + "'::_text";
}

loadServicesEnforcedTags();
setInterval(loadServicesEnforcedTags, 300 * 1000);