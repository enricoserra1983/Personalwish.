"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Gift, Users, UserPlus, CheckCircle2, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  wishlist_id: string | null;
  item_id: string | null;
  actor_name: string;
  created_at: string;
  read_at: string | null;
};

function iconFor(type: string) {
  if (type === "friend_request" || type === "friend_accepted") return <UserPlus size={19}/>;
  if (type === "list_participant") return <Users size={19}/>;
  return <Gift size={19}/>;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { router.replace("/login"); return; }
    const { data, error } = await supabase.rpc("get_my_notifications", { p_limit: 100 });
    if (error) setError(error.message);
    else setItems((data || []) as Notification[]);
    setLoading(false);
  }, [router]);

  useEffect(() => { void load(); }, [load]);

  async function markRead(id?: string) {
    const { error } = await createClient().rpc("mark_my_notifications_read", { p_notification_id: id || null });
    if (error) { setError(error.message); return; }
    setItems(current => current.map(item => (!id || item.id === id) ? { ...item, read_at: new Date().toISOString() } : item));
  }

  async function openNotification(item: Notification) {
    if (!item.read_at) await markRead(item.id);
    if (item.wishlist_id) {
      const { data } = await createClient().from("wishlists").select("share_token").eq("id", item.wishlist_id).maybeSingle();
      if (data?.share_token) { router.push("/lista/" + data.share_token); return; }
    }
    router.push("/");
  }

  const unread = items.filter(item => !item.read_at).length;

  return <main className="notificationsPage">
    <header className="notificationsHeader">
      <a href="/" className="notificationsBrand"><Gift size={21}/> PersonalWish</a>
      <a href="/" className="notificationsBack">Torna alle liste</a>
    </header>
    <section className="notificationsContent">
      <div className="notificationsTitleRow">
        <div><div className="eyebrow">IL TUO SPAZIO</div><h1>Notifiche</h1><p>Qui trovi gli aggiornamenti sulle tue amicizie e sulle tue liste.</p></div>
        {unread > 0 && <button className="notificationsReadAll" onClick={() => markRead()}><CheckCheck size={16}/> Segna tutte come lette</button>}
      </div>
      {error && <p className="notificationsError">{error}</p>}
      {loading ? <div className="notificationsEmpty"><LoaderCircle className="spin" size={22}/> Caricamento notifiche...</div> :
        items.length ? <div className="notificationsList">{items.map(item => <button key={item.id} className={`notificationCard ${item.read_at ? "" : "unread"}`} onClick={() => openNotification(item)}>
          <span className="notificationIcon">{iconFor(item.type)}</span>
          <span className="notificationText"><b>{item.title}</b><span>{item.body}</span><small>{new Date(item.created_at).toLocaleString("it-IT",{dateStyle:"medium",timeStyle:"short"})}</small></span>
          {!item.read_at && <span className="notificationUnreadDot" aria-label="Non letta"/>}
        </button>)}</div> : <div className="notificationsEmpty"><Bell size={28}/><b>Ancora nessuna notifica</b><span>Quando ci saranno novità sulle tue liste o amicizie, le troverai qui.</span></div>}
    </section>
  </main>;
}
