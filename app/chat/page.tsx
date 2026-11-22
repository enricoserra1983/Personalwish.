"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, MessageCircle, Users, Gift, Send, Plus, LoaderCircle } from "lucide-react";

type Chat = { conversation_id:string; chat_type:"direct"|"group"|"list"; chat_title:string; wishlist_id:string|null; updated_at:string; last_message:string|null; unread_count:number };
type Friend = { user_id:string; display_name:string };
type Message = { id:string; conversation_id:string; sender_id:string; body:string; created_at:string };

export default function ChatPage(){
 const [chats,setChats]=useState<Chat[]>([]);
 const [friends,setFriends]=useState<Friend[]>([]);
 const [wishlists,setWishlists]=useState<{id:string;title:string}[]>([]);
 const [active,setActive]=useState<Chat|null>(null);
 const [messages,setMessages]=useState<Message[]>([]);
 const [userId,setUserId]=useState("");
 const [draft,setDraft]=useState("");
 const [loading,setLoading]=useState(true);
 const [sending,setSending]=useState(false);
 const [error,setError]=useState("");
 const [showNew,setShowNew]=useState(false);
 const [newType,setNewType]=useState<"direct"|"group"|"list">("direct");
 const [friendId,setFriendId]=useState("");
 const [groupTitle,setGroupTitle]=useState("");
 const [memberIds,setMemberIds]=useState<string[]>([]);
 const [wishlistId,setWishlistId]=useState("");

 const supabase=createClient();
 const loadChats=useCallback(async()=>{
  const {data,error}=await supabase.rpc("get_my_chats");
  if(error){setError("Chat non ancora disponibili: "+error.message);return;}
  setChats(data||[]);
 },[]);
 useEffect(()=>{
  let alive=true;
  (async()=>{
   const [{data:auth},{data:chatData,error:chatError},{data:friendData},{data:listData}] = await Promise.all([
    supabase.auth.getUser(),supabase.rpc("get_my_chats"),supabase.rpc("get_my_friends"),
    supabase.from("wishlists").select("id,title").order("created_at",{ascending:false})
   ]);
   if(!alive)return;
   if(!auth.user){window.location.href="/login";return;}
   setUserId(auth.user.id);setChats(chatData||[]);setFriends(friendData||[]);setWishlists(listData||[]);
   if(chatError)setError("Per iniziare, verifica di aver eseguito lo script chat in Supabase.");
   setLoading(false);
  })();
  return()=>{alive=false};
 },[]);
 useEffect(()=>{
  if(!active||!userId)return;
  let alive=true;
  (async()=>{
   const {data,error}=await supabase.from("chat_messages").select("id,conversation_id,sender_id,body,created_at").eq("conversation_id",active.conversation_id).order("created_at",{ascending:true}).limit(200);
   if(!alive)return;
   if(error){setError(error.message);return}
   setMessages(data||[]);
   await supabase.rpc("mark_chat_read",{p_conversation_id:active.conversation_id});
   await loadChats();
  })();
  const channel=supabase.channel("chat-"+active.conversation_id)
   .on("postgres_changes",{event:"INSERT",schema:"public",table:"chat_messages",filter:"conversation_id=eq."+active.conversation_id},payload=>{
    const m=payload.new as Message;
    setMessages(current=>current.some(x=>x.id===m.id)?current:[...current,m]);
    if(m.sender_id!==userId)supabase.rpc("mark_chat_read",{p_conversation_id:active.conversation_id});
   }).subscribe();
  return()=>{alive=false;supabase.removeChannel(channel)};
 },[active?.conversation_id,userId,loadChats]);
 async function createChat(){
  setError("");
  let result;
  if(newType==="direct"&&friendId) result=await supabase.rpc("open_direct_chat",{p_friend_id:friendId});
  else if(newType==="group") result=await supabase.rpc("create_group_chat",{p_title:groupTitle,p_member_ids:memberIds});
  else if(newType==="list"&&wishlistId) result=await supabase.rpc("open_list_chat",{p_wishlist_id:wishlistId});
  if(!result||result.error){setError(result?.error?.message||"Completa i campi richiesti.");return}
  await loadChats();
  const id=result.data;
  const {data}=await supabase.rpc("get_my_chats");
  const chat=(data||[]).find((x:Chat)=>x.conversation_id===id);
  if(chat)setActive(chat);
  setShowNew(false);setFriendId("");setGroupTitle("");setMemberIds([]);setWishlistId("");
 }
 async function sendMessage(){
  const body=draft.trim();if(!body||!active||sending)return;
  setSending(true);
  const {error}=await supabase.from("chat_messages").insert({conversation_id:active.conversation_id,sender_id:userId,body});
  if(error)setError(error.message);else setDraft("");
  setSending(false);
 }
 return <main className="chatPage">
  <header className="chatTop"><Link href="/" className="chatBack"><ArrowLeft size={18}/> PersonalWish</Link><h1><MessageCircle size={22}/> Chat</h1><button onClick={()=>setShowNew(v=>!v)}><Plus size={17}/> Nuova chat</button></header>
  {error&&<p className="chatError">{error}</p>}
  <div className="chatLayout">
   <aside className="chatSidebar"><h2>Conversazioni</h2>{loading?<p>Caricamento...</p>:chats.length===0?<p className="chatMuted">Non hai ancora conversazioni. Creane una con il pulsante Nuova chat.</p>:chats.map(chat=><button key={chat.conversation_id} className={active?.conversation_id===chat.conversation_id?"chatEntry active":"chatEntry"} onClick={()=>setActive(chat)}>
    <span className="chatEntryIcon">{chat.chat_type==="direct"?<MessageCircle/>:chat.chat_type==="group"?<Users/>:<Gift/>}</span><span className="chatEntryText"><b>{chat.chat_title||"Conversazione"}</b><small>{chat.last_message||"Nessun messaggio"}</small></span>{chat.unread_count>0&&<i>{chat.unread_count}</i>}
   </button>)}</aside>
   <section className="chatWindow">
    {showNew?<div className="chatNew"><h2>Nuova conversazione</h2><div className="chatTypeTabs"><button className={newType==="direct"?"selected":""} onClick={()=>setNewType("direct")}>Privata</button><button className={newType==="group"?"selected":""} onClick={()=>setNewType("group")}>Gruppo</button><button className={newType==="list"?"selected":""} onClick={()=>setNewType("list")}>Lista</button></div>
     {newType==="direct"?<label>Amico<select value={friendId} onChange={e=>setFriendId(e.target.value)}><option value="">Seleziona un amico</option>{friends.map(f=><option key={f.user_id} value={f.user_id}>{f.display_name}</option>)}</select></label>:null}
     {newType==="group"?<><label>Nome del gruppo<input value={groupTitle} onChange={e=>setGroupTitle(e.target.value)} placeholder="Es. Regali di Natale"/></label><div className="chatFriendChoices">{friends.map(f=><label key={f.user_id}><input type="checkbox" checked={memberIds.includes(f.user_id)} onChange={e=>setMemberIds(v=>e.target.checked?[...v,f.user_id]:v.filter(x=>x!==f.user_id))}/>{f.display_name}</label>)}</div></>:null}
     {newType==="list"?<label>Lista<select value={wishlistId} onChange={e=>setWishlistId(e.target.value)}><option value="">Seleziona una lista</option>{wishlists.map(w=><option key={w.id} value={w.id}>{w.title}</option>)}</select><small>La chat sarà accessibile solo agli amici autorizzati alla lista.</small></label>:null}
     <button className="chatPrimary" onClick={createChat}>Crea conversazione</button>
    </div>:active?<><div className="chatConversationHead"><div><b>{active.chat_title||"Conversazione"}</b><small>{active.chat_type==="direct"?"Chat privata":active.chat_type==="group"?"Chat di gruppo":"Chat della lista"}</small></div></div><div className="chatMessages">{messages.length===0?<p className="chatMuted">Inizia la conversazione con un messaggio.</p>:messages.map(m=><div key={m.id} className={m.sender_id===userId?"chatBubble mine":"chatBubble"}><p>{m.body}</p><small>{new Date(m.created_at).toLocaleString("it-IT",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"})}</small></div>)}</div><form className="chatComposer" onSubmit={e=>{e.preventDefault();sendMessage()}}><input value={draft} onChange={e=>setDraft(e.target.value)} placeholder="Scrivi un messaggio..." maxLength={4000}/><button disabled={!draft.trim()||sending}><Send size={18}/></button></form></>:<div className="chatWelcome"><MessageCircle size={40}/><h2>Le tue conversazioni</h2><p>Seleziona una chat oppure creane una nuova.</p></div>}
   </section>
  </div>
 </main>
}
