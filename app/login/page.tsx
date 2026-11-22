"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Gift, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup" | "forgot";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function getInviteId() {\n    const value = new URLSearchParams(window.location.search).get("invite");\n    return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value) ? value : null;\n  }\n\n  async function sendInviteRequest() {\n    const inviterId = getInviteId();\n    if (!inviterId) return;\n    const { error } = await createClient().rpc("send_friend_request", { p_recipient_id: inviterId, p_share_token: null });\n    if (error && !error.message.toLowerCase().includes("siete già amici")) throw error;\n  }\n\n  function getNextPath() {
    const requested = new URLSearchParams(window.location.search).get("next");
    return requested && requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";
  }

  function changeMode(next: Mode) {
    setMode(next);
    setError("");
    setMessage("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    const supabase = createClient();
    const nextPath = getNextPath();

    try {
      if (mode === "forgot") {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        });
        if (resetError) throw resetError;
        setMessage("Se l'indirizzo è associato a un account, riceverai un'email con il link per reimpostare la password. Controlla anche la cartella spam.");
      } else if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}${getInviteId() ? `&invite=${encodeURIComponent(getInviteId()!)}` : ""}`,
          },
        });
        if (authError) throw authError;
        if (data.session) {
          router.replace(nextPath);
          router.refresh();
        } else {
          setMessage("Registrazione completata. Controlla la tua email per confermare l'account. Dopo la conferma tornerai alla lista condivisa.");
        }
      } else {
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
        if (authError) throw authError;
        router.replace(nextPath);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Si è verificato un errore. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  const isForgot = mode === "forgot";

  return (
    <main className="authShell">
      <section className="authCard">
        <Link href="/" className="authBrand">
          <span><Gift size={22} /></span> PersonalWish
        </Link>
        <div className="eyebrow">I TUOI DESIDERI, CONDIVISI A MODO TUO</div>
        <h1>{isForgot ? "Recupera la password" : mode === "signup" ? "Crea il tuo account" : "Bentornato"}</h1>
        <p className="authIntro">
          {isForgot
            ? "Inserisci l'email del tuo account: ti invieremo un link per scegliere una nuova password."
            : mode === "signup"
              ? "Registrati per creare liste e condividerle con chi vuoi."
              : "Accedi per gestire le tue liste e prenotare i regali."}
        </p>

        {!isForgot && (
          <div className="authTabs">
            <button type="button" className={mode === "signup" ? "selected" : ""} onClick={() => changeMode("signup")}>Registrati</button>
            <button type="button" className={mode === "login" ? "selected" : ""} onClick={() => changeMode("login")}>Accedi</button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="authForm">
          {mode === "signup" && (
            <label>
              Come vuoi essere chiamato
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Il tuo nome" required autoComplete="name" />
            </label>
          )}
          <label>
            Email
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="nome@esempio.it" required autoComplete="email" />
          </label>
          {!isForgot && (
            <label>
              Password
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === "signup" ? "Almeno 8 caratteri" : "La tua password"} required minLength={mode === "signup" ? 8 : 6} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
            </label>
          )}

          {mode === "login" && (
            <button type="button" className="textButton" onClick={() => changeMode("forgot")}>Password dimenticata?</button>
          )}
          {error && <p className="authError" role="alert">{error}</p>}
          {message && <p className="authMessage" role="status">{message}</p>}
          <button className="authSubmit" type="submit" disabled={busy}>
            {busy
              ? <><LoaderCircle size={17} /> Attendi...</>
              : isForgot ? "Invia il link di recupero" : mode === "signup" ? "Crea account" : "Accedi"}
          </button>
        </form>

        {isForgot ? (
          <button type="button" className="textButton" onClick={() => changeMode("login")}>Torna all'accesso</button>
        ) : (
          <p className="authFoot">Puoi consultare una lista condivisa anche senza account. Per creare liste e prenotare un regalo è necessario accedere.</p>
        )}
      </section>
    </main>
  );
}
