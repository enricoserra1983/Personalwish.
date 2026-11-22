import { NextRequest, NextResponse } from "next/server";

function decode(value:string) {
  return value.replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&#x27;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#x2F;/g,"/");
}

function readMeta(html:string, key:string) {
  const tags=html.match(/<meta\b[^>]*>/gi)||[];
  for(const tag of tags) {
    const name=(tag.match(/(?:property|name|itemprop)=["']([^"']+)["']/i)?.[1]||"").toLowerCase();
    if(name!==key.toLowerCase()) continue;
    const value=tag.match(/content=["']([^"']*)["']/i)?.[1];
    if(value) return decode(value);
  }
  return "";
}

function readJsonLd(html:string) {
  const scripts=html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi)||[];
  for(const script of scripts) {
    const raw=script.replace(/^<script[^>]*>/i,"").replace(/<\/script>$/i,"").trim();
    try {
      const parsed=JSON.parse(raw);
      const queue=Array.isArray(parsed)?[...parsed]:[parsed];
      while(queue.length) {
        const item=queue.shift();
        if(!item||typeof item!=="object") continue;
        if(item["@graph"]) queue.push(...item["@graph"]);
        const type=Array.isArray(item["@type"])?item["@type"]:[item["@type"]];
        if(type.some((x:string)=>String(x).toLowerCase()==="product")) {
          const image=Array.isArray(item.image)?item.image[0]:item.image;
          return {title:typeof item.name==="string"?item.name:"",description:typeof item.description==="string"?item.description:"",image:typeof image==="string"?image:(image?.url||image?.contentUrl||"")};
        }
      }
    } catch {}
  }
  return {title:"",description:"",image:""};
}

function amazonImage(html:string) {
  const patterns=[
    /<img[^>]+id=["']landingImage["'][^>]+>/i,
    /<img[^>]+data-old-hires=["'][^"']+["'][^>]*>/i,
    /<img[^>]+data-a-dynamic-image=["'][^"']+["'][^>]*>/i,
    /<img[^>]+id=["']main-image["'][^>]+>/i,
  ];
  for(const pattern of patterns) {
    const tag=html.match(pattern)?.[0];
    if(!tag) continue;
    const old=tag.match(/data-old-hires=["']([^"']+)["']/i)?.[1];
    if(old && /^https?:\/\//i.test(old)) return decode(old);
    const dynamic=tag.match(/data-a-dynamic-image=["']([^"']+)["']/i)?.[1];
    if(dynamic) {
      try {
        const images=JSON.parse(decode(dynamic));
        const urls=Object.keys(images);
        if(urls.length) return urls.sort((a,b)=>(images[b]||0)-(images[a]||0))[0];
      } catch {}
    }
    const src=tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
    if(src && /^https?:\/\//i.test(src) && !/sprite|transparent|pixel|loading/i.test(src)) return decode(src);
  }
  return "";
}

function cleanTitle(value:string) {
  return decode(value.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim());
}

export async function POST(request:NextRequest) {
  try {
    const body=await request.json();
    const input=new URL(String(body.url||""));
    if(!["http:","https:"].includes(input.protocol) || ["localhost","127.0.0.1","::1"].includes(input.hostname) || input.hostname.endsWith(".local")) {
      return NextResponse.json({error:"Indirizzo non valido."},{status:400});
    }
    const response=await fetch(input.toString(),{
      headers:{"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36","Accept":"text/html,application/xhtml+xml"},
      signal:AbortSignal.timeout(15000),redirect:"follow",
    });
    if(!response.ok) return NextResponse.json({error:"Il negozio non consente di leggere i dati del prodotto. Puoi inserirli manualmente."},{status:422});
    const finalUrl=new URL(response.url);
    const html=(await response.text()).slice(0,2500000);
    const jsonLd=readJsonLd(html);
    let title=readMeta(html,"og:title")||readMeta(html,"twitter:title")||jsonLd.title||cleanTitle(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"");
    let image=readMeta(html,"og:image")||readMeta(html,"twitter:image")||jsonLd.image||"";
    const description=readMeta(html,"og:description")||readMeta(html,"description")||jsonLd.description||"";
    if(!image && /(^|\.)amazon\./i.test(finalUrl.hostname)) image=amazonImage(html);
    const genericTitles=["amazon.it","amazon","amazon.it: prezzi bassi"];
    if(genericTitles.includes(title.toLowerCase()) || (!title && !image)) {
      return NextResponse.json({error:"Il negozio non ha restituito i dati del prodotto. Puoi inserire nome e immagine manualmente."},{status:422});
    }
    if(image) {
      try { image=new URL(image,finalUrl).toString(); } catch { image=""; }
    }
    return NextResponse.json({title,image,description,url:finalUrl.toString()});
  } catch {
    return NextResponse.json({error:"Non è stato possibile recuperare il prodotto. Puoi compilare i campi manualmente."},{status:422});
  }
}
