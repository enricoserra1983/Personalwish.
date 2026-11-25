"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Gift, Heart, Plus, Users, Bell, Link2, Settings2, LockKeyhole, Sparkles, LogOut, LoaderCircle, Trash2, UserRound, ChevronDown, LayoutGrid, List, X, ArrowDownUp, GripVertical, UserRoundX, CircleHelp } from "lucide-react";

type WishItem = {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  image_url: string | null;
  product_url: string | null;
  position?: number | null;
};
type Wishlist = {
  id: string;
  is_public: boolean;
  private_access_mode: "all_friends" | "selected" | "owner_only";
  title: string;
  description: string | null;
  share_token: string;
  image_url: string | null;
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
  const [profileUserId, setProfileUserId] = useState("");
  const [firstName,setFirstName]=useState("");
  const [lastName,setLastName]=useState("");
  const [city,setCity]=useState("");
  const [birthDate,setBirthDate]=useState("");
  const [birthdayVisible,setBirthdayVisible]=useState(false);
  const [allowUserSearch,setAllowUserSearch]=useState(true);
  const [allowFriendRequests,setAllowFriendRequests]=useState(true);
  const [notifyFriendRequests,setNotifyFriendRequests]=useState(true);
  const [notifyListActivity,setNotifyListActivity]=useState(true);
  const [profileDetailsVisible,setProfileDetailsVisible]=useState(true);
  const [friendNetworkVisibility,setFriendNetworkVisibility]=useState<"all"|"except"|"none">("all");
  const [showFriendNetworkMenu,setShowFriendNetworkMenu]=useState(false);
  const [allowIndirectFriendVisibility,setAllowIndirectFriendVisibility]=useState(true);
  const [friendNetworkExcludedIds,setFriendNetworkExcludedIds]=useState<string[]>([]);
  const [friendExclusionSearch,setFriendExclusionSearch]=useState("");
  const [savingPrivacySettings,setSavingPrivacySettings]=useState(false);
  const [profileAvatarUrl,setProfileAvatarUrl]=useState("");
  const [savingProfile,setSavingProfile]=useState(false);
  const [deletingAccount,setDeletingAccount]=useState(false);
  const [uploadingAvatar,setUploadingAvatar]=useState(false);
  const avatarInputRef=useRef<HTMLInputElement>(null);
  const importTextRef=useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"lists" | "friends" | "groups" | "profile" | "settings" | "transfer">("lists");
  useEffect(()=>{ if(typeof window!=="undefined" && new URLSearchParams(window.location.search).get("section")==="friends") setTab("friends"); },[]);
  useEffect(()=>{ if(tab==="friends"){ loadFriends(); loadFriendGroups(); } },[tab]);
  const [friends,setFriends] = useState<{user_id:string;display_name:string}[]>([]);
  const [showAllFriends,setShowAllFriends] = useState(false);
  const [friendVisitCounts,setFriendVisitCounts] = useState<Record<string,number>>({});
  const [selectedFriend,setSelectedFriend] = useState<{user_id:string;display_name:string}|null>(null);
  const [friendWishlists,setFriendWishlists] = useState<{id:string;title:string;description:string|null;share_token:string;created_at:string}[]>([]);
  const [friendProfileDetails,setFriendProfileDetails] = useState<{first_name:string|null;last_name:string|null;birth_date:string|null;city:string|null;avatar_url:string|null;friends_visible:boolean;friends:{user_id:string;display_name:string;avatar_url:string|null}[]} | null>(null);
  const [friendListsLoading,setFriendListsLoading] = useState(false);
  const [requests,setRequests] = useState<{id:string;requester_id:string;requester_name:string;wishlist_title:string|null}[]>([]);
  const [friendSearch,setFriendSearch] = useState("");
  const [showInviteMenu,setShowInviteMenu] = useState(false);
  const [inviteCopied,setInviteCopied] = useState(false);
  const [friendResults,setFriendResults] = useState<{user_id:string;display_name:string}[]>([]);
  const [selectedFriends,setSelectedFriends] = useState<string[]>([]);
  const [selectedGroupIds,setSelectedGroupIds] = useState<string[]>([]);
  const [friendGroups,setFriendGroups] = useState<{group_id:string;group_name:string;member_count:number}[]>([]);
  const [newGroupName,setNewGroupName] = useState("");
  const [activeGroup,setActiveGroup] = useState<string>("");
  const [groupMembers,setGroupMembers] = useState<{user_id:string;display_name:string}[]>([]);
  const [savedGroupMemberIds,setSavedGroupMemberIds] = useState<string[]>([]);
  const [savingGroupMembers,setSavingGroupMembers] = useState(false);
  const [wishlists, setWishlists] = useState<Wishlist[]>([]);
  const [activeId, setActiveId] = useState("");
  const [newListTitle, setNewListTitle] = useState("");
  const [showNewListForm, setShowNewListForm] = useState(false);
  const [showHomeListActions, setShowHomeListActions] = useState(false);
  const [homeListAction, setHomeListAction] = useState<"create"|"import"|null>(null);
  const [importDestination, setImportDestination] = useState<"existing"|"new">("existing");
  const [importTargetListId, setImportTargetListId] = useState("");
  const [importNewListTitle, setImportNewListTitle] = useState("");
  const [editingListTitle, setEditingListTitle] = useState(false);
  const [editedListTitle, setEditedListTitle] = useState("");
  const [showEditMenu, setShowEditMenu] = useState(false);
  const [uploadingListImage, setUploadingListImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [newWish, setNewWish] = useState("");
  const [showWishEditor,setShowWishEditor] = useState(false);
  const [wishDescription,setWishDescription] = useState("");
  const [wishUrl,setWishUrl] = useState("");
  const [wishImage,setWishImage] = useState("");
  const [wishPrice,setWishPrice] = useState("");
  const [editingWishId,setEditingWishId] = useState<string|null>(null);
  const [fetchingProduct,setFetchingProduct] = useState(false);
  const [showProductLinkHelp,setShowProductLinkHelp] = useState(false);
  const [draggingWishId,setDraggingWishId] = useState<string|null>(null);
  const [dragPointer,setDragPointer] = useState<{x:number;y:number}|null>(null);
  const [dragOverWishId,setDragOverWishId] = useState<string|null>(null);
  const dragTargetRef = useRef<string|null>(null);
  const [savingWishImage,setSavingWishImage] = useState(false);
  const wishImageInputRef = useRef<HTMLInputElement>(null);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const privacyPanelRef = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [displayMode, setDisplayMode] = useState<"grid" | "list">("grid");
  const [detailWish, setDetailWish] = useState<WishItem | null>(null);

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
    if(!draggingWishId)return;
    const onMove=(event:PointerEvent)=>{
      setDragPointer({x:event.clientX,y:event.clientY});
      const target=document.elementFromPoint(event.clientX,event.clientY)?.closest<HTMLElement>("[data-wish-id]");
      if(target?.dataset.wishId){dragTargetRef.current=target.dataset.wishId;setDragOverWishId(target.dataset.wishId);}
      const edge=100;
      if(event.clientY<edge)window.scrollBy(0,-Math.max(10,(edge-event.clientY)*0.24));
      else if(event.clientY>window.innerHeight-edge)window.scrollBy(0,Math.max(10,(event.clientY-(window.innerHeight-edge))*0.24));
    };
    const onUp=()=>{const target=dragTargetRef.current;if(target)void moveWish(draggingWishId,target);setDraggingWishId(null);setDragPointer(null);setDragOverWishId(null);dragTargetRef.current=null;};
    window.addEventListener("pointermove",onMove,{passive:true});window.addEventListener("pointerup",onUp);window.addEventListener("pointercancel",onUp);
    return()=>{window.removeEventListener("pointermove",onMove);window.removeEventListener("pointerup",onUp);window.removeEventListener("pointercancel",onUp);};
  },[draggingWishId]);

  const draggedWish = wishlists.flatMap(list=>list.wishlist_items||[]).find(item=>item.id===draggingWishId) || null;
  const activeList = wishlists.find(list => list.id === activeId) || wishlists[0] || null;
  const wishes = activeList?.wishlist_items || [];
  const reservedCount = 0;

  useEffect(() => {
    if (!showPrivacy) return;
    const frame = window.requestAnimationFrame(() => {
      privacyPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [showPrivacy]);

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError || !auth.user) {
      router.replace("/login");
      return;
    }
    const user = auth.user;
    const {data:profile,error:profileLoadError}=await supabase.from("profiles").select("username,first_name,last_name,city,birth_date,birthday_visible,avatar_url,allow_user_search,allow_friend_requests,notify_friend_requests,notify_list_activity,profile_details_visible,friend_network_visibility,allow_indirect_friend_visibility,friend_network_excluded_ids").eq("id",user.id).maybeSingle();
    if(profileLoadError) throw profileLoadError;
    const metadataName = user.user_metadata?.display_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "Utente";
    const name = [profile?.first_name,profile?.last_name].filter(Boolean).join(" ") || metadataName;
    setProfileName(String(name));
    setProfileEmail(user.email || "");
    setProfileUserId(user.id);

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: user.id,
      username: profile?.username || String(metadataName),
      display_name: String(name),
    }, { onConflict: "id" });
    if (profileError) throw profileError;
    setFirstName(profile?.first_name||"");
    setLastName(profile?.last_name||"");
    setCity(profile?.city||"");
    setBirthDate(profile?.birth_date||"");
    setBirthdayVisible(profile?.birthday_visible||false);
    setAllowUserSearch(profile?.allow_user_search ?? true);
    setAllowFriendRequests(profile?.allow_friend_requests ?? true);
    setNotifyFriendRequests(profile?.notify_friend_requests ?? true);
    setNotifyListActivity(profile?.notify_list_activity ?? true);
    setProfileDetailsVisible(profile?.profile_details_visible ?? true);
    setFriendNetworkVisibility(profile?.friend_network_visibility ?? "all");
    setAllowIndirectFriendVisibility(profile?.allow_indirect_friend_visibility ?? true);
    setFriendNetworkExcludedIds(profile?.friend_network_excluded_ids ?? []);
    setProfileAvatarUrl(profile?.avatar_url||"");

    const { data, error: listError } = await supabase
      .from("wishlists")
      .select("id,title,description,share_token,image_url,is_public,private_access_mode,owner_sees_participants,participants_see_participants,owner_sees_reservations,participants_see_reservations,owner_sees_buyer,participants_see_buyer,wishlist_items(id,title,description,price,image_url,product_url,position)")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false })
      .order("position", { referencedTable: "wishlist_items", ascending: true });
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

  // Aggiorna periodicamente le richieste ricevute, mostrate nel Centro notifiche.
  useEffect(() => {
    let active = true;
    const checkPendingRequests = async () => {
      const { data, error } = await createClient().rpc("get_my_friend_requests");
      if (!active || error) return;
      setRequests(data || []);
    };
    checkPendingRequests();
    const interval = window.setInterval(checkPendingRequests, 20000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  // Aggiorna il conteggio delle notifiche non lette.
  useEffect(() => {
    let active = true;
    const checkUnreadNotifications = async () => {
      const { data, error } = await createClient().rpc("get_my_notifications", { p_limit: 100 });
      if (!active || error) return;
      setUnreadNotificationCount((data || []).filter((notification: { read_at?: string | null }) => !notification.read_at).length);
    };
    checkUnreadNotifications();
    const interval = window.setInterval(checkUnreadNotifications, 15000);
    return () => { active = false; window.clearInterval(interval); };
  }, []);

  // Carica i dati della privacy solo dopo aver aperto il pannello.
  useEffect(() => {
    if (!showPrivacy || !activeList?.id) return;
    let cancelled = false;
    const loadPrivacyData = async () => {
      try {
        await Promise.all([loadFriends(), loadFriendGroups(), loadSelectedFriends()]);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Impossibile caricare le impostazioni privacy.");
      }
    };
    loadPrivacyData();
    return () => { cancelled = true; };
  }, [showPrivacy, activeList?.id]);

  useEffect(() => {
    if (!profileUserId) return;
    try {
      const saved = localStorage.getItem("personalwish_friend_visits_"+profileUserId);
      setFriendVisitCounts(saved ? JSON.parse(saved) : {});
    } catch { setFriendVisitCounts({}); }
  }, [profileUserId]);

  async function loadFriends() {
    const supabase=createClient();
    const [{data:f},{data:r}]=await Promise.all([supabase.rpc("get_my_friends"),supabase.rpc("get_my_friend_requests")]);
    setFriends(f||[]); setRequests(r||[]);
  }

  function openFriendProfile(person:{user_id:string;display_name:string}) {
    setFriendVisitCounts(current => {
      const next = {...current, [person.user_id]: (current[person.user_id] || 0) + 1};
      try { localStorage.setItem("personalwish_friend_visits_"+profileUserId, JSON.stringify(next)); } catch {}
      return next;
    });
    router.push("/amico/"+person.user_id);
  }
  const [expandedFriendListsId,setExpandedFriendListsId]=useState<string|null>(null);
  const [friendListsById,setFriendListsById]=useState<Record<string,{id:string;title:string;description:string|null;share_token:string;created_at:string}[]>>({});
  const [loadingFriendListsId,setLoadingFriendListsId]=useState<string|null>(null);
  async function toggleFriendLists(person:{user_id:string;display_name:string}) {
    if(expandedFriendListsId===person.user_id){setExpandedFriendListsId(null);return;}
    setExpandedFriendListsId(person.user_id);
    if(friendListsById[person.user_id]) return;
    setLoadingFriendListsId(person.user_id);
    const {data,error}=await createClient().rpc("get_friend_shared_wishlists",{p_friend_id:person.user_id});
    if(error) setError(error.message);
    else setFriendListsById(current=>({...current,[person.user_id]:data||[]}));
    setLoadingFriendListsId(null);
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
    if(error) setError(error.message); else {
      const members=data||[];
      setGroupMembers(members);
      setSavedGroupMemberIds(members.map((person:{user_id:string})=>person.user_id));
    }
  }

  function toggleGroupMember(id:string,add:boolean) {
    setGroupMembers(current => add
      ? (current.some(person=>person.user_id===id) ? current : [...current, friends.find(person=>person.user_id===id)!].filter(Boolean))
      : current.filter(person=>person.user_id!==id));
  }

  async function confirmGroupMembers() {
    if(!activeGroup) return;
    setSavingGroupMembers(true);
    const currentIds=groupMembers.map(person=>person.user_id);
    const toAdd=currentIds.filter(id=>!savedGroupMemberIds.includes(id));
    const toRemove=savedGroupMemberIds.filter(id=>!currentIds.includes(id));
    for(const id of [...toRemove,...toAdd]) {
      const result=await createClient().rpc("set_friend_group_member",{
        p_group_id:activeGroup,p_friend_id:id,p_add:toAdd.includes(id)
      });
      if(result.error){setError(result.error.message);setSavingGroupMembers(false);return;}
    }
    setSavedGroupMemberIds(currentIds);
    setSavingGroupMembers(false);
    setError("Componenti del gruppo aggiornati.");
  }

  function getInviteUrl() {
    return window.location.origin + "/login?invite=" + encodeURIComponent(profileUserId);
  }

  function inviteMessage() {
    return "Ti invito su PersonalWish! Crea e condividi le tue liste dei desideri con amici e familiari: " + getInviteUrl();
  }

  async function copyInviteLink() {
    try {
      await navigator.clipboard.writeText(getInviteUrl());
      setInviteCopied(true);
    } catch {
      setError("Non riesco a copiare automaticamente il link. Puoi copiarlo da: " + getInviteUrl());
    }
  }

  function shareInviteWhatsApp() {
    window.open("https://wa.me/?text=" + encodeURIComponent(inviteMessage()), "_blank", "noopener,noreferrer");
  }

  function shareInviteFacebook() {
    window.open("https://www.facebook.com/sharer/sharer.php?u=" + encodeURIComponent(getInviteUrl()), "_blank", "noopener,noreferrer");
  }

  async function shareInviteNative() {
    if (navigator.share) {
      try { await navigator.share({ title: "Invito a PersonalWish", text: inviteMessage(), url: getInviteUrl() }); }
      catch (err) { if (!(err instanceof Error && err.name === "AbortError")) setError("Condivisione non disponibile."); }
    } else {
      await copyInviteLink();
      setError("Link copiato: incollalo nell'app in cui vuoi invitare il tuo amico.");
    }
  }

  function shareInviteEmail() {
    window.location.href = "mailto:?subject=" + encodeURIComponent("Ti invito su PersonalWish") + "&body=" + encodeURIComponent(inviteMessage());
  }

  async function searchFriends() {
    const term=friendSearch.trim();
    if(term.length<3) { setFriendResults([]); setError("Inserisci almeno 3 caratteri del nome utente oppure l'email completa."); return; }
    const {data,error}=await createClient().rpc("search_personalwish_users",{p_term:term});
    if(error) setError(error.message);
    else {
      setFriendResults(data||[]);
      setError(data?.length ? "" : "Nessun utente trovato. Controlla il nome utente esatto o l'email completa.");
    }
  }

  async function sendFriendRequest(id:string) {
    const {error}=await createClient().rpc("send_friend_request",{p_recipient_id:id,p_share_token:null});
    if(error) setError(error.message); else {setError("Richiesta di amicizia inviata.");setFriendResults([]);setFriendSearch("");}
  }

  async function answerFriendRequest(id:string,accept:boolean) {
    const {error}=await createClient().rpc("respond_friend_request",{p_request_id:id,p_accept:accept});
    if(error) setError(error.message); else await loadFriends();
  }

  async function removeFriend(person:{user_id:string;display_name:string}) {
    if(!window.confirm("Vuoi rimuovere "+person.display_name+" dai tuoi amici?")) return;
    const {error}=await createClient().rpc("remove_friend",{p_friend_id:person.user_id});
    if(error) setError(error.message);
    else {
      if(selectedFriend?.user_id===person.user_id) setSelectedFriend(null);
      setError(person.display_name+" è stato rimosso dai tuoi amici.");
      await Promise.all([loadFriends(),loadFriendGroups(),loadSelectedFriends()]);
    }
  }

  async function setListVisibility(isPublic:boolean,mode:"all_friends"|"selected"|"owner_only") {
    if(!activeList) return;
    const {error}=await createClient().rpc("set_wishlist_access",{p_wishlist_id:activeList.id,p_is_public:isPublic,p_mode:mode});
    if(error) setError(error.message); else await loadData();
  }

  async function toggleSelectedFriend(id:string,allowed:boolean) {
    if(!activeList) return;
    const {error}=await createClient().rpc("set_wishlist_friend_access",{p_wishlist_id:activeList.id,p_friend_id:id,p_allow:allowed});
    if(error) setError(error.message); else await loadSelectedFriends();
  }

  async function toggleSelectedGroup(groupId:string,allow:boolean) {
    if(!activeList) return;
    const supabase=createClient();
    const {data,error}=await supabase.rpc("get_friend_group_members",{p_group_id:groupId});
    if(error){setError(error.message);return;}
    // Seleziona esclusivamente i componenti del gruppo scelto.
    const groupIds=(data||[]).map((person:{user_id:string})=>person.user_id);
    const {data:current,error:currentError}=await supabase.from("wishlist_members").select("user_id").eq("wishlist_id",activeList.id);
    if(currentError){setError(currentError.message);return;}
    const currentIds=(current||[]).map((person:{user_id:string})=>person.user_id);
    const targetIds=allow?groupIds:[];
    for(const id of currentIds.filter((id:string)=>!targetIds.includes(id))){
      const result=await supabase.rpc("set_wishlist_friend_access",{p_wishlist_id:activeList.id,p_friend_id:id,p_allow:false});
      if(result.error){setError(result.error.message);return;}
    }
    for(const id of targetIds.filter((id:string)=>!currentIds.includes(id))){
      const result=await supabase.rpc("set_wishlist_friend_access",{p_wishlist_id:activeList.id,p_friend_id:id,p_allow:true});
      if(result.error){setError(result.error.message);return;}
    }
    await loadSelectedFriends();
  }

  async function deleteFriendGroup(groupId:string,groupName:string) {
    if(!window.confirm(`Vuoi eliminare il gruppo "${groupName}"?`)) return;
    const {error}=await createClient().rpc("delete_friend_group",{p_group_id:groupId});
    if(error){setError(error.message);return;}
    if(activeGroup===groupId){setActiveGroup("");setGroupMembers([]);}
    await loadFriendGroups();
  }

  async function loadSelectedFriends() {
    if(!activeList) return;
    const supabase=createClient();
    const {data,error}=await supabase.from("wishlist_members").select("user_id").eq("wishlist_id",activeList.id);
    if(error){setError(error.message);return;}
    const ids=(data||[]).map(x=>x.user_id);
    setSelectedFriends(ids);
    const selectedGroups:string[]=[];
    for(const group of friendGroups) {
      const {data:members}=await supabase.rpc("get_friend_group_members",{p_group_id:group.group_id});
      const memberIds=(members||[]).map((person:{user_id:string})=>person.user_id);
      if(memberIds.length>0 && memberIds.every((id:string)=>ids.includes(id)) && ids.every((id:string)=>memberIds.includes(id))) {
        selectedGroups.push(group.group_id);
      }
    }
    setSelectedGroupIds(selectedGroups);
  }

  async function saveProfile() {
    setSavingProfile(true);setError("");
    const fullName=[firstName.trim(),lastName.trim()].filter(Boolean).join(" ")||profileName;
    const {error}=await createClient().from("profiles").update({
      first_name:firstName.trim()||null,
      last_name:lastName.trim()||null,
      display_name:fullName,
      birth_date:birthDate||null,
      city:city.trim()||null,
      birthday_visible:birthdayVisible,
    }).eq("id",profileUserId);
    if(error) setError("Non è stato possibile salvare il profilo: "+error.message);
    else {setProfileName(fullName);setError("Profilo aggiornato.");}
    setSavingProfile(false);
  }

  async function savePrivacySettings() {
    setSavingPrivacySettings(true);
    setError("");
    const {error}=await createClient().from("profiles").update({
      allow_user_search:allowUserSearch,
      allow_friend_requests:allowFriendRequests,
      notify_friend_requests:notifyFriendRequests,
      notify_list_activity:notifyListActivity,
      profile_details_visible:profileDetailsVisible,
      friend_network_visibility:friendNetworkVisibility,
      allow_indirect_friend_visibility:allowIndirectFriendVisibility,
      friend_network_excluded_ids:friendNetworkVisibility==="except"?friendNetworkExcludedIds:[],
    }).eq("id",profileUserId);
    if(error) setError("Non è stato possibile salvare le preferenze: "+error.message);
    else setError("Preferenze di privacy e sicurezza salvate.");
    setSavingPrivacySettings(false);
  }


  async function uploadProfileAvatar(file:File|null) {
    if(!file)return;
    if(!file.type.startsWith("image/")){setError("Seleziona un'immagine valida.");return;}
    if(file.size>5*1024*1024){setError("La foto deve essere inferiore a 5 MB.");return;}
    setUploadingAvatar(true);setError("");
    const supabase=createClient();
    const ext=(file.name.split(".").pop()||"jpg").replace(/[^a-zA-Z0-9]/g,"").toLowerCase()||"jpg";
    const path=`${profileUserId}/profile/avatar-${Date.now()}.${ext}`;
    const {error:uploadError}=await supabase.storage.from("wishlist-images").upload(path,file,{upsert:true,contentType:file.type});
    if(uploadError){setError("Caricamento foto non riuscito: "+uploadError.message);setUploadingAvatar(false);return;}
    const url=supabase.storage.from("wishlist-images").getPublicUrl(path).data.publicUrl;
    const {error:updateError}=await supabase.from("profiles").update({avatar_url:url}).eq("id",profileUserId);
    if(updateError)setError("Foto caricata ma non salvata: "+updateError.message);
    else setProfileAvatarUrl(url+"?v="+Date.now());
    setUploadingAvatar(false);
  }


  async function exportWishlistText() {
    if(!activeList)return;
    const lines=wishes.flatMap((w,i)=>[`${i+1}. ${w.title}`,...(w.product_url?[w.product_url]:[]),""]);
    const file=new File([lines.join("\n")],(activeList.title||"lista").replace(/[^a-z0-9-_ ]/gi,"").trim().replace(/\s+/g,"-")+".txt",{type:"text/plain;charset=utf-8"});
    try {
      if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))) {
        await navigator.share({files:[file],title:activeList.title||"Lista PersonalWish"});
        return;
      }
    } catch(err) {
      if(err instanceof Error&&err.name==="AbortError")return;
    }
    const url=URL.createObjectURL(file);const a=document.createElement("a");a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  async function exportWishlistPdf() {
    if(!activeList)return;
    const clean=(value:string)=>value.normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^\x20-\x7E]/g,"?");
    const wrap=(value:string,max=78)=>{const words=clean(value).split(/\s+/);const out:string[]=[];let line="";for(const word of words){if((line+" "+word).trim().length>max&&line){out.push(line);line=word;}else line=(line+" "+word).trim();}if(line)out.push(line);return out;};
    const pageLines:{text:string;url?:string;bold?:boolean}[][]=[[]];
    const add=(line:{text:string;url?:string;bold?:boolean})=>{let page=pageLines[pageLines.length-1];if(page.length>=48){pageLines.push([]);page=pageLines[pageLines.length-1];}page.push(line);};
    add({text:clean(activeList.title),bold:true});add({text:""});
    wishes.forEach((w,i)=>{wrap(`${i+1}. ${w.title}`,70).forEach((line,j)=>add({text:line,bold:j===0}));const productUrl=w.product_url;if(productUrl){wrap(productUrl,78).forEach((line,j)=>add({text:line,url:j===0?productUrl:undefined}));}add({text:""});});
    const objects:string[]=[];
    const addObj=(value:string)=>{objects.push(value);return objects.length;};
    const catalogId=addObj("");
    const pagesId=addObj("");
    const fontId=addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    const boldFontId=addObj("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
    const pageIds:number[]=[];
    const pageRefs:string[]=[];
    pageLines.forEach((lines)=>{
      let y=790;const commands:string[]=[];const annots:number[]=[];
      lines.forEach(line=>{
        if(line.text===""){y-=10;return;}
        const font=line.bold?boldFontId:fontId;
        const escaped=line.text.replace(/\\/g,"\\\\").replace(/\(/g,"\\(").replace(/\)/g,"\\)");
        commands.push(`BT /${line.bold?"F2":"F1"} 11 Tf 50 ${y} Td (${escaped}) Tj ET`);
        if(line.url){const width=Math.min(495,Math.max(40,line.text.length*5.5));const safeUrl=encodeURI(line.url).replace(/\\/g,"%5C").replace(/\(/g,"%28").replace(/\)/g,"%29");const aid=addObj(`<< /Type /Annot /Subtype /Link /Rect [50 ${y-3} ${50+width} ${y+11}] /Border [0 0 0] /A << /S /URI /URI (${safeUrl}) >> >>`);annots.push(aid);}
        y-=17;
      });
      const stream=commands.join("\n");
      const contentId=addObj(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
      const pageId=addObj(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R /F2 ${boldFontId} 0 R >> >> /Contents ${contentId} 0 R /Annots [${annots.map(id=>id+" 0 R").join(" ")}] >>`);
      pageIds.push(pageId);pageRefs.push(pageId+" 0 R");
    });
    objects[catalogId-1]=`<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objects[pagesId-1]=`<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pageIds.length} >>`;
    let pdf="%PDF-1.4\n";
    const offsets=[0];
    objects.forEach((obj,i)=>{offsets.push(pdf.length);pdf+=`${i+1} 0 obj\n${obj}\nendobj\n`;});
    const xref=pdf.length;pdf+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;
    offsets.slice(1).forEach(offset=>{pdf+=String(offset).padStart(10,"0")+" 00000 n \n";});
    pdf+=`trailer\n<< /Size ${objects.length+1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF`;
    const file=new File([new TextEncoder().encode(pdf)],(activeList.title||"lista").replace(/[^a-z0-9-_ ]/gi,"").trim().replace(/\s+/g,"-")+".pdf",{type:"application/pdf"});
    try{
      if(navigator.canShare?.({files:[file]})&&navigator.share){await navigator.share({files:[file],title:activeList.title||"Lista PersonalWish"});return;}
    }catch(err){if(err instanceof Error&&err.name==="AbortError")return;setError("Condivisione non disponibile: avvio il download del PDF.");}
    const url=URL.createObjectURL(file);const link=document.createElement("a");link.href=url;link.download=file.name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  async function importWishlistText(file:File|null, destination: "existing"|"new" = importDestination, newTitle = importNewListTitle, targetListId = importTargetListId) {
    if(!file)return;
    const extension=file.name.toLowerCase().split(".").pop();
    if(!["txt","doc","docx","pdf"].includes(extension||"")){setError("Scegli un file TXT, DOC, DOCX o PDF.");return;}
    if(destination==="new"&&!newTitle.trim()){setError("Inserisci il nome della nuova lista.");return;}
    if(destination==="existing"&&!targetListId){setError("Seleziona la lista in cui importare i desideri.");return;}
    setBusy(true);setError("");
    try {
      let raw="";
      if(extension==="txt") raw=await file.text();
      else {
        const form=new FormData();form.append("file",file);
        const response=await fetch("/api/import-document",{method:"POST",body:form});
        const data=await response.json();
        if(!response.ok)throw new Error(data.error||"Non riesco a leggere il documento.");
        raw=data.text||"";
      }
      const rows=raw.replace(/\r/g,"").split("\n").map(line=>line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/,"").trim()).filter(Boolean);
      const products:{title:string;product_url:string|null}[]=[];
      for(const row of rows){
        if(/^https?:\/\//i.test(row)&&products.length&&!products[products.length-1].product_url){products[products.length-1].product_url=row;continue;}
        products.push({title:row,product_url:null});
      }
      const unique=products.filter((item,index)=>products.findIndex(other=>other.title.toLowerCase()===item.title.toLowerCase())===index);
      if(!unique.length)throw new Error("Nel documento non ho trovato prodotti da importare.");
      const destinationTitle=destination==="new" ? newTitle.trim() : (wishlists.find(list=>list.id===targetListId)?.title||"");
      if(!destinationTitle)throw new Error("Non è stato possibile identificare la lista di destinazione.");
      const filtered=unique.filter(item=>item.title.toLowerCase()!==destinationTitle.toLowerCase());
      if(!filtered.length)throw new Error("Nel documento non ho trovato desideri da importare.");
      if(!window.confirm(`Importare ${filtered.length} desideri nella lista "${destinationTitle}"?`))return;
      let destinationId=targetListId;
      if(destination==="new") {
        const supabase=createClient();
        const {data:auth}=await supabase.auth.getUser();
        if(!auth.user)throw new Error("Sessione scaduta. Accedi nuovamente.");
        const {data:list,error:listError}=await supabase.from("wishlists").insert({
          owner_id:auth.user.id,title:destinationTitle,description:"Una raccolta di cose che mi piacerebbe ricevere.",
        }).select("id").single();
        if(listError||!list)throw new Error("Non è stato possibile creare la nuova lista: "+(listError?.message||"errore sconosciuto"));
        destinationId=list.id;
      }
      const {error}=await createClient().from("wishlist_items").insert(filtered.map(item=>({wishlist_id:destinationId,title:item.title,product_url:item.product_url})));
      if(error) {
        if(destination==="new") await createClient().from("wishlists").delete().eq("id",destinationId);
        throw new Error("Importazione non riuscita: "+error.message);
      }
      setError(`Importati ${filtered.length} desideri nella lista "${destinationTitle}".`);
      setShowHomeListActions(false);setHomeListAction(null);setImportNewListTitle("");
      await loadData();setActiveId(destinationId);
    } catch(err) {
      setError(err instanceof Error?err.message:"Errore durante l'importazione del documento.");
    } finally {setBusy(false);}
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }
  async function deleteMyAccount() {
    const confirmed = window.confirm("Vuoi eliminare definitivamente il tuo account PersonalWish? Verranno cancellati anche profilo, liste e dati collegati. Questa operazione non può essere annullata.");
    if (!confirmed) return;
    setDeletingAccount(true);
    setError("");
    const supabase = createClient();
    const { error: deleteError } = await supabase.rpc("delete_my_account");
    if (deleteError) {
      setError("Non è stato possibile eliminare l'account: " + deleteError.message + ". Verifica di aver applicato la procedura SQL di eliminazione account in Supabase.");
      setDeletingAccount(false);
      return;
    }
    try { await supabase.auth.signOut(); } catch {}
    router.replace("/login?accountDeleted=1");
    router.refresh();
  }


  async function createWishlist() {
    const title = newListTitle.trim();
    if (!title) return;
    setBusy(true); setError("");
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) { router.replace("/login"); setBusy(false); return; }
    const { data, error: insertError } = await supabase.from("wishlists").insert({
      owner_id: auth.user.id,title,description:"Una raccolta di cose che mi piacerebbe ricevere.",
    }).select("id").single();
    if (insertError) setError(insertError.message);
    else {
      setNewListTitle("");setShowNewListForm(false);setShowHomeListActions(false);setHomeListAction(null);
      await loadData();if(data?.id)setActiveId(data.id);
    }
    setBusy(false);
  }

  async function updateWishlistTitle() {
    if(!activeList) return;
    const title=editedListTitle.trim();
    if(!title){setError("Inserisci un nome per la lista.");return;}
    setBusy(true);setError("");
    const {error}=await createClient().from("wishlists").update({title}).eq("id",activeList.id);
    if(error) setError(error.message);
    else {setEditingListTitle(false);await loadData();}
    setBusy(false);
  }

  async function updateWishlistImage(file:File|null) {
    if(!activeList || !file) return;
    if(!file.type.startsWith("image/")){setError("Seleziona un file immagine.");return;}
    if(file.size>5*1024*1024){setError("L'immagine deve essere inferiore a 5 MB.");return;}
    setUploadingListImage(true);setError("");
    const supabase=createClient();
    const path=`${profileUserId}/${activeList.id}/cover-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
    const {error:uploadError}=await supabase.storage.from("wishlist-images").upload(path,file,{upsert:true,contentType:file.type});
    if(uploadError){setError("Caricamento immagine non riuscito: "+uploadError.message);setUploadingListImage(false);return;}
    const {data}=supabase.storage.from("wishlist-images").getPublicUrl(path);
    const {error:updateError}=await supabase.from("wishlists").update({image_url:data.publicUrl}).eq("id",activeList.id);
    if(updateError) setError("Immagine caricata ma non salvata nella lista: "+updateError.message);
    else {setShowEditMenu(false);await loadData();}
    setUploadingListImage(false);
  }

  async function deleteWishlist() {
    if(!activeList) return;
    if(!window.confirm(`Vuoi eliminare definitivamente la lista "${activeList.title}" e tutti i suoi desideri? L'operazione non può essere annullata.`)) return;
    setBusy(true);setError("");
    const {error}=await createClient().from("wishlists").delete().eq("id",activeList.id);
    if(error) setError("Non è stato possibile eliminare la lista: "+error.message);
    else {
      setShowPrivacy(false);
      setShowShareMenu(false);
      setEditingListTitle(false);
      await loadData();
    }
    setBusy(false);
  }

  function resetWishEditor() {
    setNewWish("");setWishDescription("");setWishUrl("");setWishImage("");setWishPrice("");
    setEditingWishId(null);setWishMode("manual");setShowWishEditor(false);
  }

  async function fetchProductDetails() {
    if(!wishUrl.trim() || fetchingProduct)return;
    let url:string;
    try{url=new URL(wishUrl.trim()).toString();if(!["http:","https:"].includes(new URL(url).protocol))throw new Error();}
    catch{setError("Inserisci un link valido che inizi con https://");return;}
    setFetchingProduct(true);setError("");setWishUrl(url);setWishMode("link");
    const host=new URL(url).hostname.toLowerCase();
    const isAmazon=host.includes("amazon.")||host==="amzn.eu"||host.endsWith(".amzn.eu");
    try{
      let lastError:Error|null=null;
      const attempts=isAmazon?3:1;
      for(let attempt=0;attempt<attempts;attempt++){
        try{
          const response=await fetch("/api/product-preview",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({url,includeImage:true}),signal:AbortSignal.timeout(17000)});
          const data=await response.json();
          if(!response.ok)throw new Error(data.error||"Il negozio non ha restituito i dati del prodotto.");
          if(!data.title)throw new Error("Nome non disponibile.");
          setNewWish(data.title);
          if(data.image)setWishImage(data.image);
          if(data.description)setWishDescription(data.description);
          if(isAmazon&&!data.image)setError("Nome recuperato. Amazon non ha fornito la foto: puoi aggiungerla dalla galleria.");
          lastError=null;
          break;
        }catch(error){
          lastError=error instanceof Error?error:new Error("Recupero non riuscito");
          if(attempt<attempts-1)await new Promise(resolve=>setTimeout(resolve,900*(attempt+1)));
        }
      }
      if(lastError)throw lastError;
    }catch{
      setError(isAmazon?"Amazon non ha restituito i dati neanche dopo 3 tentativi automatici. Il link è conservato: puoi completare i campi manualmente.":"Non riesco a leggere i dati del prodotto. Il link è conservato: puoi completare i campi manualmente.");
    }finally{setFetchingProduct(false);}
  }

  async function uploadWishImage(file:File|null) {
    if(!file) return;
    if(!file.type.startsWith("image/")){setError("Seleziona un'immagine valida.");return;}
    if(file.size>5*1024*1024){setError("L'immagine deve essere inferiore a 5 MB.");return;}
    setSavingWishImage(true);setError("");
    const path=`${profileUserId}/${activeList?.id}/wish-${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
    const supabase=createClient();
    const {error}=await supabase.storage.from("wishlist-images").upload(path,file,{upsert:true,contentType:file.type});
    if(error) setError("Caricamento immagine non riuscito: "+error.message);
    else setWishImage(supabase.storage.from("wishlist-images").getPublicUrl(path).data.publicUrl);
    setSavingWishImage(false);
  }

  function openWishEditor(wish?:WishItem) {
    if(wish) {
      setEditingWishId(wish.id);setNewWish(wish.title);setWishDescription(wish.description||"");
      setWishUrl(wish.product_url||"");setWishImage(wish.image_url||"");
      setWishPrice(wish.price==null?"":String(wish.price));setWishMode(wish.product_url?"link":"manual");
    } else resetWishEditor();
    setShowWishEditor(true);
  }

  async function addWish() {
    if (!newWish.trim() || !activeList) return;
    setBusy(true); setError("");
    const supabase=createClient();
    const payload={
      wishlist_id:activeList.id,title:newWish.trim(),description:wishDescription.trim(),
      image_url:wishImage.trim()||null,product_url:wishUrl.trim()||null,
      price:wishPrice.trim()?Number(wishPrice.replace(",",".")):null,position:editingWishId?wishes.findIndex(w=>w.id===editingWishId):wishes.length,
    };
    const result=editingWishId
      ? await supabase.from("wishlist_items").update(payload).eq("id",editingWishId)
      : await supabase.from("wishlist_items").insert(payload);
    if(result.error) setError(result.error.message);
    else {resetWishEditor();await loadData();}
    setBusy(false);
  }

  async function moveWish(draggedId:string,targetId:string) {
    if(!activeList||draggedId===targetId)return;
    const ordered=[...wishes];const from=ordered.findIndex(item=>item.id===draggedId),to=ordered.findIndex(item=>item.id===targetId);
    if(from<0||to<0)return;
    const [moved]=ordered.splice(from,1);ordered.splice(to,0,moved);
    setWishlists(current=>current.map(list=>list.id===activeList.id?{...list,wishlist_items:ordered}:list));
    const supabase=createClient();
    const updates=await Promise.all(ordered.map((item,index)=>supabase.from("wishlist_items").update({position:index}).eq("id",item.id)));
    const failed=updates.find(result=>result.error);
    if(failed?.error){setError("Non sono riuscito a salvare il nuovo ordine: "+failed.error.message);await loadData();}
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
    return `https://personalwish.vercel.app/lista/${activeList.share_token}`;
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
      {draggingWishId&&dragPointer&&draggedWish&&<div className="wishDragGhost" style={{left:dragPointer.x+14,top:dragPointer.y+14}}><span>{draggedWish.image_url?<img src={draggedWish.image_url} alt=""/>:"🎁"}</span><b>{draggedWish.title}</b></div>}
      <aside className="sidebar">
        <a className="brand" href="/"><span className="brandIcon"><Gift size={21}/></span><span>Personal<span className="brandAccent">Wish</span></span></a>
        <div className="workspaceLabel">IL TUO SPAZIO</div>
        <button className={`navItem ${tab === "lists" ? "active" : ""}`} onClick={() => setTab("lists")}><Heart size={18}/> Le mie liste <span className="navCount">{wishlists.length}</span></button>
        <button className={`navItem ${tab === "friends" ? "active" : ""}`} onClick={() => { setTab("friends"); loadFriends(); loadFriendGroups(); }}><Users size={18}/> Amici</button>
        <button className={`navItem ${tab === "groups" ? "active" : ""}`} onClick={() => setTab("groups")}><Users size={18}/> I miei gruppi</button>
        <a className="navItem chatNavLink" href="/notifiche"><Bell size={18}/> Notifiche{unreadNotificationCount > 0 && <span className="chatUnreadDot" aria-label="Notifiche non lette"/>}</a>
        <button className={`navItem ${tab === "settings" ? "active" : ""}`} onClick={() => { setTab("settings"); loadFriends(); }}><Settings2 size={18}/> Impostazioni</button>\n        <button className={`navItem ${tab === "transfer" ? "active" : ""}`} onClick={() => setTab("transfer")}><ArrowDownUp size={18}/> Importa / Esporta</button>
        <div className="sideBottom"><div className="avatar">{profileAvatarUrl?<img src={profileAvatarUrl} alt="Foto profilo"/>:profileName.charAt(0).toUpperCase()}</div><div><b>{loading ? "Caricamento..." : profileName}</b><small>Account personale</small></div><button className="outline" onClick={signOut}><LogOut size={15}/> Esci</button></div>
      </aside>

      <section className="content">
        <header className="topbar"><a className="mobileBrand" href="/" aria-label="Torna alla pagina iniziale"><Gift size={20}/> PersonalWish</a><div className="crumb">Il tuo spazio <span>/</span> {tab === "lists" ? "Le mie liste" : tab === "friends" ? "Amici" : tab === "groups" ? "I miei gruppi" : tab === "profile" ? "Il mio profilo" : tab === "transfer" ? "Importa / Esporta" : "Impostazioni"}</div><div className="topActions"><a className="notificationQuickLink" href="/notifiche" aria-label={unreadNotificationCount > 0 ? `Apri le notifiche: ${unreadNotificationCount} non lette` : "Apri le notifiche"} title="Notifiche"><Bell size={19}/>{(unreadNotificationCount > 0 || requests.length > 0) && <span className="notificationBellDot" aria-label="Notifiche o richieste di amicizia non lette"/>}</a><div className="accountMenuWrap"><button type="button" className="avatar small accountAvatar" aria-label={requests.length && tab !== "friends" ? "Apri menu account: hai nuove richieste di amicizia" : "Apri menu account"} aria-expanded={showAccountMenu} onClick={() => setShowAccountMenu(v => !v)}>{profileAvatarUrl?<img src={profileAvatarUrl} alt="Foto profilo"/>:profileName.charAt(0).toUpperCase()}</button>{showAccountMenu && <div className="accountDropdown"><div className="accountDropdownUser"><b>{profileName}</b><small>{profileEmail}</small></div><button className="accountFriendsButton" onClick={() => { setTab("friends"); loadFriends(); loadFriendGroups(); setShowAccountMenu(false); }}><Users size={16}/> Amici{requests.length > 0 && <span className="accountFriendsBadge">{requests.length > 9 ? "9+" : requests.length}</span>}</button><button onClick={() => { setTab("profile"); setShowAccountMenu(false); }}><UserRound size={16}/> Il mio profilo</button><button onClick={() => { setTab("settings"); loadFriends(); setShowAccountMenu(false); }}><Settings2 size={16}/> Impostazioni</button><button onClick={() => { setTab("transfer"); setShowAccountMenu(false); }}><ArrowDownUp size={16}/> Importa / Esporta</button><button className="accountLogout" onClick={() => { setShowAccountMenu(false); signOut(); }}><LogOut size={16}/> Esci</button></div>}</div></div></header>

        {error && <div className="authError" role="alert">{error}</div>}
        {loading ? <div className="settingsCard"><LoaderCircle size={20}/> Caricamento delle tue liste...</div> : null}

        {tab === "lists" && !loading && <>
          <div className="welcome"><div><div className="eyebrow">LA TUA WISHLIST</div><h1>I desideri prendono forma.</h1><p>Crea le tue liste e condividile con le persone a cui tieni.</p></div></div>
          <div className="wishlistCarousel" aria-label="Le tue liste">
            {wishlists.map(list=><button type="button" key={list.id} className={`wishlistCard ${activeList?.id===list.id ? "active" : ""}`} onClick={()=>setActiveId(list.id)}>
              {list.image_url ? <img src={list.image_url} alt="" className="wishlistCardImage"/> : <div className="wishlistCardImage wishlistCardPlaceholder">🎁</div>}
              <span className="wishlistCardTitle">{list.title}</span>
              <span className="wishlistCardCount">{list.wishlist_items?.length || 0} desideri</span>
            </button>)}
            <button type="button" className="wishlistCard wishlistAddCard" onClick={()=>{setShowHomeListActions(v=>!v);setHomeListAction(null);setShowNewListForm(false);}}>
              <span className="wishlistAddIcon"><Plus size={24}/></span><span className="wishlistCardTitle">Nuova lista</span><span className="wishlistCardCount">Crea o importa</span>
            </button>
          </div>
          {showHomeListActions && <div className="importWorkflowCard">
            <div className="importWorkflowActions">
              <button type="button" className={homeListAction==="create"?"selected":""} onClick={()=>{setHomeListAction("create");setShowNewListForm(true);}}> <Plus size={16}/> Crea</button>
              <button type="button" className={homeListAction==="import"?"selected":""} onClick={()=>{setHomeListAction("import");setShowNewListForm(false);setImportDestination("new");setImportNewListTitle("");}}> <ArrowDownUp size={16}/> Importa</button>
            </div>
            {homeListAction==="create" && <div className="addRow"><input value={newListTitle} onChange={e=>setNewListTitle(e.target.value)} placeholder="Nome della nuova lista..."/><button onClick={createWishlist} disabled={busy || !newListTitle.trim()}><Plus size={17}/> Crea lista</button></div>}
            {homeListAction==="import" && <div className="importWorkflowForm"><label>Nome della nuova lista</label><input value={importNewListTitle} onChange={e=>setImportNewListTitle(e.target.value)} placeholder="Es. Regali di Natale"/><button type="button" onClick={()=>importTextRef.current?.click()} disabled={busy||!importNewListTitle.trim()}><ArrowDownUp size={16}/> Scegli file da importare</button><small>Formati supportati: TXT, DOC, DOCX e PDF</small><input ref={importTextRef} type="file" accept=".txt,.doc,.docx,.pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf" hidden onChange={e=>{importWishlistText(e.target.files?.[0]||null,"new",importNewListTitle);e.currentTarget.value="";}}/></div>}
          </div>}
          {activeList ? <>
            <div className="listHero">
              <button type="button" className="listSettingsButton" aria-label="Impostazioni lista" title="Impostazioni lista" aria-expanded={showEditMenu} onClick={()=>setShowEditMenu(v=>!v)}><Settings2 size={20}/></button>
              {showEditMenu && <>
                <button type="button" className="listSettingsBackdrop" aria-label="Chiudi menu" onClick={()=>setShowEditMenu(false)}/>
                <div className="listSettingsMenu">
                  <div className="listSettingsMenuTitle">Modifica lista</div>
                  <button type="button" className="listSettingsMenuItem" onClick={()=>{setEditedListTitle(activeList.title);setEditingListTitle(v=>!v);}}><span>Nome lista</span><ChevronDown size={15} className={editingListTitle?"menuChevronOpen":""}/></button>
                  {editingListTitle && <div className="listSettingsSubpanel"><input value={editedListTitle} onChange={e=>setEditedListTitle(e.target.value)} placeholder="Nuovo nome della lista..." maxLength={80}/><div><button type="button" onClick={updateWishlistTitle} disabled={busy || !editedListTitle.trim()}>Salva</button><button type="button" className="outline" onClick={()=>setEditingListTitle(false)}>Annulla</button></div></div>}
                  <button type="button" className="listSettingsMenuItem" onClick={()=>imageInputRef.current?.click()} disabled={uploadingListImage}><span>{uploadingListImage ? "Caricamento immagine..." : "Immagine"}</span><ChevronDown size={15}/></button>
                  <input ref={imageInputRef} type="file" accept="image/*" disabled={uploadingListImage} onChange={e=>{updateWishlistImage(e.target.files?.[0]||null);e.currentTarget.value="";}} style={{display:"none"}} />
                  <button type="button" className="listSettingsMenuItem" onClick={()=>{setShowEditMenu(false);setShowPrivacy(true);}}><span>Privacy lista</span><Settings2 size={15}/></button>
                  <div className="listSettingsMenuDivider"/>
                  <button type="button" className="listSettingsMenuItem danger" onClick={deleteWishlist} disabled={busy}><span>Elimina lista</span><Trash2 size={15}/></button>
                </div>
              </>}
              <div className="heroCopy"><div className="listTag"><Sparkles size={13}/> LISTA PERSONALE</div><h2>{activeList.title}</h2><p>{activeList.description || "Una raccolta di cose che mi piacerebbe ricevere."}</p><div className="heroMeta"><span><Gift size={15}/> {wishes.length} desideri</span><span><Users size={15}/> {activeList.is_public ? "Lista pubblica" : "Lista privata"}</span></div><div className="addRow"><button className="shareButton" onClick={() => setShowShareMenu(true)}><Link2 size={16}/> Condividi lista</button></div></div>
              <div className="heroArt"><div className="orb orbOne"/><div className="orb orbTwo"/>{activeList.image_url ? <img className="listCoverImage" src={activeList.image_url} alt={"Immagine della lista "+activeList.title}/> : <div className="giftBox">🎁</div>}<div className="floating f1">💝</div><div className="floating f2">✨</div><div className="floating f3">🎀</div></div>
            </div>
            <div className="sectionHead"><div><h3>I tuoi desideri</h3><p>{wishes.length} desideri nella lista</p></div></div>
            {showPrivacy && <section ref={privacyPanelRef} className="privacyPanel"><div className="privacyHead"><div><div className="eyebrow">CONTROLLO ACCESSI</div><h3>Privacy di questa lista</h3><p>Scegli cosa possono vedere il creatore e gli altri partecipanti.</p></div><button className="closeBtn" onClick={() => setShowPrivacy(false)}>×</button></div>
              <div className="privacyGroup"><h4>Accesso alla lista</h4><div className="accessChoice"><button className={activeList.is_public ? "selected" : ""} onClick={() => setListVisibility(true,"selected")}>Pubblica · tutti gli utenti</button><button className={!activeList.is_public && activeList.private_access_mode==="all_friends" ? "selected" : ""} onClick={() => setListVisibility(false,"all_friends")}>Privata · tutti i miei amici</button><button className={!activeList.is_public && activeList.private_access_mode==="selected" ? "selected" : ""} onClick={() => {setListVisibility(false,"selected");loadSelectedFriends();}}>Privata · amici selezionati</button><button className={!activeList.is_public && activeList.private_access_mode==="owner_only" ? "selected" : ""} onClick={() => setListVisibility(false,"owner_only")}>Privata · solo io</button></div>{!activeList.is_public && activeList.private_access_mode==="selected" && <div className="friendChecks"><b>Amici autorizzati</b>{friendGroups.map(group=><div className="groupAccessRow" key={group.group_id}><span><b>{group.group_name}</b> · {group.member_count} amici</span><span className="groupSelectedMark" aria-label={selectedGroupIds.includes(group.group_id) ? "Gruppo selezionato" : "Gruppo non selezionato"}>{selectedGroupIds.includes(group.group_id) ? "✓" : ""}</span><button type="button" onClick={()=>toggleSelectedGroup(group.group_id,true)}>Seleziona solo questo gruppo</button></div>)}{friends.map(friend=><label key={friend.user_id}><input type="checkbox" checked={selectedFriends.includes(friend.user_id)} onChange={e=>toggleSelectedFriend(friend.user_id,e.target.checked)}/>{friend.display_name}</label>)}{friends.length===0 && <small>Non hai ancora amici. Aggiungili dalla sezione Amici.</small>}</div>}</div><div className="privacyGroup"><h4>Visibilità</h4>{privacyLabels.map(({ key, label }) => <PrivacyToggle key={key} label={label} value={activeList[key]} onClick={() => togglePrivacy(key)}/>)}</div>
              <div className="privacyNote"><LockKeyhole size={16}/> Le impostazioni vengono salvate direttamente nel database.</div>
            </section>}
            <div className="addRow"><button type="button" onClick={()=>openWishEditor()}><Plus size={17}/> Aggiungi un desiderio</button></div>
            {wishes.length ? <>
              <div className="ownerViewToolbar">
                <span>Visualizzazione</span>
                <div className="sharedViewSwitch" role="group" aria-label="Visualizzazione desideri">
                  <button type="button" className={displayMode === "grid" ? "selected" : ""} onClick={() => changeDisplayMode("grid")} aria-pressed={displayMode === "grid"}><LayoutGrid size={16}/> Schede</button>
                  <button type="button" className={displayMode === "list" ? "selected" : ""} onClick={() => changeDisplayMode("list")} aria-pressed={displayMode === "list"}><List size={16}/> Lista</button>
                </div>
              </div>
              {displayMode === "grid" ? (
                <div className="wishGrid">{wishes.map((wish, i) => <article data-wish-id={wish.id} className={`wishCard ${draggingWishId===wish.id?"wishDragging":""} ${dragOverWishId===wish.id&&draggingWishId!==wish.id?"wishDropTarget":""}`} key={wish.id}><div className={`wishImage image${i % 3}`}><button type="button" className="wishDragHandle" title="Trascina per riordinare" aria-label={`Trascina ${wish.title}`} onPointerDown={e=>{e.preventDefault();dragTargetRef.current=wish.id;setDraggingWishId(wish.id);}}><GripVertical size={19}/></button>{wish.image_url ? <img src={wish.image_url} alt={wish.title}/> : <span>🎁</span>}</div><div className="wishInfo"><div className="wishTitle">{wish.title}</div><p>{wish.description || "Nessuna descrizione"}</p>{wish.product_url && <a href={wish.product_url} target="_blank" rel="noopener noreferrer" className="wishProductLink">Apri prodotto ↗</a>}<div className="wishFoot"><b>{wish.price == null ? "Prezzo da definire" : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(wish.price)}</b><div><button className="outline" onClick={() => openWishEditor(wish)}>Modifica</button><button className="outline" onClick={() => deleteWish(wish.id)} aria-label="Elimina desiderio"><Trash2 size={15}/></button></div></div></div></article>)}</div>
              ) : (
                <div className="ownerCompactList">{wishes.map(wish => <div data-wish-id={wish.id} className={`ownerCompactRow ${draggingWishId===wish.id?"wishDragging":""} ${dragOverWishId===wish.id&&draggingWishId!==wish.id?"wishDropTarget":""}`} key={wish.id}><button type="button" className="wishDragHandle listDragHandle" title="Trascina per riordinare" aria-label={`Trascina ${wish.title}`} onPointerDown={e=>{e.preventDefault();dragTargetRef.current=wish.id;setDraggingWishId(wish.id);}}><GripVertical size={19}/></button>
                  <button type="button" className="ownerCompactMain" onClick={() => setDetailWish(wish)}>
                    <span className="ownerCompactName">{wish.title}</span>
                    <b>{wish.price == null ? "Prezzo da definire" : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(wish.price)}</b>
                  </button>
                  <button type="button" className="outline" onClick={() => openWishEditor(wish)}>Modifica</button>
                  <button type="button" className="outline" onClick={() => deleteWish(wish.id)} aria-label="Elimina desiderio"><Trash2 size={15}/></button>
                </div>)}</div>
              )}
              {detailWish && <div className="sharedDetailOverlay" onClick={() => setDetailWish(null)}><section className="sharedDetailDialog" role="dialog" aria-modal="true" aria-label={detailWish.title} onClick={e => e.stopPropagation()}>
                <button type="button" className="sharedDetailClose" onClick={() => setDetailWish(null)} aria-label="Chiudi"><X size={20}/></button>
                {detailWish.image_url ? <img src={detailWish.image_url} alt={detailWish.title} className="sharedDetailImage"/> : <div className="sharedItemPlaceholder sharedDetailImage"><Gift size={38}/></div>}
                <div className="sharedItemBody"><h2>{detailWish.title}</h2><p>{detailWish.description || "Nessuna descrizione"}</p><div className="sharedDetailPrice">{detailWish.price == null ? "Prezzo da definire" : new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" }).format(detailWish.price)}</div>
                  {detailWish.product_url && <a className="sharedDetailProductLink" href={detailWish.product_url} target="_blank" rel="noopener noreferrer">Apri prodotto ↗</a>}
                  <div className="wishEditorActions"><button type="button" onClick={() => { const wish = detailWish; setDetailWish(null); openWishEditor(wish); }}>Modifica desiderio</button><button type="button" className="outline" onClick={() => setDetailWish(null)}>Chiudi</button></div>
                </div></section></div>}
            </> : <div className="settingsCard">Non hai ancora aggiunto desideri a questa lista.</div>}
            {showWishEditor && <div className="shareOverlay wishOverlay" role="presentation" onClick={resetWishEditor}><section className="shareDialog wishEditorDialog" role="dialog" aria-modal="true" onClick={e=>e.stopPropagation()}><button className="shareClose" aria-label="Chiudi" onClick={resetWishEditor}>×</button><div className="wishEditorHeading"><div className="shareDialogIcon"><Gift size={22}/></div><h3>{editingWishId?"Modifica desiderio":"Aggiungi un desiderio"}</h3><p>Inserisci il nome oppure incolla un link per provare a recuperare i dettagli</p></div><div className="wishLinkBox"><div className="wishFieldLabel">Link del prodotto <button type="button" className="productLinkHelpButton" aria-label="Informazioni sul recupero del prodotto" aria-expanded={showProductLinkHelp} onClick={()=>setShowProductLinkHelp(value=>!value)}><CircleHelp size={15}/></button></div>{showProductLinkHelp&&<p className="productLinkHelpText" role="note">Se dopo 2 o 3 tentativi il prodotto non viene caricato automaticamente, puoi inserirne manualmente il nome e gli altri dettagli.</p>}<div className="wishLinkRow"><input value={wishUrl} onChange={e=>setWishUrl(e.target.value)} placeholder="Incolla qui il link del prodotto"/><button type="button" onClick={fetchProductDetails} disabled={fetchingProduct||!wishUrl.trim()}>{fetchingProduct?"Sto cercando...":"Recupera"}</button></div><p className="wishHint">{fetchingProduct?"Ricerca in corso: non premere di nuovo. Se serve, riproveremo automaticamente.":"Proveremo a recuperare nome, immagine e descrizione."}</p></div><div className="wishField"><div className="wishFieldLabel">Nome del desiderio <span>*</span></div><input value={newWish} onChange={e=>setNewWish(e.target.value)} placeholder="Es. Cuffie wireless"/></div><div className="wishField"><div className="wishFieldLabel">Descrizione</div><textarea value={wishDescription} onChange={e=>setWishDescription(e.target.value)} placeholder="Aggiungi qualche dettaglio..." rows={3}/></div><div className="wishField"><div className="wishFieldLabel">Prezzo <span className="wishOptional">facoltativo</span></div><input value={wishPrice} onChange={e=>setWishPrice(e.target.value)} inputMode="decimal" placeholder="Es. 49,90 €"/></div><div className="wishField"><div className="wishFieldLabel">Immagine <span className="wishOptional">facoltativa</span></div><button type="button" className="wishImagePick" onClick={()=>wishImageInputRef.current?.click()} disabled={savingWishImage}><span>＋</span>{savingWishImage?"Caricamento...":wishImage?"Cambia immagine":"Scegli dalla galleria"}</button><input ref={wishImageInputRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>uploadWishImage(e.target.files?.[0]||null)}/>{wishImage && <img src={wishImage} alt="Anteprima desiderio" className="wishEditorPreview"/>}</div><div className="wishEditorActions"><button type="button" onClick={addWish} disabled={busy||!newWish.trim()}>{busy?"Salvataggio...":editingWishId?"Salva modifiche":"Salva desiderio"}</button><button type="button" className="outline" onClick={resetWishEditor}>Annulla</button></div></section></div>}
          </> : <div className="settingsCard">Non hai ancora creato una lista. Usa il campo qui sopra per crearne una.</div>}
        </>}

        {tab === "friends" && <><div className="welcome"><div><div className="eyebrow">LA TUA RETE</div><p>Cerca utenti PersonalWish e gestisci le richieste di amicizia.</p></div></div>{showAllFriends ? <><div className="friendsPageHeading"><button type="button" className="textButton" onClick={()=>setShowAllFriends(false)}>← Torna alla tua rete</button><h2>Tutti i tuoi amici</h2></div>{friends.length ? friends.map(person=><div className="settingsCard friendProfileButton" key={person.user_id}><div className="avatar">{person.display_name.charAt(0).toUpperCase()}</div><button type="button" className="friendNameLink" onClick={()=>openFriendProfile(person)}>{person.display_name}</button><button type="button" className="outline friendListsToggle" onClick={()=>toggleFriendLists(person)}>{expandedFriendListsId===person.user_id?"Nascondi liste":"Visualizza liste"}</button><button type="button" className="outline friendRemoveButton" onClick={()=>removeFriend(person)}><UserRoundX size={14}/> Rimuovi</button>{expandedFriendListsId===person.user_id && <div className="friendInlineLists">{loadingFriendListsId===person.user_id?<small>Caricamento liste…</small>:friendListsById[person.user_id]?.length?friendListsById[person.user_id].map(list=><a className="friendInlineList" key={list.id} href={"/lista/"+list.share_token}><span>🎁</span><b>{list.title}</b><span>Apri →</span></a>):<small>Non ci sono liste condivise con te.</small>}</div>}</div>) : <div className="settingsCard">Non hai ancora amici.</div>}{selectedFriend && <section className="privacyPanel"><div className="privacyHead"><div><div className="eyebrow">PROFILO AMICO</div><h3>Profilo di {selectedFriend.display_name}</h3><p>Le informazioni mostrate rispettano le impostazioni privacy di questa persona.</p></div><button className="closeBtn" onClick={()=>setSelectedFriend(null)}>×</button></div>
            {friendProfileDetails && <div className="settingsCard friendPublicProfile">
              <div className="avatar">{friendProfileDetails.avatar_url?<img src={friendProfileDetails.avatar_url} alt="Foto profilo"/>:selectedFriend.display_name.charAt(0).toUpperCase()}</div>
              <div><b>{[friendProfileDetails.first_name,friendProfileDetails.last_name].filter(Boolean).join(" ") || selectedFriend.display_name}</b>
                {friendProfileDetails.city && <small>{friendProfileDetails.city}</small>}
                {friendProfileDetails.birth_date && <small>Compleanno: {new Date(friendProfileDetails.birth_date+"T00:00:00").toLocaleDateString("it-IT")}</small>}
              </div>
            </div>}
            {friendProfileDetails?.friends_visible && <div className="friendNetworkSection"><h4><Users size={17}/> La sua rete</h4>
              {friendProfileDetails.friends.length ? <div className="friendNetworkList">{friendProfileDetails.friends.map(person=><button type="button" className="friendNetworkPerson" key={person.user_id} onClick={()=>openFriendProfile(person)}>
                <span className="avatar">{person.avatar_url?<img src={person.avatar_url} alt=""/>:person.display_name.charAt(0).toUpperCase()}</span><b>{person.display_name}</b><span>Apri profilo →</span>
              </button>)}</div> : <p>Non ci sono amici visibili in questa rete.</p>}
            </div>}
            <h4>Le sue liste</h4>
            {friendListsLoading ? <div className="settingsCard"><LoaderCircle size={18}/> Caricamento delle liste...</div> : friendWishlists.length ? <div className="friendWishlistGrid">{friendWishlists.map(list=><a className="friendWishlistCard" key={list.id} href={"/lista/"+list.share_token}><span>🎁</span><div><b>{list.title}</b><small>{list.description || "Lista dei desideri"}</small></div><strong>Apri →</strong></a>)}</div> : <div className="settingsCard">Al momento {selectedFriend.display_name} non ha liste condivise con te.</div>}</section>}</> : <><div className="friendsPreviewHeading"><button type="button" className="friendsSectionLink" onClick={()=>setShowAllFriends(true)}>I tuoi amici <span>Vedi tutti →</span></button><p>Le persone con cui interagisci più spesso.</p></div>{friends.length ? [...friends].sort((a,b)=>(friendVisitCounts[b.user_id]||0)-(friendVisitCounts[a.user_id]||0)).slice(0,5).map(person=><div className="settingsCard friendProfileButton" key={person.user_id}><div className="avatar">{person.display_name.charAt(0).toUpperCase()}</div><button type="button" className="friendNameLink" onClick={()=>openFriendProfile(person)}>{person.display_name}</button><button type="button" className="outline friendListsToggle" onClick={()=>toggleFriendLists(person)}>{expandedFriendListsId===person.user_id?"Nascondi liste":"Visualizza liste"}</button><button type="button" className="outline friendRemoveButton" onClick={()=>removeFriend(person)}><UserRoundX size={14}/> Rimuovi</button>{expandedFriendListsId===person.user_id && <div className="friendInlineLists">{loadingFriendListsId===person.user_id?<small>Caricamento liste…</small>:friendListsById[person.user_id]?.length?friendListsById[person.user_id].map(list=><a className="friendInlineList" key={list.id} href={"/lista/"+list.share_token}><span>🎁</span><b>{list.title}</b><span>Apri →</span></a>):<small>Non ci sono liste condivise con te.</small>}</div>}</div>) : <div className="settingsCard">Non hai ancora amici.</div>}{selectedFriend && <section className="privacyPanel"><div className="privacyHead"><div><div className="eyebrow">PROFILO AMICO</div><h3>Profilo di {selectedFriend.display_name}</h3><p>Le informazioni mostrate rispettano le impostazioni privacy di questa persona.</p></div><button className="closeBtn" onClick={()=>setSelectedFriend(null)}>×</button></div>
            {friendProfileDetails && <div className="settingsCard friendPublicProfile">
              <div className="avatar">{friendProfileDetails.avatar_url?<img src={friendProfileDetails.avatar_url} alt="Foto profilo"/>:selectedFriend.display_name.charAt(0).toUpperCase()}</div>
              <div><b>{[friendProfileDetails.first_name,friendProfileDetails.last_name].filter(Boolean).join(" ") || selectedFriend.display_name}</b>
                {friendProfileDetails.birth_date && <small>Compleanno: {new Date(friendProfileDetails.birth_date+"T00:00:00").toLocaleDateString("it-IT")}</small>}
              </div>
            </div>}
            {friendProfileDetails?.friends_visible && <div className="friendNetworkSection"><h4><Users size={17}/> La sua rete</h4>
              {friendProfileDetails.friends.length ? <div className="friendNetworkList">{friendProfileDetails.friends.map(person=><button type="button" className="friendNetworkPerson" key={person.user_id} onClick={()=>openFriendProfile(person)}>
                <span className="avatar">{person.avatar_url?<img src={person.avatar_url} alt=""/>:person.display_name.charAt(0).toUpperCase()}</span><b>{person.display_name}</b><span>Apri profilo →</span>
              </button>)}</div> : <p>Non ci sono amici visibili in questa rete.</p>}
            </div>}
            <h4>Le sue liste</h4>
            {friendListsLoading ? <div className="settingsCard"><LoaderCircle size={18}/> Caricamento delle liste...</div> : friendWishlists.length ? <div className="friendWishlistGrid">{friendWishlists.map(list=><a className="friendWishlistCard" key={list.id} href={"/lista/"+list.share_token}><span>🎁</span><div><b>{list.title}</b><small>{list.description || "Lista dei desideri"}</small></div><strong>Apri →</strong></a>)}</div> : <div className="settingsCard">Al momento {selectedFriend.display_name} non ha liste condivise con te.</div>}</section>}</>}{selectedFriend && <section className="privacyPanel"><div className="privacyHead"><div><div className="eyebrow">PROFILO AMICO</div><h3>Profilo di {selectedFriend.display_name}</h3><p>Le informazioni mostrate rispettano le impostazioni privacy di questa persona.</p></div><button className="closeBtn" onClick={()=>setSelectedFriend(null)}>×</button></div>
            {friendProfileDetails && <div className="settingsCard friendPublicProfile">
              <div className="avatar">{friendProfileDetails.avatar_url?<img src={friendProfileDetails.avatar_url} alt="Foto profilo"/>:selectedFriend.display_name.charAt(0).toUpperCase()}</div>
              <div><b>{[friendProfileDetails.first_name,friendProfileDetails.last_name].filter(Boolean).join(" ") || selectedFriend.display_name}</b>
                {friendProfileDetails.birth_date && <small>Compleanno: {new Date(friendProfileDetails.birth_date+"T00:00:00").toLocaleDateString("it-IT")}</small>}
              </div>
            </div>}
            {friendProfileDetails?.friends_visible && <div className="friendNetworkSection"><h4><Users size={17}/> La sua rete</h4>
              {friendProfileDetails.friends.length ? <div className="friendNetworkList">{friendProfileDetails.friends.map(person=><button type="button" className="friendNetworkPerson" key={person.user_id} onClick={()=>openFriendProfile(person)}>
                <span className="avatar">{person.avatar_url?<img src={person.avatar_url} alt=""/>:person.display_name.charAt(0).toUpperCase()}</span><b>{person.display_name}</b><span>Apri profilo →</span>
              </button>)}</div> : <p>Non ci sono amici visibili in questa rete.</p>}
            </div>}
            <h4>Le sue liste</h4>
            {friendListsLoading ? <div className="settingsCard"><LoaderCircle size={18}/> Caricamento delle liste...</div> : friendWishlists.length ? <div className="friendWishlistGrid">{friendWishlists.map(list=><a className="friendWishlistCard" key={list.id} href={"/lista/"+list.share_token}><span>🎁</span><div><b>{list.title}</b><small>{list.description || "Lista dei desideri"}</small></div><strong>Apri →</strong></a>)}</div> : <div className="settingsCard">Al momento {selectedFriend.display_name} non ha liste condivise con te.</div>}</section>}<div className="addRow"><input value={friendSearch} onChange={e=>setFriendSearch(e.target.value)} placeholder="Nome utente esatto o email completa..." /><button onClick={searchFriends} disabled={friendSearch.trim().length<3}>Cerca</button></div>{friendResults.map(person=>{const alreadyFriend=friends.some(friend=>friend.user_id===person.user_id);return <div className="settingsCard" key={person.user_id}><div className="avatar">{person.display_name.charAt(0).toUpperCase()}</div><div style={{flex:1}}><b>{person.display_name}</b><small className="friendSearchUsername">Nome utente</small></div>{alreadyFriend ? <span className="friendAlreadyLabel">Siete già amici</span> : <button className="outline" onClick={()=>sendFriendRequest(person.user_id)}>Aggiungi amico</button>}</div>})}<h3>Invita un amico</h3><p>Condividi il link di PersonalWish tramite l’app che preferisci.</p><div className="addRow"><button onClick={()=>{setInviteCopied(false);setShowInviteMenu(true);}}> <Link2 size={17}/> Invita un amico</button></div><h3>Le mie cerchie</h3><p>Crea gruppi personali come Famiglia, Colleghi o Amici stretti.</p><div className="addRow"><input value={newGroupName} onChange={e=>setNewGroupName(e.target.value)} placeholder="Nome della nuova cerchia..." /><button onClick={createFriendGroup} disabled={!newGroupName.trim()}><Plus size={16}/> Crea gruppo</button></div>{friendGroups.map(group=><div className="settingsCard" key={group.group_id}><div style={{flex:1}}><b>{group.group_name}</b><p>{group.member_count} amici</p></div><button className="outline" onClick={()=>openFriendGroup(group.group_id)}>Gestisci</button><button className="outline" onClick={()=>deleteFriendGroup(group.group_id,group.group_name)} aria-label={"Elimina gruppo "+group.group_name}><Trash2 size={15}/> Elimina</button></div>)}{activeGroup && <section className="privacyPanel"><div className="privacyHead"><div><h3>Componenti del gruppo</h3><p>Seleziona gli amici da inserire in questa cerchia.</p></div><button className="closeBtn" onClick={()=>setActiveGroup("")}>×</button></div>{friends.map(person=><label className="groupFriendRow" key={person.user_id}><input type="checkbox" checked={groupMembers.some(m=>m.user_id===person.user_id)} onChange={e=>toggleGroupMember(person.user_id,e.target.checked)}/>{person.display_name}</label>)}<div className="addRow"><button type="button" onClick={confirmGroupMembers} disabled={savingGroupMembers}>{savingGroupMembers ? "Salvataggio..." : "Conferma"}</button></div></section>}<h3>Richieste ricevute</h3>{requests.length ? requests.map(req=><div className="settingsCard" key={req.id}><div><b>{req.requester_name}</b><p>{req.wishlist_title ? "Richiesta di amicizia e accesso a: "+req.wishlist_title : "Richiesta di amicizia"}</p></div><button className="outline" onClick={()=>answerFriendRequest(req.id,true)}>Accetta</button><button className="outline" onClick={()=>answerFriendRequest(req.id,false)}>Rifiuta</button></div>) : <div className="settingsCard">Non hai richieste in sospeso.</div>}</>}

        {tab === "groups" && <><div className="welcome"><div><div className="eyebrow">CONDIVISIONE</div><h1>I tuoi gruppi.</h1><p>La gestione dei gruppi sarà collegata al database nel prossimo passaggio.</p></div></div><div className="settingsCard">Non ci sono ancora gruppi collegati al tuo account.</div></>}

        {tab === "profile" && <><div className="welcome"><div><h1>Il mio profilo.</h1><p>Personalizza le informazioni che condividi su PersonalWish.</p></div></div>
          <section className="profileEditor">
            <div className="profilePhotoArea"><div className="avatar profileAvatarLarge">{profileAvatarUrl?<img src={profileAvatarUrl} alt="Foto profilo"/>:profileName.charAt(0).toUpperCase()}</div><div><b>La tua foto profilo</b><p>Questa immagine ti rappresenterà nelle chat e tra gli amici.</p><button type="button" className="outline" onClick={()=>avatarInputRef.current?.click()} disabled={uploadingAvatar}>{uploadingAvatar?"Caricamento...":"Scegli una foto"}</button><input ref={avatarInputRef} type="file" accept="image/*" hidden onChange={e=>{uploadProfileAvatar(e.target.files?.[0]||null);e.currentTarget.value="";}}/></div></div>
            <div className="profileFormGrid"><label>Nome<input value={firstName} onChange={e=>setFirstName(e.target.value)} maxLength={60} placeholder="Il tuo nome"/></label><label>Cognome<input value={lastName} onChange={e=>setLastName(e.target.value)} maxLength={60} placeholder="Il tuo cognome"/></label><label>Città<input value={city} onChange={e=>setCity(e.target.value)} maxLength={80} placeholder="La tua città"/></label><label>Data di nascita<input type="date" value={birthDate} onChange={e=>setBirthDate(e.target.value)}/></label><div className="profileEmailField"><span>Email</span><b>{profileEmail}</b></div></div>
            <div className="birthdayPrivacy"><div><b>Mostra il mio compleanno agli amici</b><p>Se disattivato, la data resta privata e gli amici non riceveranno promemoria.</p></div><PrivacyToggle label={birthdayVisible?"Visibile agli amici":"Privato"} value={birthdayVisible} onClick={()=>setBirthdayVisible(v=>!v)}/></div>
            <div className="addRow"><button type="button" onClick={saveProfile} disabled={savingProfile}>{savingProfile?"Salvataggio...":"Salva modifiche"}</button></div>
          </section>
</>}
        {tab === "transfer" && <><div className="welcome"><div><div className="eyebrow">GESTIONE DELLE LISTE</div><h1>Importa / Esporta.</h1><p>Salva una copia dei tuoi desideri o aggiungi rapidamente nuovi elementi da un documento.</p></div></div><section className="profileEditor transferPanel"><div className="transferActions"><div className="transferImportCard"><b>Importa da un documento</b><p>Importa desideri da un file TXT, DOC, DOCX o PDF.</p><div className="transferListChoice"><label>Destinazione dell'importazione</label><div className="importDestinationOptions"><label><input type="radio" name="importDestination" checked={importDestination==="existing"} onChange={()=>setImportDestination("existing")}/> Lista esistente</label><label><input type="radio" name="importDestination" checked={importDestination==="new"} onChange={()=>setImportDestination("new")}/> Crea nuova lista</label></div>{importDestination==="existing" ? <><select value={importTargetListId||activeList?.id||""} onChange={e=>setImportTargetListId(e.target.value)} disabled={!wishlists.length}><option value="" disabled>Seleziona una lista</option>{wishlists.map(list=><option key={list.id} value={list.id}>{list.title}</option>)}</select><small>I desideri verranno aggiunti alla lista scelta, senza modificare quelli già presenti.</small></> : <><input value={importNewListTitle} onChange={e=>setImportNewListTitle(e.target.value)} placeholder="Nome della nuova lista..."/><small>La lista verrà creata durante l'importazione.</small></>}</div><button type="button" onClick={()=>importTextRef.current?.click()} disabled={busy||(importDestination==="existing"&&!(importTargetListId||activeList?.id))||(importDestination==="new"&&!importNewListTitle.trim())}><ArrowDownUp size={16}/> Scegli documento</button><input ref={importTextRef} type="file" accept=".txt,.doc,.docx,.pdf,text/plain,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf" hidden onChange={e=>{importWishlistText(e.target.files?.[0]||null,importDestination,importNewListTitle,importTargetListId||activeList?.id||"");e.currentTarget.value="";}}/></div><div><b>Esporta in formato testo</b><p>Crea un file TXT e apre il menu di condivisione del dispositivo.</p><button type="button" onClick={exportWishlistText} disabled={!activeList}>Esporta file di testo</button></div><div><b>Esporta in PDF</b><p>Prepara una versione stampabile della lista, da salvare come PDF.</p><button type="button" onClick={exportWishlistPdf} disabled={!activeList}>Esporta PDF</button></div></div></section></>}
        {tab === "settings" && <><div className="welcome"><div><div className="eyebrow">PREFERENZE</div><h1>Impostazioni.</h1><p>Gestisci la privacy, i contatti e le notifiche del tuo account.</p></div></div>
          <section className="settingsPrivacySection">
            <h3><LockKeyhole size={18}/> Visibilità e contatti</h3>
            <p className="settingsPrivacyIntro">Decidi se gli altri utenti possono trovarti e inviarti richieste di amicizia.</p>
            <div className="settingsPrivacyRow"><div><b>Comparire nelle ricerche</b><small>Se disattivi, il tuo account non apparirà cercando il nome utente o l'email.</small></div><PrivacyToggle label={allowUserSearch?"Visibile":"Nascosto"} value={allowUserSearch} onClick={()=>setAllowUserSearch(v=>!v)}/></div>
            <div className="settingsPrivacyRow"><div><b>Ricevere richieste di amicizia</b><small>Se disattivi, gli altri utenti non potranno inviarti nuove richieste.</small></div><PrivacyToggle label={allowFriendRequests?"Consentite":"Bloccate"} value={allowFriendRequests} onClick={()=>setAllowFriendRequests(v=>!v)}/></div>
          </section>
          <section className="settingsPrivacySection">
            <h3><Users size={18}/> Profilo e rete di amici</h3>
            <p className="settingsPrivacyIntro">Decidi quali informazioni personali mostrare agli amici e chi può vedere la tua rete.</p>
            <div className="settingsPrivacyRow"><div><b>Mostra i miei dati personali agli amici</b><small>Consente di mostrare nome e cognome nel tuo profilo. La data di compleanno segue l'impostazione separata nel profilo.</small></div><PrivacyToggle label={profileDetailsVisible?"Visibili":"Privati"} value={profileDetailsVisible} onClick={()=>setProfileDetailsVisible(v=>!v)}/></div>
            <div className="settingsPrivacyRow"><div><b>Chi può vedere il mio elenco amici?</b><small>Puoi mostrare tutta la rete, nascondere alcune persone oppure mantenerla privata.</small></div>
              <div className="friendNetworkSelectWrap">
                <button type="button" className="friendNetworkSelectButton" aria-expanded={showFriendNetworkMenu} onClick={()=>setShowFriendNetworkMenu(v=>!v)}>
                  {friendNetworkVisibility==="all"?"Tutti i miei amici":friendNetworkVisibility==="except"?"Tutti tranne…":"Nessuno"} <ChevronDown size={15}/>
                </button>
                {showFriendNetworkMenu && <div className="friendNetworkSelectMenu">
                  {([{value:"all",label:"Tutti i miei amici"},{value:"except",label:"Tutti tranne…"},{value:"none",label:"Nessuno"}] as const).map(option=><button type="button" key={option.value} className={friendNetworkVisibility===option.value?"selected":""} onClick={()=>{setFriendNetworkVisibility(option.value);setShowFriendNetworkMenu(false);}}>
                    <span>{option.label}</span>{friendNetworkVisibility===option.value && <span className="friendNetworkSelectCheck">✓</span>}
                  </button>)}
                </div>}
              </div>
            </div>
            {friendNetworkVisibility==="except" && <div className="friendNetworkExclusions">
              <b>Escludi queste persone</b>
              <small>Gli amici selezionati non compariranno nella rete visibile del tuo profilo.</small>
              {friends.length ? <>
                <input className="friendExclusionSearch" type="search" value={friendExclusionSearch} onChange={e=>setFriendExclusionSearch(e.target.value)} placeholder="Cerca un amico..." aria-label="Cerca un amico da escludere"/>
                <div className="friendExclusionList">
                  {friends.filter(person=>person.display_name.toLocaleLowerCase("it").includes(friendExclusionSearch.trim().toLocaleLowerCase("it"))).map(person=><label className="groupFriendRow" key={person.user_id}>
                    <input type="checkbox" checked={friendNetworkExcludedIds.includes(person.user_id)} onChange={e=>setFriendNetworkExcludedIds(current=>e.target.checked?[...current,person.user_id]:current.filter(id=>id!==person.user_id))}/>
                    {person.display_name}
                  </label>)}
                  {!friends.some(person=>person.display_name.toLocaleLowerCase("it").includes(friendExclusionSearch.trim().toLocaleLowerCase("it"))) && <small className="friendExclusionEmpty">Nessun amico trovato.</small>}
                </div>
              </> : <small>Non hai ancora amici da escludere.</small>}
            </div>}
            <div className="settingsPrivacyRow"><div><b>Consenti che il mio profilo compaia nelle reti degli amici</b><small>Se disattivi, il tuo nome e il collegamento al profilo non appariranno negli elenchi degli amici dei tuoi amici.</small></div><PrivacyToggle label={allowIndirectFriendVisibility?"Visibile":"Nascosto"} value={allowIndirectFriendVisibility} onClick={()=>setAllowIndirectFriendVisibility(v=>!v)}/></div>
            <div className="addRow settingsPrivacySave"><button type="button" onClick={savePrivacySettings} disabled={savingPrivacySettings}>{savingPrivacySettings?"Salvataggio...":"Salva privacy del profilo"}</button></div>
          </section>
          <section className="settingsPrivacySection">
            <h3><Bell size={18}/> Notifiche</h3>
            <p className="settingsPrivacyIntro">Scegli quali notifiche ricevere nel centro notifiche di PersonalWish.</p>
            <div className="settingsPrivacyRow"><div><b>Richieste e amicizie</b><small>Nuove richieste di amicizia e conferme.</small></div><PrivacyToggle label={notifyFriendRequests?"Attive":"Disattive"} value={notifyFriendRequests} onClick={()=>setNotifyFriendRequests(v=>!v)}/></div>
            <div className="settingsPrivacyRow"><div><b>Attività delle liste</b><small>Partecipanti, prenotazioni e acquisti nelle tue liste.</small></div><PrivacyToggle label={notifyListActivity?"Attive":"Disattive"} value={notifyListActivity} onClick={()=>setNotifyListActivity(v=>!v)}/></div>
            <div className="addRow settingsPrivacySave"><button type="button" onClick={savePrivacySettings} disabled={savingPrivacySettings}>{savingPrivacySettings?"Salvataggio...":"Salva preferenze"}</button></div>
          </section>
          <section className="deleteAccountSection">
            <div><b>Elimina account</b><p>Cancella definitivamente il tuo account e i dati collegati.</p></div>
            <button type="button" onClick={deleteMyAccount} disabled={deletingAccount}>{deletingAccount?"Eliminazione...":"Elimina account"}</button>
          </section></>}

        {showInviteMenu && <div className="shareOverlay" role="presentation" onClick={() => setShowInviteMenu(false)}>
          <section className="shareDialog" role="dialog" aria-modal="true" aria-labelledby="inviteDialogTitle" onClick={e => e.stopPropagation()}>
            <button className="shareClose" aria-label="Chiudi" onClick={() => setShowInviteMenu(false)}>×</button>
            <div className="shareDialogIcon"><Users size={21}/></div>
            <h3 id="inviteDialogTitle">Invita un amico</h3>
            <p>Invia il link per far conoscere PersonalWish.</p>
            <div className="shareOptions">
              <button onClick={shareInviteWhatsApp}><span className="shareAppIcon whatsapp">W</span><b>WhatsApp</b></button>
              <button onClick={shareInviteFacebook}><span className="shareAppIcon facebook">f</span><b>Facebook</b></button>
              <button onClick={shareInviteNative}><span className="shareAppIcon messenger">ϟ</span><b>Messenger</b></button>
              <button onClick={shareInviteNative}><span className="shareAppIcon instagram">◎</span><b>Instagram</b></button>
              <button onClick={shareInviteEmail}><span className="shareAppIcon email">✉</span><b>Email</b></button>
              <button onClick={copyInviteLink}><span className="shareAppIcon copy"><Link2 size={19}/></span><b>{inviteCopied ? "Copiato!" : "Copia link"}</b></button>
            </div>
            <div className="shareLinkPreview"><span>{typeof window !== "undefined" ? window.location.origin + "/login" : "Link PersonalWish"}</span><button onClick={copyInviteLink}>{inviteCopied ? "Copiato" : "Copia"}</button></div>
            <small className="shareHint">Per Messenger e Instagram si apre il menu di condivisione del telefono, dove puoi scegliere l’app o la chat.</small>
          </section>
        </div>}
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
