## Descrizione

Gestore dei messaggi inviati alla piattaforma Notify (Piattaforma di notifica regionale).

## Configurazione
I dati sono salvati su DB [PostgreSQL](https://www.postgresql.org/), creare lo schema `unpaudit` ed eseguire lo script di creazione delle tabelle contenuto in `notifysandb` 

## Installazione

* Compilare i sorgenti utilizzando apache ant, viene generato un file .tar (es: messagestoresrv-1.0.0.tar)
* Estrarre il file .tar nella directory /appserv/unp/notify/messagestore
* Eseguire il comando npm install per installare le dipendenze
* Eseguire lo script messagestore

## Differenze da notificatore cittadini
Reperimento dei messaggi modificato in quanto aggiunti criteri di ricerca dei messaggi.
La ricerca si basa anche su un database differente