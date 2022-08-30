## Preferences

Il cittadino per poter ricevere notifiche, deve prima impostare i suoi contatti digitali e poi le sue preferenze per il servizio **bollo_auto_pref**.
  
  
1. Il cittadino dovra impostare i suoi contatti digitali all'API:   
    **PUT** *api/v1/users/PPPPLT80R10M082K/preferences/bollo_auto_pref*  
  esempio body:  
  ```
{ 
	 "sms": "333312412", 
	 "phone": "333998800", 
	 "email": "prova@consulenti.csi.it", 
	 "push": "7f2a370f-6d15-4400-9836-cad", 
	 "language": "it_IT"   
}  
 ``` 

Così il cittadino con il codice fiscale **PPPPLT80R10M082K** avrà impostato i suoi contatti digitali su cui essere contattato.  

2. Successivamente il cittadino potrà scegliere le canalità su cui essere contattato, mettiamo esempio di un cittadino che vuole essere contattato solamente tramite notifiche push.  
      
    Api da contattatare: **PUT** *api/v1/users/PPPPLT80R10M082K/preferences/bollo_auto_pref*  

```  
 { "channels": "push" } 
 ```  
 
In questo modo il servizio censito su Preferences con il nome di *bollo_auto_pref*, che ha abilitato le opportune canalità in fase di registrazione, può inviare messaggi al cittadino **PPPPLT80R10M082K** ma lui le riceverà **solamente** su push, in quanto ha abilitato solo le push per quel servizio.  