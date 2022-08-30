var util = require('util');
var request = util.promisify(require("request"));
const uuid = require("uuid/v4");



module.exports = function (conf, obj) {
    const crypto = obj.cryptoAES_cbc();
    const encrypt = function (text) {
        if (!text || text === null) return null;
        return crypto.encrypt(text, conf.security.secret)
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
    router.get('/preferences/:fruitore/user/:userId/applicazione/:applicazione', async function (req, res, next) {

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
                    'Authorization': auth
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
        } catch (err) {
            logger.error(err.message);
            eh.system_error("error getting preferences from configuratore", err.message);
            return next({type: "system_error", status: 500, message: err});
        }
        var result = {};
        if(preferences && preferences.body && preferences.body[0]){
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
                        'Accept-Encoding': 'gzip, deflate, br'
                    },
                    body: payloadToSend,
                    json: true
                    , gzip: true
                };
        
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
            result = saveOnBroadcastBatch(bodyConfiguratore, requestJsonBody, token);
            return next({type: "ok", status: 200, message: result});
        }else{
            return next({type: "system_error", status: 500, message: "configuratore non ha risposto in maniera corretta"});
        }
    }

    async function saveOnBroadcastBatch(bodyConfiguratore, jsonBody, token){
        let correlation_id = uuid();
        let query_insert = "INSERT INTO broadcast_batch (uuid, fiscal_code, stato, full_message, token, flag_not_to_send, correlation_id, telephone, email, push_token) values ";
        
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
            query_insert+= "('"+ uuid()+"','"+ encrypt(element.codice_fiscale)+"', 'NUOVO', '"+jsonBody+"','"+token+"',false,'"+correlation_id+"',"+numero_di_telefono +","+email+","+pushToken+")";
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
    return router;
}