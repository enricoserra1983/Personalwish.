"use client";

import { useMemo, useState } from "react";
import { Gift, Heart, Plus, Users, Link2, Settings2, Eye, EyeOff, ShoppingBag, LockKeyhole, Sparkles } from "lucide-react";

type Wish = { id: number; title: string; note: string; price: string; reserved: boolean; emoji: string };
type Privacy = {
  ownerSeesParticipants: boolean;
  participantsSeeParticipants: boolean;
  ownerSeesReservations: boolean;
  participantsSeeReservations: boolean;
  ownerSeesBuyer: boolean;
  participantsSeeBuyer: boolean;
};

const initialWishes: Wish[] = [
  { id: 1, title: "Cuffie wireless", note: "Con cancellazione del rumore", price: "€ 89,90", reserved: false, emoji: "🎧" },
  { id: 2, title: "Libro illustrato", note: "Edizione con copertina rigida", price: "€ 24,00", reserved: true, emoji: "📚" },
  { id: 3, title: "Zaino da viaggio", note: "Capienza 30 litri", price: "€ 59,00", reserved: false, emoji: "🎒" },
];

const defaults: Privacy = {
  ownerSeesParticipants: true,
  participantsSeeParticipants: true,
  ownerSeesReservations: false,
  participantsSeeReservations: true,
  ownerSeesBuyer: false,
  participantsSeeBuyer: true,
};

export default function Home() {
  const [tab, setTab] = useState<"lists" | "groups" | "settings">("lists");
  const [wishes, setWishes] = useState(initialWishes);
  const [privacy, setPrivacy] = useState(defaults);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [newWish, setNewWish] = useState("");
  const [copied, setCopied] = useState(false);
  const reservedCount = useMemo(() => wishes.filter(w => w.reserved).length, [wishes]);

  function addWish() {
    if (!newWish.trim()) return;
    setWishes([...wishes, { id: Date.now(), title: newWish.trim(), note: "Aggiungi una descrizione", price: "Da definire", reserved: false, emoji: "🎁" }]);
    setNewWish("");
  }
  function toggleReserved(id: number) {
    setWishes(wishes.map(w => w.id === id ? { ...w, reserved: !w.reserved } : w));
  }
  function togglePrivacy(key: keyof Privacy) {
    setPrivacy(p => {
      const next = { ...p, [key]: !p[key] };
      // If buyer identity is visible, reservation status must also be visible to the same audience.
      if (key === "ownerSeesBuyer" && next.ownerSeesBuyer) next.ownerSeesReservations = true;
      if (key === "participantsSeeBuyer" && next.participantsSeeBuyer) next.participantsSeeReservations = true;
      return next;
    });
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <a className="brand" href="#"><span className="brandIcon"><Gift size={21}/></span><span>Personal<span className="brandAccent">Wish</span></span></a>
        <div className="workspaceLabel">IL TUO SPAZIO</div>
        <button className={`navItem ${tab === "lists" ? "active" : ""}`} onClick={() => setTab("lists")}><Heart size={18}/> Le mie liste <span className="navCount">2</span></button>
        <button className={`navItem ${tab === "groups" ? "active" : ""}`} onClick={() => setTab("groups")}><Users size={18}/> I miei gruppi</button>
        <button className={`navItem ${tab === "settings" ? "active" : ""}`} onClick={() => setTab("settings")}><Settings2 size={18}/> Impostazioni</button>
        <div className="sideBottom"><div className="avatar">M</div><div><b>Mario Rossi</b><small>Account demo</small></div><span className="onlineDot"/></div>
      </aside>

      <section className="content">
        <header className="topbar"><div className="mobileBrand"><Gift size={20}/> PersonalWish</div><div className="crumb">Il tuo spazio <span>/</span> {tab === "lists" ? "Le mie liste" : tab === "groups" ? "I miei gruppi" : "Impostazioni"}</div><div className="topActions"><span className="demoPill"><span/> Anteprima</span><div className="avatar small">M</div></div></header>

        {tab === "lists" && <>
          <div className="welcome"><div><div className="eyebrow">LA TUA WISHLIST</div><h1>I desideri prendono forma.</h1><p>Crea la tua lista e condividila con le persone a cui tieni.</p></div><button className="primary"><Plus size={17}/> Nuova lista</button></div>
          <div className="listHero">
            <div className="heroCopy"><div className="listTag"><Sparkles size={13}/> LISTA PERSONALE</div><h2>Idee regalo per me</h2><p>Una raccolta di cose che mi piacerebbe ricevere.</p><div className="heroMeta"><span><Gift size={15}/> {wishes.length} desideri</span><span><Users size={15}/> 4 partecipanti</span></div><button className="shareButton" onClick={() => { navigator.clipboard?.writeText(window.location.href + "lista/demo"); setCopied(true); setTimeout(() => setCopied(false), 1800); }}><Link2 size={16}/> {copied ? "Link copiato!" : "Condividi lista"}</button></div>
            <div className="heroArt"><div className="orb orbOne"/><div className="orb orbTwo"/><div className="giftBox">🎁</div><div className="floating f1">💝</div><div className="floating f2">✨</div><div className="floating f3">🎀</div></div>
          </div>
          <div className="sectionHead"><div><h3>I tuoi desideri</h3><p>{reservedCount} già prenotati · {wishes.length - reservedCount} ancora disponibili</p></div><button className="textButton" onClick={() => setShowPrivacy(!showPrivacy)}><Settings2 size={16}/> Privacy lista</button></div>
          <div className="addRow"><input value={newWish} onChange={e => setNewWish(e.target.value)} onKeyDown={e => e.key === "Enter" && addWish()} placeholder="Aggiungi un desiderio..." /><button onClick={addWish}><Plus size={17}/> Aggiungi</button></div>
          <div className="wishGrid">{wishes.map((wish, i) => <article className="wishCard" key={wish.id}><div className={`wishImage image${i % 3}`}><span>{wish.emoji}</span><button className="heartBtn"><Heart size={17}/></button></div><div className="wishInfo"><div className="wishTitle">{wish.title}</div><p>{wish.note}</p><div className="wishFoot"><b>{wish.price}</b><button className={wish.reserved ? "reserved" : "reserve"} onClick={() => toggleReserved(wish.id)}>{wish.reserved ? "Prenotato" : "Prenota"}</button></div></div></article>)}</div>
          {showPrivacy && <section className="privacyPanel"><div className="privacyHead"><div><div className="eyebrow">CONTROLLO ACCESSI</div><h3>Privacy di questa lista</h3><p>Scegli cosa possono vedere il creatore e gli altri partecipanti.</p></div><button className="closeBtn" onClick={() => setShowPrivacy(false)}>×</button></div>
            <div className="privacyGroup"><h4>Partecipanti</h4><PrivacyToggle label="Il creatore vede l'elenco dei partecipanti" value={privacy.ownerSeesParticipants} onClick={() => togglePrivacy("ownerSeesParticipants")}/><PrivacyToggle label="I partecipanti vedono l'elenco dei partecipanti" value={privacy.participantsSeeParticipants} onClick={() => togglePrivacy("participantsSeeParticipants")}/></div>
            <div className="privacyGroup"><h4>Prenotazioni</h4><PrivacyToggle label="Il creatore vede quali prodotti sono prenotati" value={privacy.ownerSeesReservations} onClick={() => togglePrivacy("ownerSeesReservations")}/><PrivacyToggle label="I partecipanti vedono quali prodotti sono prenotati" value={privacy.participantsSeeReservations} onClick={() => togglePrivacy("participantsSeeReservations")}/></div>
            <div className="privacyGroup"><h4>Identità di chi prenota</h4><PrivacyToggle label="Il creatore vede chi ha prenotato ciascun prodotto" value={privacy.ownerSeesBuyer} onClick={() => togglePrivacy("ownerSeesBuyer")}/><PrivacyToggle label="I partecipanti vedono chi ha prenotato ciascun prodotto" value={privacy.participantsSeeBuyer} onClick={() => togglePrivacy("participantsSeeBuyer")}/></div>
            <div className="privacyNote"><LockKeyhole size={16}/> Le preferenze saranno applicate anche alle richieste effettuate tramite link. Nella versione completa saranno protette direttamente dal database.</div>
          </section>}
        </>}

        {tab === "groups" && <><div className="welcome"><div><div className="eyebrow">CONDIVISIONE</div><h1>I tuoi gruppi.</h1><p>Raccogli amici e familiari per condividere le liste.</p></div><button className="primary"><Plus size={17}/> Crea gruppo</button></div><div className="groupGrid"><div className="groupCard"><div className="groupEmoji">👨‍👩‍👧‍👦</div><h3>Famiglia</h3><p>6 membri · Gruppo privato</p><button className="outline"><Link2 size={15}/> Invita persone</button></div><div className="groupCard"><div className="groupEmoji">🎄</div><h3>Natale 2026</h3><p>8 membri · Gruppo privato</p><button className="outline"><Link2 size={15}/> Invita persone</button></div><div className="groupCard addGroup"><Plus size={25}/><b>Crea un nuovo gruppo</b><small>Invita chi vuoi, con un link o un codice.</small></div></div></>}

        {tab === "settings" && <><div className="welcome"><div><div className="eyebrow">IL TUO PROFILO</div><h1>Impostazioni.</h1><p>Gestisci il tuo account e le preferenze.</p></div></div><div className="settingsCard"><div className="avatar">M</div><div><b>Mario Rossi</b><p>mario@example.com</p></div><span className="demoPill">Profilo demo</span></div><div className="settingsCard"><LockKeyhole/><div><b>Privacy e sicurezza</b><p>Le liste possono avere impostazioni indipendenti.</p></div></div></>}
        <footer>PersonalWish <span>·</span> I tuoi desideri, condivisi a modo tuo.</footer>
      </section>
    </main>
  );
}

function PrivacyToggle({ label, value, onClick }: { label: string; value: boolean; onClick: () => void }) {
  return <button className="toggleRow" onClick={onClick}><span>{label}</span><span className={`switch ${value ? "on" : ""}`}><i/></span></button>;
}
