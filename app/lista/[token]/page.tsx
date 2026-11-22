"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Gift, ExternalLink, LoaderCircle, Heart, LockKeyhole, CheckCircle2, LayoutGrid, List, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type SharedItem = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  product_url: string | null;
  price: number | null;
  currency: string;
};
type SharedWishlist = {
  id: string;
  title: string;
  description: string | null;
  items: SharedItem[];
};

export default function SharedWishlistPage() {
  const params = useParams<{ token: string }>();
  const [list, setList] = useState<SharedWishlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [reservedByMe, setReservedByMe] = useState<string[]>([]);
  const [reservingId, setReservingId] = useState<string | null>(null);
  const [reservationMessage, setReservationMessage] = useState("");
  const [displayMode, setDisplayMode] = useState<"grid" | "list">("grid");
  const [detailItem, setDetailItem] = useState<SharedItem | null>(null);

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
        setList(wishlist);
        if (currentUserId && wishlist.items.length) {
          const { data: mine } = await supabase
            .from("reservations")
            .select("item_id")
            .eq("user_id", currentUserId)
            .in("item_id", wishlist.items.map(item => item.id))
            .in("status", ["reserved", "purchased"]);
          setReservedByMe((mine || []).map(row => row.item_id));
        }
      }
      setLoading(false);
    }
    if (params.token) load();
  }, [params.token]);

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
      setReservationMessage("Regalo prenotato! La prenotazione è stata registrata.");
    } else {
      setReservationMessage("Questo regalo è già stato prenotato da un'altra persona.");
    }
    setReservingId(null);
  }

  return (
    <main className="sharedPage">
      <header className="sharedHeader">
        <Link href="/" className="sharedBrand"><span><Gift size={20}/></span> PersonalWish</Link>
        <Link href={userId ? "/" : `/login?next=${encodeURIComponent(`/lista/${params.token}`)}`} className="sharedLogin">{userId ? "Il mio account" : "Accedi"}</Link>
      </header>
      {loading ? (
        <div className="sharedState"><LoaderCircle className="sharedSpinner" size={25}/> Caricamento della lista...</div>
      ) : error ? (
        <div className="sharedState sharedError"><Heart size={24}/><h1>Lista non disponibile</h1><p>{error}</p><Link href="/">Vai a PersonalWish</Link></div>
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
                          <span className="reservedByMe"><CheckCircle2 size={16}/> Prenotato da te</span>
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
              <div className="sharedCompactList">
                {list.items.map(item => (
                  <button type="button" className="sharedCompactRow" key={item.id} onClick={() => setDetailItem(item)}>
                    {item.image_url ? <img src={item.image_url} alt="" /> : <span className="sharedCompactPlaceholder"><Gift size={19}/></span>}
                    <span className="sharedCompactInfo"><b>{item.title}</b><small>{item.price == null ? "Prezzo non indicato" : new Intl.NumberFormat("it-IT", { style: "currency", currency: item.currency || "EUR" }).format(item.price)}</small></span>
                    <span className="sharedCompactOpen">Dettagli <ExternalLink size={13}/></span>
                  </button>
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
                      <span className="reservedByMe"><CheckCircle2 size={16}/> Prenotato da te</span>
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
          <footer className="sharedFooter">Condiviso con PersonalWish · I tuoi desideri, a modo tuo.</footer>
        </section>
      ) : null}
    </main>
  );
}
