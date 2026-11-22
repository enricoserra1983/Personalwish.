import { NextRequest, NextResponse } from "next/server";

function decode(value:string) {
  return value.replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;|&#x27;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&#x2F;/g,"/");
}
function readMeta(html:string,key:string) {
  const tags=html.match(/<meta\b[^>]*>/gi)||[];
  for(const tag of tags) {
    const name=(tag.match(/(?:property|name|itemprop)=["']([^"']+)["']/i)?.[1]||"").toLowerCase();
    if(name===key.toLowerCase()) { const value=tag.match(/content=["']([^"']*)["']/i)?.[1]; if(value)return decode(value); }
  }
  return "";
}
function readJsonLd(html:string) {
  const scripts=html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi)||[];
  for(const script of scripts) try {
    const parsed=JSON.parse(script.replace(/^<script[^>]*>/i,"").replace(/<\/script>$/i,"").trim());
    const queue=Array.isArray(parsed)?[...parsed]:[parsed];
    while(queue.length) {
      const item=queue.shift(); if(!item||typeof item!=="object")continue;
      if(item["@graph"])queue.push(...item["@graph"]);
      const types=Array.isArray(item["@type"])?item["@type"]:[item["@type"]];
      if(types.some((x:string)=>String(x).toLowerCase()==="product")) {
        const im=Array.isArray(item.image)?item.image[0]:item.image;
        return {title:typeof item.name==="string"?item.name:"",description:typeof item.description==="string"?item.description:"",image:typeof im==="string"?im:(im?.url||im?.contentUrl||"")};
      }
    }
  } catch {}
  return {title:"",description:"",image:""};
}
function amazonImage(html:string) {
  const tags=html.match(/<img\b[^>]*>/gi)||[];
  const ranked=tags.map(tag=>({tag,score:(/id=["']landingImage["']/i.test(tag)?100:0)+(/id=["']main-image["']/i.test(tag)?80:0)+(/data-old-hires=/i.test(tag)?60:0)+(/data-a-dynamic-image=/i.test(tag)?50:0)})).sort((a,b)=>b.score-a.score);
  for(const {tag,score} of ranked) {
    if(score===0)continue;
    const old=tag.match(/data-old-hires=["']([^"']+)["']/i)?.[1];
    if(old&&/^https?:\/\//i.test(old))return decode(old);
    const dynamic=tag.match(/data-a-dynamic-image=["']([^"']+)["']/i)?.[1];
    if(dynamic)try{const obj=JSON.parse(decode(dynamic));const urls=Object.keys(obj);if(urls.length)return urls.sort((a,b)=>(obj[b]||0)-(obj[a]||0))[0];}catch{}
    const src=tag.match(/\bsrc=["']([^"']+)["']/i)?.[1];
    if(src&&/^https?:\/\//i.test(src)&&!/sprite|transparent|pixel|loading/i.test(src))return decode(src);
  }
  // Amazon sometimes embeds the product image in page scripts rather than an img tag.
  const patterns=[/"hiRes"\s*:\s*"([^"]+)"/g,/"large"\s*:\s*"([^"]+)"/g,/"landingImage"\s*:\s*"([^"]+)"/g];
  for(const pattern of patterns){const match=pattern.exec(html);if(match?.[1]&&/^https?:/.test(match[1]))return decode(match[1].replace(/\\u0026/g,"&"));}
  return "";
}
function cleanTitle(value:string) { return decode(value.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim()); }
function validProductTitle(value:string) {
  const t=value.trim().toLowerCase();
  return !!t && !["amazon.it","amazon","amazon.com","amazon.it: prezzi bassi","acquista online su amazon"].includes(t);
}
export async function POST(request:NextRequest) {
  try {
    const body=await request.json(); const input=new URL(String(body.url||""));
    if(!["http:","https:"].includes(input.protocol)||["localhost","127.0.0.1","::1"].includes(input.hostname)||input.hostname.endsWith(".local"))return NextResponse.json({error:"Indirizzo non valido."},{status:400});
    const response=await fetch(input.toString(),{headers:{"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36","Accept":"text/html,application/xhtml+xml"},signal:AbortSignal.timeout(15000),redirect:"follow"});
    if(!response.ok)return NextResponse.json({error:"Il negozio non consente di leggere i dati del prodotto. Puoi inserirli manualmente."},{status:422});
    const finalUrl=new URL(response.url); const html=(await response.text()).slice(0,3000000);
    const json=readJsonLd(html);
    const candidates=[readMeta(html,"og:title"),readMeta(html,"twitter:title"),json.title,cleanTitle(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]||"")];
    const title=candidates.find(validProductTitle)||"";
    let image=readMeta(html,"og:image")||readMeta(html,"twitter:image")||json.image||"";
    if(!image&&/(^|\.)amazon\./i.test(finalUrl.hostname))image=amazonImage(html);
    const description=readMeta(html,"og:description")||readMeta(html,"description")||json.description||"";
    if(!title&&!image)return NextResponse.json({error:"Amazon non ha restituito i dati del prodotto. Il link resta disponibile: puoi inserire il nome e scegliere l'immagine manualmente."},{status:422});
    if(image)try{image=new URL(image,finalUrl).toString();}catch{image="";}
    return NextResponse.json({title,image,description,url:finalUrl.toString()});
  } catch { return NextResponse.json({error:"Non è stato possibile recuperare il prodotto. Puoi compilare i campi manualmente."},{status:422}); }
}
