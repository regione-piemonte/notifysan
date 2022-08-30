var commons = require("../commons/src/commons");
const conf = commons.merge(require('./conf/broadcast'), require('./conf/broadcast-' + (process.env.ENVIRONMENT || 'localhost')));
const obj = commons.obj(conf);
console.log(JSON.stringify(conf,null,4));
//const logger = require("./logger")(conf.log4js,"send-sched");
const logger = obj.logger("sendScheduledNotifications");
const queryBuilder = obj.query_builder();
const db = obj.multiple_db();
const crypto = obj.cryptoAES_cbc();
const uuid = require("uuid/v4");
const req_promise = require("request-promise");

const decript = function (text) {
    if (!text || text === null) return null;
    return crypto.decrypt(text, conf.security.secret)
};
const encrypt = function (text) {
    if (!text || text === null) return null;
    return crypto.encrypt(text, conf.security.secret)
};


async function run(){
    logger.debug("getting broadcasts Messages from table");
    //get messages from tables 
    let select_query = queryBuilder.select("*").table("broadcast_batch").filter({
        "stato": {
            "eq": "NUOVO"
        }
    }).page(10,0).sql;
    logger.debug("sql: "+select_query);
    var select_result = await db.preferences.execute(select_query);
    //logger.debug("result: "+select_result);
    var uuids = [];
    var uuidsError = [];
    let promises = [];
    let promise = null;
    
    select_result.forEach(element => {
        //decript message
        let stringBody=decript(element.full_message);
        let jsonBody = JSON.parse(stringBody);
        logger.debug("jsonBody: "+stringBody);
        //modify the message with destination
        jsonBody.uuid=element.uuid;
        jsonBody.payload.id=element.uuid;
       
        delete jsonBody.payload.ruolo;
        delete jsonBody.payload.collocazione;
        delete jsonBody.payload.listaUtenti;
        delete jsonBody.payload.applicazione;
        jsonBody.payload.user_id=decript(element.fiscal_code);
        if(!jsonBody.user){
            jsonBody.user={};
        }
        if(!jsonBody.user.preferences){
            jsonBody.user.preferences = {};
        }
        if(element.email && jsonBody.payload.email){
            let emailDecripted = decript(element.email);
            logger.debug("email: "+emailDecripted);
            jsonBody.payload.email.to=emailDecripted;
            if(!jsonBody.user.preferences.email){
                //from
                jsonBody.user.preferences.email={};
            }
        }
        if(element.telephone && jsonBody.payload.sms){
            let telephoneDecrypted = decript(element.telephone);
            logger.debug("telephone: "+telephoneDecrypted);
            jsonBody.payload.sms.phone=telephoneDecrypted;
            if(!jsonBody.user.preferences.sms){
                jsonBody.user.preferences.sms={};
            }
        }
        if(element.push_token && jsonBody.payload.push){
            logger.debug("push: "+jsonBody.user.preferences.push);
            jsonBody.payload.push.token=element.push_token.split(',');
            if(!jsonBody.user.preferences.push){
                jsonBody.user.preferences.push={};
            }
        }
        jsonBody.payload.correlation_id=element.correlation_id
        jsonBody.payload.trusted=true;
        jsonBody.payload.batch=true;
        logger.debug("jsonBody trasformed: "+JSON.stringify(jsonBody));
        let encryptedBodyTrasformed= encrypt(JSON.stringify(jsonBody))
        setFullMessageSentBroadcast(element.uuid,encryptedBodyTrasformed)
        //send new message
        promise = send(element.token,jsonBody);
        if(promise!=null){
            promises.push(promise);
        }
    });
    if(promises.length!=0){
        Promise.all(promises).then((responses) => {
            responses.forEach((response, index) => {
                if(response=="message added to the queue 'messages'"){
                    uuids.push(select_result[index].uuid)
                }else{
                    uuidsError.push(select_result[index].uuid)
                }
            });
            //update message state
            setStatusBroadcast(uuids, 'SENT');
            setStatusBroadcast(uuidsError, 'ERROR');
        });
        
    }
    
}

function send(token, message){
    var options = {
        url: conf.mb.queues.messages,
        method: 'POST',
        headers: {
            'x-authentication': token
        },
        body: message,
        json: true
    }
    return req_promise(options).promise()
}

async function setStatusBroadcast(uuids, state){ 
  if(uuids.length==0){
    logger.debug("doing nothing");
  } else { 
    let sql = "UPDATE broadcast_batch set stato='"+state+"', sent_at=NOW() where uuid in(" + uuids.map( e => "'" + e + "'").join(",") + ")";
    logger.debug("set send status sql: ",sql);
    try{
        let res = await db.preferences.execute(sql);
    }catch(e){
        logger.error("error setting status of broad: ", e.message);
    }
  }
}

async function setFullMessageSentBroadcast(uuid, full_message_sent){ 
    let sql = "UPDATE broadcast_batch set full_message_sent='"+full_message_sent+"' where uuid ='" + uuid +"'";
    logger.debug("set send status sql: ",sql);
    try{
        let res = await db.preferences.execute(sql);
    }catch(e){
        logger.error("error setting status of broad: ", e.message);
    }
}
  
//UPDATE broadcast_batch set stato='NUOVO';
module.exports = { execute: run}