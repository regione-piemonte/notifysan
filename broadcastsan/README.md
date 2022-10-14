## Descrizione

Il progetto _audit_ ha il compito di tracciare le attività degli utenti che operano nella suite Notify (Piattaforma di notifica regionale).

## Configurazione

I dati sono salvati su DB [PostgreSQL](https://www.postgresql.org/), creare lo schema `unpaudit` ed eseguire lo script di creazione delle tabelle contenuto in `notifysandb` 

## Installazione

* Compilare i sorgenti utilizzando [apache ant](https://ant.apache.org/), viene generato un file .tar (es: _auditsrv-1.0.0.tar_)
* Estrarre il file .tar nella directory `/appserv/unp/notify/audit`
* Eseguire il comando `npm install` per installare le dipendenze
* Eseguire lo script dello schema `unpaudit`
