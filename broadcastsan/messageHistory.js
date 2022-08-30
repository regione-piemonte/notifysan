var commons = require("../commons/src/commons");
const conf = commons.merge(require('./conf/broadcast'), require('./conf/broadcast-' + (process.env.ENVIRONMENT || 'localhost')));
const obj = commons.obj(conf);
console.log(JSON.stringify(conf,null,4));
const logger = obj.logger("messageHistory");
const queryBuilder = obj.query_builder();

const db = obj.multiple_db();

async function run(){
    let query = "SELECT VALORE from batch_config where code = 'MESSAGE_HIST'";
    db.preferences.execute(query)
    .then((configuration) => {
        logger.debug("query config ok")
        let days = parseInt(configuration[0].valore);
        logger.debug("numero di giorni nella history del messaggio: ",days)
        let querymessages = "SELECT id from messages where timestamp < (NOW()- INTERVAL '"+days+" DAY')";
        db.mex.execute(querymessages).then(messages=>{
            //insert nello storico degli uiid 
            let parameter = "";
            messages.forEach((element,index) => {
                if(messages.length==index+1){
                    parameter += "'"+element.id+"'";
                }else{
                    parameter += "'"+element.id+"',";
                }
            });
            logger.debug("parameter: ",parameter);
            if(parameter!=""){
                let queryStorico = "INSERT into messages2 select * from messages where id in ("+parameter+")";
                logger.debug("queryStorico: ",queryStorico);
                db.mex.execute(queryStorico).then(()=>{
                    let queryStoricoCF = "INSERT into messages_cf_hist select * from messages_cf where id_message in ("+parameter+")";
                    db.mex.execute(queryStoricoCF).then(()=>{
                        let queryStoricosplitted = "INSERT into messages_splitted_hist select * from messages_splitted where id_message in ("+parameter+")";
                        db.mex.execute(queryStoricosplitted).then(()=>{
                            //delete by uiid nella tabella principale
                            let querydeletemessagesSplited = "DELETE from messages_splitted where id_message in ("+parameter+")";
                            db.mex.execute(querydeletemessagesSplited).then(()=>{
                                let querydeletemessagescf = "DELETE from messages_cf where id_message in ("+parameter+")";
                                db.mex.execute(querydeletemessagescf).then(()=>{
                                    let querydeletemessages = "DELETE from messages where id in ("+parameter+")";
                                    db.mex.execute(querydeletemessages).then(()=>{
                                        logger.info("Batch message history concluded correctly");     
                                    }).catch(e => logger.error("error while deleting messages: ", e.message));
                                }).catch(e => logger.error("error while deleting messages cf: ", e.message));
                            }).catch(e => logger.error("error while deleting messages splitted: ", e.message));    
                        }).catch(e => logger.error("error while inserting messages splitted in history: ", e.message));
                    }).catch(e => logger.error("error while inserting messages cf in history: ", e.message));
                }) .catch(e => logger.error("error while inserting messages in history: ", e.message));
            }else{
                logger.info("Batch message history nothing to do");
            }
        }) .catch(e => logger.error("error while query messages: ", e.message));
    })
    .catch(e => logger.error("error while query configuration: ", e.message));
   
    selectingConfigurationToDelete();

    function deleteMessage(parameterToCancel) {
        let querydeletemessageshist = "DELETE from messages2 where id in (" + parameterToCancel + ")";
        db.mex.execute(querydeletemessageshist).then(() => {
            logger.info("Batch message history to delete concluded correctly");
        }).catch(e => logger.error("error while deleting messages history: ", e.message));
    }

    function deleteMessageHistory(messagesToCancel){
        let parameterToCancel = "";
        messagesToCancel.forEach((element,index) => {
            if(messagesToCancel.length==index+1){
                parameterToCancel += "'"+element.id+"'";
            }else{
                parameterToCancel += "'"+element.id+"',";
            }
        });
        logger.debug("parameterToCancel: ",parameterToCancel);
        if(parameterToCancel!=""){
            let querydeletemessagescfhist = "DELETE from messages_cf_hist where id_message in ("+parameterToCancel+")";
            db.mex.execute(querydeletemessagescfhist).then(()=>{
                deleteMessage(parameterToCancel);

                
            }).catch(e => logger.error("error while deleting messages cf history: ", e.message)); 
        }else{
            logger.info("Batch message history to delete nothing to do");
        }
    }

    function selectMessageToCancel(configurationToDelete){
        let daysToDelete = parseInt(configurationToDelete[0].valore);
        let querydeletemessageshistory = "SELECT id from messages2 where timestamp < (NOW()- INTERVAL '"+daysToDelete+" DAY')";
        db.mex.execute(querydeletemessageshistory).then(messagesToCancel=>{
            deleteMessageHistory(messagesToCancel);
        }).catch(e => logger.error("error while selecting messages history to delete: ", e.message));
    }

    function selectingConfigurationToDelete(){
        let queryConfiguration = "SELECT VALORE from batch_config where code = 'MESSAGE_DELETE'";
        db.preferences.execute(queryConfiguration).then((configurationToDelete) => {
            selectMessageToCancel(configurationToDelete);
        }).catch(e => logger.error("error while selecting config to delete: ", e.message));
    }
}

module.exports = { execute: run}