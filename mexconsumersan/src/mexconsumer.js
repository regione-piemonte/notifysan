var commons = require("../../commons/src/commons");
console.log(JSON.stringify(process.env, null, 4));
const conf = commons.merge(require('./conf/mexconsumer'), require('./conf/mexconsumer-' + (process.env.ENVIRONMENT || 'localhost')));
console.log(JSON.stringify(conf, null, 4));
const obj = commons.obj(conf);

const logger = obj.logger();
const eh = obj.event_handler();
const utility = obj.utility();
const queryBuilder = obj.query_builder();
const db = obj.db();
const crypto = obj.cryptoAES_cbc();
const encrypt = function (text) {
    if (!text || text === null) return null;
    return crypto.encrypt(text, conf.security.passphrase)
};


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

/**
 * check if payload message is in a correct format
 */
function checkMex(mex) {

    var res = [];

    if (!mex) {
        res.push("payload not present");
        return res;
    }
    if (typeof mex !== 'object' || Array.isArray(mex)) {
        res.push("payload element is not a valid object");
        return res;
    }

    if (!mex.id) res.push("id field is mandatory");
    if (!mex.user_id 
        && !mex.applicazione 
        && !mex.listaUtenti
        && !mex.collocazione
        && !mex.ruolo) res.push("to is mandatory");
    if (!mex.mex) res.push("mex is mandatory");
    if (!utility.checkNested(mex, "mex.title")) res.push("mex.title is mandatory");
    if (!utility.checkNested(mex, "mex.body")) res.push("mex.body is mandatory");

    return res;

}

async function sendMex(body) {

    var message = {
        id : body.payload.id,
        bulk_id : body.payload.bulk_id,
        user_id : body.payload.user_id,
        tag : body.payload.tag,
        correlation_id : body.payload.correlation_id
    };

    eh.info("trying to save mex", JSON.stringify({
        message: message
    }));
    logger.debug("trying to save mex");

    var mex = body.payload;

    mex.timestamp = utility.getDateFormatted(new Date(body.timestamp));
    //mex.timestamp = utility.getDateFormatted(new Date()); per test

    let user_id = null;
    if(mex.user_id){
        user_id = mex.user_id.match(/^[a-fA-F0-9]{32}$/g)? mex.user_id:utility.hashMD5(mex.user_id);
    }
    mex.email = mex.email ? mex.email : {};
    mex.push = mex.push ? mex.push : {};
    mex.sms = mex.sms ? mex.sms : {};
    mex.mex = mex.mex ? mex.mex : {};
    mex.io = mex.io ? mex.io : {};
    var insertSql = queryBuilder.insert().table("messages").values(
        {
            id: mex.id,
            bulk_id: mex.bulk_id,
            user_id: user_id,
            email_to: mex.email.to,
            email_subject: encrypt(mex.email.subject),
            email_body: encrypt(mex.email.body),
            email_template_id: mex.email.template_id,
            sms_phone: mex.sms.phone,
            sms_content: encrypt(mex.sms.content),
            push_token: mex.push.token,
            push_title: encrypt(mex.push.title),
            push_body: encrypt(mex.push.body),
            push_call_to_action: mex.push.call_to_action,
            mex_title: encrypt(mex.mex.title),
            mex_body: encrypt(mex.mex.body),
            mex_call_to_action: mex.mex.call_to_action,
            io: encrypt(JSON.stringify(mex.io)),
            client_token: encrypt(JSON.stringify(body.user)),
            sender: body.user.preference_service_name ? body.user.preference_service_name : body.user.client_name,
            tag: mex.tag? mex.tag.split(",").map(e => e.trim()) : mex.tag,
            correlation_id: mex.correlation_id,
            timestamp: mex.timestamp,
            memo: JSON.stringify(mex.memo),
            ruolo: mex.ruolo,
            collocazione: mex.collocazione,
            applicazione: mex.applicazione
        }
    ).sql;
   
    logger.debug("sql: ", insertSql);
    await db.execute(insertSql);
    /*
    if(mex.tag && user_id){
        let tags =  mex.tag.split(",").map(e => e.trim());
        let parameter = "";       
        tags.forEach((element,index) => {
            if(tags.length==index+1){
                parameter += "'"+element+"'";
            }else{
                parameter += "'"+element+"',";
            }
        });
        let insertMessageSplittedSql= "insert into messages_splitted (id_message, cf, tag) values ('"+ mex.id+"','"+user_id+"', ARRAY ["+parameter+"])";
        logger.debug("insertMessageSplittedSql: ", insertMessageSplittedSql);
        await db.execute(insertMessageSplittedSql);
    }
    */
    if(mex.listaUtenti){
        mex.listaUtenti.forEach(codiceFiscale => saveCodiceFiscale(mex.id,codiceFiscale));
    }
    eh.ok("mex saved", JSON.stringify({
        sender: body.user.preference_service_name ? body.user.preference_service_name : body.user.client_name,
        message: message
    }));
    logger.debug("mex saved");
}

async function saveCodiceFiscale(uuid, codiceFiscale){
    let cfEncrypted= utility.hashMD5(codiceFiscale);
    var insertSqlUser = queryBuilder.insert().table("messages_cf").values(
        {
            id_message: uuid,
            cf: cfEncrypted   
        }
    ).sql;
    logger.debug("sql user: ", insertSqlUser);

    await db.execute(insertSqlUser);
}

logger.debug(JSON.stringify(process.env, null, 4));
logger.debug(JSON.stringify(conf, null, 4));
obj.consumer("mex", checkMex, null, sendMex, true)();

function sleep(ms){
    return new Promise(resolve=>{
        setTimeout(resolve,ms)
    })
}

async function shutdown(){
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
