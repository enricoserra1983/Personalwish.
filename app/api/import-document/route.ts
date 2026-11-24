import { NextResponse } from "next/server";
import mammoth from "mammoth";
import WordExtractor from "word-extractor";
import pdf from "pdf-parse";

export const runtime = "nodejs";

function htmlToTextWithLinks(html: string) {
  return html
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_match, href, label) => {
      const cleanLabel = label.replace(/<[^>]+>/g, "").trim();
      return cleanLabel ? cleanLabel + "\n" + href + "\n" : href + "\n";
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|li|h[1-6]|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Seleziona un documento da importare." }, { status: 400 });
    }
    const name = file.name.toLowerCase();
    if (!name.endsWith(".doc") && !name.endsWith(".docx") && !name.endsWith(".pdf")) {
      return NextResponse.json({ error: "Sono supportati i documenti TXT, DOC, DOCX e PDF." }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Il documento non può superare 10 MB." }, { status: 413 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    let text = "";
    if (name.endsWith(".pdf")) {
      const result = await pdf(buffer);
      text = result.text || "";
    } else if (name.endsWith(".docx")) {
      const result = await mammoth.convertToHtml({ buffer });
      text = htmlToTextWithLinks(result.value);
    } else {
      const extractor = new WordExtractor();
      const document = await extractor.extract(buffer);
      text = document.getBody();
    }
    if (!text.trim()) {
      return NextResponse.json({ error: "Il documento non contiene testo leggibile." }, { status: 422 });
    }
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ error: "Non riesco a leggere questo documento. Verifica che il PDF contenga testo selezionabile oppure prova un file DOCX o TXT." }, { status: 400 });
  }
}
