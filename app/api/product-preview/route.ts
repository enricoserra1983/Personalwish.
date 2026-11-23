import { NextRequest, NextResponse } from "next/server";

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const input = new URL(String(body.url || ""));
    if (!["http:", "https:"].includes(input.protocol)) {
      return NextResponse.json({ error: "Indirizzo non valido." }, { status: 400 });
    }

    const response = await fetch(input.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml"
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) {
      return NextResponse.json({ error: "Il negozio non consente di leggere i dati del prodotto." }, { status: 422 });
    }

    const finalUrl = new URL(response.url);
    const html = (await response.text()).slice(0, 2500000);
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
