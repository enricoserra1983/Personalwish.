
"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Gift, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");

    const supabase = createClient();

    try {
      if (mode === "signup") {
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { display_name: name.trim() },
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (authError) throw authError;

        if (data.session) {
          router.replace("/");
          router.refresh();
        } else {
          setMessage("Registrazione completata. Controlla la tua email per confermare l'account.");
        }
      } else {
        const { error: authError } =
          await supabase.auth.signInWithPassword({ email, password });

        if (authError) throw authError;

        router.replace("/");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Si è verificato un errore. Riprova.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="authShell">
      <section className="authCard">
        <Link href="/" className="authBrand">
          <span><Gift size={22} /></span> PersonalWish
        </Link>

        <div className="eyebrow">I TUOI DESIDERI, CONDIVISI A MODO TUO</div>
        <h1>{mode === "signup" ? "Crea il tuo account" : "Bentornato"}</h1>

        <p className="authIntro">
          {mode === "signup"
            ? "Registrati per creare liste e condividerle con chi vuoi."
            : "Accedi per gestire le tue liste e prenotare i regali."}
        </p>

        <div className="authTabs">
          <button
            type="button"
            className={mode === "signup" ? "selected" : ""}
            onClick={() => { setMode("signup"); setError(""); setMessage(""); }}
          >
            Registrati
          </button>
          <button
            type="button"
            className={mode === "login" ? "selected" : ""}
            onClick={() => { setMode("login"); setError(""); setMessage(""); }}
          >
            Accedi
          </button>
        </div>

        <form onSubmit={handleSubmit} className="authForm">
          {mode === "signup" && (
            <label>
              Come vuoi essere chiamato
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Il tuo nome"
                required
                autoComplete="name"
              />
            </label>
          )}

          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="nome@esempio.it"
              required
              autoComplete="email"
            />
          </label>

          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Almeno 6 caratteri"
              required
              minLength={6}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
            />
          </label>

          {error && <p className="authError" role="alert">{error}</p>}
          {message && <p className="authMessage" role="status">{message}</p>}

          <button className="authSubmit" type="submit" disabled={busy}>
            {busy
              ? <><LoaderCircle size={17} /> Attendi...</>
              : mode === "signup" ? "Crea account" : "Accedi"}
          </button>
        </form>

        <p className="authFoot">
          Puoi consultare una lista condivisa anche senza account.
          Per creare liste e prenotare un regalo è necessario accedere.
        </p>
      </section>
    </main>
  );
}
