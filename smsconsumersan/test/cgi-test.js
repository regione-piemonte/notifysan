var request = require("request");

var js2xmlparser = require("js2xmlparser");


var url = "http://dev-espos-gateway-sms.csi.it/cgi-bin/client/pSmsRequest.cgi";

//process.env.http_proxy = 'http://proxy.csi.it:3128';

var request_sms_json = {
    USERNAME: "notify",
    PASSWORD: "megaloman_18",
    CODICE_PROGETTO: "37",
    REPLY_DETAIL: "errors",
    SMS:{
        TELEFONO: "3333604782",
        TESTO: "dddddddd",
        CODIFICA: "7bit",
        TTL : "",
        PRIORITA : "",
        DATA_INVIO: "",
        NOTE : ""
    }
};

var request_sms_xml = js2xmlparser.parse("RICHIESTA_SMS", request_sms_json);
console.log(request_sms_xml);

var options = {
    url: url,
    method : "POST",
    json : { "xmlSms" : request_sms_xml}
};

request(options, function (err, data) {

    if (err) {
        console.log(" error:", err);
    }

    console.log("data:",data);
});
