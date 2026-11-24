import { NextRequest, NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// PersonalWish product preview endpoint - stable build marker.

function decode(value: string) {
  return value.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
}

function attribute(tag: string, key: string) {
  return tag.match(new RegExp("\\b" + key + "\\s*=\\s*[\"']([^\"']*)[\"']", "i"))?.[1] || "";
}

function metaValue(html: string, key: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) {
    const name = attribute(tag, "property") || attribute(tag, "name");
    const content = attribute(tag, "content");
    if (name.toLowerCase() === key.toLowerCase() && content) return decode(content);
  }
  return "";
}

function readJsonLd(html: string) {
  const scripts = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const script of scripts) {
    const raw = script.replace(/^<script\b[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    try {
      const root = JSON.parse(decode(raw));
      const pending = Array.isArray(root) ? [...root] : [root];
      while (pending.length) {
        const item = pending.shift();
        if (!item || typeof item !== "object") continue;
        if (Array.isArray(item)) { pending.push(...item); continue; }
        const types = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]];
        if (types.some((type: unknown) => String(type).toLowerCase() === "product")) {
          const rawImage = item.image;
          const image = typeof rawImage === "string" ? rawImage : Array.isArray(rawImage) ? rawImage.find((v: unknown) => typeof v === "string") : rawImage?.url;
          return { title: String(item.name || ""), image: typeof image === "string" ? image : "", description: String(item.description || "") };
        }
        pending.push(...Object.values(item));
      }
    } catch {}
  }
  return { title: "", image: "", description: "" };
}

function amazonMainImage(html: string) {
  const tags = html.match(/<img[^>]*>/gi) || [];
  for (const tag of tags) {
    const isMain = /landingImage|main-image/i.test(tag);
    const oldImage = tag.match(/data-old-hires=["']([^"']+)["']/i)?.[1];
    const src = tag.match(/src=["']([^"']+)["']/i)?.[1];
    const dynamic = tag.match(/data-a-dynamic-image=["']([^"']+)["']/i)?.[1];
    if (oldImage && /^https?:/i.test(oldImage)) return decode(oldImage);
    if (dynamic) {
      try {
        const parsed = JSON.parse(decode(dynamic));
        const urls = Object.keys(parsed);
        if (urls.length) return urls[0];
      } catch {}
    }
    if (isMain && src && /^https?:/i.test(src)) return decode(src);
  }
  return "";
}


function isPublicIp(address: string) {
  const version = isIP(address);
  if (version === 4) {
    const parts = address.split(".").map(Number);
    const [a, b] = parts;
    return !(
      a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19))
    );
  }
  if (version === 6) {
    const ip = address.toLowerCase();
    return !(
      ip === "::" || ip === "::1" || ip.startsWith("fc") ||
      ip.startsWith("fd") || ip.startsWith("fe8") ||
      ip.startsWith("fe9") || ip.startsWith("fea") ||
      ip.startsWith("feb") || ip.startsWith("ff") ||
      ip.startsWith("::ffff:")
    );
  }
  return false;
}

async function validateExternalUrl(url: URL) {
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("URL non consentito");
  if (url.username || url.password) throw new Error("Credenziali URL non consentite");
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("Host non consentito");
  }
  if (isIP(hostname)) {
    if (!isPublicIp(hostname)) throw new Error("Indirizzo IP non pubblico");
    return;
  }
  const records = await lookup(hostname, { all: true, verbatim: true });
  if (!records.length || records.some(record => !isPublicIp(record.address))) {
    throw new Error("Host non pubblico");
  }
}

async function fetchExternalPage(startUrl: URL) {
  let current = startUrl;
  for (let redirects = 0; redirects <= 3; redirects++) {
    await validateExternalUrl(current);
    const response = await fetch(current.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml"
      },
      redirect: "manual",
      signal: AbortSignal.timeout(12000)
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location || redirects === 3) throw new Error("Troppi reindirizzamenti");
      current = new URL(location, current);
      continue;
    }
    return { response, finalUrl: current };
  }
  throw new Error("Troppi reindirizzamenti");
}

async function readLimitedText(response: Response, maxBytes: number) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("Pagina troppo grande");
    }
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(merged);
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Devi accedere per recuperare i dati del prodotto." }, { status: 401 });
    }

    const body = await request.json();
    const input = new URL(String(body.url || ""));
    if (!["http:", "https:"].includes(input.protocol)) {
      return NextResponse.json({ error: "Indirizzo non valido." }, { status: 400 });
    }

    const { response, finalUrl } = await fetchExternalPage(input);
    if (!response.ok) {
      return NextResponse.json({ error: "Il negozio non consente di leggere i dati del prodotto." }, { status: 422 });
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("text/html") && !contentType.toLowerCase().includes("application/xhtml+xml")) {
      return NextResponse.json({ error: "Il link non restituisce una pagina prodotto leggibile." }, { status: 422 });
    }
    const html = await readLimitedText(response, 2500000);
    const includeImage = body.includeImage !== false;
    const jsonLd = readJsonLd(html);
    const titleTag = html.match(/<title[^>]*>([\s\S]*?)<[/]title>/i)?.[1] || "";
    const amazon = finalUrl.hostname.toLowerCase().includes("amazon.");
    const amazonTitle = amazon ? html.match(/id=["']productTitle["'][^>]*>([\s\S]*?)<\/span>/i)?.[1]?.replace(/<[^>]*>/g, " ").trim() || "" : "";
    let title = amazonTitle || jsonLd.title || metaValue(html, "og:title") || metaValue(html, "twitter:title") || decode(titleTag.replace(/<[^>]*>/g, " ").trim());
    if (amazon && (!title || /captcha|robot check|sorry|sign.?in/i.test(title))) {
      const segments=finalUrl.pathname.split("/").filter(Boolean);
      const dpIndex=segments.findIndex(segment=>segment.toLowerCase()==="dp");
      const slug=dpIndex>0?segments[dpIndex-1]:"";
      if(slug && !/^(gp|product|ref|dp)$/i.test(slug)) {
        title=decode(slug.replace(/[-_]+/g," ").replace(/\\b[A-Z0-9]{10}\\b/g,"").trim());
      }
    }
    let image = includeImage ? (metaValue(html, "og:image") || metaValue(html, "twitter:image") || jsonLd.image) : "";
    if (includeImage && !image && amazon) image = amazonMainImage(html);
    const description = metaValue(html, "og:description") || metaValue(html, "description") || jsonLd.description;
    const cleanTitle = title.toLowerCase().trim();
    if (!title || ["amazon.it", "amazon.com", "amazon"].includes(cleanTitle)) {
      return NextResponse.json({ error: "Il sito non ha restituito il nome del prodotto. Puoi inserirlo manualmente." }, { status: 422 });
    }
    if (image) {
      try { image = new URL(image, finalUrl).toString(); } catch { image = ""; }
    }
    return NextResponse.json({ title, image, description, url: finalUrl.toString() });
  } catch {
    return NextResponse.json({ error: "Non è stato possibile recuperare il prodotto. Puoi compilare i campi manualmente." }, { status: 422 });
  }
}
