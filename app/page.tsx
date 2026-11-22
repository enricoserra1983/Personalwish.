"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Gift, Heart, Plus, Users, Link2, Settings2, LockKeyhole, Sparkles, LogOut, LoaderCircle, Trash2, UserRound, ChevronDown } from "lucide-react";

type WishItem = {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  image_url: string | null;
  product_url: string | null;
};
type Wishlist = {
  id: string;
  title: string;
  description: string | null;
  share_token: string;
  owner_sees_participants: boolean;
  participants_see_participants: boolean;
  owner_sees_reservations: boolean;
  participants_see_reservations: boolean;
  owner_sees_buyer: boolean;
  participants_see_buyer: boolean;
  wishlist_items: WishItem[];
};
type PrivacyKey =
  | "owner_sees_participants"
  | "participants_see_participants"
  | "owner_sees_reservations"
  | "participants_see_reservations"
  | "owner_sees_buyer"
  | "participants_see_buyer";

const privacyLabels: { key: PrivacyKey; label: string }[] = [
  { key: "owner_sees_participants", label: "Il creatore vede l'elenco dei partecipanti" },
  { key: "participants_see_participants", label: "I partecipanti vedono l'elenco dei partecipanti" },
  { key: "owner_sees_reservations", label: "Il creatore vede quali prodotti sono prenotati" },
  { key: "participants_see_reservations", label: "I partecipanti vedono quali prodotti sono prenotati" },
  { key: "owner_sees_buyer", label: "Il creatore vede chi ha prenotato ciascun prodotto" },
  { key: "participants_see_buyer", label: "I partecipanti vedono chi ha prenotato ciascun prodotto" },
];

export default function Home() {
  const router = useRouter();
  const [profileName, setProfileName] = useState("Utente");
  const [profileEmail, setProfileEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"lists" | "groups" | "profile" | "settings">("lists");
  const [wishlists, setWishlists] = useState<Wishlist[]>([]);
  const [activeId, setActiveId] = useState("");
  const [newListTitle, setNewListTitle] = useState("");
  const [newWish, setNewWish] = useState("");
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [copied, setCopied] = useState(false);\n  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const activeList = wishlists.find(list => list.id === activeId) || wishlists[0] || null;
  const wishes = activeList?.wishlist_items || [];
  const reservedCount = 0;

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      router.replace("/login");
      return;
    }
    const user = auth.user;
    const name = user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "Utente";
    setProfileName(String(name));
    setProfileEmail(user.email || "");

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: user.id,
      display_name: String(name),
    }, { onConflict: "id" });
    if (profileError) throw profileError;

    const { data, error: listError } = await supabase
      .from("wishlists")
      .select("id,title,description,share_token,owner_sees_participants,participants_see_participants,owner_sees_reservations,participants_see_reservations,owner_sees_buyer,participants_see_buyer,wishlist_items(id,title,description,price,image_url,product_url)")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    if (listError) throw listError;
    const rows = (data || []) as unknown as Wishlist[];
    setWishlists(rows);
    setActiveId(current => rows.some(row => row.id === current) ? current : rows[0]?.id || "");
    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadData().catch(err => {
      const detail = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : err instanceof Error ? err.message : String(err);
      setError("Errore nel caricamento: " + detail);
      setLoading(false);
    });
  }, [loadData]);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  async function createWishlist() {
    const title = newListTitle.trim();
    if (!title) return;
    setBusy(true); setError("");
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { router.replace("/login"); return; }
    const { data, error: insertError } = await supabase.from("wishlists").insert({
      owner_id: auth.user.id,
      title,
      description: "Una raccolta di cose che mi piacerebbe ricevere.",
    }).select("id").single();
    if (insertError) setError(insertError.message);
    else {
      setNewListTitle("");
      await loadData();
      if (data?.id) setActiveId(data.id);
    }
    setBusy(false);
  }

  async function addWish() {
    if (!newWish.trim() || !activeList) return;
    setBusy(true); setError("");
    const supabase = createClient();
    const { error: insertError } = await supabase.from("wishlist_items").insert({
      wishlist_id: activeList.id,
      title: newWish.trim(),
      description: "",
      position: wishes.length,
    });
    if (insertError) setError(insertError.message);
    else { setNewWish(""); await loadData(); }
    setBusy(false);
  }

  async function deleteWish(id: string) {
    if (!activeList || !window.confirm("Vuoi eliminare questo desiderio?")) return;
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("wishlist_items").delete().eq("id", id);
    if (deleteError) setError(deleteError.message);
    else await loadData();
  }

  async function togglePrivacy(key: PrivacyKey) {
    if (!activeList) return;
    const next = { [key]: !activeList[key] } as Record<string, boolean>;
    if (key === "owner_sees_buyer" && next[key]) next.owner_sees_reservations = true;
    if (key === "owner_sees_reservations" && !next[key]) next.owner_sees_buyer = false;
    if (key === "participants_see_buyer" && next[key]) next.participants_see_reservations = true;
    if (key === "participants_see_reservations" && !next[key]) next.participants_see_buyer = false;
    const supabase = createClient();
    const { error: updateError } = await supabase.from("wishlists").update(next).eq("id", activeList.id);
    if (updateError) setError(updateError.message);
    else await loadData();
  }

  async function shareList() {
    if (!activeList) return;
    const url = `${window.location.origin}/lista/${activeList.share_token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Non riesco a copiare il link. Puoi copiarlo dalla barra degli indirizzi: " + url);
    }
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <a className="brand" href="/"><span className="brandIcon"><Gift size={21}/></span><span>Personal<span className="brandAccent">Wish</span></span></a>
        <div className="workspaceLabel">IL TUO SPAZIO</div>
        <button className={`navItem ${tab === "lists" ? "active" : ""}`} onClick={() => setTab("lists")}><Heart size={18}/> Le mie liste <span className="navCount">{wishlists.length}</span></button>
        <button className={`navItem ${tab === "groups" ? "active" : ""}`} onClick={() => setTab("groups")}><Users size={18}/> I miei gruppi</button>
        <button className={`navItem ${tab === "settings" ? "active" : ""}`} onClick={() => setTab("settings")}><Settings2 size={18}/> Impostazioni</button>
        <div className="sideBottom"><div className="avatar">{profileName.charAt(0).toUpperCase()}</div><div><b>{loading ? "Caricamento..." : profileName}</b><small>Account personale</small></div><button className="outline" onClick={signOut}><LogOut size={15}/> Esci</button></div>
      </aside>

      <section className="content">
        <header className="topbar"><div className="mobileBrand"><Gift size={20}/> PersonalWish</div><div className="crumb">Il tuo spazio <span>/</span> {tab === "lists" ? "Le mie liste" : tab === "groups" ? "I miei gruppi" : tab === "profile" ? "Il mio profilo" : "Impostazioni"}</div><div className="topActions"><span className="demoPill"><span/> Account personale</span><div className="accountMenuWrap"><button type="button" className="avatar small accountAvatar" aria-label="Apri menu account" aria-expanded={showAccountMenu} onClick={() => setShowAccountMenu(v => !v)}>{profileName.charAt(0).toUpperCase()}</button>{showAccountMenu && <div className="accountDropdown"><div className="accountDropdownUser"><b>{profileName}</b><small>{profileEmail}</small></div><button onClick={() => { setTab("profile"); setShowAccountMenu(false); }}><UserRound size={16}/> Il mio profilo</button><button onClick={() => { setTab("settings"); setShowAccountMenu(false); }}><Settings2 size={16}/> Impostazioni</button><button className="accountLogout" onClick={() => { setShowAccountMenu(false); signOut(); }}><LogOut size={16}/> Esci</button></div>}</div></div></header>

        {error && <div className="authError" role="alert">{error}</div>}
        {loading ? <div className="settingsCard"><LoaderCircle size={20}/> Caricamento delle tue liste...</div> : null}

        {tab === "lists" && !loading && <>
          <div className="welcome"><div><div className="eyebrow">LA TUA WISHLIST</div><h1>I desideri prendono forma.</h1><p>Crea le tue liste e condividile con le persone a cui tieni.</p></div></div>
          <div className="addRow">
            <input value={newListTitle} onChange={e => setNewListTitle(e.target.value)} placeholder="Nome della nuova lista..." />
            <button onClick={createWishlist} disabled={busy || !newListTitle.trim()}><Plus size={17}/> Nuova lista</button>
          </div>
          {wishlists.length > 0 && <div className="addRow">
            <select aria-label="Seleziona lista" value={activeList?.id || ""} onChange={e => setActiveId(e.target.value)}>
              {wishlists.map(list => <option key={list.id} value={list.id}>{list.title}</option>)}
            </select>
          </div>}
          {activeList ? <>
            <div className="listHero">
              <div className="heroCopy"><div className="listTag"><Sparkles size={13}/> LISTA PERSONALE</div><h2>{activeList.title}</h2><p>{activeList.description || "Una raccolta di cose che mi piacerebbe ricevere."}</p><div className="heroMeta"><span><Gift size={15}/> {wishes.length} desideri</span><span><Users size={15}/> Lista privata</span></div><button className="shareButton" onClick={shareList}><Link2 size={16}/> {copied ? "Link copiato!" : "Condividi lista"}</button></div>
              <div className="heroArt"><div className="orb orbOne"/><div className="orb orbTwo"/><div className="giftBox">🎁</div><div className="floating f1">💝</div><div className="floating f2">✨</div><div className="floating f3">🎀</div></div>
            </div>
            <div className="sectionHead"><div><h3>I tuoi desideri</h3><p>{wishes.length} desideri nella lista</p></div><button className="textButton" onClick={() => setShowPrivacy(!showPrivacy)}><Settings2 size={16}/> Privacy lista</button></div>
            <div className="addRow"><input value={newWish} onChange={e => setNewWish(e.target.value)} onKeyDown={e => e.key === "Enter" && addWish()} placeholder="Aggiungi un desiderio..." /><button onClick={addWish} disabled={busy || !newWish.trim()}><Plus size={17}/> Aggiungi</button></div>
            {wishes.length ? <div className="wishGrid">{wishes.map((wish, i) => <article className="wishCard" key={wish.id}><div className={`wishImage image${i % 3}`}><span>🎁</span></div><div className="wishInfo"><div className="wishTitle">{wish.title}</div><p>{wish.description || "Nessuna descrizione"}</p><div className="wishFoot"><b>{wish.price == null ? "Prezzo da definire" : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(wish.price)}</b><button className="outline" onClick={() => deleteWish(wish.id)} aria-label="Elimina desiderio"><Trash2 size={15}/></button></div></div></article>)}</div> : <div className="settingsCard">Non hai ancora aggiunto desideri a questa lista.</div>}
            {showPrivacy && <section className="privacyPanel"><div className="privacyHead"><div><div className="eyebrow">CONTROLLO ACCESSI</div><h3>Privacy di questa lista</h3><p>Scegli cosa possono vedere il creatore e gli altri partecipanti.</p></div><button className="closeBtn" onClick={() => setShowPrivacy(false)}>×</button></div>
              <div className="privacyGroup"><h4>Visibilità</h4>{privacyLabels.map(({ key, label }) => <PrivacyToggle key={key} label={label} value={activeList[key]} onClick={() => togglePrivacy(key)}/>)}</div>
              <div className="privacyNote"><LockKeyhole size={16}/> Le impostazioni vengono salvate direttamente nel database.</div>
            </section>}
          </> : <div className="settingsCard">Non hai ancora creato una lista. Usa il campo qui sopra per crearne una.</div>}
        </>}

        {tab === "groups" && <><div className="welcome"><div><div className="eyebrow">CONDIVISIONE</div><h1>I tuoi gruppi.</h1><p>La gestione dei gruppi sarà collegata al database nel prossimo passaggio.</p></div></div><div className="settingsCard">Non ci sono ancora gruppi collegati al tuo account.</div></>}

        {tab === "profile" && <><div className="welcome"><div><div className="eyebrow">ACCOUNT PERSONALE</div><h1>Il mio profilo.</h1><p>Le informazioni associate al tuo account PersonalWish.</p></div></div><div className="settingsCard"><div className="avatar">{profileName.charAt(0).toUpperCase()}</div><div><b>{profileName}</b><p>{profileEmail}</p></div></div></>}
        {tab === "settings" && <><div className="welcome"><div><div className="eyebrow">PREFERENZE</div><h1>Impostazioni.</h1><p>Gestisci la privacy e la sicurezza delle tue liste.</p></div></div><div className="settingsCard"><LockKeyhole/><div><b>Privacy e sicurezza</b><p>Ogni lista può avere impostazioni indipendenti per partecipanti e prenotazioni.</p></div></div></>}
        <footer>PersonalWish <span>·</span> I tuoi desideri, condivisi a modo tuo.</footer>
      </section>
    </main>
  );
}

function PrivacyToggle({ label, value, onClick }: { label: string; value: boolean; onClick: () => void }) {
  return <button className="toggleRow" onClick={onClick}><span>{label}</span><span className={`switch ${value ? "on" : ""}`}><i/></span></button>;
}
