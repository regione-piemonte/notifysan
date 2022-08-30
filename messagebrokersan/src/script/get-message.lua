local ns = ARGV[1]
local queue = ARGV[2]
local count = ARGV[3]
local result = {}
local hp_key = ns .. queue .. "_priority";
local lp_key = ns .. queue;
local function d(o)
 local result = nil
 if o then
   result = cjson.encode(cmsgpack.unpack(o))
 end
 return result
end

local hashset = string.gsub(ns .. "coda:" .. queue,":[A-z]+$","")
local counter = string.gsub(ns .. "counter:" .. queue,":[A-z]+$","")


 for i=1,count-table.getn(result) do    
    local uuid = redis.call("zpopmin",lp_key)[1] or "x";

      redis.log(redis.LOG_WARNING, "uuid" .. uuid)
    local m = d(redis.call("hget",hashset,uuid))
    if m then
        local c = redis.call('HINCRBY', counter, uuid, -1)
        if c <= 0 then
          redis.call('HDEL', hashset, uuid)
          redis.call('HDEL', counter, uuid)
        end
        table.insert(result,m)
    end
 end

 return result
