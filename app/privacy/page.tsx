import Link from "next/link";

export const metadata = {
  title: "Informativa sulla privacy | MyPersonalWish",
  description: "Informazioni sul trattamento dei dati personali su MyPersonalWish.",
};

const sections = [
  {
    title: "1. Titolare del trattamento",
    body: (
      <>
        <p>Il titolare del trattamento è <strong>Enrico Serra</strong>, ideatore e gestore di MyPersonalWish.</p>
        <p>Per richieste relative ai dati personali: <a href="mailto:mypersonalwish.privacy@gmail.com">mypersonalwish.privacy@gmail.com</a>.</p>
      </>
    ),
  },
  {
    title: "2. Dati trattati",
    body: (
      <>
        <p>In base alle funzioni utilizzate, MyPersonalWish può trattare:</p>
        <ul>
          <li>dati dell’account: indirizzo email, credenziali gestite dal servizio di autenticazione, nome visualizzato e nome utente;</li>
          <li>dati del profilo inseriti volontariamente: nome, cognome, città, data di nascita (se inserita nel profilo), immagine del profilo e preferenze di visibilità;</li>
          <li>contenuti delle liste: titoli, descrizioni, prodotti, link, immagini e file eventualmente importati;</li>
          <li>dati relativi ad amicizie, gruppi, inviti, richieste, partecipazione alle liste, prenotazioni e acquisti segnalati;</li>
          <li>dati tecnici necessari al funzionamento, alla sicurezza e alla gestione delle sessioni.</li>
        </ul>
        <p>Non inserire nelle liste informazioni personali o particolari di altre persone senza averne titolo.</p>
      </>
    ),
  },
  {
    title: "3. Finalità e basi giuridiche",
    body: (
      <>
        <p>I dati sono utilizzati per creare e gestire gli account, permettere la creazione e la condivisione delle liste, gestire amicizie e gruppi, consentire le prenotazioni e mostrare le preferenze di visibilità scelte dall’utente.</p>
        <p>Per le funzioni richieste dall’utente, la base giuridica da verificare e documentare è l’esecuzione del servizio richiesto o di misure precontrattuali. Per sicurezza, prevenzione degli abusi e manutenzione possono rilevare i legittimi interessi del titolare. Eventuali trattamenti facoltativi basati sul consenso saranno accompagnati da una richiesta specifica.</p>
        <p>I dati non devono essere utilizzati per finalità ulteriori incompatibili con quelle indicate.</p>
      </>
    ),
  },
  {
    title: "4. Visibilità e condivisione",
    body: (
      <>
        <p>MyPersonalWish permette di condividere liste con link e con altri utenti. La visibilità di liste, partecipanti, prenotazioni, profilo e rete di amicizie dipende dalle impostazioni selezionate e dalle regole mostrate nell’app.</p>
        <p>Chi riceve un link può visualizzare i contenuti resi accessibili tramite quel link. L’utente è responsabile di verificare le impostazioni di condivisione prima di diffondere un link.</p>
      </>
    ),
  },
  {
    title: "5. Fornitori e destinatari",
    body: (
      <>
        <p>L’applicazione utilizza <strong>Supabase</strong> per autenticazione, database e archiviazione delle immagini e <strong>Vercel</strong> per la distribuzione e l’hosting dell’applicazione. Questi fornitori possono trattare dati per erogare i rispettivi servizi secondo i relativi accordi e documenti privacy.</p>
        <p>Quando l’utente richiede il recupero automatico dei dati di un prodotto, il link inserito viene aperto dal server dell’applicazione per leggere le informazioni pubblicamente disponibili sulla pagina del negozio. Il sito del negozio contattato può quindi ricevere la richiesta proveniente dall’infrastruttura che ospita l’applicazione.</p>
        <p>Prima della pubblicazione definitiva devono essere verificati i ruoli contrattuali dei fornitori, la localizzazione effettiva dei dati, gli eventuali sub-responsabili e le garanzie applicabili ai trasferimenti fuori dallo Spazio economico europeo.</p>
      </>
    ),
  },
  {
    title: "6. Conservazione",
    body: (
      <>
        <p>I dati sono conservati per il tempo necessario a fornire le funzioni richieste e a gestire l’account. I tempi specifici per account inattivi, cancellazione dell’account, backup, log tecnici, richieste di assistenza e obblighi di legge devono essere definiti e comunicati prima della pubblicazione definitiva.</p>
      </>
    ),
  },
  {
    title: "7. Conferimento dei dati",
    body: (
      <>
        <p>L’indirizzo email e i dati necessari all’account sono indispensabili per registrarsi e accedere alle funzioni riservate. I dati del profilo e i contenuti delle liste sono facoltativi, salvo quelli necessari per la specifica funzione scelta. Se non vengono forniti i dati necessari, alcune funzioni potrebbero non essere disponibili.</p>
      </>
    ),
  },
  {
    title: "8. Diritti dell’interessato",
    body: (
      <>
        <p>Nei casi previsti dal GDPR, è possibile chiedere accesso ai dati, rettifica, cancellazione, limitazione del trattamento, portabilità e opporsi ai trattamenti basati sul legittimo interesse. Quando il trattamento si basa sul consenso, è possibile revocarlo in qualsiasi momento, senza pregiudicare quanto effettuato prima della revoca.</p>
        <p>Per esercitare i diritti: <a href="mailto:mypersonalwish.privacy@gmail.com">mypersonalwish.privacy@gmail.com</a>. È inoltre possibile proporre reclamo al <a href="https://www.garanteprivacy.it/" target="_blank" rel="noreferrer">Garante per la protezione dei dati personali</a>.</p>
      </>
    ),
  },
  {
    title: "9. Sicurezza e decisioni automatizzate",
    body: (
      <>
        <p>Sono adottate misure tecniche e organizzative per proteggere account, contenuti e accessi. Nessuna decisione con effetti giuridici o analogamente significativi viene presa unicamente tramite processi decisionali automatizzati, salvo eventuali future modifiche comunicate agli utenti.</p>
      </>
    ),
  },
  {
    title: "10. Cookie e archiviazione sul dispositivo",
    body: (
      <>
        <p>Per mantenere la sessione di accesso, l’applicazione utilizza cookie tecnici gestiti dal servizio di autenticazione. La funzione “Ricordami su questo dispositivo”, se selezionata, memorizza inoltre l’indirizzo email nel dispositivo dell’utente tramite l’archiviazione locale del browser; è possibile disattivarla togliendo la selezione al successivo accesso.</p>
        <p>La configurazione effettiva dei cookie e l’eventuale presenza di strumenti di misurazione o contenuti di terze parti devono essere verificate prima della pubblicazione definitiva.</p>
      </>
    ),
  },
  {
    title: "11. Minori",
    body: (
      <>
        <p>La creazione di un account MyPersonalWish è riservata alle persone che hanno compiuto 18 anni. In fase di registrazione viene richiesta la data di nascita per verificare il requisito di età; il controllo viene effettuato anche lato server e il dato usato per la verifica viene rimosso dai metadati Auth prima che l’account sia creato. Separatamente, l’utente può scegliere di inserire la propria data di nascita nella sezione profilo: in tal caso viene conservata nel profilo e la sua visibilità è regolata dalle impostazioni dedicate. Le liste accessibili tramite link potrebbero comunque essere visualizzate da persone non registrate: chi condivide un link deve prestare attenzione ai contenuti e alle informazioni personali eventualmente inserite.</p>
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <main className="privacyPage">
      <header className="privacyPageHeader">
        <Link href="/" className="privacyBack">← Torna a MyPersonalWish</Link>
        <img src="/mypersonalwish-logo-horizontal.png" alt="MyPersonalWish" />
      </header>
      <article className="privacyDocument">
        <p className="privacyEyebrow">TRASPARENZA E PROTEZIONE DEI DATI</p>
        <h1>Informativa sulla privacy</h1>
        <p className="privacyLead">Questa pagina descrive in modo semplice quali dati possono essere trattati quando utilizzi MyPersonalWish e per quali finalità.</p>
        <div className="privacyDraftNotice">
          <strong>Bozza da completare prima della pubblicazione definitiva</strong>
          <span>Questa versione è ancora in fase di completamento. Devono essere verificati i tempi di conservazione, i dettagli contrattuali dei fornitori, la localizzazione dei dati e gli eventuali trasferimenti internazionali. Occorre inoltre completare la verifica delle impostazioni effettive di cookie, backup e cancellazione dei dati.</span>
        </div>
        {sections.map((section) => (
          <section className="privacyDocumentSection" key={section.title}>
            <h2>{section.title}</h2>
            {section.body}
          </section>
        ))}
        <p className="privacyLastUpdate">Ultimo aggiornamento: 27 novembre 2026</p>
        <p className="privacyContact">Contatto privacy: <a href="mailto:mypersonalwish.privacy@gmail.com">mypersonalwish.privacy@gmail.com</a></p>
      </article>
    </main>
  );
}
