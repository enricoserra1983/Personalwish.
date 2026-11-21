# PersonalWish — starter MVP

Prima base del progetto PersonalWish: web app responsive in Next.js, con anteprima interattiva e schema iniziale PostgreSQL per Supabase.

## Cosa contiene
- `app/page.tsx`: interfaccia demo con liste, desideri, gruppi e impostazioni privacy.
- `app/globals.css`: layout responsive desktop/mobile.
- `supabase/schema.sql`: modello iniziale dei dati.
- `.env.example`: variabili da configurare per Supabase.

## Avvio locale
Requisiti: Node.js 20+.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Apri http://localhost:3000.

L'interfaccia attuale è una **demo frontend**: le modifiche sono temporanee e non vengono salvate su un server. Il pulsante di condivisione copia un link dimostrativo, non crea ancora un link pubblico funzionante.

## Prossime attività necessarie
1. Creare un progetto Supabase e configurare le variabili ambiente.
2. Implementare registrazione, login e profili.
3. Implementare accesso pubblico in sola lettura tramite token casuale.
4. Implementare prenotazioni solo per utenti autenticati.
5. Scrivere e testare le policy RLS e le funzioni server-side per la privacy.
6. Implementare upload immagini, gruppi, inviti e gestione acquisti.
7. Aggiungere test di sicurezza: in particolare verificare che il proprietario non possa ricavare l'identità del partecipante tramite API, query o metadati quando la privacy la nasconde.

## Regole di sicurezza da rispettare
Le impostazioni privacy non devono essere applicate soltanto nascondendo elementi nell'interfaccia. I dati non autorizzati non devono proprio essere restituiti dal database/API. La consultazione tramite link deve essere read-only e non deve rivelare identità o prenotazioni non consentite.
