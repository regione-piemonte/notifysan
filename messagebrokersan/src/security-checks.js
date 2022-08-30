/* security checks in the user token JWT for manage the profiling */
module.exports = function(logger) {

    function check(req, permission,conf) {
        if (!(req.user.applications[conf.app_name]).includes(permission)) {
            logger.error("user doesn't have %s permissions at path: %s ", permission, "[" + req.method + "] " + req.path);
            return {name : "SecurityError", message:"User doesn't have " + permission + " permissions at: " + "[" + req.method + "] " + req.path}
        }
        return null;
    }


    return {
        checkEnqueue : (req,conf) => check(req,"enqueue",conf),
        checkDequeue: (req,conf) => check(req,"dequeue",conf)
    }


}