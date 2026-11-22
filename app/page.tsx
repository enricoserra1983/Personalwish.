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
  is_public: boolean;
  private_access_mode: "all_friends" | "selected";
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
  const [tab, setTab] = useState<"lists" | "friends" | "groups" | "profile" | "settings">("lists");
  const [friends,setFriends] = useState<{user_id:string;display_name:string}[]>([]);
  const [requests,setRequests] = useState<{id:string;requester_id:string;requester_name:string;wishlist_title:string|null}[]>([]);
  const [friendSearch,setFriendSearch] = useState("");
  const [friendResults,setFriendResults] = useState<{user_id:string;display_name:string}[]>([]);
  const [selectedFriends,setSelectedFriends] = useState<string[]>([]);
  const [friendGroups,setFriendGroups] = useState<{group_id:string;group_name:string;member_count:number}[]>([]);
  const [newGroupName,setNewGroupName] = useState("");
  const [activeGroup,setActiveGroup] = useState<string>("");
  const [groupMembers,setGroupMembers] = useState<{user_id:string;display_name:string}[]>([]);
  const [wishlists, setWishlists] = useState<Wishlist[]>([]);
  const [activeId, setActiveId] = useState("");
  const [newListTitle, setNewListTitle] = useState("");
  const [newWish, setNewWish] = useState("");
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);

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
      .select("id,title,description,share_token,is_public,private_access_mode,owner_sees_participants,participants_see_participants,owner_sees_reservations,participants_see_reservations,owner_sees_buyer,participants_see_buyer,wishlist_items(id,title,description,price,image_url,product_url)")
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

  async function loadFriends() {
    const supabase=createClient();
    const [{data:f},{data:r}]=await Promise.all([supabase.rpc("get_my_friends"),supabase.rpc("get_my_friend_requests")]);
    setFriends(f||[]); setRequests(r||[]);
  }

  async function loadFriendGroups() {
    const {data,error}=await createClient().rpc("get_my_friend_groups");
    if(error) setError(error.message); else setFriendGroups(data||[]);
  }

  async function createFriendGroup() {
    if(!newGroupName.trim()) return;
    const {error}=await createClient().rpc("save_friend_group",{p_name:newGroupName.trim(),p_group_id:null});
    if(error) setError(error.message); else {setNewGroupName("");await loadFriendGroups();}
  }

  async function openFriendGroup(id:string) {
    setActiveGroup(id);
    const {data,error}=await createClient().rpc("get_friend_group_members",{p_group_id:id});
    if(error) setError(error.message); else setGroupMembers(data||[]);
  }

  async function toggleGroupMember(id:string,add:boolean) {
    const {error}=await createClient().rpc("set_friend_group_member",{p_group_id:activeGroup,p_friend_id:id,p_add:add});
    if(error) setError(error.message); else await openFriendGroup(activeGroup);
  }

  async function searchFriends() {
    if(friendSearch.trim().length<2) return;
    const {data,error}=await createClient().rpc("search_personalwish_users",{p_term:friendSearch.trim()});
    if(error) setError(error.message); else setFriendResults(data||[]);
  }

  async function sendFriendRequest(id:string) {
    const {error}=await createClient().rpc("send_friend_request",{p_recipient_id:id,p_share_token:null});
    if(error) setError(error.message); else {setError("Richiesta di amicizia inviata.");setFriendResults([]);setFriendSearch("");}
  }

  async function answerFriendRequest(id:string,accept:boolean) {
    const {error}=await createClient().rpc("respond_friend_request",{p_request_id:id,p_accept:accept});
    if(error) setError(error.message); else await loadFriends();
  }

  async function setListVisibility(isPublic:boolean,mode:"all_friends"|"selected") {
    if(!activeList) return;
    const {error}=await createClient().rpc("set_wishlist_access",{p_wishlist_id:activeList.id,p_is_public:isPublic,p_mode:mode});
    if(error) setError(error.message); else await loadData();
  }

  async function toggleSelectedFriend(id:string,allowed:boolean) {
    if(!activeList) return;
    const {error}=await createClient().rpc("set_wishlist_friend_access",{p_wishlist_id:activeList.id,p_friend_id:id,p_allow:allowed});
    if(error) setError(error.message); else await loadSelectedFriends();
  }

  async function loadSelectedFriends() {
    if(!activeList) return;
    const {data}=await createClient().from("wishlist_members").select("user_id").eq("wishlist_id",activeList.id);
    setSelectedFriends((data||[]).map(x=>x.user_id));
  }

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

  function getShareUrl() {
    if (!activeList) return "";
    return `${window.location.origin}/lista/${activeList.share_token}`;
  }

  async function copyShareLink() {
    const url = getShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setError("Non riesco a copiare automaticamente il link: " + url);
    }
  }

  async function shareToInstagram() {
    const url = getShareUrl();
    const text = `Guarda la mia lista "${activeList?.title}" su PersonalWish`;
    if (navigator.share) {
      try { await navigator.share({ title: activeList?.title || "PersonalWish", text, url }); }
      catch (err) { if (!(err instanceof Error && err.name === "AbortError")) setError("Condivisione non disponibile."); }
    } else {
      await copyShareLink();
      setError("Link copiato: apri Instagram e incollalo nella chat o nella tua storia.");
    }
  }

  function shareToWhatsApp() {
    const url = getShareUrl();
    const text = `Guarda la mia lista "${activeList?.title}" su PersonalWish: ${url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
  }

  function shareToFacebook() {
    const url = getShareUrl();
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank", "noopener,noreferrer");
  }

  function shareByEmail() {
    const url = getShareUrl();
    const subject = `La mia lista ${activeList?.title} su PersonalWish`;
    const body = `Ciao! Guarda la mia lista dei desideri: ${url}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <a className="brand" href="/"><span className="brandIcon"><Gift size={21}/></span><span>Personal<span className="brandAccent">Wish</span></span></a>
        <div className="workspaceLabel">IL TUO SPAZIO</div>
        <button className={`navItem ${tab === "lists" ? "active" : ""}`} onClick={() => setTab("lists")}><Heart size={18}/> Le mie liste <span className="navCount">{wishlists.length}</span></button>
        <button className={`navItem ${tab === "friends" ? "active" : ""}`} onClick={() => { setTab("friends"); loadFriends(); loadFriendGroups(); }}><Users size={18}/> Amici</button>
        <button className={`navItem ${tab === "groups" ? "active" : ""}`} onClick={() => setTab("groups")}><Users size={18}/> I miei gruppi</button>
        <button className={`navItem ${tab === "settings" ? "active" : ""}`} onClick={() => setTab("settings")}><Settings2 size={18}/> Impostazioni</button>
        <div className="sideBottom"><div className="avatar">{profileName.charAt(0).toUpperCase()}</div><div><b>{loading ? "Caricamento..." : profileName}</b><small>Account personale</small></div><button className="outline" onClick={signOut}><LogOut size={15}/> Esci</button></div>
      </aside>

      <section className="content">
        <header className="topbar"><a className="mobileBrand" href="/" aria-label="Torna alla pagina iniziale"><Gift size={20}/> PersonalWish</a><div className="crumb">Il tuo spazio <span>/</span> {tab === "lists" ? "Le mie liste" : tab === "friends" ? "Amici" : tab === "groups" ? "I miei gruppi" : tab === "profile" ? "Il mio profilo" : "Impostazioni"}</div><div className="topActions"><span className="demoPill"><span/> Account personale</span><div className="accountMenuWrap"><button type="button" className="avatar small accountAvatar" aria-label="Apri menu account" aria-expanded={showAccountMenu} onClick={() => setShowAccountMenu(v => !v)}>{profileName.charAt(0).toUpperCase()}</button>{showAccountMenu && <div className="accountDropdown"><div className="accountDropdownUser"><b>{profileName}</b><small>{profileEmail}</small></div><button onClick={() => { setTab("profile"); setShowAccountMenu(false); }}><UserRound size={16}/> Il mio profilo</button><button onClick={() => { setTab("settings"); setShowAccountMenu(false); }}><Settings2 size={16}/> Impostazioni</button><button className="accountLogout" onClick={() => { setShowAccountMenu(false); signOut(); }}><LogOut size={16}/> Esci</button></div>}</div></div></header>

        {error && <div className="authError" role="alert">{error}</div>}
        {loading ? <div className="settingsCard"><LoaderCircle size={20}/> Caricamento delle tue liste...</div> : null}

        {tab === "lists" && !loading && <>
          <div className="welcome"><div><div className="eyebrow">LA TUA WISHLIST</div><h1>I desideri prendono forma.</h1><p>Crea le tue liste e condividile con le persone a cui tieni.</p></div></div>
          <div className="addRow">
            <input value={newListTitle} onChange={e => setNewListTitle(e.target.value)} placeholder="Nome della nuova lista..." />
            <button onClick={createWishlist} disabled={busy || !newListTitle.trim()}><Plus size={17}/> Nuova lista</button>
          </div>
          {wishlists.length > 0 && <div className="addRow">
            <select className="wishlistSelect" aria-label="Seleziona lista" value={activeList?.id || ""} onChange={e => setActiveId(e.target.value)}>
              {wishlists.map(list => <option key={list.id} value={list.id}>{list.title}</option>)}
            </select>
          </div>}
          {activeList ? <>
            <div className="listHero">
              <div className="heroCopy"><div className="listTag"><Sparkles size={13}/> LISTA PERSONALE</div><h2>{activeList.title}</h2><p>{activeList.description || "Una raccolta di cose che mi piacerebbe ricevere."}</p><div className="heroMeta"><span><Gift size={15}/> {wishes.length} desideri</span><span><Users size={15}/> {activeList.is_public ? "Lista pubblica" : "Lista privata"}</span></div><button className="shareButton" onClick={() => setShowShareMenu(true)}><Link2 size={16}/> Condividi lista</button></div>
              <div className="heroArt"><div className="orb orbOne"/><div className="orb orbTwo"/><div className="giftBox">🎁</div><div className="floating f1">💝</div><div className="floating f2">✨</div><div className="floating f3">🎀</div></div>
            </div>
            <div className="sectionHead"><div><h3>I tuoi desideri</h3><p>{wishes.length} desideri nella lista</p></div><button className="textButton" onClick={() => setShowPrivacy(!showPrivacy)}><Settings2 size={16}/> Privacy lista</button></div>
            <div className="addRow"><input value={newWish} onChange={e => setNewWish(e.target.value)} onKeyDown={e => e.key === "Enter" && addWish()} placeholder="Aggiungi un desiderio..." /><button onClick={addWish} disabled={busy || !newWish.trim()}><Plus size={17}/> Aggiungi</button></div>
            {wishes.length ? <div className="wishGrid">{wishes.map((wish, i) => <article className="wishCard" key={wish.id}><div className={`wishImage image${i % 3}`}><span>🎁</span></div><div className="wishInfo"><div className="wishTitle">{wish.title}</div><p>{wish.description || "Nessuna descrizione"}</p><div className="wishFoot"><b>{wish.price == null ? "Prezzo da definire" : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(wish.price)}</b><button className="outline" onClick={() => deleteWish(wish.id)} aria-label="Elimina desiderio"><Trash2 size={15}/></button></div></div></article>)}</div> : <div className="settingsCard">Non hai ancora aggiunto desideri a questa lista.</div>}
            {showPrivacy && <section className="privacyPanel"><div className="privacyHead"><div><div className="eyebrow">CONTROLLO ACCESSI</div><h3>Privacy di questa lista</h3><p>Scegli cosa possono vedere il creatore e gli altri partecipanti.</p></div><button className="closeBtn" onClick={() => setShowPrivacy(false)}>×</button></div>
              <div className="privacyGroup"><h4>Accesso alla lista</h4><div className="accessChoice"><button className={activeList.is_public ? "selected" : ""} onClick={() => setListVisibility(true,"selected")}>Pubblica · tutti gli utenti</button><button className={!activeList.is_public && activeList.private_access_mode==="all_friends" ? "selected" : ""} onClick={() => setListVisibility(false,"all_friends")}>Privata · tutti i miei amici</button><button className={!activeList.is_public && activeList.private_access_mode==="selected" ? "selected" : ""} onClick={() => {setListVisibility(false,"selected");loadSelectedFriends();}}>Privata · amici selezionati</button></div>{!activeList.is_public && activeList.private_access_mode==="selected" && <div className="friendChecks"><b>Amici autorizzati</b>{friends.map(friend=><label key={friend.user_id}><input type="checkbox" checked={selectedFriends.includes(friend.user_id)} onChange={e=>toggleSelectedFriend(friend.user_id,e.target.checked)}/>{friend.display_name}</label>)}{friends.length===0 && <small>Non hai ancora amici. Aggiungili dalla sezione Amici.</small>}</div>}</div><div className="privacyGroup"><h4>Visibilità</h4>{privacyLabels.map(({ key, label }) => <PrivacyToggle key={key} label={label} value={activeList[key]} onClick={() => togglePrivacy(key)}/>)}</div>
              <div className="privacyNote"><LockKeyhole size={16}/> Le impostazioni vengono salvate direttamente nel database.</div>
            </section>}
          </> : <div className="settingsCard">Non hai ancora creato una lista. Usa il campo qui sopra per crearne una.</div>}
        </>}

        {tab === "friends" && <><div className="welcome"><div><div className="eyebrow">LA TUA RETE</div><h1>I tuoi amici.</h1><p>Cerca utenti PersonalWish e gestisci le richieste di amicizia.</p></div></div><div className="addRow"><input value={friendSearch} onChange={e=>setFriendSearch(e.target.value)} placeholder="Cerca per nome..." /><button onClick={searchFriends} disabled={friendSearch.trim().length<2}>Cerca</button></div>{friendResults.map(person=><div className="settingsCard" key={person.user_id}><div className="avatar">{person.display_name.charAt(0).toUpperCase()}</div><b>{person.display_name}</b><button className="outline" onClick={()=>sendFriendRequest(person.user_id)}>Aggiungi amico</button></div>)}<h3>Le mie cerchie</h3><p>Crea gruppi personali come Famiglia, Colleghi o Amici stretti.</p><div className="addRow"><input value={newGroupName} onChange={e=>setNewGroupName(e.target.value)} placeholder="Nome della nuova cerchia..." /><button onClick={createFriendGroup} disabled={!newGroupName.trim()}><Plus size={16}/> Crea gruppo</button></div>{friendGroups.map(group=><div className="settingsCard" key={group.group_id}><div style={{flex:1}}><b>{group.group_name}</b><p>{group.member_count} amici</p></div><button className="outline" onClick={()=>openFriendGroup(group.group_id)}>Gestisci</button></div>)}{activeGroup && <section className="privacyPanel"><div className="privacyHead"><div><h3>Componenti del gruppo</h3><p>Seleziona gli amici da inserire in questa cerchia.</p></div><button className="closeBtn" onClick={()=>setActiveGroup("")}>×</button></div>{friends.map(person=><label className="groupFriendRow" key={person.user_id}><input type="checkbox" checked={groupMembers.some(m=>m.user_id===person.user_id)} onChange={e=>toggleGroupMember(person.user_id,e.target.checked)}/>{person.display_name}</label>)}</section>}<h3>Richieste ricevute</h3>{requests.length ? requests.map(req=><div className="settingsCard" key={req.id}><div><b>{req.requester_name}</b><p>{req.wishlist_title ? "Richiesta di amicizia e accesso a: "+req.wishlist_title : "Richiesta di amicizia"}</p></div><button className="outline" onClick={()=>answerFriendRequest(req.id,true)}>Accetta</button><button className="outline" onClick={()=>answerFriendRequest(req.id,false)}>Rifiuta</button></div>) : <div className="settingsCard">Non hai richieste in sospeso.</div>}<h3>I tuoi amici</h3>{friends.length ? friends.map(person=><div className="settingsCard" key={person.user_id}><div className="avatar">{person.display_name.charAt(0).toUpperCase()}</div><b>{person.display_name}</b></div>) : <div className="settingsCard">Non hai ancora amici.</div>}</>}

        {tab === "groups" && <><div className="welcome"><div><div className="eyebrow">CONDIVISIONE</div><h1>I tuoi gruppi.</h1><p>La gestione dei gruppi sarà collegata al database nel prossimo passaggio.</p></div></div><div className="settingsCard">Non ci sono ancora gruppi collegati al tuo account.</div></>}

        {tab === "profile" && <><div className="welcome"><div><div className="eyebrow">ACCOUNT PERSONALE</div><h1>Il mio profilo.</h1><p>Le informazioni associate al tuo account PersonalWish.</p></div></div><div className="settingsCard"><div className="avatar">{profileName.charAt(0).toUpperCase()}</div><div><b>{profileName}</b><p>{profileEmail}</p></div></div></>}
        {tab === "settings" && <><div className="welcome"><div><div className="eyebrow">PREFERENZE</div><h1>Impostazioni.</h1><p>Gestisci la privacy e la sicurezza delle tue liste.</p></div></div><div className="settingsCard"><LockKeyhole/><div><b>Privacy e sicurezza</b><p>Ogni lista può avere impostazioni indipendenti per partecipanti e prenotazioni.</p></div></div></>}

        {showShareMenu && activeList && <div className="shareOverlay" role="presentation" onClick={() => setShowShareMenu(false)}>
          <section className="shareDialog" role="dialog" aria-modal="true" aria-labelledby="shareDialogTitle" onClick={e => e.stopPropagation()}>
            <button className="shareClose" aria-label="Chiudi" onClick={() => setShowShareMenu(false)}>×</button>
            <div className="shareDialogIcon"><Link2 size={21}/></div>
            <h3 id="shareDialogTitle">Condividi la tua lista</h3>
            <p>Invia “{activeList.title}” a chi vuoi.</p>
            <div className="shareOptions">
              <button onClick={shareToWhatsApp}><span className="shareAppIcon whatsapp">W</span><b>WhatsApp</b></button>
              <button onClick={shareToFacebook}><span className="shareAppIcon facebook">f</span><b>Facebook</b></button>
              <button onClick={async () => { const url = getShareUrl(); const text = `Guarda la mia lista "${activeList.title}" su PersonalWish: ${url}`; if (navigator.share) { try { await navigator.share({ title: activeList.title, text, url }); } catch (err) { if (!(err instanceof Error && err.name === "AbortError")) setError("Condivisione non disponibile."); } } else { await copyShareLink(); setError("Link copiato: apri Messenger e incollalo nella conversazione."); } }}><span className="shareAppIcon messenger"><span>ϟ</span></span><b>Messenger</b></button>
              <button onClick={shareToInstagram}><span className="shareAppIcon instagram">◎</span><b>Instagram</b></button>
              <button onClick={shareByEmail}><span className="shareAppIcon email">✉</span><b>Email</b></button>
              <button onClick={copyShareLink}><span className="shareAppIcon copy"><Link2 size={19}/></span><b>{copied ? "Copiato!" : "Copia link"}</b></button>
              <button onClick={() => window.open(getShareUrl(), "_blank", "noopener,noreferrer")}><span className="shareAppIcon browser">↗</span><b>Apri link</b></button>
            </div>
            <div className="shareLinkPreview"><span>{getShareUrl()}</span><button onClick={copyShareLink}>{copied ? "Copiato" : "Copia"}</button></div>
            <small className="shareHint">Instagram potrebbe richiedere di incollare il link nella chat o nella storia dopo aver aperto la condivisione.</small>
          </section>
        </div>}

        <footer>PersonalWish <span>·</span> I tuoi desideri, condivisi a modo tuo.</footer>
      </section>
    </main>
  );
}

function PrivacyToggle({ label, value, onClick }: { label: string; value: boolean; onClick: () => void }) {
  return <button className="toggleRow" onClick={onClick}><span>{label}</span><span className={`switch ${value ? "on" : ""}`}><i/></span></button>;
}
