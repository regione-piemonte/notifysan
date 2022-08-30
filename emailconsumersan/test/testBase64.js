let data = "aaaàà+eeèé";
let base = new Buffer(data).toString('base64');
let res = Buffer.from(base, 'base64').toString('utf8');

console.log(res)