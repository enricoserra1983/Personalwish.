"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Gift, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setReady(Boolean(data.session));
      if (!data.session) setError("Il link non è valido o è scaduto. Richiedi una nuova email di recupero.");
    });
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    if (password.length < 8) {
      setError("La password deve contenere almeno 8 caratteri.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Le due password non coincidono.");
      return;
    }

    setBusy(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setMessage("Password aggiornata. Ora puoi accedere con la nuova password.");
      window.setTimeout(() => {
        router.replace("/login");
        router.refresh();
      }, 1400);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Non è stato possibile aggiornare la password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="authShell">
      <section className="authCard">
        <Link href="/" className="authBrand"><span><Gift size={22} /></span> PersonalWish</Link>
        <div className="eyebrow">SICUREZZA ACCOUNT</div>
        <h1>Nuova password</h1>
        <p className="authIntro">Scegli una nuova password per il tuo account PersonalWish.</p>
        {ready && (
          <form onSubmit={handleSubmit} className="authForm">
            <label>Nuova password
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={8} autoComplete="new-password" required placeholder="Almeno 8 caratteri" />
            </label>
            <label>Conferma nuova password
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} minLength={8} autoComplete="new-password" required placeholder="Ripeti la password" />
            </label>
            {error && <p className="authError" role="alert">{error}</p>}
            {message && <p className="authMessage" role="status">{message}</p>}
            <button className="authSubmit" type="submit" disabled={busy}>
              {busy ? <><LoaderCircle size={17} /> Attendi...</> : "Salva nuova password"}
            </button>
          </form>
        )}
        {!ready && error && <p className="authError" role="alert">{error}</p>}
        <p className="authFoot"><Link href="/login">Torna all'accesso</Link></p>
      </section>
    </main>
  );
}
