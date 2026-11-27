"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Gift, CheckCircle2, ShoppingBag, LoaderCircle, ExternalLink, X, PackageOpen } from "lucide-react";

type ReservationRow = { id: string; item_id: string; status: "reserved" | "purchased"; created_at: string };
type WishItem = { id: string; title: string; description: string | null; image_url: string | null; product_url: string | null; price: number | null; currency: string | null; wishlist_id: string };
type WishlistRow = { id: string; title: string; share_token: string; owner_id: string };
type ProfileRow = { owner_id: string; display_name: string | null };
type Entry = { reservation: ReservationRow; item: WishItem; wishlist: WishlistRow; ownerName: string };

export default function MyReservationsPage() {
  const router = useRouter();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState<"reserved" | "purchased">("reserved");
  const [selected, setSelected] = useState<Entry | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      const supabase = createClient();
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) { router.replace("/login"); return; }
      const { data: reservations, error: reservationError } = await supabase
        .from("reservations")
        .select("id,item_id,status,created_at")
        .eq("user_id", auth.user.id)
        .in("status", ["reserved", "purchased"])
        .order("created_at", { ascending: false });
      if (reservationError) {
        if (alive) { setError("Non è stato possibile caricare le prenotazioni."); setLoading(false); }
        return;
      }
      const rows = (reservations || []) as ReservationRow[];
      if (!rows.length) { if (alive) setLoading(false); return; }
      const itemIds = [...new Set(rows.map(row => row.item_id))];
      const { data: items, error: itemsError } = await supabase
        .from("wishlist_items")
        .select("id,title,description,image_url,product_url,price,currency,wishlist_id")
        .in("id", itemIds);
      if (itemsError) { if (alive) { setError("Non è stato possibile caricare i dettagli dei prodotti."); setLoading(false); } return; }
      const itemRows = (items || []) as WishItem[];
      const wishlistIds = [...new Set(itemRows.map(item => item.wishlist_id))];
      const { data: wishlists, error: listsError } = await supabase
        .from("wishlists")
        .select("id,title,share_token,owner_id")
        .in("id", wishlistIds);
      if (listsError) { if (alive) { setError("Non è stato possibile caricare le liste di origine."); setLoading(false); } return; }
      const listRows = (wishlists || []) as WishlistRow[];
      // La tabella profiles è protetta da RLS: recuperiamo i soli proprietari
      // delle liste in cui l'utente ha una propria prenotazione tramite RPC dedicata.
      const { data: profiles, error: profilesError } = await supabase.rpc("get_my_reservation_list_owners");
      if (profilesError) {
        if (alive) { setError("Non è stato possibile recuperare i nomi dei proprietari delle liste."); setLoading(false); }
        return;
      }
      const profileRows = (profiles || []) as ProfileRow[];
      const itemMap = new Map(itemRows.map(item => [item.id, item]));
      const listMap = new Map(listRows.map(list => [list.id, list]));
      const profileMap = new Map(profileRows.map(profile => [profile.owner_id, profile]));
      const result: Entry[] = rows.flatMap(reservation => {
        const item = itemMap.get(reservation.item_id);
        const wishlist = item ? listMap.get(item.wishlist_id) : undefined;
        if (!item || !wishlist) return [];
        const owner = profileMap.get(wishlist.owner_id);
        const ownerName = owner?.display_name?.trim() || "Utente";
        return [{ reservation, item, wishlist, ownerName }];
      });
      if (alive) { setEntries(result); setLoading(false); }
    }
    load().catch(() => { if (alive) { setError("Si è verificato un errore durante il caricamento."); setLoading(false); } });
    return () => { alive = false; };
  }, [router]);

  const reserved = useMemo(() => entries.filter(entry => entry.reservation.status === "reserved"), [entries]);
  const purchased = useMemo(() => entries.filter(entry => entry.reservation.status === "purchased"), [entries]);
  const visible = activeTab === "reserved" ? reserved : purchased;

  return (
    <main style={{minHeight:"100vh",background:"#f5f7fb",padding:"22px 16px 48px"}}>
      <div style={{maxWidth:900,margin:"0 auto"}}>
        <header style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:26}}>
          <Link href="/" style={{display:"inline-flex",alignItems:"center",gap:8,color:"#42516a",textDecoration:"none",fontSize:14,fontWeight:650}}><ArrowLeft size={18}/> Torna a MyPersonalWish</Link>
          <Link href="/" aria-label="MyPersonalWish" className="accountPageBrand"><img src="/mypersonalwish-logo-horizontal.png" alt="MyPersonalWish"/></Link>
        </header>
        <div style={{marginBottom:22}}>
          <div style={{fontSize:11,fontWeight:800,letterSpacing:".12em",color:"#6b54d8",marginBottom:7}}>IL TUO ACCOUNT</div>
          <h1 style={{fontSize:"clamp(27px,5vw,36px)",lineHeight:1.15,margin:"0 0 8px",color:"#172033"}}>Le mie prenotazioni</h1>
          <p style={{margin:0,color:"#687386",fontSize:14}}>Ritrova i prodotti che hai prenotato o già acquistato nelle liste dei tuoi amici.</p>
        </div>
        <div style={{display:"flex",gap:9,padding:5,background:"#e9edf4",borderRadius:12,marginBottom:18}}>
          <button type="button" onClick={()=>setActiveTab("reserved")} aria-pressed={activeTab==="reserved"} style={{flex:1,minHeight:44,border:0,borderRadius:9,background:activeTab==="reserved"?"#fff":"transparent",color:activeTab==="reserved"?"#1769e0":"#657187",fontWeight:750,display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:activeTab==="reserved"?"0 1px 4px #17203312":"none"}}><Gift size={17}/> Prenotati <span style={{fontSize:12,background:activeTab==="reserved"?"#eaf2ff":"#dfe4ec",padding:"2px 7px",borderRadius:20}}>{reserved.length}</span></button>
          <button type="button" onClick={()=>setActiveTab("purchased")} aria-pressed={activeTab==="purchased"} style={{flex:1,minHeight:44,border:0,borderRadius:9,background:activeTab==="purchased"?"#fff":"transparent",color:activeTab==="purchased"?"#dc3545":"#657187",fontWeight:750,display:"flex",alignItems:"center",justifyContent:"center",gap:8,boxShadow:activeTab==="purchased"?"0 1px 4px #17203312":"none"}}><ShoppingBag size={17}/> Acquistati <span style={{fontSize:12,background:activeTab==="purchased"?"#fff0f1":"#dfe4ec",padding:"2px 7px",borderRadius:20}}>{purchased.length}</span></button>
        </div>
        {loading ? <div style={{padding:40,textAlign:"center",color:"#687386"}}><LoaderCircle size={22} className="sharedSpinner"/> <p>Caricamento delle tue prenotazioni...</p></div>
        : error ? <div role="alert" style={{padding:18,background:"#fff",borderRadius:12,color:"#b42318"}}>{error}</div>
        : visible.length ? <div style={{display:"grid",gap:11}}>
          {visible.map(entry=><button type="button" key={entry.reservation.id} onClick={()=>setSelected(entry)} className="reservationProductCard">
            {entry.item.image_url ? <img className="reservationProductImage" src={entry.item.image_url} alt=""/> : <span className="reservationProductPlaceholder"><Gift size={27}/></span>}
            <span style={{display:"block",flex:1,minWidth:0}}>
              <b className="reservationProductTitle">{entry.item.title}</b>
              <small style={{display:"block",marginTop:5,color:"#657187",fontSize:12}}>Prenotato dalla lista <strong>{entry.wishlist.title}</strong> di {entry.ownerName}</small>
              <small style={{display:"inline-flex",alignItems:"center",gap:5,marginTop:6,fontSize:11,fontWeight:750,color:entry.reservation.status==="purchased"?"#dc3545":"#287a58"}}>{entry.reservation.status==="purchased"?<ShoppingBag size={13}/>:<CheckCircle2 size={13}/>} {entry.reservation.status==="purchased"?"Acquistato":"Prenotato"}</small>
            </span>
            <span style={{color:"#8994a6",fontSize:20,padding:"0 4px"}}>›</span>
          </button>)}
        </div> : <div style={{padding:"42px 20px",background:"#fff",border:"1px dashed #d7deea",borderRadius:14,textAlign:"center",color:"#687386"}}>
          <PackageOpen size={34} style={{margin:"0 auto 12px",color:"#9aa5b5"}}/>
          <b style={{display:"block",color:"#253149",marginBottom:5}}>{activeTab==="reserved"?"Non hai prodotti prenotati":"Non hai prodotti acquistati"}</b>
          <span style={{fontSize:13}}>Quando prenoti o confermi un regalo nelle liste condivise, lo troverai qui.</span>
        </div>}
      </div>
      {selected && <div role="presentation" onClick={()=>setSelected(null)} style={{position:"fixed",inset:0,zIndex:50,background:"#11182788",display:"grid",placeItems:"center",padding:16}}>
        <section role="dialog" aria-modal="true" aria-label={selected.item.title} onClick={event=>event.stopPropagation()} style={{width:"min(100%,480px)",maxHeight:"90vh",overflowY:"auto",background:"#fff",borderRadius:17,position:"relative",padding:20,boxShadow:"0 18px 60px #11182735"}}>
          <button type="button" onClick={()=>setSelected(null)} aria-label="Chiudi" style={{position:"absolute",top:12,right:12,width:35,height:35,border:0,borderRadius:20,background:"#eef1f6",color:"#44516a",display:"grid",placeItems:"center"}}><X size={18}/></button>
          {selected.item.image_url ? <img src={selected.item.image_url} alt={selected.item.title} style={{width:"100%",height:210,objectFit:"contain",background:"#f5f7fb",borderRadius:11,marginBottom:16}}/> : <div style={{height:160,display:"grid",placeItems:"center",background:"#f5f7fb",borderRadius:11,marginBottom:16}}><Gift size={42}/></div>}
          <h2 style={{fontSize:22,lineHeight:1.25,margin:"0 42px 9px 0",color:"#172033"}}>{selected.item.title}</h2>
          {selected.item.description && <p style={{whiteSpace:"pre-wrap",lineHeight:1.55,color:"#586579",fontSize:14}}>{selected.item.description}</p>}
          {selected.item.price!=null && <b style={{display:"block",margin:"12px 0",fontSize:18}}>{new Intl.NumberFormat("it-IT",{style:"currency",currency:selected.item.currency||"EUR"}).format(selected.item.price)}</b>}
          <div style={{padding:12,background:"#f5f7fb",borderRadius:10,fontSize:13,color:"#586579",marginTop:12}}>Dalla lista <b style={{color:"#26344d"}}>{selected.wishlist.title}</b> di <b style={{color:"#26344d"}}>{selected.ownerName}</b></div>
          <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:16}}>
            <Link href={"/lista/"+selected.wishlist.share_token} style={{display:"inline-flex",alignItems:"center",gap:7,padding:"10px 13px",background:"#1769e0",color:"#fff",borderRadius:8,textDecoration:"none",fontSize:13,fontWeight:700}}>Apri la lista</Link>
            {selected.item.product_url && <a href={selected.item.product_url} target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:7,padding:"10px 13px",border:"1px solid #dce2eb",color:"#42516a",borderRadius:8,textDecoration:"none",fontSize:13,fontWeight:700}}>Vedi prodotto <ExternalLink size={14}/></a>}
          </div>
        </section>
      </div>}
    </main>
  );
}
