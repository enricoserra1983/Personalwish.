import { NextRequest, NextResponse } from "next/server";

function readMeta(html:string, property:string) {
  const escaped=property.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const patterns=[
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["'][^>]*>`,"i"),
    new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`,"i"),
  ];
  for(const pattern of patterns){const match=html.match(pattern);if(match?.[1])return match[1].replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">");}
  return "";
}

export async function POST(request:NextRequest) {
  try {
    const body=await request.json();
    const url=new URL(String(body.url||""));
    if(!["http:","https:"].includes(url.protocol) || ["localhost","127.0.0.1","::1"].includes(url.hostname) || url.hostname.endsWith(".local")) {
      return NextResponse.json({error:"Indirizzo non valido."},{status:400});
    }
    const response=await fetch(url.toString(),{
      headers:{"User-Agent":"Mozilla/5.0 (compatible; PersonalWish/1.0)","Accept":"text/html,application/xhtml+xml"},
      signal:AbortSignal.timeout(10000),
      redirect:"follow",
    });
    if(!response.ok) return NextResponse.json({error:"Il negozio non consente di leggere i dati del prodotto. Puoi inserirli manualmente."},{status:422});
    const html=(await response.text()).slice(0,1500000);
    const title=readMeta(html,"og:title")||readMeta(html,"twitter:title")||html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<[^>]+>/g,"").trim()||"";
    let image=readMeta(html,"og:image")||readMeta(html,"twitter:image");
    if(image){try{image=new URL(image,url).toString();}catch{image="";}}
    const description=readMeta(html,"og:description")||readMeta(html,"description");
    return NextResponse.json({title,image,description,url:url.toString()});
  } catch {
    return NextResponse.json({error:"Non è stato possibile recuperare il prodotto. Puoi compilare i campi manualmente."},{status:422});
  }
}
