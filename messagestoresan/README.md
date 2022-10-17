## Descrizione

Gestore dei messaggi inviati alla piattaforma Notify (Piattaforma di notifica regionale).

## Configurazione
I dati sono salvati su DB [PostgreSQL](https://www.postgresql.org/), creare lo schema `unpaudit` ed eseguire lo script di creazione delle tabelle contenuto in `notifysandb` 

## Installazione

* Compilare i sorgenti utilizzando apache ant, viene generato un file .tar (es: messagestoresrv-2.0.1.tar)
* Estrarre il file .tar nella directory /appserv/unp/notify/messagestore
* Eseguire il comando npm install per installare le dipendenze
* Eseguire lo script messagestore