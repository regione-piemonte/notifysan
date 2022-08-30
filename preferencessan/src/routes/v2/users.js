module.exports = function (conf, obj, locales) {

    const logger = obj.logger();
    const db = obj.db();
    const Utility = obj.utility();
    const buildQuery = obj.query_builder();

    const express = require('express');
    const router = express.Router();

    var escape = require('escape-html');
    var fs = require("fs");

    /**
     * check the input of the user for contacts
     */
    function checkInput(user) {
        let res = [];

        if (user.sms && !/^\d+$/.test(user.sms)) res.push("sms is not a number");
        if (user.phone && !/^\d+$/.test(user.phone)) res.push("phone is not a number");
        if (user.email && !user.email.match(/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/))
            res.push("email is not valid");
        if(!user.push) user.push = {};
        if (Array.isArray(user.push) || typeof user.push !== "object") res.push("push must be an object formed as: { label:[<token>]}");

        if (user.language && !Object.keys(locales).includes(user.language)) res.push("language locale not valid");
        if (user.interests) user.interests = user.interests.split(",").map(e => e.trim()).join(",");

        return res;

    }

    function parseContact(user){
        if(!user || user === null) return user;
        if (user.push && user.push !== "") user.push = JSON.parse(user.push);
        return user;
    }

    /**
     * get user's contacts
     */
    router.get('/:user_id/contacts', async function (req, res, next) {

        let user_id = Utility.hashMD5(req.params.user_id);

        var query = "";
        try {
            query = buildQuery.select().table("users").filter({"user_id": {"eq": user_id}}).sql;
            var queryTerms = buildQuery.select().table("users_terms").filter({"user_id": {"eq": user_id}}).sql;
        } catch (err) {
            return next({type: "client_error", status: 400, message: err});
        }

        try {
            var result = await db.execute(query);
            var resultTerms = await db.execute(queryTerms);
        } catch (err) {
            return next({type: "db_error", status: 500, message: err});
        }

        if (!result || result.length === 0 || !resultTerms || resultTerms.length === 0)
            return next({type: "info", status: 404, message: "no contacts for " + escape(req.params.user_id)});

        let user = result[0];
        let userTerms = resultTerms[0];

        user = parseContact(user);
        user.user_id = req.params.user_id;
        delete userTerms.user_id;
        user.terms = userTerms;
        next({type: "ok", status: 200, message: user});
    });

    /**
     *  insert or update contacts of user
     */
    router.put('/:user_id/contacts', async function (req, res, next) {
        let user = req.body;

        let user_id = Utility.hashMD5(req.params.user_id);

        try {
            let select_query = buildQuery.select().table("users_terms").filter({"user_id":{"eq": user_id}}).sql;
            var select_result = await db.execute(select_query);
            if(!select_result[0] || select_result[0] === null) return next({type: "client_error", status: 412, message: "The user didn't accept the terms of service"});
        } catch (err) {
            return next({type: "db_error", status: 500, message: err});
        }

        let resCheck = checkInput(user);
        if (resCheck.length > 0) {
            resCheck.forEach(e => {
                logger.info(e);
            });
            return next({
                type: "client_error",
                status: 400,
                message: "user input is malformed: " + resCheck.join(","),
                body: req.body
            })
        }


        try {
            var sql_insert_s = "INSERT INTO users_s (select *,to_timestamp(" + new Date().getTime() + "* 0.001) from users where user_id = '" + user_id + "')";
            var sql_delete = buildQuery.delete().table("users").filter({
                "user_id": {"eq": user_id}
            }).sql;
            var sql_insert = buildQuery.insert().table("users").values({
                user_id: user_id,
                sms: user.sms,
                email: user.email,
                push: JSON.stringify(user.push),
                phone: user.phone,
                language: user.language,
                interests: user.interests
            }).sql;
            sql_insert_s = sql_insert_s + " ON CONFLICT ON CONSTRAINT users_s_pk do update set sms = '" + user.sms + "', email = '" + user.email + "', push = '" + JSON.stringify(user.push) + "', phone = '" + user.phone + "', language = '" + user.language + "', interests = '" + user.interests +"'";
            var select_sql = buildQuery.select().table("users").filter({
                "user_id": {"eq": user_id}
            }).sql;
        } catch (err) {
            return next({type: "client_error", status: 400, message: "the request is not correct", body: err})
        }

        try {
            var result = await db.execute(sql_insert_s + ";" + sql_delete + ";" + sql_insert + ";" + select_sql + ";");
            let user = parseContact(result[3][0]);
            user.user_id = req.params.user_id;
            return next({type: "ok", status: 200, message: user})
        } catch (err) {
            logger.error(JSON.stringify(err));
            return next({type: "db_error", status: 500, message: err})
        }
    });

    /**
     *  get the preferences of the specified user for the specified service
     */
    router.get('/:user_id/preferences/:service_name', async function (req, res, next) {

        let user_id = Utility.hashMD5(req.params.user_id);

        let filter = {
            "user_id": {"eq": user_id},
            "service_name": {"eq": req.params.service_name}
        };
        try {
            var user_services_sql = buildQuery.select().table('users_services').filter(filter).sql;
            var service_sql = buildQuery.select().table('services').filter({"name": {"eq": req.params.service_name}}).sql;
            var user_sql = buildQuery.select().table('users').filter({"user_id": {"eq": user_id}}).sql;
        } catch (err) {
            return next({type: "client_error", status: 400, message: "the request is not correct", body: err})
        }

        try {
            var result = await db.execute(user_services_sql + ";" + service_sql + ";" + user_sql);
        } catch (err) {
            return next({type: "db_error", status: 500, message: err})
        }

        var service = result[1][0];
        if (!service) return next({type: "client_error", status: 404, message: "service doesn't exist"});
        var user = result[2][0];
        if (!user) return next({type: "client_error", status: 404, message: "user doesn't exist"});
        var user_services = result[0][0];
        if (!user_services) return next({type: "info", status: 404, message: "user preferences for this service not found"});
        /* filter only the channels chosen from user that are available in the service*/
        if(user_services.channels && user_services.channels !== "") {
            let channelsPossibles = (user_services.channels.split(",")).filter(e => (service.channels.split(",")).includes(e));
            user_services.channels = channelsPossibles.join(",");
        }
        user_services.user_id = req.params.user_id;
        next({type: "ok", status: 200, message: user_services});
    });

    /**
     *  insert or update preferences of service
     */
    router.put('/:user_id/preferences/:service_name', async function (req, res, next) {
        let user_id = Utility.hashMD5(req.params.user_id);

        if (!req.body.channels) req.body.channels = "";

        try {
            var sql_services = buildQuery.select().table("services").filter({"name": {"eq": req.params.service_name}}).sql;
            var sql_insert_s = "INSERT INTO users_services_s (select *,to_timestamp(" + new Date().getTime() + "* 0.001) from users_services where user_id = '" + user_id + "' and service_name = '" + req.params.service_name + "')"
            var sql_delete = buildQuery.delete().table("users_services").filter({
                "user_id": {"eq": user_id},
                "service_name": {"eq": req.params.service_name}
            }).sql;
            var sql_insert = buildQuery.insert().table("users_services").values({
                uuid: Utility.uuid(),
                user_id: user_id,
                service_name: req.params.service_name,
                channels: req.body.channels
            }).sql;
            if(req.body.channels === null || req.body.channels === "") sql_insert = "";
        } catch (err) {
            return next({type: "client_error", status: 400, message: "the request is not correct", body: err})
        }

        let total_query = sql_insert_s + "; " + sql_delete + "; " + sql_insert + ";";

        try {
            let service = await db.execute(sql_services);
            service = service[0];
            if(!service) return next({type: "client_error", status: 400, message: "the service '" + escape(req.params.service_name) + "' doesn't exist"});
            await db.execute(total_query);
        } catch (err) {
            return next({type: "db_error", status: 500, message: err});
        }
        next({type: "ok", status: 200, message: "OK"});
    });

    /**
     *  get the preferences of the specified user for all the services
     */
    router.get('/:user_id/preferences', async function (req, res, next) {

        let user_id = Utility.hashMD5(req.params.user_id);

        let filter = {
            "user_id": {"eq": user_id}
        };

        try {
            var user_services_sql = buildQuery.select("us.*").table('users_services as us').join().table("services as s").on("us.service_name=s.name").filter(filter).sql;
            var user_sql = buildQuery.select().table('users').filter(filter).sql;
        } catch (err) {
            return next({type: "client_error", status: 400, message: "the request is not correct", body: err})
        }

        try {
            var result = await db.execute(user_services_sql + ";" + user_sql);
        } catch (err) {
            return next({type: "db_error", status: 500, message: err})
        }

        var user = result[1][0];
        if (!user) return next({type: "client_error", status: 404, message: "user doesn't exist"});
        var user_services = result[0];
        user_services = user_services.map(e => {
            e.user_id = req.params.user_id;
            return e;
        });
        next({type: "ok", status: 200, message: user_services});
    });

    /**
     *  insert or update preferences of service
     */
    router.put('/:user_id/preferences', async function (req, res, next) {

        let user_id = Utility.hashMD5(req.params.user_id);

        let services = req.body;
        if(Array.isArray(services)) return next({type: "client_error", status: 400, message: "Request body should be an object, not an array"});
        await Object.keys(services).forEach(async service_name => {

            if (!services[service_name]) services[service_name] = "";

            try {
                var sql_insert_s = "INSERT INTO users_services_s (select *,to_timestamp(" + new Date().getTime() + "* 0.001) from users_services where user_id = '" + user_id + "' and service_name = '" + service_name + "')"
                var sql_delete = buildQuery.delete().table("users_services").filter({
                    "user_id": {"eq": user_id},
                    "service_name": {"eq": service_name}
                }).sql;
                var sql_insert = buildQuery.insert().table("users_services").values({
                    uuid: Utility.uuid(),
                    user_id: user_id,
                    service_name: service_name,
                    channels: services[service_name]
                }).sql;
                if(services[service_name] === null || services[service_name] === "") sql_insert = "";
            } catch (err) {
                return next({type: "client_error", status: 400, message: "the request is not correct", body: err})
            }

            let total_query = sql_insert_s + "; " + sql_delete + "; " + sql_insert + ";";

            try {
                await db.execute(total_query);
            } catch (err) {
                return next({type: "db_error", status: 500, message: err});
            }
        })
        next({type: "ok", status: 200, message: "OK"});
    });

    /**
     *  get contacts of user for the only available channels the he has chosen
     */
    router.get('/:user_id/contacts/:service', async function (req, res, next) {

        let user_id = Utility.hashMD5(req.params.user_id);

        var filter = {
            "u.user_id": {"eq": user_id},
            "us.service_name": {"eq": req.params.service}
        };

        try {
            //var sql = buildQuery.select().table("( select u.user_id, us.channels, u.email, u.sms, u.push,us.service_name from users_services us,users u where u.user_id = us.user_id ) t").filter(filter).sql;
            var checkUser = buildQuery.select().table("users").filter({"user_id": {"eq": user_id}}).sql;
            var sql = buildQuery.select("u.user_id, us.channels, u.email, u.sms, u.push,us.service_name").table("users u")
                .join("LEFT").table("users_services us").on("u.user_id = us.user_id").filter(filter).sql;
        } catch (err) {
            return next({type: "client_error", status: 400, message: "the request is not correct", body: err})
        }

        try {
            var dbRes = await db.execute(checkUser + ";" + sql);
        } catch (err) {
            return next({type: "db_error", status: 500, message: err})
        }
        var user = dbRes[0][0];
        if(!user){
            return next({type: "info", status: 404, message: "user not found"})
        }

        var contacts = dbRes[1];

        if (contacts.length === 0) {
            return next({
                type: "info",
                status: 204,
                message: ""
            })
        }

        var result = {};
        /* compose contacts object assigning to each channels the relative user contact */
        if(contacts[0].channels) contacts[0].channels.split(",").map(e => e.trim()).forEach(e => result[e] = contacts[0][e]);

        if (result.push && result.push !== "") {
            try {
                var push = JSON.parse(result["push"]);
                push = push[req.params.service];
                if(push && push.length > 0) result.push = push;
                else delete result.push;
            } catch (err) {
                return next({type: "system_error", status: 500, message: "user push contact not a valid JSON"});
            }
        }
        next({type: "ok", status: 200, message: result});
    });

    /**
     *  accept user terms
     */
    router.put('/:user_id/terms', async function (req, res, next) {

        let user_id = Utility.hashMD5(req.params.user_id);

        let document_hash = req.body;

        try {
            var terms = fs.readFileSync(process.cwd() + "/terms/terms");
        } catch (err) {
            return next({type: "system_error", status: 500, message: err});
        }

        let termsCrypted = Utility.hashMD5(terms);

        if(termsCrypted !== document_hash.hash) return next({type: "client_error", status: 400, message: "the hash of terms is wrong", body: {}});

        try {
            let sql_insert_s = "INSERT INTO users_terms_s (select *,to_timestamp(" + new Date().getTime() + "* 0.001) from users_terms where user_id = '" + user_id + "')";
            let sql_delete = buildQuery.delete().table("users_terms").filter({
                "user_id": {"eq": user_id}
            }).sql;
            let sql_insert = buildQuery.insert().table("users_terms").values({
                user_id: user_id,
                accepted_at: Utility.getDateFormatted(new Date()),
                hashed_terms: document_hash.hash
            }).sql;
            let select_query = buildQuery.select().table("users_terms").filter({"user_id":{"eq": user_id}}).sql;

            var select_result = await db.execute(sql_insert_s + ";" + sql_delete + ";" + sql_insert + ";" + select_query);

            let user = select_result[3][0];
            delete user.user_id;
            return next({type: "ok", status: 200, message: user});
        } catch (err) {
            return next({type: "db_error", status: 500, message: err});
        }

    });

    /**
     * get user's accepted terms
     */
    router.get('/:user_id/terms', async function (req, res, next) {

        let user_id = Utility.hashMD5(req.params.user_id);

        try {
            let select_query = buildQuery.select().table("users_terms").filter({"user_id":{"eq": user_id}}).sql;
            var select_result = await db.execute(select_query);

            if(!select_result[0] || select_result[0] === null) return next({type: "client_error", status: 404, message: "User not found"});

            let user = select_result[0];
            delete user.user_id;
            return next({type: "ok", status: 200, message: user});
        } catch (err) {
            return next({type: "db_error", status: 500, message: err});
        }
    });

    /**
     *  historicize user
     */
    router.delete('/:user_id', async function (req, res, next) {

        let user_id = Utility.hashMD5(req.params.user_id);
        try {
            let sql_insert_s = "INSERT INTO users_s (select *,to_timestamp(" + new Date().getTime() + "* 0.001) from users where user_id = '" + user_id + "')";
            sql_insert_s = sql_insert_s + " ON CONFLICT ON CONSTRAINT users_s_pk DO NOTHING";
            let sql_delete_user = buildQuery.delete().table("users").filter({
                "user_id": {"eq": user_id}
            }).sql;
            let sql_insert_terms_s = "INSERT INTO users_terms_s (select *,to_timestamp(" + new Date().getTime() + "* 0.001) from users_terms where user_id = '" + user_id + "')";
            let sql_delete_terms = buildQuery.delete().table("users_terms").filter({
                "user_id": {"eq": user_id}
            }).sql;
            let sql_delete_user_preferences = buildQuery.delete().table("users_services").filter({
                "user_id": {"eq": user_id}
            }).sql;

            let total_query = sql_insert_s + "; " + sql_delete_user + "; " + sql_insert_terms_s + ";" + sql_delete_terms + ";" + sql_delete_user_preferences + ";";

            await db.execute(total_query);
            return next({type: "ok", status: 200, message: "OK"});
        } catch (err) {
            return next({type: "db_error", status: 500, message: err});
        }
    });

    return router;
}