console.log(JSON.stringify(process.env, null, 4));
var commons = require("../../commons/src/commons");
const conf = commons.merge(require('./conf/smsconsumer'), require('./conf/smsconsumer-' + (process.env.ENVIRONMENT || 'localhost')));
console.log(JSON.stringify(conf, null, 4));

process.binding('http_parser').HTTPParser = require('http-parser-js').HTTPParser;

const obj = commons.obj(conf);

const logger = obj.logger();
const eh = obj.event_handler();
const utility = obj.utility();

var util = require("util");
var request = util.promisify(require('request'));
var js2xmlparser = require("js2xmlparser");


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

function checkSms(payloadMessage) {
    var res = [];

    if (!payloadMessage) {
        res.push("payload not present");
        return res;
    }
    if (typeof payloadMessage !== 'object' || Array.isArray(payloadMessage)) {
        res.push("payload element is not a valid object");
        return res;
    }

    if (!payloadMessage.id) res.push("id is mandatory");
    if (!payloadMessage.user_id 
        && !payloadMessage.applicazione 
        && !payloadMessage.listaUtenti
        && !payloadMessage.collocazione
        && !payloadMessage.ruolo) res.push("to is mandatory");
    if (!payloadMessage.sms) res.push("sms is mandatory");

    const SMS_CONTENT = "sms.content";
    if (!utility.checkNested(payloadMessage,SMS_CONTENT)) res.push("sms.content is mandatory");
    var smsRegex = /^[a-zA-Z0-9àèìòùÀÈÌÒÙáéíóúÁÉÍÓÚ"!\s()=?'+*@$%,.;:#_\->/]*$/g;
    if(utility.checkNested(payloadMessage,SMS_CONTENT) && !payloadMessage.sms.content.match(smsRegex)) res.push("sms content contains invalid characters");
    if(utility.checkNested(payloadMessage,SMS_CONTENT) && smsCharCounter(payloadMessage.sms.content) > 160) res.push("sms content too long");
    return res;
}

function smsCharCounter(content){
    let countMatch = content.match(/[àèìòùÀÈÌÒÙáéíóúÁÉÍÓÚ]/g) || [];
    let countDotsAndNumbers = content.toLowerCase().match(/:[0-9a-f][0-9a-f]/g) || [];
    let countTwoDots = content.match(/::/g) || [];
    //console.log(content.length + countMatch.length + countDotsAndNumbers.length + countTwoDots.length)
    return content.length + countMatch.length + countDotsAndNumbers.length + countTwoDots.length;
}

function checkTo(payload){
    return payload.sms.phone;
}

async function sendSMS(body,userPreferences){

    var message = {
        id : body.payload.id,
        bulk_id : body.payload.bulk_id,
        user_id : body.payload.user_id,
        tag : body.payload.tag,
        correlation_id : body.payload.correlation_id
    };

    eh.info("trying to send sms",JSON.stringify({
        message: message
    }));
    logger.debug("trying to send sms");

    body.payload.sms.phone =  userPreferences.body.sms;

    var sms = body.payload.sms;



    var request_sms_json = {
        USERNAME: body.user.preferences.sms.username,
        PASSWORD: body.user.preferences.sms.password,
        CODICE_PROGETTO: body.user.preferences.sms.project_code,
        REPLY_DETAIL: conf.sms.reply_detail,
        SMS: {
            TELEFONO: sms.phone,
            TESTO: sms.content,
            CODIFICA: conf.sms.encoding,
            TTL: body.payload.trusted ? conf.sms.TTL.trusted : conf.sms.TTL.standard,
            PRIORITA: body.payload.trusted && !body.payload.batch ? conf.sms.priority.trusted : conf.sms.priority.standard,
            NOTE: body.payload.id
        }
    };

    if(process.env.DRY_RUN_SMS && process.env.DRY_RUN_SMS === "true") {
        logger.info("DRY RUN SMS setted");
        request_sms_json.SMS.DATA_INVIO = "01/01/2030 00:00";
    }

    var request_sms_xml = js2xmlparser.parse("RICHIESTA_SMS", request_sms_json);

    var optionsSMS = {
        url: conf.sms.send_url + "?xmlSms=" + request_sms_xml,
        headers: {'Content-Type': 'text/xml'},
        method: "GET"
    };

    try{
        var data = await request(optionsSMS);
    }catch(err){
        err.description_message = "sms gateway error";
        throw err;
    }

    if (data.body.includes("ERRORE") ||data.body.includes("erroneo") ||data.body.includes("errato") || data.statusCode !== 200) {
        logger.error("RETURNED ERROR status code: 500, error in post sms to gateway: %s, error: %s", optionsSMS.url,JSON.stringify(data.body) );
        throw "status code: 500, error in send sms to gateway: " + optionsSMS.url + " " + data.body;
    }
    eh.ok("sms sent",JSON.stringify({
        sender: body.user.preference_service_name,
        message:message
    }));
    logger.debug("sms sent");
}

logger.debug(JSON.stringify(process.env, null, 4));
logger.debug(JSON.stringify(conf, null, 4));
obj.consumer("sms", checkSms, checkTo,sendSMS)();
