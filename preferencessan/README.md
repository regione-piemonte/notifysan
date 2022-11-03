## Descrizione

Gestore delle preferenze di notifica per il progetto Notify (Piattaforma di notifica regionale).

## Configurazione

I dati sono salvati su DB [PostgreSQL](https://www.postgresql.org/), creare lo schema `unpaudit` ed eseguire lo script di creazione delle tabelle contenuto in `notifysandb` 

## Installazione

* Compilare i sorgenti utilizzando apache ant, viene generato un file .tar (es: preferencessrv-2.1.0.tar)
* Estrarre il file .tar nella directory /appserv/unp/notify/preferences
* Eseguire il comando npm install per installare le dipendenze
* Eseguire lo script preferences

## Differenze da notificatore cittadini
Cambio della gestione delle preferenze dell'utente. 
Non più presenti sul database ma presenti su applicativo configuratore