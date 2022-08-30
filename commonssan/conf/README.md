# Commons

Commons è il progetto di utility comuni per tutti gli altri progetti.

Le classi di utility sono:

* `db`: legge dalla configurazione la proprietà "mysql" e inizializza la connessione al db.
* `multiple-db`: legge dalla configurazione la proprietà "mysql" che dovrà essere un oggetto composto da più oggetti database, per permettere di fare query a più database
* `logger`: legge dalla configurazione la proprietà "log4js" e inizializza il logger.
* `security`: legge dalla configurazione la proprietà "security" e "app_name" e fa i seguenti controlli sul token JWT:
    1. controllo che sia criptato con la giusta chiave
    2. controllo che non sia scaduto
    3. controllo che ci sia nel token l'attributo "applications",un array di stringhe che contiene la lista di applicazioni a cui il token è abilitato per l'accesso, e quindi controllare che il token sia effettivamente abilitato a quell'applicazione.     

    Infine mette nella request l'oggetto "user" che contiene il JSON del token decodificato.
* `security-checks`: espone metodi per i controlli di sicurezza come checkHeader, che controlla la presenza di Shib-Iride-IdentitaDigitale come attributo nell'header. 
* `event-handler`: espone i tipi di errori possibili dei vari eventi che possono essere generati dagli applicativi, contatta poi il message broker per l'accodamento dell'evento all'url specificato dalla proprietà "mb.queues.events".
* `utility`: semplice classe di utility che esponse metodi comunemenente usati dagli applicativi.
* `query-builder`: classe che permette di creare in modo facilitato le query.
* `consumer`: classe che mette a fattor comune la logica di implementazione dei consumer. Legge dalla configurazione proprietà come "mb" per scodare dal message broker il messaggio e a seconda delle implementazioni dei vari metodi passati dagli altri consumer, crea un loop che esegue tutta la logica.


Di seguito la lista delle altre funzionalità che si trovano allo stesso livello di `obj`:

*`hasOwnNestedProperty`: controllo se l'oggetto ( primo parametro ) contiene la chiave indicata (secondo parametro).

*`merge`: unisce due oggetti JSON, il secondo JSON sovrascriverà le chiavi del primo nel caso coincidano. 

*`locales`: lista di locales disponibili

  
## Getting Started  
  
La configurazione di default è scritta in commons.json, contiene una configurazione di default del logger.  
  
  
## Examples  
  
### 1. commons 
Commons espone semplicemente i metodi che permettono di invocare le funzionalita delle classi che contiene.

Esempio di chiamata della classe logger:

```
var commons = require("../../commons/src/commons");
const obj = commons.obj(conf);
const logger = obj.logger();
```
### 1. db  
Per eseguire una query con db, dopo aver settato la properietà corretta per la configurazione, chiamare il metodo `execute(query)` passando come parametro la query sql.  

esempio configurazione: 
```
"mysql": {  
  "host": "localhost",  
  "user": "root",  
  "password": "password",  
  "database": "preferences"  
}
```

esempio di utilizzo:
```
var query= "SELECT * FROM USERS;";
try {  
	var result = await db.execute(query);  
} catch (err) {  
	console.log(err);
}
```
  
### 2. multiple-db  
Multiple-db crea al suo interno un oggetto JSON, dove la chiave(che è il nome dell'oggetto nell'array dove si è configurato)  è associata alla funzione `execute(query)` che va direttamente sul database indicato.

esempio di configurazione:
```
"mysql": {
    "unpadmin": {
      "host": "localhost",
      "user": "root",
      "password": "password",
      "database": "unpadmin"
    },
    "preferences":{
      "host": "localhost",
      "user": "root",
      "password": "password",
      "database": "preferences"
    },
    "events":{
      "host": "localhost",
      "user": "root",
      "password": "password",
      "database": "events"
    },
    "audit":{
      "host": "localhost",
      "user": "root",
      "password": "password",
      "database": "audit"
    },
    "mex": {
      "host": "localhost",
      "user": "root",
      "password": "password",
      "database": "mex"
    }
}
```
  
  esempio di query eseguita sul database "mex":
```
 var sql = "SELECT * FROM MESSAGES;";
 try {  
    var result = await multiple_db.mex.execute(sql);  
} catch (err) {  
    console.log(err);
}
```
### 3. logger
 Il logger contiene già una configurazione di default all'interno di commons.
Configurazione di default:
```
{
	"log4js": {
		"appenders": {
			"consoleAppender": {
				"type": "console",
				"layout": {
					"type": "pattern",
					"pattern": "%d{yyyy-MM-dd hh:mm:ss} [%-5p] %m"
				}
			},
			"fileAppender": {
				"type": "file",
				"filename": "../../logs/app.log",
				"maxLogSize": 5242880,
				"compress": true,
				"layout": {
					"type": "pattern",
					"pattern": "%d{yyyy-MM-dd hh:mm:ss} [%-5p] %m"
				}
			}
		},
		"categories": {
			"default": {
				"appenders": [
					"fileAppender"
				],
				"level": "debug"
			}
		}
	}
}
```

Di default scrive soltanto su fileAppender, se si vuole per esempio cambiare il path del file log:
```
"log4js": {  
    "appenders": {  
        "fileAppender": {  
            "filename": "/appserv/unp/logs/preferences.log"  
  }  
    }  
}
```
 
 ### 4. security
La security legge dalla configurazione solo `app_name` e `security`.

Oltre a proteggere automaticamente il sistema controllando il token JWT e i permessi per l'applicazione, permette di gestire con una mappa la profilazione.

Esempio di gestione con una mappa di permessi:
```
if (conf.security) {  
	var permissionMap = {};  
	permissionMap[prefix + "services"] = ["user"];  
	permissionMap[prefix + "users/:user_id/contacts"] = ["user"];  
	permissionMap[prefix + "users/:user_id/preferences/:service_name"] = ["user"];  
	permissionMap[prefix + "users/:user_id"] = ["user"];  
	permissionMap[prefix + "users/:user_id/contacts/:service_name"] = ["backend"];  
	obj.security(permissionMap, app);   
}
```

### 5. security-checks

Esempio di controllo dell' header:

```
	app.use(prefix + 'users/:user_id/contacts', security_checks.checkHeader);  
	app.use(prefix + 'users/:user_id/preferences/:service_name', security_checks.checkHeader);  
	app.delete(prefix + 'users/:user_id', security_checks.checkHeader); 
```

### 6. event-handler

Esempio di uso event-handler:

```
const eh = obj.event_handler();

eh.info("trying to send event");
try{
   db.execute(query);
 catch(err){
  eh.system_error("Error", JSON.stringify(e));
}
```