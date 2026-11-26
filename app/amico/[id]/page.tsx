"use client";

import {useEffect,useState} from "react";
import {useParams,useRouter} from "next/navigation";
import {createClient} from "@/lib/supabase/client";
import {ArrowLeft,Users,Gift,MapPin,CalendarDays,LoaderCircle,ChevronDown,Search} from "lucide-react";

type FriendProfile={
  user_id:string;display_name:string;first_name:string|null;last_name:string|null;
  city:string|null;birth_date:string|null;avatar_url:string|null;
  friends_visible:boolean;friends:{user_id:string;display_name:string;avatar_url:string|null}[];
};
type SharedList={id:string;title:string;description:string|null;share_token:string;created_at:string};

export default function FriendProfilePage(){
  const params=useParams<{id:string}>();
  const router=useRouter();
  const friendId=params.id;
  const [profile,setProfile]=useState<FriendProfile|null>(null);
  const [lists,setLists]=useState<SharedList[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [networkOpen,setNetworkOpen]=useState(false);
  const [networkSearch,setNetworkSearch]=useState("");

  useEffect(()=>{
    let active=true;
    async function load(){
      setLoading(true);
      const supabase=createClient();
      const [{data:p,error:pe},{data:l,error:le}]=await Promise.all([
        supabase.rpc("get_friend_profile",{p_friend_id:friendId}),
        supabase.rpc("get_friend_shared_wishlists",{p_friend_id:friendId})
      ]);
      if(!active)return;
      if(pe){setError(pe.message);setLoading(false);return;}
      if(le){setError(le.message);setLoading(false);return;}
      const rawProfile=p as FriendProfile;
      const signAvatar=async(path:string|null)=>{
        if(!path)return null;
        if(path.startsWith("http"))return path;
        const {data}=await supabase.storage.from("profile-images").createSignedUrl(path,600);
        return data?.signedUrl||null;
      };
      const [profileAvatar,friendsWithAvatars]=await Promise.all([
        signAvatar(rawProfile.avatar_url),
        Promise.all((rawProfile.friends||[]).map(async person=>({...person,avatar_url:await signAvatar(person.avatar_url)})))
      ]);
      if(!active)return;
      setProfile({...rawProfile,avatar_url:profileAvatar,friends:friendsWithAvatars});
      setLists((l||[]) as SharedList[]);
      setLoading(false);
    }
    if(friendId)load();
    return()=>{active=false;};
  },[friendId]);

  if(loading)return <main className="friendProfilePage"><div className="friendProfileLoading"><LoaderCircle size={22}/> Caricamento profilo…</div></main>;
  if(error||!profile)return <main className="friendProfilePage"><button className="textButton" onClick={()=>router.push("/?section=friends")}><ArrowLeft size={16}/> Torna indietro</button><div className="settingsCard">{error||"Profilo non disponibile."}</div></main>;

  const fullName=[profile.first_name,profile.last_name].filter(Boolean).join(" ")||profile.display_name;
  return <main className="friendProfilePage">
    <header className="friendProfileTop"><button className="textButton" onClick={()=>router.push("/?section=friends")}><ArrowLeft size={17}/> Torna indietro</button><a className="friendProfileBrand" href="/" aria-label="MyPersonalWish"><img src="/mypersonalwish-logo.svg" alt="" /><b>MyPersonal<span className="brandAccent">Wish</span></b></a></header>
    <section className="friendProfileHero">
      <div className="friendProfileHeroAvatar">{profile.avatar_url?<img src={profile.avatar_url} alt="Foto profilo"/>:profile.display_name.charAt(0).toUpperCase()}</div>
      <div className="eyebrow">PROFILO PERSONALWISH</div>
      <h1>{fullName}</h1>
      {profile.city&&<p><MapPin size={15}/>{profile.city}</p>}
      {profile.birth_date&&<p><CalendarDays size={15}/>Compleanno: {new Date(profile.birth_date+"T00:00:00").toLocaleDateString("it-IT",{day:"numeric",month:"long"})}</p>}
    </section>
    <section className="friendProfileContent">
      <div className="friendProfileSectionTitle"><Gift size={18}/><h2>Le sue liste condivise con te</h2></div>
      {lists.length?<div className="friendProfileLists">{lists.map(list=><a className="friendWishlistCard" key={list.id} href={"/lista/"+list.share_token}><span>🎁</span><div><b>{list.title}</b><small>{list.description||"Lista dei desideri"}</small></div><strong>Apri →</strong></a>)}</div>:<div className="settingsCard">Al momento non ci sono liste che questa persona ha condiviso con te.</div>}
      {profile.friends_visible&&<div className="friendProfileNetwork">
        <button type="button" className="friendProfileNetworkToggle" onClick={()=>setNetworkOpen(v=>!v)} aria-expanded={networkOpen}>
          <span className="friendProfileSectionTitle"><Users size={18}/><h2>La sua rete ({profile.friends.length})</h2></span>
          <ChevronDown size={18} className={networkOpen?"rotated":""}/>
        </button>
        {networkOpen&&(profile.friends.length?<div className="friendProfileNetworkPanel">
          <label className="friendProfileNetworkSearch"><Search size={15}/><input type="search" value={networkSearch} onChange={e=>setNetworkSearch(e.target.value)} placeholder="Cerca tra i suoi amici..." /></label>
          <div className="friendProfileNetworkScroll">{profile.friends.filter(person=>person.display_name.toLocaleLowerCase("it").includes(networkSearch.trim().toLocaleLowerCase("it"))).map(person=><div className="friendProfileNetworkPerson" key={person.user_id}><span className="avatar">{person.avatar_url?<img src={person.avatar_url} alt=""/>:person.display_name.charAt(0).toUpperCase()}</span><b>{person.display_name}</b></div>)}
          {profile.friends.every(person=>!person.display_name.toLocaleLowerCase("it").includes(networkSearch.trim().toLocaleLowerCase("it")))&&<p className="friendProfileMuted">Nessun profilo trovato.</p>}</div>
        </div>:<p className="friendProfileMuted">Non ci sono amici visibili in questa rete.</p>)}
      </div>}
    </section>
  </main>;
}
