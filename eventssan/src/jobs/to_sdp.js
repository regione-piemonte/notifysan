var commons = require("../../../commons/src/commons");
console.log(JSON.stringify(process.env, null, 4));
const conf = commons.merge(require('../conf/events'), require('../conf/events-' + (process.env.ENVIRONMENT || 'localhost')));
console.log(JSON.stringify(conf, null, 4));
const obj = commons.obj(conf);

const logger = obj.logger("to_sdp");
const db = obj.db();
const Utility = obj.utility();
const queryBuilder = obj.query_builder();

const dateformat = require("dateformat");
const util = require("util");
const request = require('request-promise');

var optionsToSdp = {
  method: "POST",
  url: conf.sdp.stream.esito.url,
  auth: conf.sdp.stream.esito.auth
};

logger.debug(JSON.stringify(process.env, null, 4));
logger.debug(JSON.stringify(conf, null, 4));
// execute();
async function execute(){
  logger.info("starting execute");
  try{
    let q = "SELECT count(*) as count from messages_status;";
    let count_mex = (await db.execute(q))[0].count;
    let difference_mex = count_mex - conf.sdp.record_limit;
    if(difference_mex <= 0 ){
      logger.info("count of message_status is still minor than the record_limit ... exiting process");
      process.exit(0);
    } 
    let q2 = "SELECT message_id, bulk_id, email_result::int, push_result::int, sms_result::int, io_result::int, mex_result::int, send_date, note from messages_status order by send_date limit " + difference_mex;
    logger.debug("query get messages to sdp: ",q2);
    let messages = await db.execute(q2);
    if(messages.length === 0 ) {
      logger.info("no messages to send to sdp");
      process.exit(0);
    }
    let date = new Date().toISOString();
    messages = await chunkify(messages,conf.sdp.request_components_limit);
    for(mess of messages){
      mess = mess.map( e => {
          let r = {
            time: date,
            components: e
          };
          return r;
      });
      optionsToSdp.json = {
        stream: conf.sdp.table_name,
        application: conf.sdp.table_name,
        values: mess
      }
      logger.info("Sending to SDP");
      await request(optionsToSdp);
      logger.info("Sent to SDP");
      let deleteQuery = "delete from messages_status where message_id in (" + mess.map(e => "'" + e.components.message_id + "'").join(",") + ")";
      logger.debug("delete: ", deleteQuery);
      await db.execute(deleteQuery);
      logger.info("process successfully executed");
      process.exit(0);
    }
  }catch(e){
    logger.error(JSON.stringify(e));
    process.exit(1);
  }
}



async function chunkify(mexs,limit){
    logger.debug("chunkify");
    if(!Array.isArray(mexs[0])) mexs = [mexs];
    if (mexs.every( e => e.length < limit)) return mexs;

    let temp = [];
    mexs = mexs.map( chunk => {
      if(chunk.length < limit) {
        return chunk;
      }
      temp.push(chunk.slice(0, Math.ceil(chunk.length / 2)));
      temp.push(chunk.slice(Math.ceil(chunk.length / 2), chunk.length ));
      return null;
    } ).filter(e => e !== null);

    mexs = mexs.concat(temp);
    return chunkify(mexs,limit);
}
