var commons = require("../commons/src/commons");
const conf = commons.merge(require('./conf/broadcast'), require('./conf/broadcast-' + (process.env.ENVIRONMENT || 'localhost')));
const obj = commons.obj(conf);
console.log(JSON.stringify(conf,null,4));
const logger = obj.logger("broadCastHistory");
const queryBuilder = obj.query_builder();

const db = obj.multiple_db();

async function run(){
    let query = "SELECT VALORE from batch_config where code = 'BROADCAST_HIST'";
    db.preferences.execute(query)
    .then((configuration) => {
        logger.debug("query config ok")
        let days = parseInt(configuration[0].valore);
        logger.debug("numero di giorni nella history del batch: ",days)
        let querymessages = "SELECT uuid from broadcast_batch where created_at < (NOW()- INTERVAL '"+days+" DAY')";
        db.preferences.execute(querymessages).then(messages=>{
            let parameter = "";
            messages.forEach((element,index) => {
                if(messages.length==index+1){
                    parameter += "'"+element.uuid+"'";
                }else{
                    parameter += "'"+element.uuid+"',";
                }
            });
            logger.debug("parameter: ",parameter);
            if(parameter!=""){
                let insertStorico = "INSERT into broadcast_batch_s select * from broadcast_batch where uuid in ("+parameter+")";
                logger.debug("insertStorico: ",insertStorico);
                db.preferences.execute(insertStorico).then(()=>{
                    let querydeletebroadcastbatch = "DELETE from broadcast_batch where uuid in ("+parameter+")";
                    logger.debug("querydeletebroadcastbatch: ",querydeletebroadcastbatch);
                    db.preferences.execute(querydeletebroadcastbatch).then(()=>{
                        logger.info("batch broadcast history ok");
                    }).catch(e => logger.error("error while deleting broadcast_batch_s: ", e.message));

                }).catch(e => logger.error("error while inserting broadcast_batch_s: ", e.message));
            }else{
                logger.info("batch broadcast history nothing to do");
            }
        }).catch(e => logger.error("error while selecting broadcast_batch: ", e.message));
    }).catch(e => logger.error("error while selecting configuration: ", e.message));
    
    selectingBroadcastConfigurationToDelete();

    deleteOldSemaforo();

    function deleteOldSemaforo(){
        let querydeletesemaforo= "DELETE from semaforo where created_at < now() - interval '7 days' ";
        db.preferences.execute(querydeletesemaforo).then(()=>{
            logger.info("querydeletesemaforo  ok");
        }).catch(e => logger.error("error while deleting semaforo: ", e.message)); 
    }

    function selectingBroadcastConfigurationToDelete(){
        let queryConfiguration = "SELECT VALORE from batch_config where code = 'BROADCAST_DELETE'";
        db.preferences.execute(queryConfiguration).then((configurationToDelete) => {
            selectBroadcastToDelete(configurationToDelete);
        }).catch(e => logger.error("error while selecting config BROADCAST_DELETE to delete: ", e.message));
    }

    function selectBroadcastToDelete(configurationToDelete){
        let daysToDelete = parseInt(configurationToDelete[0].valore);
        let querydeletebroadcastshistory = "SELECT uuid from broadcast_batch_s where created_at < (NOW()- INTERVAL '"+daysToDelete+" DAY')";
        db.preferences.execute(querydeletebroadcastshistory).then(messagesToCancel=>{
            deleteBroadcastHistory(messagesToCancel);
        }).catch(e => logger.error("error while selecting broadcast_batch_s to delete: ", e.message));
    }

    function deleteBroadcastHistory(messagesToCancel){
        let parameterToCancel = "";
        messagesToCancel.forEach((element,index) => {
            if(messagesToCancel.length==index+1){
                parameterToCancel += "'"+element.id+"'";
            }else{
                parameterToCancel += "'"+element.id+"',";
            }
        });
        logger.debug("parameterToCancel broadcast: ",parameterToCancel);
        if(parameterToCancel!=""){
            let querydeletebroadcast_batch_s= "DELETE from broadcast_batch_s where uuid in ("+parameterToCancel+")";
            db.preferences.execute(querydeletebroadcast_batch_s).then(()=>{
                
                logger.info("batch broadcast_batch_s  ok");
                
            }).catch(e => logger.error("error while deleting messages cf history: ", e.message)); 
        }else{
            logger.info("Batch broadcast_batch_s  to delete nothing to do");
        }
    }
}

module.exports = { execute: run}