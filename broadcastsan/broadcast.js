var commons = require("../commons/src/commons");
const conf = commons.merge(require('./conf/broadcast'), require('./conf/broadcast-' + (process.env.ENVIRONMENT || 'localhost')));
console.log(JSON.stringify(process.env, null, 4));
console.log(JSON.stringify(conf,null,4));

const obj = commons.obj(conf);
const logger = obj.logger();
const express = require("express");
const bodyParser = require('body-parser');
const app = express();
const cors = require("cors");
const db = obj.multiple_db();
const cryptoAES = obj.cryptoAES_cbc();
const req_promise = require("request-promise");
var crypto = require('crypto');
const path = require('path');
const build_query = obj.query_builder();
const fs = require("fs");

logger.debug(JSON.stringify(process.env, null, 4));
logger.debug(JSON.stringify(conf, null, 4));

function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

function toObj (k, v, result) {
    if(!result) result = {};
    var _ = k.indexOf("_");
    if(_ == -1)
    {
        result[k] = v;
        return result;
    }
    result[k.substring(0, _)] = toObj(k.substring(_ + 1), v, result[k.substring(0, _)]);
    return result ;
}

app.use(bodyParser.json());
app.use(cors());

var jwt = require('express-jwt');

app.use(jwt({
       secret: conf.security.secret,
       getToken: function fromHeaderOrQuerystring(req) {
           return req.headers['x-authentication'];
       }
}));

app.post('/api/v1/cryptoAES_cbc/decrypt', async function (req, res, next) {
      logger.info("crypto AES decrypt ")
      let token = req.body.token;
      try{
        if(!token) res.status(400).send("Token is mandatory");
          //process.env.UNPADMIN_SECURITY_CRYPTO_PASSWORD = "dev";
          //logger.debug("unpadmin security crypto password:",process.env.UNPADMIN_SECURITY_CRYPTO_PASSWORD);
          if(!conf.security.crypto.password) return res.send({token:req.body.token});
          let result = cryptoAES.decrypt(token,conf.security.crypto.password);
          return res.send({token:result});
      }catch(e){
          logger.error(JSON.stringify(e));
          res.status(500).send("error: " + e);
      }
});

app.get('/api/v1/broadcasts', async function (req, res, next) {

      let filter = req.query.filter;
      let sql = build_query.select().table("broadcast").filter(filter).sql;
      logger.debug("query broadcast: ",sql)
      try{
          var result = await db.preferences.execute(sql);
          return res.send(result);
      }catch(e){
        logger.error(JSON.stringify(e));
          res.status(500).send("error: " + e);
      }
});

app.get('/api/v1/preferences/users', async function (req, res, next) {

      let filter = {};
      if(req.query.channel && req.query.channel != '') filter.channels = {'ci': req.query.channel};
      filter.service_name = {'eq': req.query.service_name};

      try{
          var sql = build_query.select().table("users_services").filter(filter).count().sql;
      }catch(e){
        logger.error(JSON.stringify(e));
        res.status(400).send("error: " + e);
      }

      logger.debug("query get users count for channel: ",sql)
      try{
          var result = await db.preferences.execute(sql);
          return res.send(result[0]);
      }catch(e){
          logger.error(JSON.stringify(e));
          res.status(500).send("error: " + e);
      }
});

app.get('/api/v1/broadcasts/:name', async function (req, res, next) {

      logger.info("get message: " + req.params.name);
      try{
          var result = await db.preferences.execute("select * from broadcast where name='" + req.params.name + "'");
          let json = result[0];
          if(!json || json === null) return res.status(404).send("broadcast not found");
          json.mex=json.mex.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
          json.mex = JSON.parse(Buffer.from(json.mex, 'base64').toString('utf8'));
          //json.mex = JSON.parse(json.mex);
          return res.send(json);
      }catch(e){
          logger.error(JSON.stringify(e));
          res.status(500).send("error: " + e);
      }
});

app.put('/api/v1/broadcasts', async function (req, res, next) {

      let broad = req.body;
      /*
      let mex = {};
      mex.uuid = req.body.uuid;
      mex.name = req.body.name;
      mex.service = req.body.service;
      mex.scheduled_at = req.body.scheduled_at;
      mex.created_at = req.body.created_at;
      mex.mex = req.body;
      mex.status = "scheduled";
      mex.token = req.body.token;*/

      if(broad.scheduled_at) broad.scheduled_at = broad.scheduled_at.replace('Z','');
      if(broad.created_at) broad.created_at = broad.created_at.replace('Z','');
      if(broad.sent_at) broad.sent_at = broad.sent_at.replace('Z','');


      try{
          let query_delete = "DELETE from broadcast WHERE uuid ='" + broad.uuid + "'; "
          let query_insert = "INSERT INTO broadcast " + insert(broad) + ";";
          logger.info(query_delete+query_insert);
          var result = await db.preferences.execute(query_delete+query_insert);
          logger.debug("saved mex");
          return res.send(result);
      }catch(e){
          logger.error(JSON.stringify(e));
          res.status(500).send("error: " + e);
      }
});

app.delete('/api/v1/broadcasts/:uuid', async function (req, res, next) {

      logger.info("called delete of message: " + req.params.uuid);
      let uuid = req.params.uuid;

      try{
          let query_delete = "DELETE from broadcast WHERE uuid ='" + uuid + "'; "
          var result = await db.preferences.execute(query_delete);
          return res.send(result);
      }catch(e){
          logger.error(JSON.stringify(e));
          res.status(500).send("error: " + e);
      }
});

/*app.get('/api/v1/preferences/services', async function (req, res, next) {

      console.log("called get list of services");

      try{
          let query = "SELECT * from services";
          var result = await db.preferences.execute(query);
          return res.send(result);
      }catch(e){
          console.log(e);
          res.status(500).send("error: " + e);
      }
});*/

app.post('/api/v1/broadcast/send', async function (req, res, next) {

      logger.info("called [POST] send broadcast: ",req.body);

      let message = req.body.message;
      let token = req.body.token;
      let service = req.body.service;

      try{
          var contacts = await getUserPreferences(message.payload.user_id,service);
          if(!contacts || contacts == null) {
            logger.debug("contacts not found: ",contacts);
            return res.status(404).send("User doesn't exists or did not chose preferences for this service");
          }
      }catch(e){
        logger.error("error getting contacts :", JSON.stringify(e));
        return res.status(500).send("error getting contacts: " + e);
      }

      let possibleChannels = ['push','email','sms'];
      possibleChannels.filter( ch => !Object.keys(contacts).includes(ch)).forEach( ch => delete message.payload[ch]);
      logger.debug(possibleChannels)
      //['sms','email','push'].filter( e=> Object.keys(message.payload).includes(e)).forEach( ch => if(!contacts[ch]) return res.status(400).send("user doesn't have setted channels"));

      if(message.payload.sms) message.payload.sms.phone = contacts.sms;
      if(message.payload.email) message.payload.email.to = contacts.email;
      if(message.payload.push) message.payload.push.token = contacts.push;

      message.payload.trusted = true;

      console.log(message)
      var options = {
              url: conf.mb.queues.messages,
              method: 'POST',
              headers: {
                  'x-authentication': token
              },
              body: message,
              json: true
          }

      try{
          let response = await req_promise(options);
          logger.debug("mex sent");
          return res.send("message sent");
      }catch(e){
          logger.error(JSON.stringify(e));
          return res.status(500).send("error: " + e);
      }
});

app.get('/api/v1/templates', async function (req, res, next) {

      logger.info("called [GET] templates ");
      let token = conf.mb.token;

      var options = {
              url: conf.mb.queues.templates,
              method: 'GET',
              headers: {
                  'x-authentication': token
              },
              json: true
          }

      try{
          let response = await req_promise(options);
          return res.send(response);
      }catch(e){
          logger.error(JSON.stringify(e));
          return res.status(500).send("error: " + e);
      }
});

app.get('/api/v1/messages/file/:name', async function (req, res, next) {

      logger.info("called [GET] messages/file/ " + req.params.name);
      let name = req.params.name;

      let sent_messages = conf.send_scheduled.sent_messages_path;
      let not_sent_messages = conf.send_scheduled.not_sent_messages_path;
      try{
          if(fs.existsSync(sent_messages + "/" + name)) return res.sendFile(sent_messages + "/" + name);
          else return res.sendFile(not_sent_messages + "/" + name);
      }catch(e){
          logger.error(JSON.stringify(e));
          return res.status(500).send("error: " + e);
      }
});
var schedule = require('node-schedule');
//not used
/*
const send_sched = require("./send-scheduled");
var sendMessages = schedule.scheduleJob('* * * * *', send_sched.execute);
*/

//every minute
const send_sched_notification = require("./sendScheduledNotifications");
var sendMessages2 = schedule.scheduleJob('*/1 * * * *', send_sched_notification.execute);

//ogni giorno all'1 am
const history_sched = require("./messageHistory");
var historySched = schedule.scheduleJob('0 1 * * *', history_sched.execute);


//ogni giorno alle 2 am
const history_broadcast = require("./broadcastHistory");
var historyBroadcast = schedule.scheduleJob('0 2 * * *', history_broadcast.execute);

app.listen(conf.server_port, function () {
    logger.debug('Express server broadcast listening on port: ' + conf.server_port);
    setup();
});

async function setup(){
  try{
    if(!fs.existsSync(conf.send_scheduled.not_sent_messages_path)) await fs.mkdirSync(conf.send_scheduled.not_sent_messages_path,{recursive:true});
    if(!fs.existsSync(conf.send_scheduled.sent_messages_path)) await fs.mkdirSync(conf.send_scheduled.sent_messages_path,{});
  }catch(e){
    logger.error(JSON.stringify(e));
    process.exit(1);
  }
}



function insert(params){
    //logger.debug("params of insert:",params);
    return "( " + Object.keys(params).join(",") + ") VALUES( " + Object.keys(params).map( e=> params[e] ? "'" + (typeof params[e] ==="object"? new Buffer(JSON.stringify(params[e])).toString('base64') : params[e]) + "'" : 'NULL' ).join(",") + " )";
}

function update(params,where){
    let sql = "SET " + Object.keys(params).map( e => e + " = '" + typeof params[e] ==="object"? new Buffer(JSON.stringify(params[e])).troString('base64')  : params[e] + "'").join(",");
    if(where) sql += " WHERE " + Object.keys(where).map(e => e + " = '" + where[e] + "'" ).join(" and ");
    return sql;
}

async function getUserPreferences(user_id,service_name){
  let crypted_user_id = user_id.length <= 32? crypto.createHash('md5').update(user_id).digest("hex"): user_id;
  let sql = "SELECT us.channels, u.email, u.sms, u.push,us.service_name FROM users u LEFT JOIN users_services us on u.user_id=us.user_id  WHERE us.service_name = '" + service_name +"' and u.user_id='" + crypted_user_id + "'";
  logger.debug("sql get user preferences: ", sql);
  try{
    var contact = await db.preferences.execute(sql);
    contact = contact[0];
    if(!contact || contact === null || contact.channels === null || contact.channels === "") return null;
    let res = contact.channels.split(",").reduce( (r,ch) => {
      if((!contact[ch] || contact[ch] === null) ||
            (ch === 'push' && (!JSON.parse(contact[ch])[service_name]
                        || JSON.parse(contact[ch])[service_name] === null ))) return r;
      if(ch === "push") r[ch] = JSON.parse(contact[ch])[service_name]
      else r[ch] = contact[ch];
      return r;
    },{});
    logger.debug("preferences result: ", res);
    return res;
  }catch(e){
    logger.error("error getting contacts :", e.message);
    throw e;
  }

}

/*async function getPreferencesByUserIdAndService(user_id,service) {
  let crypted_user_id = user_id.length <= 32? crypto.createHash('md5').update(user_id).digest("hex"): user_id;

  let query= "SELECT email,sms,push from users where user_id ='" + crypted_user_id + "'";
  try{
        let contacts = await db.preferences.execute(query);
        contacts = contacts[0] || null;
        return contacts;
  }catch(e){
      logger.error("error getting contacts :",e);
      throw e;
  }
}*/
