"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Gift, ExternalLink, LoaderCircle, Heart, LockKeyhole, CheckCircle2, LayoutGrid, List, X, ChevronDown, ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type SharedItem = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  product_url: string | null;
  price: number | null;
  currency: string;
  reserved?: boolean;
  purchased?: boolean;
  reserved_by?: string | null;
};
type SharedWishlist = {
  id: string;
  title: string;
  description: string | null;
  items: SharedItem[];
  participants?: { user_id: string; display_name: string }[];
  owner_id?: string;
};

export default function SharedWishlistPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [list, setList] = useState<SharedWishlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [reservedByMe, setReservedByMe] = useState<string[]>([]);
  const [purchasedByMe, setPurchasedByMe] = useState<string[]>([]);
  const [reservedItems, setReservedItems] = useState<string[]>([]);
  const [reservingId, setReservingId] = useState<string | null>(null);
  const [reservationMessage, setReservationMessage] = useState("");
  const [displayMode, setDisplayMode] = useState<"grid" | "list">("grid");
  const [detailItem, setDetailItem] = useState<SharedItem | null>(null);
  const [participantsOpen, setParticipantsOpen] = useState(false);

  useEffect(() => {
    try {
      const savedMode = window.localStorage.getItem("personalwish-shared-view");
      if (savedMode === "grid" || savedMode === "list") setDisplayMode(savedMode);
    } catch {}
  }, []);

  function changeDisplayMode(mode: "grid" | "list") {
    setDisplayMode(mode);
    try { window.localStorage.setItem("personalwish-shared-view", mode); } catch {}
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data, error: rpcError }, { data: authData }] = await Promise.all([
        supabase.rpc("get_shared_wishlist", { p_share_token: params.token }),
        supabase.auth.getUser(),
      ]);
      const currentUserId = authData.user?.id ?? null;
      setUserId(currentUserId);
      if (rpcError) {
        setError("Non è stato possibile aprire questa lista. Riprova più tardi.");
      } else if (!data) {
        setError("Questa lista non esiste o il link non è valido.");
      } else {
        const wishlist = data as SharedWishlist;
        // Il proprietario non deve mai usare la vista condivisa/partecipante
        // della propria lista: lo riportiamo alla dashboard proprietario.
        if (currentUserId && wishlist.owner_id === currentUserId) {
          router.replace("/?wishlist=" + encodeURIComponent(wishlist.id));
          setLoading(false);
          return;
        }
        setList(wishlist);
        setReservedItems(wishlist.items.filter(item => item.reserved).map(item => item.id));
        if (currentUserId && wishlist.items.length) {
          const { data: mine } = await supabase
            .from("reservations")
            .select("item_id,status")
            .eq("user_id", currentUserId)
            .in("item_id", wishlist.items.map(item => item.id))
            .in("status", ["reserved", "purchased"]);
          setReservedByMe((mine || []).map(row => row.item_id));
          setPurchasedByMe((mine || []).filter(row => row.status === "purchased").map(row => row.item_id));
        }
      }
      setLoading(false);
    }
    if (params.token) load();
  }, [params.token, router]);

  async function cancelReservation(itemId: string) {
    if (!userId || !reservedByMe.includes(itemId)) return;
    setReservingId(itemId);
    setReservationMessage("");
    const supabase = createClient();
    const { data: cancelled, error: cancelError } = await supabase.rpc("set_my_reservation_purchased", {
      p_share_token: params.token,
      p_item_id: itemId,
      p_purchased: false,
    });
    if (cancelError || cancelled !== true) {
      setReservationMessage(cancelError?.message || "Non è stato possibile annullare la prenotazione. Riprova.");
    } else {
      setReservedByMe(current => current.filter(id => id !== itemId));
      setPurchasedByMe(current => current.filter(id => id !== itemId));
      setReservedItems(current => current.filter(id => id !== itemId));
      setList(current => current ? {
        ...current,
        items: current.items.map(item => item.id === itemId ? { ...item, reserved: false, purchased: false, reserved_by: null } : item),
      } : current);
      setDetailItem(current => current?.id === itemId ? null : current);
      setReservationMessage("Prenotazione annullata: il desiderio è nuovamente disponibile.");
    }
    setReservingId(null);
  }

  async function togglePurchased(itemId: string) {
    if (!userId || !reservedByMe.includes(itemId)) return;
    const isPurchased = purchasedByMe.includes(itemId);
    setReservingId(itemId);
    setReservationMessage("");
    const supabase = createClient();
    const { data, error: toggleError } = await supabase.rpc("set_my_reservation_purchased", {
      p_share_token: params.token,
      p_item_id: itemId,
      p_purchased: !isPurchased,
    });
    if (toggleError || data !== true) {
      setReservationMessage(toggleError?.message || "Non è stato possibile aggiornare lo stato del regalo. Riprova.");
    } else if (!isPurchased) {
      setPurchasedByMe(current => current.includes(itemId) ? current : [...current, itemId]);
      setList(current => current ? {
        ...current,
        items: current.items.map(item => item.id === itemId ? { ...item, purchased: true, reserved: true } : item),
      } : current);
      setDetailItem(current => current?.id === itemId ? { ...current, purchased: true, reserved: true } : current);
      setReservationMessage("Regalo segnato come acquistato.");
    } else {
      setPurchasedByMe(current => current.filter(id => id !== itemId));
      setReservedByMe(current => current.filter(id => id !== itemId));
      setReservedItems(current => current.filter(id => id !== itemId));
      setList(current => current ? {
        ...current,
        items: current.items.map(item => item.id === itemId ? { ...item, purchased: false, reserved: false, reserved_by: null } : item),
      } : current);
      setDetailItem(current => current?.id === itemId ? null : current);
      setReservationMessage("Acquisto annullato: il desiderio è nuovamente disponibile.");
    }
    setReservingId(null);
  }

  async function reserveItem(itemId: string) {
    if (!userId) return;
    setReservingId(itemId);
    setReservationMessage("");
    const supabase = createClient();
    const { data, error: reserveError } = await supabase.rpc("reserve_shared_wishlist_item", {
      p_share_token: params.token,
      p_item_id: itemId,
    });
    if (reserveError) {
      setReservationMessage(reserveError.message.includes("Non puoi prenotare")
        ? "Non puoi prenotare un regalo della tua lista."
        : "Non è stato possibile completare la prenotazione. Riprova.");
    } else if (data === true) {
      setReservedByMe(current => [...current, itemId]);
      setReservedItems(current => current.includes(itemId) ? current : [...current, itemId]);
      setReservationMessage("Regalo prenotato! La prenotazione è stata registrata.");
    } else {
      setReservationMessage("Questo regalo è già stato prenotato da un'altra persona.");
    }
    setReservingId(null);
  }

  return (
    <main className="sharedPage">
      <header className="sharedHeader sharedHeaderFriendList">
        <Link href="/?section=friends" className="sharedBackToFriends"><ArrowLeft size={18}/> <span>Torna agli amici</span></Link>
        <Link href="/" className="sharedBrand" aria-label="MyPersonalWish"><img src="/mypersonalwish-logo.svg" alt="" /><b>MyPersonal<span className="brandAccent">Wish</span></b></Link>
      </header>
      {loading ? (
        <div className="sharedState"><LoaderCircle className="sharedSpinner" size={25}/> Caricamento della lista...</div>
      ) : error ? (
        <div className="sharedState sharedError"><Heart size={24}/><h1>Lista non disponibile</h1><p>{error}</p><Link href="/">Vai a MyPersonalWish</Link></div>
      ) : list ? (
        <section className="sharedContent">
          <div className="sharedEyebrow"><Heart size={14}/> LISTA CONDIVISA</div>
          <h1>{list.title}</h1>
          <p className="sharedDescription">{list.description || "Una raccolta di desideri da condividere."}</p>
          <div className="sharedItemsToolbar">
            <div className="sharedCount">{list.items.length} {list.items.length === 1 ? "desiderio" : "desideri"}</div>
            {list.items.length > 0 && (
              <div className="sharedViewSwitch" role="group" aria-label="Visualizzazione prodotti">
                <button type="button" className={displayMode === "grid" ? "selected" : ""} onClick={() => changeDisplayMode("grid")} aria-pressed={displayMode === "grid"}><LayoutGrid size={16}/> Schede</button>
                <button type="button" className={displayMode === "list" ? "selected" : ""} onClick={() => changeDisplayMode("list")} aria-pressed={displayMode === "list"}><List size={16}/> Lista</button>
              </div>
            )}
          </div>
          {list.participants && list.participants.length > 0 && <section className={`sharedParticipants ${participantsOpen ? "isOpen" : ""}`}><button type="button" className="sharedParticipantsToggle" onClick={() => setParticipantsOpen(open => !open)} aria-expanded={participantsOpen}><span><b>Amici che partecipano</b><small>{list.participants.length} {list.participants.length === 1 ? "partecipante" : "partecipanti"}</small></span><ChevronDown size={18} aria-hidden="true"/></button>{participantsOpen && <div className="sharedParticipantsNames">{list.participants.map(person => person.user_id === userId ? <span key={person.user_id} className="sharedParticipantName sharedParticipantSelf" aria-label="Sei tu">Tu</span> : <Link key={person.user_id} href={`/amico/${person.user_id}`} className="sharedParticipantName" title={`Apri il profilo di ${person.display_name}`}>{person.display_name}</Link>)}</div>}</section>}
          {!userId && <div className="sharedSignupNotice"><div><b>Vuoi partecipare anche tu?</b><span>Registrati gratuitamente per vedere chi partecipa e prenotare un desiderio.</span></div><Link href={`/login?next=${encodeURIComponent(`/lista/${params.token}`)}`}>Crea account</Link></div>}
          {reservationMessage && <p className="reservationNotice" role="status">{reservationMessage}</p>}
          {list.items.length ? (
            displayMode === "grid" ? (
              <div className="sharedGrid">
                {list.items.map(item => (
                  <article className="sharedItem" key={item.id}>
                    {item.image_url ? <img src={item.image_url} alt={item.title} className="sharedItemImage"/> : <div className="sharedItemPlaceholder"><Gift size={35}/></div>}
                    <div className="sharedItemBody">
                      <h2>{item.title}</h2>
                      {item.description && <p>{item.description}</p>}
                      <div className="sharedItemBottom">
                        <b>{item.price == null ? "Prezzo non indicato" : new Intl.NumberFormat("it-IT", { style: "currency", currency: item.currency || "EUR" }).format(item.price)}</b>
                        {item.product_url && <a href={item.product_url} target="_blank" rel="noreferrer">Vedi prodotto <ExternalLink size={14}/></a>}
                      </div>
                      <div className="reservationAction">
                        {reservedByMe.includes(item.id) ? (
                          <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                            <button type="button" className="reservedByMe" onClick={() => cancelReservation(item.id)} disabled={reservingId !== null} title="Tocca per annullare la prenotazione" style={{border:0,background:"transparent",cursor:"pointer",font:"inherit",padding:0,opacity:reservingId === item.id ? 0.65 : 1}}>
                              {reservingId === item.id ? "Annullamento..." : <><CheckCircle2 size={16}/> Prenotato da te</>}
                            </button>
                            <button type="button" onClick={() => togglePurchased(item.id)} disabled={reservingId !== null} aria-pressed={purchasedByMe.includes(item.id)} style={{minHeight:32,minWidth:104,padding:"6px 11px",borderRadius:7,border:"1px solid",borderColor:purchasedByMe.includes(item.id)?"#dc3545":"#d7dce3",background:purchasedByMe.includes(item.id)?"#dc3545":"#f1f3f5",color:purchasedByMe.includes(item.id)?"#fff":"#687386",fontSize:12,fontWeight:700,cursor:"pointer",opacity:reservingId === item.id ? 0.65 : 1}}>
                              {reservingId === item.id ? "Attendi..." : "Acquistato"}
                            </button>
                          </div>
                        ) : reservedItems.includes(item.id) ? (
                          <span className="reservedByMe" style={item.purchased ? {color:"#dc3545"} : undefined}><CheckCircle2 size={16}/> {item.purchased ? "Acquistato" : (item.reserved_by ? `Già prenotato da ${item.reserved_by}` : "Già prenotato")}</span>
                        ) : userId ? (
                          <button type="button" onClick={() => reserveItem(item.id)} disabled={reservingId !== null} className="reserveButton">
                            {reservingId === item.id ? <><LoaderCircle size={15} className="sharedSpinner"/> Prenotazione...</> : <><Gift size={15}/> Prenota regalo</>}
                          </button>
                        ) : (
                          <Link className="reserveButton" href={`/login?next=${encodeURIComponent(`/lista/${params.token}`)}`}>
                            <LockKeyhole size={15}/> Accedi per prenotare
                          </Link>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="sharedCompactList" style={{display:"flex",flexDirection:"column",gap:9}}>
                {list.items.map(item => (
                  <div className={`sharedCompactRow ${reservedItems.includes(item.id) ? "isReserved" : ""}`} key={item.id} style={{display:"flex",alignItems:"center",gap:12,minWidth:0,padding:"10px 12px",background:"#fff",border:"1px solid #e0e6ee",borderRadius:7}}>
                    {item.image_url ? (
                      <img src={item.image_url} alt="" style={{display:"block",width:58,height:58,flex:"0 0 58px",objectFit:"contain",background:"#f4f7fb",borderRadius:5}}/>
                    ) : (
                      <span className="sharedCompactPlaceholder" style={{display:"grid",placeItems:"center",width:58,height:58,flex:"0 0 58px",background:"#edf3fb",borderRadius:5,color:"#1769e0"}}><Gift size={22}/></span>
                    )}
                    <button type="button" className="sharedCompactInfo" onClick={() => setDetailItem(item)} aria-label={`Apri i dettagli di ${item.title}`} style={{display:"block",flex:"1 1 auto",minWidth:0,padding:0,border:0,background:"transparent",textAlign:"left",cursor:"pointer"}}>
                      <b style={{display:"-webkit-box",WebkitBoxOrient:"vertical",WebkitLineClamp:3,overflow:"hidden",fontSize:14,lineHeight:1.35,fontWeight:700,color:"#172033",overflowWrap:"anywhere"}}>{item.title}</b>
                      <small style={{display:"block",marginTop:3,fontSize:11,fontWeight:600,color:"#1769e0"}}>Visualizza dettagli</small>
                    </button>
                    {reservedByMe.includes(item.id) ? (
                      <div style={{display:"flex",alignItems:"center",gap:5,flex:"0 0 auto",flexWrap:"wrap",justifyContent:"flex-end"}}>
                        <button type="button" onClick={() => cancelReservation(item.id)} disabled={reservingId !== null} title="Tocca per annullare la prenotazione" className="compactReservedLabel" style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:5,fontSize:11,fontWeight:700,color:"#287a58",textAlign:"center",padding:0,border:0,background:"transparent",cursor:"pointer",opacity:reservingId === item.id ? 0.65 : 1}}>{reservingId === item.id ? "Annullamento..." : <><CheckCircle2 size={14}/> Prenotato da te</>}</button>
                        <button type="button" onClick={() => togglePurchased(item.id)} disabled={reservingId !== null} aria-pressed={purchasedByMe.includes(item.id)} style={{minHeight:30,minWidth:88,padding:"5px 8px",borderRadius:6,border:"1px solid",borderColor:purchasedByMe.includes(item.id)?"#dc3545":"#d7dce3",background:purchasedByMe.includes(item.id)?"#dc3545":"#f1f3f5",color:purchasedByMe.includes(item.id)?"#fff":"#687386",fontSize:11,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap",opacity:reservingId === item.id ? 0.65 : 1}}>
                          {reservingId === item.id ? "Attendi..." : "Acquistato"}
                        </button>
                      </div>
                    ) : reservedItems.includes(item.id) ? (
                      <span className="compactReservedLabel" style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:5,flex:"0 0 auto",maxWidth:118,fontSize:11,fontWeight:700,color:item.purchased?"#dc3545":"#687386",textAlign:"center"}}><CheckCircle2 size={14}/> {item.purchased ? "Acquistato" : (item.reserved_by ? `Da ${item.reserved_by}` : "Già prenotato")}</span>
                    ) : userId ? (
                      <button type="button" onClick={() => reserveItem(item.id)} disabled={reservingId !== null} className="reserveButton" style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:6,flex:"0 0 auto",minWidth:88,minHeight:38,padding:"8px 12px",border:0,borderRadius:5,background:"#1769e0",color:"#fff",fontSize:12,fontWeight:700,whiteSpace:"nowrap",opacity:reservingId !== null && reservingId !== item.id ? .65 : 1}}>
                        {reservingId === item.id ? <><LoaderCircle size={14} className="sharedSpinner"/> Attendi</> : "Prenota"}
                      </button>
                    ) : (
                      <Link className="reserveButton" href={`/login?next=${encodeURIComponent(`/lista/${params.token}`)}`} style={{display:"inline-flex",alignItems:"center",justifyContent:"center",gap:5,flex:"0 0 auto",minHeight:38,padding:"8px 10px",borderRadius:5,background:"#1769e0",color:"#fff",fontSize:11,fontWeight:700,textDecoration:"none",whiteSpace:"nowrap"}}>
                        <LockKeyhole size={14}/> Prenota
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )
          ) : <div className="sharedEmpty">Questa lista non contiene ancora desideri.</div>}
          {detailItem && (
            <div className="sharedDetailOverlay" onClick={() => setDetailItem(null)}>
              <section className="sharedDetailDialog" role="dialog" aria-modal="true" aria-label={detailItem.title} onClick={event => event.stopPropagation()}>
                <button type="button" className="sharedDetailClose" onClick={() => setDetailItem(null)} aria-label="Chiudi"><X size={20}/></button>
                {detailItem.image_url ? <img src={detailItem.image_url} alt={detailItem.title} className="sharedDetailImage"/> : <div className="sharedItemPlaceholder sharedDetailImage"><Gift size={38}/></div>}
                <div className="sharedItemBody">
                  <h2>{detailItem.title}</h2>
                  {detailItem.description && <p>{detailItem.description}</p>}
                  <div className="sharedDetailPrice">{detailItem.price == null ? "Prezzo non indicato" : new Intl.NumberFormat("it-IT", { style: "currency", currency: detailItem.currency || "EUR" }).format(detailItem.price)}</div>
                  {detailItem.product_url && <a className="sharedDetailProductLink" href={detailItem.product_url} target="_blank" rel="noreferrer">Apri il prodotto <ExternalLink size={15}/></a>}
                  <div className="reservationAction">
                    {reservedByMe.includes(detailItem.id) ? (
                      <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                        <button type="button" className="reservedByMe" onClick={() => cancelReservation(detailItem.id)} disabled={reservingId !== null} title="Tocca per annullare la prenotazione" style={{border:0,background:"transparent",cursor:"pointer",font:"inherit",padding:0,opacity:reservingId === detailItem.id ? 0.65 : 1}}>
                          {reservingId === detailItem.id ? "Annullamento..." : <><CheckCircle2 size={16}/> Prenotato da te</>}
                        </button>
                        <button type="button" onClick={() => togglePurchased(detailItem.id)} disabled={reservingId !== null} aria-pressed={purchasedByMe.includes(detailItem.id)} style={{minHeight:32,minWidth:104,padding:"6px 11px",borderRadius:7,border:"1px solid",borderColor:purchasedByMe.includes(detailItem.id)?"#dc3545":"#d7dce3",background:purchasedByMe.includes(detailItem.id)?"#dc3545":"#f1f3f5",color:purchasedByMe.includes(detailItem.id)?"#fff":"#687386",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                          {reservingId === detailItem.id ? "Attendi..." : "Acquistato"}
                        </button>
                      </div>
                    ) : reservedItems.includes(detailItem.id) ? (
                      <span className="reservedByMe" style={detailItem.purchased ? {color:"#dc3545"} : undefined}><CheckCircle2 size={16}/> {detailItem.purchased ? "Acquistato" : (detailItem.reserved_by ? `Già prenotato da ${detailItem.reserved_by}` : "Già prenotato")}</span>
                    ) : userId ? (
                      <button type="button" onClick={() => reserveItem(detailItem.id)} disabled={reservingId !== null} className="reserveButton">
                        {reservingId === detailItem.id ? <><LoaderCircle size={15} className="sharedSpinner"/> Prenotazione...</> : <><Gift size={15}/> Prenota regalo</>}
                      </button>
                    ) : (
                      <Link className="reserveButton" href={`/login?next=${encodeURIComponent(`/lista/${params.token}`)}`}>
                        <LockKeyhole size={15}/> Accedi per prenotare
                      </Link>
                    )}
                  </div>
                </div>
              </section>
            </div>
          )}
          <footer className="sharedFooter">Condiviso con MyPersonalWish · Crea, condividi e realizza i tuoi desideri.</footer>
        </section>
      ) : null}
    </main>
  );
}
