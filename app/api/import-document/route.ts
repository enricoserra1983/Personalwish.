import { NextResponse } from "next/server";
import mammoth from "mammoth";
import WordExtractor from "word-extractor";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Seleziona un documento da importare." }, { status: 400 });
    }
    const name = file.name.toLowerCase();
    if (!name.endsWith(".doc") && !name.endsWith(".docx")) {
      return NextResponse.json({ error: "Sono supportati i documenti DOC e DOCX." }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Il documento non può superare 10 MB." }, { status: 413 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    let text = "";
    if (name.endsWith(".docx")) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
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
    return NextResponse.json({ error: "Non riesco a leggere questo documento Word. Prova a salvarlo in DOCX o TXT." }, { status: 400 });
  }
}
