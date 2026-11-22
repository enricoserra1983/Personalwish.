"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Gift, ExternalLink, LoaderCircle, Heart } from "lucide-react";
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

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data, error: rpcError } = await supabase.rpc("get_shared_wishlist", {
        p_share_token: params.token,
      });
      if (rpcError) setError("Non è stato possibile aprire questa lista. Riprova più tardi.");
      else if (!data) setError("Questa lista non esiste o il link non è valido.");
      else setList(data as SharedWishlist);
      setLoading(false);
    }
    if (params.token) load();
  }, [params.token]);

  return (
    <main className="sharedPage">
      <header className="sharedHeader">
        <Link href="/" className="sharedBrand"><span><Gift size={20}/></span> PersonalWish</Link>
        <Link href="/login" className="sharedLogin">Accedi</Link>
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
          <div className="sharedCount">{list.items.length} {list.items.length === 1 ? "desiderio" : "desideri"}</div>
          {list.items.length ? (
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
                  </div>
                </article>
              ))}
            </div>
          ) : <div className="sharedEmpty">Questa lista non contiene ancora desideri.</div>}
          <footer className="sharedFooter">Condiviso con PersonalWish · I tuoi desideri, a modo tuo.</footer>
        </section>
      ) : null}
    </main>
  );
}
