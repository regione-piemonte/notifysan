// api v1 configuration
module.exports = function (conf, app, obj, locales) {

    var prefix = "/api";
    const security_checks = obj.security_checks();

    if (conf.security) {
        app.use(prefix + '/v1/users/:user_id/contacts', security_checks.checkHeader);
        app.use(prefix + '/v1/users/:user_id/preferences', security_checks.checkHeader);
        app.use(prefix + '/v1/users/:user_id/terms', security_checks.checkHeader);
        app.delete(prefix + '/v1/users/:user_id', security_checks.checkHeader);
    }
    
    app.use(prefix + '/v1', require('./routes/v1')(conf, obj, locales));
}