var util = require('util');
var request = util.promisify(require("request"));
const uuid = require("uuid/v4");



module.exports = function (conf, obj) {
    const crypto = obj.cryptoAES_cbc();
    const encrypt = function (text) {
        if (!text || text === null) return null;
        return crypto.encrypt(text, conf.security.secret)
    };
    const decript = function (text) {
        if (!text || text === null) return null;
        return crypto.decrypt(text, conf.security.secret)
    };

    const db = obj.db();
    const eh = obj.event_handler();
    const logger = obj.logger();
    const express = require('express');
    const router = express.Router();

    //var fs = require("fs");

    /**
     *  get preferences from configuratore
     */
    router.get('/preferences/:fruitore/user/:userId/applicazione/:applicazione/:forwardFor', async function (req, res, next) {
        var result = {};
        try {
            logger.debug("get preferences from configuratore: ",conf.configuratore.urlPreferences);
            let fruitore = req.params.fruitore;
            let applicazione = req.params.applicazione;
            let userId = req.params.userId
            var username = conf.configuratore.user;
            var password = conf.configuratore.pwd;
            var auth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');
            let options = {
                url: conf.configuratore.urlPreferences,
                method: 'POST',
                headers: {
                    'Authorization': auth,
                    'X-Forwarded-For': req.params.forwardFor,
                    'X-Codice-Servizio':'NOTIFYSAN'
                },
                body: {
                    "codice_applicazione": applicazione,
                    "codici_fiscale":[userId],
                    "nome_fruitore": fruitore
                },
                json: true
            
            };
            logger.debug("get preferences from configuratore 2: ",JSON.stringify(options));
            preferences = await request(options);
            logger.info("preferences: ",Object.keys(preferences.body))
            let uuid= req.headers['msg_uuid']
            
            if(preferences && preferences.body && preferences.body[0]){
                saveSingleOnBroadcastBatch(uuid, userId, preferences.body[0].numero_di_telefono, preferences.body[0].email, preferences.body[0].push)
                if(preferences.body[0].email){
                    result.email = preferences.body[0].email;
                }
                if(preferences.body[0].numero_di_telefono){
                    result.sms = preferences.body[0].numero_di_telefono
                }
                if(preferences.body[0].push){
                    result.push = preferences.body[0].push
                }
            } 
        } catch (err) {
            logger.error(err.message);
            eh.system_error("error getting preferences from configuratore", err.message);
            return next({type: "system_error", status: 500, message: err});
        }
        next({type: "ok", status: 200, message: result});
    });

    router.post('/messages/batch', async function (req, res, next) {

        try {
            logger.debug("get preferences from configuratore: ",conf.configuratore.urlPreferences);
            //insert into semaforo on primary key
            var resultSemaforo = "ko"
            try {    
                var message_section = req.body.message_section;
                var uuid = req.body.uuid;
                var query_insert_sem = "insert into semaforo(uuid,channel) values('"+uuid+"','"+message_section+"')";
                resultSemaforo = await db.execute(query_insert_sem);
            }   catch (err) {
                logger.info(err.message);
            }
            //se ok prosegui se ko logga
            logger.info(resultSemaforo);
            if(resultSemaforo!="ko"){
                var username = conf.configuratore.user;
                var password = conf.configuratore.pwd;
                var auth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');
                var payloadToSend = {};
                var payload = req.body.payload;
                if(payload.ruolo){
                    payloadToSend.codice_ruolo=payload.ruolo
                }
                if(payload.collocazione){
                    payloadToSend.codice_collocazione=payload.collocazione
                }
                if(payload.listaUtenti){
                    payloadToSend.codici_fiscale=payload.listaUtenti
                }
                if(payload.applicazione){
                    payloadToSend.codice_applicazione=payload.applicazione
                }
                payloadToSend.nome_fruitore= req.body.user.preference_service_name;
                let options = {
                    url: conf.configuratore.urlPreferences,
                    method: 'POST',
                    headers: {
                        'Authorization': auth,
                        'Accept-Encoding': 'gzip, deflate, br',
                        'X-Forwarded-For': req.body.forwardFor,
                        'X-Codice-Servizio':'NOTIFYSAN'
                    },
                    body: payloadToSend,
                    json: true
                    , gzip: true
                };
                logger.debug("get preferences from configuratore 1: ",JSON.stringify(options));
                preferences = await request(options,(error, response, bodyConfiguratore) => messagesBatchCallback(error, response, bodyConfiguratore, req));
            }
            
            next({type: "ok", status: 200, message: preferences});
        } catch (err) {
            logger.error(err.message);
            eh.system_error("error getting preferences from configuratore (batch)", err.message);
            return next({type: "system_error", status: 500, message: err});
        }
        
    });

    async function messagesBatchCallback(error, response, bodyConfiguratore, req) {
        if(error){
            logger.error(error);
            return next({type: "system_error", status: 500, message: "configuratore non ha risposto in maniera corretta"});
        }
        // body is the decompressed response body
        logger.debug('server encoded the data as: ' + (response.headers['content-encoding'] || 'identity'))
        if (response.statusCode >= 200 && response.statusCode<300) {
            let requestJsonBody=encrypt(JSON.stringify(req.body));
            let token = req.headers['x-authentication'];
            result = saveOnBroadcastBatch(bodyConfiguratore, requestJsonBody, token, req.body.uuid);
            return next({type: "ok", status: 200, message: result});
        }else{
            return next({type: "system_error", status: 500, message: "configuratore non ha risposto in maniera corretta"});
        }
    }

    async function saveOnBroadcastBatch(bodyConfiguratore, jsonBody, token, uuidParameter){
        let correlation_id = uuid();
        let query_insert = "INSERT INTO broadcast_batch (uuid, fiscal_code, stato, full_message, token, flag_not_to_send, correlation_id, telephone, email, push_token, uuid_provenienza) values ";
        
        bodyConfiguratore.forEach((element, idx, array) => { 
            let numero_di_telefono="null";
            if(element.numero_di_telefono!=null){
                numero_di_telefono="'"+encrypt(element.numero_di_telefono.trim())+"'";
            }
            let email = "null";
            if(element.email!=null){
                email = "'"+encrypt(element.email.trim())+"'";
            }
            let pushToken = "null";
            if(element.push!=null){
                pushToken = "'"+element.push.trim()+"'";
            }
            query_insert+= "('"+ uuid()+"','"+ encrypt(element.codice_fiscale)+"', 'NUOVO', '"+jsonBody+"','"+token+"',false,'"+correlation_id+"',"+numero_di_telefono +","+email+","+pushToken+", '"+uuidParameter+"')";
            if (idx !== array.length - 1){ 
                query_insert+=", "
            }
        });
        query_insert+=" ;";
        logger.info(query_insert);
        try {
            var result = await db.execute(query_insert);
            
            logger.debug("saved mex: "+result);
            return next({type: "ok", status: 200, message: result});
        } catch (err) {
            if(err.errno && err.errno === 1054) return next({type: "client_error", status: 400, message: err});
            return next({type: "db_error", status: 500, message: err});
        }
    }

    async function saveSingleOnBroadcastBatch(uuid, fiscal_code, numeroTelefono, mail,tokenPush){
  
        let query_insert = "INSERT INTO broadcast_batch (uuid, fiscal_code, stato,  flag_not_to_send, telephone, email, push_token, uuid_provenienza) values ";
        
        let numero_di_telefono="null";
        if(numeroTelefono!=null){
            numero_di_telefono="'"+encrypt(numeroTelefono.trim())+"'";
        }
        let email = "null";
        if(mail!=null){
            email = "'"+encrypt(mail.trim())+"'";
        }
        let pushToken = "null";
        if(tokenPush!=null){
            pushToken = "'"+tokenPush.trim()+"'";
        }
        query_insert+= "('"+ uuid+"','"+ encrypt(fiscal_code)+"', 'SENT', true,"+numero_di_telefono +","+email+","+pushToken+", '"+uuid+"')";
       
        logger.info(query_insert);
        try {
            var result = await db.execute(query_insert);
            
            logger.debug("saved mex: "+result);
           
        } catch (err) {
            logger.error(err.message);
            eh.system_error("error saveSingleOnBroadcastBatch", err.message);
        }
    }

    router.get('/messages/batch/:uuid', async function (req, res, next) {
        try {
            let uuid = req.params.uuid
            var selectSql = "select * from broadcast_batch where uuid_provenienza='"+uuid+"'";
            logger.debug("selectSql: "+selectSql);
            let result = await db.execute(selectSql);
            let resultApi = [];
            result.forEach((element, idx, array) => { 
                let fiscal_code = decript(element.fiscal_code);
                let telephone = "";
                if(element.telephone){
                    telephone = decript(element.telephone);
                }
                let email = "";
                if(element.email){
                    email = decript(element.email);
                }

                let push_token = false;
                if(element.push_token){
                    push_token = true;
                }
                resultApi.push({
                    fiscal_code:fiscal_code,
                    telephone:telephone,
                    email:email,
                    push_token:push_token
                });
            });
            return next({type: "ok", status: 200, message: resultApi});
        } catch (err) {
            if(err.errno && err.errno === 1054) return next({type: "client_error", status: 400, message: err});
            return next({type: "db_error", status: 500, message: err});
        }
        
    });

    return router;
}