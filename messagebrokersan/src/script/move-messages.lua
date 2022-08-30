local ns = ARGV[1]

local keys = redis.call("keys", ns .. "*:*:*:to_be_retried");
for _, from_key in ipairs(keys) do
    local to_key = string.gsub(from_key, ':to_be_retried', '');
    local msgs = redis.call("zunionstore", to_key, 2, from_key, to_key);    
    redis.call("del", from_key);
end
