local ns = ARGV[1]

local keys = redis.call('keys', ns .. "consumers:*");
for _,k in ipairs(keys)
do
        redis.call('del', k)
end

redis.call("SADD", ns .. "consumers:messages", "sms")
redis.call("SADD", ns .. "consumers:messages", "push")
redis.call("SADD", ns .. "consumers:messages", "email")
redis.call("SADD", ns .. "consumers:messages", "mex")
redis.call("SADD", ns .. "consumers:messages", "io")

redis.call("SADD", ns .. "consumers:audit", "audit")
redis.call("SADD", ns .. "consumers:events", "events")
