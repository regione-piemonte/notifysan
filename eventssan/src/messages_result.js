var commons = require("../../commons/src/commons");

const conf = commons.merge(require('./conf/events'), require('./conf/events-' + (process.env.ENVIRONMENT || 'localhost')));
const obj = commons.obj(conf);

const logger = obj.logger("status");
const db = obj.db();
const Utility = obj.utility();
const queryBuilder = obj.query_builder();
const security_checks = obj.security_checks();
var prefix = "/api/v1/";
var bodyParser = require('body-parser');
const util = require("util");
// const request = util.promisify(require('request'));
var express = require('express');
var app = express();
var escape = require('escape-html');
var uuid = require('uuid');

app.use(bodyParser.json());
app.use(function (req, res, next) {
  res.set("X-Response-Time", new Date().getTime());
  next();
});
const dateformat = require("dateformat");
var to_continue_insert = true;

if (conf.security) {
  if (conf.security.blacklist) obj.blacklist(app);

  var permissionMap = [];
  permissionMap.push({
    url: prefix + "status/messages",
    method: "get",
    permissions: ["read"]
  });
  permissionMap.push({
    url: prefix + "status/messages/:message_id",
    method: "get",
    permissions: ["read"]
  });

  obj.security(permissionMap, app);
}

// app.use(async function(req,res,next){
//   try{
//     await updateToken();
//     return next();
//   }catch(e){
//     logger.error(e);
//     res.status(500).send("error contacting sdp");
//   }
// })
// var token = "";
// var optionsToSdp = {
//   url: conf.sdp.odata.esito.url,
//   headers: {
//     'Authorization': "Bearer " + token,
//     'connection': 'close'
//   },
//   json: true
// };

// conf.sdp.odata.esito.token.form.client_secret = conf.sdp.odata.esito.token.form.secret;
// delete conf.sdp.odata.esito.token.form.secret;
// async function updateToken() {
//   logger.debug("update token")
//   try{
//     let optionsToken = conf.sdp.odata.esito.token;        
//     token = await request(optionsToken);
//     optionsToSdp.headers.Authorization = "Bearer " + token.body.access_token;
//     logger.debug("updated token: ",token.body);
//   }catch (e){
//     logger.error(e);
//     throw e;
//   }
// }

app.get(prefix + 'status/messages/', async function (req, res, next) {

  let bulk_id = req.query.bulk_id;
  if (!uuid.validate(bulk_id)) {
    logger.debug("not a valid uuid");
    return next({
      type: "client_error",
      status: 400,
      message: escape(bulk_id) + " is not a valid bulk id"
    });
  }
  if (!bulk_id) return next({ type: "client_error", status: 400, message: "Bulk_id param is mandatory" });
  try {
    let select_query = queryBuilder.select("message_id, bulk_id, email_result::int, push_result::int, sms_result::int, io_result::int, mex_result::int, send_date, note").table("messages_status").filter({
      "bulk_id": {
        "eq": bulk_id
      }
    }).sql;
    var select_result = await db.execute(select_query);
    // optionsToSdp.url = conf.sdp.odata.esito.url.replace(":bulk_id", bulk_id);

    // let sdpResponse = await request(optionsToSdp);
    // let messageStatus = sdpResponse.body;
    // messageStatus = messageStatus.d.results.map(e => {
    //   e.send_date = JSON.stringify(e.send_date, null, 4);
    //   return e;
    // });
    // select_result.concat(messageStatus);

    if (select_result.length === 0) return next({
      type: "client_error",
      status: 204,
      message: "No data found"
    })

    return next({
      type: "ok",
      status: 200,
      message: select_result
    });

  } catch (err) {
    return next({
      type: "system_error",
      status: 500,
      message: err
    });
  }
});

app.get(prefix + 'status/messages/:message_id', async function (req, res, next) {
  let message_id = req.params.message_id;
  if (!uuid.validate(message_id)) {
    logger.debug("not a valid uuid");
    return next({
      type: "client_error",
      status: 400,
      message: escape(message_id) + " is not a valid message id"
    });
  }

  try {
    let select_query = queryBuilder.select("message_id, bulk_id, email_result::int, push_result::int, sms_result::int, io_result::int, mex_result::int, send_date, note").table("messages_status").filter({
      "message_id": {
        "eq": message_id
      }
    }).sql;

    let select_result = (await db.execute(select_query))[0];
    if (!select_result) return next({
      type: "client_error",
      status: 204,
      message: "No data found"
    });
    return next({
      type: "ok",
      status: 200,
      message: select_result
    });

    // optionsToSdp.url = conf.sdp.odata.esito.url.replace(":message_id", message_id);

    // let sdpResponse = await request(optionsToSdp);
    // let messageStatus = sdpResponse.body;
    // logger.debug("message_id: ",message_id)
    // logger.debug("response from sdp: ",JSON.stringify(messageStatus,null,4));
    // messageStatus = messageStatus.d.results.map(e => {
    //   //e.send_date = JSON.stringify(e.send_date, null, 4);
    //   delete e.__metadata;
    //   delete e.streamCode;
    //   delete e.sensor;
    //   delete e.time;
    //   delete e.internalId;
    //   delete e.datasetVersion;
    //   delete e.idDataset;      
    //   return e;
    // });
    // messageStatus = messageStatus[0];
    // if (!messageStatus) return next({
    //   type: "client_error",
    //   status: 204,
    //   message: "No data found"
    // })

    // return next({
    //   type: "ok",
    //   status: 200,
    //   message: messageStatus
    // });

  } catch (err) {
    logger.error(JSON.stringify(err));
    return next({
      type: "system_error",
      status: 500,
      message: err
    });
  }
});

obj.response_handler(app);

app.listen(conf.server_port, function () {
  logger.info("environment: ", JSON.stringify(process.env, null, 4));
  logger.info("configuration: ", JSON.stringify(conf, null, 4));
  logger.info('Messages Result server listening on port: ', conf.server_port);

});
