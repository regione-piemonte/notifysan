var commons = require("../commons/src/commons");
const conf = commons.merge(require('./conf/broadcast'), require('./conf/broadcast-' + (process.env.ENVIRONMENT || 'localhost')));
const obj = commons.obj(conf);
console.log(JSON.stringify(conf,null,4));
//const logger = require("./logger")(conf.log4js,"send-sched");
const logger = obj.logger("send-sched");
const db = obj.db();
const req_promise = require("request-promise");
const fs = require('fs');
const uuid = require("uuid/v4");
logger.info(JSON.stringify(conf,null,4));

async function run(){
    logger.debug("getting broadcasts Messages");
    let broads = await getBroadMessages();
    logger.debug("got broadcasts: ", broads.length);
    if(broads.length === 0) return;
    await setSendingStatusBroadcast(broads.map(e => e.uuid));
    for await (let broad of broads) {
        let preferences = await getUserFromPreferences(broad.service);
        let mexs = [];
        for await (let pref of preferences){
          let mex = composeMessage(JSON.parse(broad.mex),pref);
          if(mex !== null) mexs.push(mex);
        }
        try{
          logger.debug("start sending broadcast: ",broad.name);
          if(mexs.length > 0) {
            let prep_messages = await prepareMessages(mexs,conf.mb.request_limit);
            await sendMessages(prep_messages,broad.token);
          }
          let filename = conf.send_scheduled.sent_messages_path + "/" + broad.name;
          try{
              await fs.writeFileSync(filename,JSON.stringify(mexs,null,4));
          }catch(e){
              logger.error("cannot save file: ", e.message);
          }
          await setSentBroadcast(broad);
        }catch(e){
          logger.error("error of broad: ", broad);
          logger.error("messages: ", mexs);
          logger.error(JSON.stringify(e));
          let filename = conf.send_scheduled.not_sent_messages_path + "/" + broad.name;
          await fs.writeFileSync(filename,JSON.stringify(mexs,null,4));
        }

    }
}

async function setSendingStatusBroadcast(uuids){
  let sql = "UPDATE broadcast set status='sending' where uuid in(" + uuids.map( e => "'" + e + "'").join(",") + ")";
  logger.debug("set send status sql: ",sql);
  try{
    let res = await db.execute(sql);
  }catch(e){
    logger.error("error setting status of broad: ", e.message);
  }
}

async function setSentBroadcast(broad){
  logger.debug("set sent status on ",broad.name);
  let sql = "UPDATE broadcast set status='sent',sent_at=NOW() where uuid='" + broad.uuid + "'";
  try{
    let res = await db.execute(sql);
  }catch(e){
    logger.error("error setting status of broad: ", e.message);
  }
}

/*async function prepareAndSendMessage(mexs,token){
  logger.debug("prepare chunk of messages");
    let limit_array = Math.trunc(conf.mb.request_limit/ JSON.stringify(mexs[0]).length);
    //logger.debug(limit_array)
    for (var index = 0; index < mexs.length; index += limit_array) {
        let chunk = mexs.slice(index, index+limit_array);
        await sendMessage(chunk,token);
    }
}*/

async function sendMessages(mexs,token){
  logger.debug("trying to send messages to mb");
  for(let i=0;i<mexs.length;i++){
    await sendMessage(mexs[i],token);
  }
  logger.debug("mexs sent");
}

async function prepareMessages(mexs,limit){
    logger.debug("prepare bulks");
    if(!Array.isArray(mexs[0])) mexs = [mexs];
    if (mexs.every( e => JSON.stringify(e).length < limit)) return mexs;

    let temp = [];
    mexs = mexs.map( chunk => {
      if(JSON.stringify(chunk).length < limit) {
        return chunk;
      }
      temp.push(chunk.slice(0, Math.ceil(chunk.length / 2)));
      temp.push(chunk.slice(Math.ceil(chunk.length / 2), chunk.length ));
      return null;
    } ).filter(e => e !== null);

    mexs = mexs.concat(temp);
    return prepareMessages(mexs,limit);
}

async function sendMessage(mexs,token){
  logger.debug("sending messages");
  var options = {
          url: conf.mb.queues.messages,
          method: 'POST',
          headers: {
              'x-authentication': token
          },
          body: mexs,
          json: true
      }
  try{
      let response = await req_promise(options);
      logger.info("mex sent");
  }catch(e){
      logger.error(JSON.stringify(e));
      throw e;
  }
}

function composeMessage(message,preference){
      let senders={
        sms: "phone",
        email: "to",
        push: "token"
      };

      let channels = ['sms','push','email','mex'];
      //remove empty message parts
      channels.filter( e => Object.keys(message).includes(e)).forEach(e=> {if(Object.keys(message[e]).length === 0) delete message[e]});

      Object.keys(message).filter( e=> e !== "mex").filter( e => e !== "bulk_id").filter( e => e !== "tag")
      .filter( e=> { //check if user has that preferences and contact
        let hasUserPref = Object.keys(preference).includes(e);
        if(!hasUserPref) delete message[e];
        return hasUserPref;
      }).forEach( e => message[e][senders[e]] = preference[e]);

      message.trusted = true;
      message.user_id = preference.user_id;
      message.id = uuid();
      message = {
        uuid: message.id,
        payload: message
      }
      if(channels.filter(value => !Object.keys(message.payload).includes(value)).length === 4) return null;
      return message;
}

async function getUserFromPreferences(service_name){
  let sql = "SELECT u.user_id, us.channels, u.email, u.sms, u.push,us.service_name FROM users u LEFT JOIN users_services us on u.user_id=us.user_id  WHERE us.service_name = '" + service_name +"'";
  try{
    var contacts = await db.execute(sql);
    var results = [];
    /* compose contacts object assigning to each channels the relative user contact */

    let res = contacts.filter(contact => contact.channels !== null).map(contact => contact.channels.split(",").reduce( (r,ch) => {
      r.user_id = contact.user_id;
      if((!contact[ch] || contact[ch] === null) ||
            (ch === 'push' && (!JSON.parse(contact[ch])[service_name]
                        || JSON.parse(contact[ch])[service_name] === null ))) return r;
      if(ch === "push") r[ch] = JSON.parse(contact[ch])[service_name]
      else r[ch] = contact[ch];
      return r;
    },{}));

    return res;
  }catch(e){
    logger.error("error getting preferences: ", e.message);
  }
}

async function getBroadMessages(){
  try{
    let get_broad_messages = "SELECT * FROM broadcast WHERE scheduled_at <= NOW() and status = 'scheduled';"
    logger.debug("query:",get_broad_messages);
    let mess = await db.execute(get_broad_messages);
    logger.debug(Array.isArray(mess));

    mess = mess.map( broad => {
      //broad.mex=broad.mex.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
      broad.mex=Buffer.from(broad.mex, 'base64').toString('utf8');
      return broad;
    });
    logger.debug(mess);
    return mess;
  }catch(e){
    logger.error(JSON.stringify(e));
    throw e;
  }
}

module.exports = { execute: run}
