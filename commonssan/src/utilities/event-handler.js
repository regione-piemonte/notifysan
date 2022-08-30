var util = require('util');
const logger = require('../conf/logger');
var request = util.promisify(require("request"));

/**
 * Class to create events used by applications and send the event to the queue.
 * You can add events typologies in return statement or use the "new_event" method from the applications.
 * @param conf configuration JSON
 * @param logger logger
 */
module.exports = function (conf, logger) {
    module.mb_url = conf.mb.queues.events;
    module.token = conf.mb.token;
    module.source = conf.app_name;
    module.retriesNum = conf.eventHandler.retries.num;
    module.retriesDelay = conf.eventHandler.retries.delay;
    module.logger = logger;
    module.utility = require("./utility")(logger);
    return {
        ok: async (description, payload) => new_event(description, "OK", payload) ,
        client_request: async (description, payload) => new_event(description, "CLIENT_REQUEST", payload),
        client_error: async (description, payload) => new_event(description, "CLIENT_ERROR", payload),
        db_error: (description, payload) => new_event(description, "DB_ERROR", payload),
        system_error: async (description, payload) => new_event(description, "SYSTEM_ERROR", payload),
        external_error: (description, payload) => new_event(description, "EXTERNAL_ERROR", payload),
        security_error: (description, payload) => new_event(description, "SECURITY_ERROR", payload),
        info: async (description, payload) => new_event(description, "INFO", payload),
        new_event: new_event
    };
}

async function new_event(description, type, payload) {
    var event = {
        uuid: module.utility.uuid(),
        payload: {
            source: module.source,
            description: typeof description === 'object' ? "[" + description.method + "] " + description.path : description,
            payload: payload,
            type: type || "OK",
            created_at: new Date().getTime()
        }
    }

    var optionsToMb = {
        url: module.mb_url,
        method: 'POST',
        json: event,
        headers: {
            'x-authentication': module.token,
            'connection':'close'
        }
    }

    /**
     * send event to the Message Broker
     */
    // try {
    //     var data = await request(optionsToMb);
    //     if (data.statusCode !== 201) {
    //         module.logger.warn("error sending event: status code[%s] event url [%s] error [%s]", data.statusCode, optionsToMb.url, data.body);
    //     } else {
    //         module.logger.debug("event successfully sent:", data.body);
    //     }
    // } catch(err) {
    //     module.logger.error("error sending event: status code [500] event url [%s] error [%s] event [%s]", optionsToMb.url, JSON.stringify(err), JSON.stringify(event));
    // }
    sendEvent(optionsToMb, module.retriesNum);
}

async function sendEvent(options, retries) {
    try {
        let data = await request(options);

        if(data.statusCode === 201) {
            module.logger.debug("event successfully sent:", data.body);
            return;
        }

        if (retries > 0 && (data.statusCode == 408 || data.statusCode >= 500)) {
            module.logger.warn("error sending event: status code [%s] event url [%s] retries left [%s] error [%s]", data.statusCode, options.url, retries - 1, data.body);
            setTimeout(sendEvent, module.retriesDelay, options, retries - 1);
        } else {
            module.logger.error("cannot send event: status code [%s] event url [%s] event [uuid:%s, source: %s, description: %s] error [%s]", data.statusCode, options.url, options.json.uuid, options.json.payload.source, options.json.payload.description, data.body);
        }
    } catch(err) {
        module.logger.error("cannot send event: status code [exception] event url [%s] event [uuid:%s, source: %s, description: %s] error [%s]", options.url, options.json.uuid, options.json.payload.source, options.json.payload.description, err.message);
    }
}
