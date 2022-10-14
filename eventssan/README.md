## Descrizione

Il progetto _broadcastsan_ contiene un elenco di batch per gestire la storicizzazione dei dati

## Configurazione
I dati sono salvati su DB [PostgreSQL](https://www.postgresql.org/), creare lo schema `unpaudit` ed eseguire lo script di creazione delle tabelle contenuto in `notifysandb` 


## Installazione

* Compilare i sorgenti utilizzando [apache ant](https://ant.apache.org/), viene generato un file .tar (es: _eventssrv-1.0.0.tar_)
* Estrarre il file .tar nella directory `/appserv/unp/notify/events`
* Eseguire il comando `npm install` per installare le dipendenze
* Eseguire lo script dello schema `unpevents`
