## Descrizione

Il progetto _broadcastsan_ ha il compito di inviare in maniera batch i messaggi
Il progetto _broadcastsan_ contiene un elenco di batch per gestire la storicizzazione dei dati

## Configurazione

## Installazione

* Compilare i sorgenti utilizzando [apache ant](https://ant.apache.org/), viene generato un file .tar (es: _auditsrv-1.0.0.tar_)
* Estrarre il file .tar nella directory `/appserv/unp/notify/audit`
* Eseguire il comando `npm install` per installare le dipendenze

## Differenze da notificatore cittadini
Creazione di batchs di storicizzazione di varie tabelle
Creazione di schedulatore di messaggi da inviare