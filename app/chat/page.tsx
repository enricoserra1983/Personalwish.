import { redirect } from "next/navigation";

// La chat è stata disattivata nella prima versione pubblica di PersonalWish.
// Le tabelle e i messaggi esistenti non vengono eliminati.
export default function ChatDisabledPage() {
  redirect("/");
}
