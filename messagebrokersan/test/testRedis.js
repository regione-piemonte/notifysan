var commons = require("../../commons/src/commons");
console.log(JSON.stringify(process.env, null, 4));
const conf = commons.merge(require('../src/conf/mb'),require('../src/conf/mb-' + (process.env.ENVIRONMENT || 'localhost')));
console.log(JSON.stringify(conf, null, 4));
const obj = commons.obj(conf);

const redis = new require('ioredis')(conf.redis);

/*var Redis = require('ioredis');
var redis = new Redis({
    host: 'localhost'
});*/

redis.set('foo', 'bar');
redis.get('foo', function (err, result) {
    console.log(result);
});