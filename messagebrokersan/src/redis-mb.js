var commons = require("../../commons/src/commons");
const conf = commons.merge(require('./conf/mb'),require('./conf/mb-' + (process.env.ENVIRONMENT || 'localhost')));

const fs = require('fs');
const util = require('util');
const redis = new require('ioredis')(conf.redis);

const obj = commons.obj(conf);
const logger = obj.logger();
/**
 * definition of custom command present in script
 */
redis.defineCommand('add_message', {
    numberOfKeys: 0,
    lua: fs.readFileSync('script/add-message.lua')
});

redis.defineCommand('get_message', {
    numberOfKeys: 0,
    lua: fs.readFileSync('script/get-message.lua')
});

redis.defineCommand('move_messages', {
    numberOfKeys: 0,
    lua: fs.readFileSync('script/move-messages.lua')
});


redis.defineCommand('setup', {
    numberOfKeys: 0,
    lua: fs.readFileSync('script/setup.lua')
});

/**
 * transform to promises instead of callbacks
 */
redis.add_message = util.promisify(redis.add_message);
redis.get_message = util.promisify(redis.get_message);
redis.setup = util.promisify(redis.setup);

/**
 * add message to message broker
 * @param queue_or_topic the queue or the topic
 * @param messages messages
 * @param is_topic flag if is queue or topic
 * @returns {Promise<*>}
 */
async function add_message(queue_or_topic, messages, is_topic)
{
    //logger.debug("adding to " + (is_topic? "topic" : "queue") + " '", queue_or_topic, "':", JSON.stringify(messages));
    return redis.add_message(conf.redis.keyPrefix, queue_or_topic, JSON.stringify(messages),is_topic);
}

async function setup(keyPrefix)
{
    logger.debug("setup redis ...");
    return redis.setup(keyPrefix);
}

/**
 * get message from message broker
 * @param keyPrefix key prefix in message broker
 * @param queue queue to read
 * @returns {Promise<*>}
 */
async function get_message(keyPrefix,queue,count)
{
    let result = await redis.get_message(keyPrefix,"queues:" + queue,count);
    result = result.filter( e => e !== null).map( e=> JSON.parse(e) );
    if(result.length === 0) return null;
    if(count === 1) result = result[0];
    return result;
}

/**
 * messages to be moved from to_be_retried to queues
 */
async function move_messages(keyPrefix){
    return redis.move_messages(keyPrefix);
}

async function hgetall(key){
    return await redis.hgetall(key);
}

async function type(key){
    return await redis.type(key);
}

async function lrange(key,start,end){
    return await redis.lrange(key,start,end);
}


async function del(key){
    return await redis.del(key);
}

async function hmset(key,map){
    return await redis.hmset(key,map);
}

module.exports = {
    get_message: get_message,
    setup: setup,
    add_message:add_message,
    move_messages:move_messages,
    hgetall: hgetall,
    type:type,
    lrange:lrange,
    del:del,
    hmset:hmset
}