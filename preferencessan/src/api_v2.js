// api v2 configuration
module.exports = function (conf, app, obj, locales) {

    var prefix = "/api";
    const security_checks = obj.security_checks();

    if (conf.security) {
        app.use(prefix + '/v2/users/:user_id/contacts', security_checks.checkServiceAuthType);
        app.use(prefix + '/v2/users/:user_id/preferences', security_checks.checkServiceAuthType);
        app.use(prefix + '/v2/users/:user_id/terms', security_checks.checkServiceAuthType);
        app.delete(prefix + '/v2/users/:user_id', security_checks.checkServiceAuthType);
    }
    
    app.use(prefix + '/v2', require('./routes/v2')(conf, obj, locales));
}