import { useState, useEffect, useRef, useCallback, useMemo } from "react";

const MAPBOX_TOKEN = import.meta.env?.VITE_MAPBOX_TOKEN;

// ── Backend API ────────────────────────────────────────────────────────
// Change this to your deployed backend URL in production
const API_BASE = import.meta.env?.VITE_API_URL;

// ── Fallback mock data (used when backend is unavailable) ──────────────
const MOCK_EVENTS = [
  { id:1, country:"Ukraine", lat:48.38, lng:31.17, title:"Conflict Escalation in Eastern Regions", summary:"Intensified front-line operations with heavy drone and artillery activity. NATO supply routes under strain.", category:"war", region:"Europe", timestamp:"2025-03-18T06:30:00Z", assets:[{ symbol:"EUR/USD", direction:"down", pct:"0.4", reason:"Risk-off flight from EUR" },{ symbol:"NAT GAS", direction:"up", pct:"8.2", reason:"Pipeline disruption risk" },{ symbol:"WHEAT", direction:"up", pct:"3.4", reason:"Ukraine export blockade" },{ symbol:"LMT", direction:"up", pct:"4.2", reason:"Defense spending surge" }] },
  { id:2, country:"China", lat:35.86, lng:104.20, title:"PBOC Cuts Reserve Ratio 50bps", summary:"$140B liquidity injection targets slowing GDP. Manufacturing PMI below contraction threshold for 3rd month.", category:"economy", region:"Asia", timestamp:"2025-03-18T04:15:00Z", assets:[{ symbol:"USD/CNY", direction:"up", pct:"0.3", reason:"Yuan weakens on easing" },{ symbol:"COPPER", direction:"up", pct:"2.1", reason:"Demand outlook improves" },{ symbol:"IRON ORE", direction:"up", pct:"1.8", reason:"Construction stimulus bets" },{ symbol:"HSI", direction:"up", pct:"2.4", reason:"Liquidity drives equities" }] },
  { id:3, country:"United States", lat:37.09, lng:-95.71, title:"Fed Holds Rates — No Cut Through Q2", summary:"Powell signals higher-for-longer stance. Core PCE still 2.8%. Labor market adds 180k jobs vs 210k expected.", category:"economy", region:"Americas", timestamp:"2025-02-10T22:00:00Z", assets:[{ symbol:"DXY", direction:"up", pct:"0.6", reason:"Rate differential widens" },{ symbol:"EUR/USD", direction:"down", pct:"0.7", reason:"USD strengthens broadly" },{ symbol:"GOLD", direction:"down", pct:"0.9", reason:"Opportunity cost rises" },{ symbol:"QQQ", direction:"down", pct:"1.1", reason:"Growth stocks pressured" }] },
  { id:4, country:"Saudi Arabia", lat:23.89, lng:45.08, title:"OPEC+ Extends Cuts Through Q3", summary:"2.2M bpd reduction maintained. Riyadh targets $90 Brent floor ahead of sovereign wealth fund expansion.", category:"economy", region:"Middle East", timestamp:"2025-01-17T18:45:00Z", assets:[{ symbol:"BRENT", direction:"up", pct:"3.9", reason:"Supply reduction priced in" },{ symbol:"WTI", direction:"up", pct:"4.1", reason:"OPEC discipline holds" },{ symbol:"XOM", direction:"up", pct:"3.2", reason:"Margin expansion for majors" },{ symbol:"USD/SAR", direction:"flat", pct:"0.0", reason:"Peg maintained by CB" }] },
  { id:5, country:"Taiwan", lat:23.70, lng:120.96, title:"PLA Exercises Escalate in Taiwan Strait", summary:"Largest naval drill in 18 months. 45 PLA aircraft crossed median line. US carrier group repositioned.", category:"war", region:"Asia", timestamp:"2024-12-17T12:00:00Z", assets:[{ symbol:"TSM", direction:"down", pct:"3.8", reason:"Fab disruption risk priced" },{ symbol:"SOX", direction:"down", pct:"2.1", reason:"Supply chain uncertainty" },{ symbol:"GOLD", direction:"up", pct:"1.4", reason:"Safe haven bid surges" },{ symbol:"USD/TWD", direction:"up", pct:"1.1", reason:"TWD weakens on tension" }] },
  { id:6, country:"Germany", lat:51.17, lng:10.45, title:"Germany Enters Technical Recession", summary:"Q4 GDP -0.3%, second consecutive contraction. IFO business climate at 2-year low. Bunds rally.", category:"economy", region:"Europe", timestamp:"2024-09-16T09:00:00Z", assets:[{ symbol:"EUR/USD", direction:"down", pct:"0.9", reason:"Eurozone growth anchor drags" },{ symbol:"DAX", direction:"down", pct:"1.8", reason:"Corporate earnings cut" },{ symbol:"BUND 10Y", direction:"up", pct:"0.8", reason:"ECB cut bets accelerate" },{ symbol:"EUR/GBP", direction:"down", pct:"0.6", reason:"GBP outperforms EUR" }] },
  { id:7, country:"Iran", lat:32.43, lng:53.69, title:"US Sanctions Hit Iranian Energy Sector", summary:"Treasury targets 15 entities and 3 tankers. Hormuz transit insurance premiums spike 40%.", category:"politics", region:"Middle East", timestamp:"2024-03-15T16:30:00Z", assets:[{ symbol:"BRENT", direction:"up", pct:"2.3", reason:"Supply shock risk premium" },{ symbol:"SHIPPING", direction:"up", pct:"4.5", reason:"Rerouting adds cost/time" },{ symbol:"USD/IRR", direction:"up", pct:"3.2", reason:"IRR depreciates sharply" },{ symbol:"FRO", direction:"up", pct:"3.1", reason:"Tanker rates benefit" }] },
  { id:8, country:"Japan", lat:36.20, lng:138.25, title:"BOJ Ends Negative Rate Policy", summary:"First rate hike in 17 years. Policy rate lifted to 0.1%. ¥15T carry trade unwind begins.", category:"economy", region:"Asia", timestamp:"2023-03-14T03:00:00Z", assets:[{ symbol:"USD/JPY", direction:"down", pct:"2.8", reason:"JPY surges on normalization" },{ symbol:"NIKKEI", direction:"down", pct:"2.1", reason:"Exporters hit by strong JPY" },{ symbol:"JP BANKS", direction:"up", pct:"5.3", reason:"NIM expansion incoming" },{ symbol:"JGB 10Y", direction:"down", pct:"1.4", reason:"Yields rise, prices fall" }] },
];

// ── useEvents hook — fetches from backend, falls back to mock ──────────
function useEvents() {
  const [events, setEvents]         = useState(MOCK_EVENTS);
  const [loading, setLoading]       = useState(true);
  const [backendStatus, setStatus]  = useState("connecting"); // "live" | "mock" | "connecting" | "error"
  const [lastFetch, setLastFetch]   = useState(null);

  const fetchEvents = useCallback(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout
      const res = await fetch(`${API_BASE}/events?limit=200`, {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // Backend returns { events: [...], count: N }
      if (Array.isArray(data.events) && data.events.length > 0) {
        setEvents(data.events);
        setStatus("live");
      } else if (Array.isArray(data.events) && data.events.length === 0) {
        // Backend is up but no events yet (pipeline hasn't run) — keep mock
        setStatus("mock");
      } else {
        throw new Error("unexpected response shape");
      }
    } catch (err) {
      const isMock = err.name === "AbortError" || err.message.includes("fetch") || err.message.includes("NetworkError");
      setStatus(isMock ? "mock" : "error");
      setEvents(MOCK_EVENTS);
      console.info("[MacroScope] Using mock data:", err.message);
    } finally {
      setLoading(false);
      setLastFetch(new Date());
    }
  }, []);

  useEffect(() => {
    fetchEvents();
    const t = setInterval(fetchEvents, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, [fetchEvents]);

  return { events, loading, backendStatus, lastFetch, refetch: fetchEvents };
}

const CAT_COLOR = { war:"#FF3B30", economy:"#FFD60A", politics:"#0A84FF" };
const CAT_BG    = { war:"rgba(255,59,48,0.13)", economy:"rgba(255,214,10,0.10)", politics:"rgba(10,132,255,0.13)" };
const DIR_COLOR = { up:"#30D158", down:"#FF3B30", flat:"#64748b" };
const DIR_ARROW = { up:"▲", down:"▼", flat:"─" };

const AGE_FILTERS = [
  { label:"ALL TIME", days: Infinity },
  { label:"TODAY",    days: 1 },
  { label:"7 DAYS",   days: 7 },
  { label:"30 DAYS",  days: 30 },
  { label:"3 MONTHS", days: 90 },
  { label:"1 YEAR",   days: 365 },
];

function timeAgo(ts) {
  const h = Math.floor((Date.now()-new Date(ts))/3600000);
  if (h<1) return `${Math.floor((Date.now()-new Date(ts))/60000)}m ago`;
  if (h<24) return `${h}h ago`;
  if (h<24*30) return `${Math.floor(h/24)}d ago`;
  if (h<24*365) return `${Math.floor(h/(24*30))}mo ago`;
  return `${Math.floor(h/(24*365))}y ago`;
}
function formatDate(ts) {
  return new Date(ts).toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit",timeZoneName:"short"});
}
function genSpark(trend=0, n=20) {
  const d=[50];
  for(let i=1;i<n;i++) d.push(Math.max(2,d[i-1]+(Math.random()-0.5+trend*0.1)*8));
  return d;
}

// ── Sparkline ──────────────────────────────────────────────────────
function Sparkline({ data, color="#0A84FF", w=100, h=32 }) {
  const min=Math.min(...data), max=Math.max(...data), range=max-min||1;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-((v-min)/range)*h}`).join(" ");
  const uid=useRef(`sg${Math.random().toString(36).slice(2,8)}`).current;
  return (
    <svg width={w} height={h} style={{overflow:"visible",flexShrink:0}}>
      <defs><linearGradient id={uid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.35"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
      <polygon points={`${pts} ${w},${h} 0,${h}`} fill={`url(#${uid})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={(data.length-1)/(data.length-1)*w} cy={h-((data[data.length-1]-min)/range)*h} r="2.5" fill={color}/>
    </svg>
  );
}

// ── AI Summary ─────────────────────────────────────────────────────
// Reads pre-computed ai_analysis stored by the backend pipeline.
// No client-side LLM call needed — zero extra API cost per page view.
function AISummary({ event }) {
  const d = event?.ai_analysis;
  const RC = { LOW:"#30D158", MEDIUM:"#FFD60A", HIGH:"#FF9F0A", CRITICAL:"#FF3B30" };
  const CC = { HIGH:"#30D158", MEDIUM:"#FFD60A", LOW:"#FF9F0A" };

  if (!d) return (
    <p style={{fontSize:11,color:"#334155",fontFamily:"monospace",padding:"10px 0"}}>
      AI analysis not yet available for this event.
    </p>
  );
  const rc = RC[d.risk_level] || "#FFD60A";
  return (
    <div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
        <span style={{fontSize:10,fontFamily:"'Space Mono',monospace",color:"#0A84FF",letterSpacing:2}}>AI ANALYSIS</span>
        <span style={{fontSize:9,padding:"2px 7px",borderRadius:4,background:rc+"22",color:rc,border:`1px solid ${rc}44`,fontFamily:"monospace",letterSpacing:1}}>{d.risk_level}</span>
      </div>
      <p style={{fontSize:12,color:"#94a3b8",lineHeight:1.75,margin:"0 0 10px"}}>{d.summary}</p>
      <div style={{background:"rgba(10,132,255,0.07)",borderLeft:"2px solid rgba(10,132,255,0.22)",padding:"10px 12px",borderRadius:"0 6px 6px 0",marginBottom:12}}>
        <div style={{fontSize:9,color:"#0A84FF",fontFamily:"monospace",letterSpacing:1.5,marginBottom:5}}>MACRO IMPACT</div>
        <p style={{fontSize:12,color:"#94a3b8",lineHeight:1.75,margin:0}}>{d.market_impact}</p>
      </div>
      {d.key_takeaway&&<div style={{background:"rgba(255,214,10,0.06)",border:"1px solid rgba(255,214,10,0.15)",padding:"8px 12px",borderRadius:6,marginBottom:12}}><span style={{fontSize:9,color:"#FFD60A",fontFamily:"monospace",letterSpacing:1.5}}>KEY TAKEAWAY  </span><span style={{fontSize:11,color:"#e2e8f0"}}>{d.key_takeaway}</span></div>}
      {d.asset_outlook?.length>0&&<div>
        <div style={{fontSize:9,fontFamily:"monospace",color:"#334155",letterSpacing:1.5,marginBottom:8}}>AI ASSET OUTLOOK</div>
        {d.asset_outlook.map(a=>{
          const dc=DIR_COLOR[a.direction]||"#64748b"; const arr=DIR_ARROW[a.direction]||"─"; const conf=CC[a.confidence]||"#64748b";
          return <div key={a.symbol} style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,padding:"6px 8px",background:"rgba(255,255,255,0.025)",borderRadius:6,border:"1px solid rgba(255,255,255,0.05)"}}>
            <span style={{fontSize:11,color:dc,fontWeight:700,width:14}}>{arr}</span>
            <span style={{fontSize:10,color:"#cbd5e1",fontFamily:"monospace",flex:1}}>{a.symbol}</span>
            <span style={{fontSize:8,color:conf,fontFamily:"monospace",background:conf+"14",padding:"1px 5px",borderRadius:3,border:`1px solid ${conf}33`}}>{a.confidence}</span>
            <span style={{fontSize:9,color:"#475569",maxWidth:80,textAlign:"right",lineHeight:1.3}}>{a.reason}</span>
          </div>;
        })}
      </div>}
    </div>
  );
}

// ── AssetPill ────────────────────────────────────────────────────────
function AssetPill({ asset }) {
  const col = DIR_COLOR[asset.direction];
  return (
    <div style={{display:"flex",alignItems:"center",gap:4,background:"rgba(255,255,255,0.04)",border:`1px solid ${col}33`,borderRadius:5,padding:"3px 7px"}}>
      <span style={{fontSize:9,color:col,fontFamily:"monospace"}}>{DIR_ARROW[asset.direction]}</span>
      <span style={{fontSize:9,color:"#94a3b8",fontFamily:"monospace"}}>{asset.symbol}</span>
      {asset.direction!=="flat"&&<span style={{fontSize:9,color:col,fontFamily:"monospace",fontWeight:700}}>{asset.pct}%</span>}
    </div>
  );
}

// ── MapCard ──────────────────────────────────────────────────────────
function MapCard({ event, expanded, onToggle, scale=1, style }) {
  const col = CAT_COLOR[event.category];
  const s = scale;
  const baseW = expanded ? 260 : 180;
  const w = baseW * s;
  const radius = Math.round(10*s);
  const pad = Math.round(10*s);
  const padSm = Math.round(6*s);
  const fs = { label:Math.max(6,Math.round(8*s)), cat:Math.max(6,Math.round(8*s)), country:Math.max(7,Math.round(10*s)), title:Math.max(8,Math.round(11*s)), body:Math.max(7,Math.round(11*s)), asset:Math.max(6,Math.round(9*s)), hint:Math.max(5,Math.round(8*s)) };
  const dotR = Math.max(3,Math.round(6*s));
  const connH = Math.max(4,Math.round(8*s));
  const pinR = Math.max(2,Math.round(6*s));
  const gapRow = Math.max(2,Math.round(6*s));

  return (
    <div onClick={onToggle} style={{position:"absolute",...style,width:w,background:expanded?"rgba(4,9,22,0.97)":"rgba(4,9,22,0.88)",border:`1px solid ${col}55`,borderRadius:radius,backdropFilter:"blur(14px)",boxShadow:expanded?`0 8px 32px rgba(0,0,0,0.7),0 0 0 1px ${col}22`:`0 4px 16px rgba(0,0,0,0.5),0 0 0 1px ${col}18`,cursor:"pointer",transition:"width 0.2s cubic-bezier(0.16,1,0.3,1)",zIndex:expanded?20:10,userSelect:"none",overflow:"hidden"}}>
      <div style={{position:"absolute",bottom:-(connH),left:"50%",transform:"translateX(-50%)",width:Math.max(1,Math.round(2*s)),height:connH,background:`${col}88`}}/>
      <div style={{position:"absolute",bottom:-(connH+pinR*2),left:"50%",transform:"translateX(-50%)",width:pinR*2,height:pinR*2,borderRadius:"50%",background:col,boxShadow:`0 0 ${pinR*2}px ${col}`}}/>
      <div style={{display:"flex",alignItems:"center",gap:gapRow,padding:`${padSm}px ${pad}px ${Math.round(padSm*0.6)}px`,borderBottom:`1px solid ${col}22`}}>
        <div style={{width:dotR,height:dotR,borderRadius:"50%",background:col,boxShadow:`0 0 ${dotR*1.5}px ${col}`,flexShrink:0}}/>
        <span style={{fontSize:fs.cat,fontFamily:"'Space Mono',monospace",color:col,letterSpacing:Math.max(0.5,1.5*s),textTransform:"uppercase",flexShrink:0}}>{event.category}</span>
        {s>0.55&&<span style={{fontSize:fs.label,color:"#334155",fontFamily:"monospace",marginLeft:"auto",flexShrink:0}}>{timeAgo(event.timestamp)}</span>}
      </div>
      <div style={{padding:`${padSm}px ${pad}px ${Math.round(padSm*0.7)}px`}}>
        {s>0.4&&<div style={{fontSize:fs.country,fontFamily:"'Space Mono',monospace",color:"#94a3b8",marginBottom:Math.round(3*s),letterSpacing:Math.max(0.3,0.5*s)}}>{event.country}</div>}
        <div style={{fontSize:fs.title,color:"#e2e8f0",lineHeight:1.35,fontWeight:500,display:"-webkit-box",WebkitLineClamp:expanded?10:(s>0.6?2:1),WebkitBoxOrient:"vertical",overflow:"hidden"}}>{event.title}</div>
      </div>
      {s>0.35&&<div style={{display:"flex",flexWrap:"wrap",gap:Math.max(2,Math.round(3*s)),padding:`${Math.round(2*s)}px ${pad}px ${Math.round(7*s)}px`}}>
        {event.assets.slice(0,expanded?4:(s>0.7?2:1)).map(a=>{
          const ac=DIR_COLOR[a.direction];
          return <div key={a.symbol} style={{display:"flex",alignItems:"center",gap:Math.max(2,Math.round(4*s)),background:"rgba(255,255,255,0.04)",border:`1px solid ${ac}33`,borderRadius:Math.round(5*s),padding:`${Math.round(3*s)}px ${Math.round(7*s)}px`}}>
            <span style={{fontSize:fs.asset,color:ac,fontFamily:"monospace"}}>{DIR_ARROW[a.direction]}</span>
            <span style={{fontSize:fs.asset,color:"#94a3b8",fontFamily:"monospace"}}>{a.symbol}</span>
            {a.direction!=="flat"&&s>0.5&&<span style={{fontSize:fs.asset,color:ac,fontFamily:"monospace",fontWeight:700}}>{a.pct}%</span>}
          </div>;
        })}
      </div>}
      {expanded&&<div style={{borderTop:`1px solid ${col}18`,padding:`${padSm}px ${pad}px ${pad}px`}}>
        <p style={{fontSize:fs.body,color:"#64748b",lineHeight:1.65,margin:`0 0 ${Math.round(10*s)}px`}}>{event.summary}</p>
        <div style={{fontSize:fs.asset,fontFamily:"monospace",color:"#334155",letterSpacing:1.5,marginBottom:Math.round(7*s)}}>ASSET PREDICTIONS</div>
        {event.assets.map(a=>{
          const c=DIR_COLOR[a.direction];
          return <div key={a.symbol} style={{display:"flex",alignItems:"center",marginBottom:Math.round(5*s),padding:`${Math.round(5*s)}px ${Math.round(8*s)}px`,background:"rgba(255,255,255,0.025)",borderRadius:Math.round(6*s),border:"1px solid rgba(255,255,255,0.05)"}}>
            <span style={{fontSize:Math.round(10*s),color:c,fontFamily:"monospace",fontWeight:700,width:Math.round(16*s)}}>{DIR_ARROW[a.direction]}</span>
            <span style={{fontSize:Math.round(10*s),color:"#cbd5e1",fontFamily:"monospace",flex:1}}>{a.symbol}</span>
            {a.direction!=="flat"&&<span style={{fontSize:Math.round(10*s),color:c,fontFamily:"monospace",fontWeight:700,background:`${c}14`,border:`1px solid ${c}33`,borderRadius:Math.round(4*s),padding:`1px ${Math.round(6*s)}px`,marginRight:Math.round(6*s)}}>{a.direction==="up"?"+":"-"}{a.pct}%</span>}
            <span style={{fontSize:Math.round(9*s),color:"#334155",fontFamily:"monospace",maxWidth:Math.round(90*s),textAlign:"right",lineHeight:1.3}}>{a.reason}</span>
          </div>;
        })}
      </div>}
      {s>0.65&&!expanded&&<div style={{textAlign:"center",fontSize:fs.hint,color:`${col}66`,fontFamily:"monospace",paddingBottom:Math.round(6*s),letterSpacing:1}}>TAP TO EXPAND</div>}
      {s>0.65&&expanded&&<div style={{textAlign:"center",fontSize:fs.hint,color:"#334155",fontFamily:"monospace",paddingBottom:Math.round(8*s),letterSpacing:1}}>CLICK TO COLLAPSE</div>}
    </div>
  );
}

// ── Mapbox Map ───────────────────────────────────────────────────────
function MapboxMap({ events, expandedId, selectedId, onToggle, onSelectOnly, onDismiss, filters, panelMode }) {
  const containerRef = useRef(null);
  const mapRef       = useRef(null);
  const [ready, setReady]           = useState(false);
  const [cardPositions, setCardPositions] = useState({});
  const [zoom, setZoom]             = useState(1.9);
  const rafRef = useRef(null);

  const filtered = useMemo(()=>events.filter(e=>{
    if (filters.category!=="all"&&e.category!==filters.category) return false;
    if (filters.region!=="all"&&e.region!==filters.region) return false;
    return true;
  }),[events,filters]);

  useEffect(()=>{
    if (window.mapboxgl){ boot(); return; }
    const link=document.createElement("link"); link.rel="stylesheet"; link.href="https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.css"; document.head.appendChild(link);
    const s=document.createElement("script"); s.src="https://api.mapbox.com/mapbox-gl-js/v3.3.0/mapbox-gl.js"; s.onload=boot; document.head.appendChild(s);
  },[]);

  function boot() {
    if (mapRef.current||!containerRef.current) return;
    const mgl=window.mapboxgl;
    mgl.accessToken=MAPBOX_TOKEN;
    const map=new mgl.Map({ container:containerRef.current, style:"mapbox://styles/mapbox/dark-v11", projection:"mercator", center:[20,15], zoom:1.9, minZoom:1.0, maxZoom:12, attributionControl:false, pitchWithRotate:false, dragRotate:false, pitch:0, bearing:0 });
    map.addControl(new mgl.NavigationControl({showCompass:false}),"bottom-right");
    map.addControl(new mgl.AttributionControl({compact:true}),"bottom-left");
    map.on("style.load",()=>{
      try{ map.setProjection("mercator"); }catch(_){}
      try{
        map.setPaintProperty("water","fill-color","#030f1e");
        ["country-boundaries","admin-0-boundary","admin-0-boundary-disputed"].forEach(l=>{ if(map.getLayer(l)){ map.setPaintProperty(l,"line-color","rgba(0,150,255,0.2)"); map.setPaintProperty(l,"line-width",0.7); } });
        if(map.getLayer("land")){ map.setPaintProperty("land","background-color","#0a1628"); }
      }catch(_){}
      setReady(true);
    });
    mapRef.current=map;
  }

  useEffect(()=>{
    const map=mapRef.current;
    if(!map||!ready) return;
    const handler=(e)=>{ if(e.originalEvent.target===map.getCanvas()){ onDismiss(); } };
    map.on("click",handler);
    return()=>{ map.off("click",handler); };
  },[ready,onDismiss]);

  function updatePositions() {
    const map=mapRef.current;
    if(!map||!ready) return;
    const pos={};
    filtered.forEach(ev=>{ const p=map.project([ev.lng,ev.lat]); pos[ev.id]={ x:Math.round(p.x), y:Math.round(p.y) }; });
    setCardPositions(pos);
    setZoom(map.getZoom());
  }

  useEffect(()=>{
    const map=mapRef.current;
    if(!map||!ready) return;
    updatePositions();
    const onMove=()=>{ cancelAnimationFrame(rafRef.current); rafRef.current=requestAnimationFrame(updatePositions); };
    map.on("move",onMove); map.on("zoom",onMove); map.on("render",onMove);
    return()=>{ map.off("move",onMove); map.off("zoom",onMove); map.off("render",onMove); };
  },[ready,filtered]);

  useEffect(()=>{ updatePositions(); },[filtered,ready]);
  useEffect(()=>()=>{ if(mapRef.current){mapRef.current.remove();mapRef.current=null;} },[]);

  const MIN_ZOOM=1.0, FULL_ZOOM=5.0, MIN_SCALE=0.45;
  const scale = Math.max(MIN_SCALE, Math.min(1,(zoom-MIN_ZOOM)/(FULL_ZOOM-MIN_ZOOM)));

  return (
    <div style={{position:"relative",width:"100%",height:"100%",overflow:"hidden"}}>
      <div ref={containerRef} style={{width:"100%",height:"100%"}}/>
      {!ready&&<div style={{position:"absolute",inset:0,background:"#030f1e",display:"flex",alignItems:"center",justifyContent:"center",gap:10,color:"#1e293b",fontFamily:"monospace",fontSize:11,letterSpacing:2}}><div style={{width:14,height:14,border:"1.5px solid #0f172a",borderTopColor:"#0A84FF",borderRadius:"50%",animation:"msSpin 0.8s linear infinite"}}/>LOADING MAP…</div>}

      {ready && filtered.map(ev=>{
        const pos=cardPositions[ev.id];
        if(!pos) return null;
        const col=CAT_COLOR[ev.category];
        const isExp=expandedId===ev.id;

        if (!panelMode) {
          const dotSize=14;
          const isCardVisible=selectedId===ev.id;
          const cardScale=Math.max(0.7,scale);
          const cardW=isExp?260:180; const cardH=isExp?340:120;
          return (
            <div key={ev.id} style={{position:"absolute",left:0,top:0,pointerEvents:"none"}}>
              {/* Dot — hidden when card is visible, reappears when card closes */}
              <div onClick={(e)=>{ e.stopPropagation(); onSelectOnly(ev.id); }} title={`${ev.country} — ${ev.title}`}
                style={{
                  position:"absolute",left:pos.x-dotSize/2,top:pos.y-dotSize/2,
                  width:dotSize,height:dotSize,cursor:"pointer",pointerEvents:"auto",zIndex:10,
                  opacity: isCardVisible ? 0 : 1,
                  pointerEvents: isCardVisible ? "none" : "auto",
                  transition:"opacity 0.2s",
                }}>
                <div style={{position:"absolute",inset:-6,borderRadius:"50%",border:`1.5px solid ${col}`,animation:`msDotPulse 2.2s ease-out ${(ev.id%6)*0.35}s infinite`,pointerEvents:"none"}}/>
                <div style={{width:"100%",height:"100%",borderRadius:"50%",background:col,boxShadow:`0 0 8px ${col},0 0 16px ${col}55`,transition:"transform 0.18s"}}
                  onMouseEnter={e=>{ e.currentTarget.style.transform="scale(1.5)"; }}
                  onMouseLeave={e=>{ e.currentTarget.style.transform="scale(1)"; }}/>
              </div>
              {isCardVisible&&<MapCard event={ev} expanded={isExp} scale={cardScale} onToggle={()=>onToggle(ev.id)}
                style={{left:pos.x-(cardW*cardScale)/2,top:pos.y-(cardH*cardScale)-14*cardScale,pointerEvents:"auto",zIndex:30}}/>}
            </div>
          );
        }

        const baseW=isExp?260:180; const baseH=isExp?340:120;
        const w=baseW*scale; const h=baseH*scale;
        return <MapCard key={ev.id} event={ev} expanded={isExp} scale={scale} onToggle={()=>onToggle(ev.id)}
          style={{left:pos.x-w/2,top:pos.y-h-14*scale,pointerEvents:"auto"}}/>;
      })}

      {ready&&<div style={{position:"absolute",bottom:14,left:"50%",transform:"translateX(-50%)",pointerEvents:"none",zIndex:5}}>
        <div style={{background:"rgba(3,9,18,0.75)",backdropFilter:"blur(8px)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:6,padding:"5px 14px"}}>
          <span style={{fontSize:8,color:"#1e293b",fontFamily:"monospace",letterSpacing:2}}>{panelMode?"SCROLL TO ZOOM · DRAG TO PAN · CLICK PANELS TO EXPAND":"SCROLL TO ZOOM · DRAG TO PAN · CLICK DOTS TO VIEW NEWS"}</span>
        </div>
      </div>}
    </div>
  );
}

// ── Detail Side Panel ────────────────────────────────────────────────
function DetailSidePanel({ event, onClose, onOpenDetail, bookmarks, toggleBookmark }) {
  if (!event) return null;
  const col=CAT_COLOR[event.category];
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%",animation:"msSlideIn 0.28s cubic-bezier(0.16,1,0.3,1)"}}>
      <div style={{padding:"16px 18px 12px",borderBottom:"1px solid rgba(255,255,255,0.06)",flexShrink:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:8}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:6}}>
              <span style={{width:7,height:7,borderRadius:"50%",background:col,display:"inline-block",boxShadow:`0 0 8px ${col}`}}/>
              <span style={{fontSize:9,fontFamily:"'Space Mono',monospace",color:col,letterSpacing:2,textTransform:"uppercase"}}>{event.category}</span>
              <span style={{fontSize:9,color:"#334155",fontFamily:"monospace"}}>· {timeAgo(event.timestamp)}</span>
            </div>
            <h2 style={{margin:0,fontSize:14,fontFamily:"'DM Serif Display',Georgia,serif",color:"#f1f5f9",lineHeight:1.4,fontWeight:400}}>{event.title}</h2>
          </div>
          <div style={{display:"flex",gap:4,flexShrink:0}}>
            <button onClick={()=>toggleBookmark(event.id)} style={{background:"none",border:"none",cursor:"pointer",color:bookmarks.has(event.id)?"#FFD60A":"#334155",fontSize:15,padding:2}}>★</button>
            <button onClick={onClose} style={{background:"none",border:"none",color:"#334155",cursor:"pointer",fontSize:16,padding:2,lineHeight:1}}>✕</button>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:5,marginTop:8}}>
          <span style={{fontSize:14}}>📍</span>
          <span style={{fontSize:12,color:"#475569",fontFamily:"'Space Mono',monospace"}}>{event.country}</span>
          <span style={{fontSize:9,color:"#1e293b",marginLeft:"auto",fontFamily:"monospace"}}>{event.region}</span>
        </div>
      </div>

      <div style={{flex:1,overflowY:"auto",scrollbarWidth:"thin",scrollbarColor:"#0f172a transparent"}}>
        <div style={{padding:"0 18px 24px"}}>
          <div style={{padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
            <p style={{margin:0,fontSize:12,color:"#64748b",lineHeight:1.75}}>{event.summary}</p>
          </div>
          <div style={{padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
            <div style={{fontSize:10,fontFamily:"'Space Mono',monospace",color:"#334155",letterSpacing:2,marginBottom:12}}>ASSET PREDICTIONS</div>
            {event.assets.map(a=>{
              const c=DIR_COLOR[a.direction]; const arr=DIR_ARROW[a.direction];
              return <div key={a.symbol} style={{display:"flex",alignItems:"center",gap:0,marginBottom:7,padding:"8px 10px",background:"rgba(255,255,255,0.025)",borderRadius:7,border:`1px solid ${c}22`}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:c+"16",border:`1px solid ${c}33`,display:"flex",alignItems:"center",justifyContent:"center",marginRight:10,flexShrink:0}}>
                  <span style={{fontSize:12,color:c,fontWeight:700}}>{arr}</span>
                </div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
                    <span style={{fontSize:11,color:"#e2e8f0",fontFamily:"monospace",fontWeight:600}}>{a.symbol}</span>
                    {a.direction!=="flat"&&<span style={{fontSize:10,color:c,fontFamily:"monospace",fontWeight:700,background:c+"14",padding:"1px 6px",borderRadius:4,border:`1px solid ${c}33`}}>{a.direction==="up"?"+":"-"}{a.pct}%</span>}
                  </div>
                  <div style={{fontSize:10,color:"#475569",lineHeight:1.4}}>{a.reason}</div>
                </div>
              </div>;
            })}
          </div>
          <div style={{padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
            <AISummary event={event}/>
          </div>

          {/* MORE DETAIL BUTTON */}
          <div style={{paddingTop:16}}>
            <button onClick={()=>onOpenDetail(event.id)} style={{
              width:"100%", padding:"11px 16px",
              background:`linear-gradient(135deg, ${col}18, ${col}0c)`,
              border:`1px solid ${col}55`, borderRadius:8,
              color:col, fontSize:11, fontFamily:"'Space Mono',monospace",
              letterSpacing:1.5, cursor:"pointer", transition:"all 0.2s",
              display:"flex", alignItems:"center", justifyContent:"center", gap:8,
            }}
              onMouseEnter={e=>{ e.currentTarget.style.background=`linear-gradient(135deg, ${col}28, ${col}18)`; e.currentTarget.style.borderColor=col+"88"; }}
              onMouseLeave={e=>{ e.currentTarget.style.background=`linear-gradient(135deg, ${col}18, ${col}0c)`; e.currentTarget.style.borderColor=col+"55"; }}
            >
              <span>VIEW FULL DETAIL PAGE</span>
              <span style={{fontSize:14}}>→</span>
            </button>
          </div>

          <div style={{marginTop:12,border:"1px dashed rgba(255,255,255,0.07)",borderRadius:10,height:260,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:6,background:"rgba(255,255,255,0.006)",position:"relative"}}>
            <div style={{position:"absolute",top:8,left:10,fontSize:8,color:"#0f172a",fontFamily:"monospace",letterSpacing:2}}>ADVERTISEMENT</div>
            <div style={{fontSize:11,color:"#0f172a",fontFamily:"monospace"}}>300 × 250</div>
            <div style={{fontSize:8,color:"#0a1020",fontFamily:"monospace",letterSpacing:1.5,textAlign:"center"}}>ADSENSE IN-PANEL</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── SEO slug helper ───────────────────────────────────────────────────
// Converts "Fed Holds Rates — No Cut Through Q2" → "fed-holds-rates-no-cut-through-q2"
function slugify(title = "") {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")   // strip special chars
    .trim()
    .replace(/\s+/g, "-")            // spaces → hyphens
    .replace(/-+/g, "-")             // collapse multiple hyphens
    .slice(0, 100);                  // cap length
}

// ── Hash Router ───────────────────────────────────────────────────────
// URL format: #/event/<slug>  e.g. #/event/fed-holds-rates-no-cut-through-q2
// Falls back to ID lookup if slug is purely numeric (backward compat)
function useHashRouter() {
  const [hash, setHash] = useState(window.location.hash || "");
  useEffect(()=>{
    const onHashChange = () => setHash(window.location.hash || "");
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  },[]);
  const navigate = useCallback((path) => { window.location.hash = path; }, []);
  const goBack    = useCallback(() => { window.location.hash = ""; }, []);
  // Parse #/event/<slug-or-id>
  const route = useMemo(()=>{
    const m = hash.match(/^#\/event\/(.+)$/);
    if (m) return { page:"event", slug: m[1] };
    return { page:"home" };
  },[hash]);
  return { route, navigate, goBack };
}

// ── Event Detail Page ────────────────────────────────────────────────
function EventDetailPage({ event, onBack, bookmarks, toggleBookmark }) {
  const col = CAT_COLOR[event.category];
  const slug = slugify(event.title);
  const canonicalUrl = `https://macroscope.io/event/${slug}`;
  const spark = useMemo(()=>
    event.assets.map(a=>genSpark(a.direction==="up"?1:a.direction==="down"?-1:0))
  ,[event.id]);

  // ── Full SEO meta tag injection ─────────────────────────────────
  useEffect(()=>{
    const prev = {
      title: document.title,
      desc:  document.querySelector('meta[name="description"]')?.content,
      ogTitle: document.querySelector('meta[property="og:title"]')?.content,
      ogDesc:  document.querySelector('meta[property="og:description"]')?.content,
      ogUrl:   document.querySelector('meta[property="og:url"]')?.content,
      twTitle: document.querySelector('meta[name="twitter:title"]')?.content,
      twDesc:  document.querySelector('meta[name="twitter:description"]')?.content,
      canonical: document.querySelector('link[rel="canonical"]')?.href,
    };

    const description = `${event.summary} Market impact: ${event.impact_summary || ""} — MacroScope geopolitical intelligence.`.slice(0, 160);
    const keywords = [event.country, event.region, event.category, ...(event.tags || []), "geopolitical", "market impact", "forex", "commodities"].join(", ");

    // Title
    document.title = `${event.title} | ${event.country} ${event.category} | MacroScope`;

    // Helper to set/create meta tag
    const setMeta = (sel, attr, val) => {
      let el = document.querySelector(sel);
      if (!el) { el = document.createElement("meta"); document.head.appendChild(el); }
      el.setAttribute(attr, val);
    };
    const setLink = (sel, attr, val) => {
      let el = document.querySelector(sel);
      if (!el) { el = document.createElement("link"); document.head.appendChild(el); }
      el.setAttribute(attr, val);
    };

    setMeta('meta[name="description"]',            "content",   description);
    setMeta('meta[name="keywords"]',               "content",   keywords);
    setMeta('meta[name="robots"]',                 "content",   "index, follow");
    setMeta('meta[property="og:type"]',            "content",   "article");
    setMeta('meta[property="og:title"]',           "content",   event.title);
    setMeta('meta[property="og:description"]',     "content",   description);
    setMeta('meta[property="og:url"]',             "content",   canonicalUrl);
    setMeta('meta[property="og:site_name"]',       "content",   "MacroScope");
    setMeta('meta[property="article:section"]',    "content",   event.category);
    setMeta('meta[property="article:tag"]',        "content",   (event.tags || []).join(", "));
    setMeta('meta[property="article:published_time"]', "content", event.timestamp);
    setMeta('meta[name="twitter:card"]',           "content",   "summary_large_image");
    setMeta('meta[name="twitter:title"]',          "content",   event.title);
    setMeta('meta[name="twitter:description"]',    "content",   description);
    setMeta('meta[name="twitter:site"]',           "content",   "@MacroScope_io");
    setLink('link[rel="canonical"]',               "href",      canonicalUrl);

    // JSON-LD structured data
    const ldScript = document.createElement("script");
    ldScript.type = "application/ld+json";
    ldScript.id   = "macroscope-ld";
    ldScript.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      "headline": event.title,
      "description": description,
      "datePublished": event.timestamp,
      "dateModified": event.timestamp,
      "author": { "@type": "Organization", "name": event.source_name || "MacroScope" },
      "publisher": { "@type": "Organization", "name": "MacroScope", "url": "https://macroscope.io" },
      "mainEntityOfPage": { "@type": "WebPage", "@id": canonicalUrl },
      "about": { "@type": "Place", "name": event.country },
      "keywords": keywords,
      "articleSection": event.category,
      "url": canonicalUrl,
    });
    document.head.appendChild(ldScript);

    return () => {
      // Restore previous values on unmount
      document.title = prev.title;
      if (prev.desc)    document.querySelector('meta[name="description"]')?.setAttribute("content", prev.desc);
      if (prev.ogTitle) document.querySelector('meta[property="og:title"]')?.setAttribute("content", prev.ogTitle);
      if (prev.ogDesc)  document.querySelector('meta[property="og:description"]')?.setAttribute("content", prev.ogDesc);
      if (prev.ogUrl)   document.querySelector('meta[property="og:url"]')?.setAttribute("content", prev.ogUrl);
      if (prev.canonical) document.querySelector('link[rel="canonical"]')?.setAttribute("href", prev.canonical);
      document.getElementById("macroscope-ld")?.remove();
    };
  }, [event.id]);

  return (
    <div style={{minHeight:"100vh",background:"#030912",color:"#e2e8f0",fontFamily:"'DM Sans',sans-serif"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500&family=DM+Serif+Display&display=swap');
        @keyframes msSpin { to{transform:rotate(360deg)} }
        @keyframes msPageIn { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:5px;} ::-webkit-scrollbar-track{background:transparent;} ::-webkit-scrollbar-thumb{background:#0f172a;border-radius:3px;}
        select option{background:#030912;}
      `}</style>

      {/* ── Top nav bar ─────────────────────────────────────────────── */}
      <div style={{position:"sticky",top:0,zIndex:100,background:"rgba(3,9,18,0.97)",backdropFilter:"blur(20px)",borderBottom:"1px solid rgba(255,255,255,0.06)",padding:"0 40px",display:"flex",alignItems:"center",justifyContent:"space-between",height:58}}>
        <div style={{display:"flex",alignItems:"center",gap:16}}>
          <button onClick={onBack} style={{display:"flex",alignItems:"center",gap:7,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:7,padding:"6px 14px",color:"#64748b",cursor:"pointer",fontSize:11,fontFamily:"'Space Mono',monospace",letterSpacing:1,transition:"all 0.15s"}}
            onMouseEnter={e=>{e.currentTarget.style.color="#e2e8f0";e.currentTarget.style.borderColor="rgba(255,255,255,0.15)";}}
            onMouseLeave={e=>{e.currentTarget.style.color="#64748b";e.currentTarget.style.borderColor="rgba(255,255,255,0.08)";}}>
            <span style={{fontSize:14}}>←</span> BACK TO MAP
          </button>
          <div style={{width:1,height:20,background:"rgba(255,255,255,0.06)"}}/>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{width:24,height:24,borderRadius:6,background:"linear-gradient(135deg,rgba(10,132,255,0.14),rgba(10,132,255,0.05))",border:"1px solid rgba(10,132,255,0.28)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12}}>🌐</div>
            <span style={{fontSize:13,fontFamily:"'Space Mono',monospace",fontWeight:700,color:"#f1f5f9"}}>MACRO<span style={{color:"#0A84FF"}}>SCOPE</span></span>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          {/* Slug URL display */}
          <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:6,padding:"4px 12px",display:"flex",alignItems:"center",gap:6}}>
            <div style={{width:6,height:6,borderRadius:"50%",background:col,boxShadow:`0 0 5px ${col}`}}/>
            <span style={{fontSize:9,color:"#334155",fontFamily:"monospace",letterSpacing:1}}>macroscope.io/event/{slug}</span>
          </div>
          <button onClick={()=>toggleBookmark(event.id)} style={{background:"none",border:"none",cursor:"pointer",color:bookmarks.has(event.id)?"#FFD60A":"#334155",fontSize:18,padding:4,transition:"color 0.15s"}}>★</button>
        </div>
      </div>

      {/* ── Top leaderboard ad ──────────────────────────────────────── */}
      <div style={{background:"rgba(4,9,20,0.8)",borderBottom:"1px solid rgba(255,255,255,0.04)",display:"flex",justifyContent:"center",padding:"10px 0"}}>
        <div style={{width:"min(970px,94%)",height:90,border:"1px dashed rgba(255,255,255,0.08)",borderRadius:10,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,background:"rgba(255,255,255,0.007)"}}>
          <div style={{fontSize:8,color:"#0f172a",fontFamily:"monospace",letterSpacing:2}}>ADVERTISEMENT</div>
          <div style={{fontSize:11,color:"#0f172a",fontFamily:"monospace",fontWeight:500}}>970 × 90 — LEADERBOARD AD</div>
          <div style={{fontSize:8,color:"#0a1020",fontFamily:"monospace",letterSpacing:1}}>ADSENSE / DFP SLOT — DETAIL PAGE TOP</div>
        </div>
      </div>

      {/* ── Page content ────────────────────────────────────────────── */}
      <div style={{maxWidth:1100,margin:"0 auto",padding:"40px 32px 80px",animation:"msPageIn 0.32s cubic-bezier(0.16,1,0.3,1)"}}>

        {/* Breadcrumb */}
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:24,fontSize:10,fontFamily:"monospace",color:"#334155"}}>
          <button onClick={onBack} style={{background:"none",border:"none",color:"#334155",cursor:"pointer",fontSize:10,fontFamily:"monospace",padding:0}} onMouseEnter={e=>e.currentTarget.style.color="#94a3b8"} onMouseLeave={e=>e.currentTarget.style.color="#334155"}>HOME</button>
          <span>/</span><span style={{color:"#475569",textTransform:"uppercase",letterSpacing:1}}>{event.region}</span>
          <span>/</span><span style={{color:col,textTransform:"uppercase",letterSpacing:1}}>{event.category}</span>
        </div>

        {/* Hero */}
        <div style={{marginBottom:36}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:16}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:col,display:"inline-block",boxShadow:`0 0 10px ${col}`}}/>
            <span style={{fontSize:10,fontFamily:"'Space Mono',monospace",color:col,letterSpacing:3,textTransform:"uppercase"}}>{event.category}</span>
            <span style={{fontSize:9,color:"#1e293b"}}>·</span>
            <span style={{fontSize:10,fontFamily:"'Space Mono',monospace",color:"#475569",letterSpacing:1}}>{event.region}</span>
            <span style={{marginLeft:"auto",fontSize:10,color:"#334155",fontFamily:"monospace"}}>{formatDate(event.timestamp)}</span>
          </div>
          <h1 style={{margin:"0 0 14px",fontSize:32,fontFamily:"'DM Serif Display',Georgia,serif",color:"#f1f5f9",lineHeight:1.25,fontWeight:400}}>{event.title}</h1>
          <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <span style={{fontSize:13}}>📍</span>
            <span style={{fontSize:13,color:"#475569",fontFamily:"'Space Mono',monospace"}}>{event.country}</span>
            <span style={{fontSize:10,background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:5,padding:"2px 9px",color:"#334155",fontFamily:"monospace"}}>{timeAgo(event.timestamp)}</span>
          </div>
        </div>

        {/* 3-column grid: main | mid | sidebar */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 280px",gap:24,alignItems:"start"}}>

          {/* COL 1 — Summary + AI */}
          <div style={{display:"flex",flexDirection:"column",gap:20}}>
            <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:"22px"}}>
              <div style={{fontSize:9,fontFamily:"'Space Mono',monospace",color:"#334155",letterSpacing:2,marginBottom:14}}>EVENT SUMMARY</div>
              <p style={{margin:0,fontSize:14,color:"#94a3b8",lineHeight:1.85}}>{event.summary}</p>
            </div>

            {/* Mid-content rectangle ad */}
            <div style={{height:250,border:"1px dashed rgba(255,255,255,0.08)",borderRadius:10,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,background:"rgba(255,255,255,0.006)"}}>
              <div style={{fontSize:8,color:"#0f172a",fontFamily:"monospace",letterSpacing:2}}>ADVERTISEMENT</div>
              <div style={{fontSize:10,color:"#0f172a",fontFamily:"monospace"}}>300 × 250</div>
              <div style={{fontSize:8,color:"#0a1020",fontFamily:"monospace",letterSpacing:1,textAlign:"center"}}>ADSENSE<br/>MID-CONTENT</div>
            </div>

            {/* AI Analysis */}
            <div style={{background:"linear-gradient(135deg,rgba(10,132,255,0.05),rgba(10,132,255,0.02))",border:"1px solid rgba(10,132,255,0.18)",borderRadius:12,padding:"22px"}}>
              <div style={{fontSize:9,fontFamily:"'Space Mono',monospace",color:"#0A84FF",letterSpacing:2,marginBottom:14}}>AI DEEP ANALYSIS</div>
              <AISummary event={event}/>
            </div>

            {/* Bottom content ad */}
            <div style={{height:90,border:"1px dashed rgba(255,255,255,0.07)",borderRadius:10,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,background:"rgba(255,255,255,0.005)"}}>
              <div style={{fontSize:8,color:"#0f172a",fontFamily:"monospace",letterSpacing:2}}>ADVERTISEMENT</div>
              <div style={{fontSize:10,color:"#0f172a",fontFamily:"monospace"}}>728 × 90 — BOTTOM BANNER</div>
            </div>
          </div>

          {/* COL 2 — Asset prediction cards */}
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{fontSize:9,fontFamily:"'Space Mono',monospace",color:"#334155",letterSpacing:2,marginBottom:2}}>ASSET PREDICTIONS</div>
            {event.assets.map((a,i)=>{
              const c=DIR_COLOR[a.direction];
              const sparkData=spark[i]||genSpark();
              return (
                <div key={a.symbol} style={{background:"rgba(255,255,255,0.025)",border:`1px solid ${c}25`,borderRadius:12,padding:"16px 18px"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:38,height:38,borderRadius:"50%",background:c+"14",border:`1px solid ${c}33`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                        <span style={{fontSize:16,color:c,fontWeight:700}}>{DIR_ARROW[a.direction]}</span>
                      </div>
                      <div>
                        <div style={{fontSize:14,color:"#e2e8f0",fontFamily:"monospace",fontWeight:700}}>{a.symbol}</div>
                        {a.direction!=="flat"&&<div style={{fontSize:12,color:c,fontFamily:"monospace",fontWeight:700}}>{a.direction==="up"?"+":"-"}{a.pct}%</div>}
                        {a.direction==="flat"&&<div style={{fontSize:10,color:"#475569",fontFamily:"monospace"}}>NO CHANGE</div>}
                      </div>
                    </div>
                    <Sparkline data={sparkData} color={c} w={90} h={40}/>
                  </div>
                  <div style={{fontSize:12,color:"#64748b",lineHeight:1.6,borderTop:"1px solid rgba(255,255,255,0.05)",paddingTop:10,marginBottom:10}}>{a.reason}</div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{flex:1,height:4,borderRadius:2,background:"rgba(255,255,255,0.06)",overflow:"hidden"}}>
                      <div style={{height:"100%",borderRadius:2,background:`linear-gradient(90deg,${c}88,${c})`,width:`${Math.min(100,parseFloat(a.pct||0)*12+15)}%`,transition:"width 0.8s cubic-bezier(0.16,1,0.3,1)"}}/>
                    </div>
                    <span style={{fontSize:9,color:"#334155",fontFamily:"monospace",whiteSpace:"nowrap"}}>{parseFloat(a.pct||0)<1?"LOW IMPACT":parseFloat(a.pct||0)<3?"MED IMPACT":"HIGH IMPACT"}</span>
                  </div>
                </div>
              );
            })}

            {/* In-content rectangle ad */}
            <div style={{height:250,border:"1px dashed rgba(255,255,255,0.07)",borderRadius:10,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,background:"rgba(255,255,255,0.005)",marginTop:4}}>
              <div style={{fontSize:8,color:"#0f172a",fontFamily:"monospace",letterSpacing:2}}>ADVERTISEMENT</div>
              <div style={{fontSize:10,color:"#0f172a",fontFamily:"monospace"}}>300 × 250</div>
              <div style={{fontSize:8,color:"#0a1020",fontFamily:"monospace",letterSpacing:1,textAlign:"center"}}>ADSENSE<br/>IN-CONTENT</div>
            </div>
          </div>

          {/* COL 3 — Sidebar */}
          <div style={{display:"flex",flexDirection:"column",gap:16,position:"sticky",top:70}}>
            {/* Event info */}
            <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:"18px"}}>
              <div style={{fontSize:9,fontFamily:"'Space Mono',monospace",color:"#334155",letterSpacing:2,marginBottom:14}}>EVENT INFO</div>
              {[["COUNTRY",event.country],["REGION",event.region],["TYPE",event.category.toUpperCase()],["PUBLISHED",formatDate(event.timestamp)],["AGE",timeAgo(event.timestamp)]].map(([k,v])=>(
                <div key={k} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10,paddingBottom:10,borderBottom:"1px solid rgba(255,255,255,0.04)"}}>
                  <span style={{fontSize:9,color:"#1e293b",fontFamily:"monospace",letterSpacing:1,flexShrink:0}}>{k}</span>
                  <span style={{fontSize:10,color:"#94a3b8",fontFamily:"monospace",textAlign:"right",maxWidth:150,lineHeight:1.4}}>{v}</span>
                </div>
              ))}
            </div>

            {/* Affected assets quick list */}
            <div style={{background:"rgba(255,255,255,0.025)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:12,padding:"18px"}}>
              <div style={{fontSize:9,fontFamily:"'Space Mono',monospace",color:"#334155",letterSpacing:2,marginBottom:14}}>AFFECTED ASSETS</div>
              {event.assets.map(a=>{
                const c=DIR_COLOR[a.direction];
                return <div key={a.symbol} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8,padding:"8px 10px",background:"rgba(255,255,255,0.02)",borderRadius:7,border:`1px solid ${c}18`}}>
                  <span style={{fontSize:13,color:c,fontWeight:700,width:16,flexShrink:0}}>{DIR_ARROW[a.direction]}</span>
                  <span style={{fontSize:11,color:"#cbd5e1",fontFamily:"monospace",flex:1}}>{a.symbol}</span>
                  {a.direction!=="flat"&&<span style={{fontSize:10,color:c,fontFamily:"monospace",fontWeight:700,background:c+"14",padding:"2px 7px",borderRadius:4,border:`1px solid ${c}33`}}>{a.direction==="up"?"+":"-"}{a.pct}%</span>}
                </div>;
              })}
            </div>

            {/* Tall sidebar ad */}
            <div style={{height:600,border:"1px dashed rgba(255,255,255,0.07)",borderRadius:10,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,background:"rgba(255,255,255,0.005)"}}>
              <div style={{fontSize:8,color:"#0f172a",fontFamily:"monospace",letterSpacing:2}}>ADVERTISEMENT</div>
              <div style={{fontSize:10,color:"#0f172a",fontFamily:"monospace"}}>160 × 600</div>
              <div style={{fontSize:8,color:"#0a1020",fontFamily:"monospace",letterSpacing:1,textAlign:"center"}}>ADSENSE<br/>SKYSCRAPER</div>
            </div>

            {/* Second sidebar ad */}
            <div style={{height:250,border:"1px dashed rgba(255,255,255,0.07)",borderRadius:10,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,background:"rgba(255,255,255,0.005)"}}>
              <div style={{fontSize:8,color:"#0f172a",fontFamily:"monospace",letterSpacing:2}}>AD</div>
              <div style={{fontSize:10,color:"#0f172a",fontFamily:"monospace"}}>300 × 250</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Footer ad ────────────────────────────────────────────────── */}
      <div style={{borderTop:"1px solid rgba(255,255,255,0.05)",background:"rgba(3,9,18,0.8)",display:"flex",justifyContent:"center",padding:"16px 0 24px"}}>
        <div style={{width:"min(970px,94%)",height:90,border:"1px dashed rgba(255,255,255,0.07)",borderRadius:10,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,background:"rgba(255,255,255,0.005)"}}>
          <div style={{fontSize:8,color:"#0f172a",fontFamily:"monospace",letterSpacing:2}}>ADVERTISEMENT</div>
          <div style={{fontSize:11,color:"#0f172a",fontFamily:"monospace"}}>970 × 90 — FOOTER LEADERBOARD</div>
        </div>
      </div>
    </div>
  );
}

// ── Main App ─────────────────────────────────────────────────────────
export default function MacroScope() {
  const { route, navigate, goBack } = useHashRouter();
  const { events: ALL_EVENTS, loading: eventsLoading, backendStatus, lastFetch, refetch } = useEvents();

  const [expandedId, setExpandedId]       = useState(null);
  const [selectedId, setSelectedId]       = useState(null);
  const [filters, setFilters]             = useState({category:"all",region:"all",ageDays:Infinity});
  const [search, setSearch]               = useState("");
  const [bookmarks, setBookmarks]         = useState(new Set());
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [feedVisible, setFeedVisible]     = useState(true);
  const [panelMode, setPanelMode]         = useState(true);
  const [time, setTime]                   = useState("");

  useEffect(()=>{
    const fmt=()=>new Date().toUTCString().split(" ")[4];
    setTime(fmt()); const t=setInterval(()=>setTime(fmt()),1000); return()=>clearInterval(t);
  },[]);

  // ── Home page SEO defaults ────────────────────────────────────────
  useEffect(()=>{
    document.title = "MacroScope — Geopolitical Market Intelligence Map";
    const setMeta = (sel, attr, val) => {
      let el = document.querySelector(sel);
      if (!el) { el = document.createElement("meta"); document.head.appendChild(el); }
      el.setAttribute(attr, val);
    };
    const setLink = (sel, rel, href) => {
      let el = document.querySelector(sel);
      if (!el) { el = document.createElement("link"); el.setAttribute("rel", rel); document.head.appendChild(el); }
      el.setAttribute("href", href);
    };
    setMeta('meta[name="description"]',         "content", "Real-time geopolitical events mapped to forex, stocks and commodity market impacts. Track conflicts, sanctions, central bank decisions and their asset predictions.");
    setMeta('meta[name="keywords"]',            "content", "geopolitical risk, market impact, forex, commodities, sanctions, war risk, central bank, MacroScope");
    setMeta('meta[name="robots"]',              "content", "index, follow");
    setMeta('meta[property="og:type"]',         "content", "website");
    setMeta('meta[property="og:title"]',        "content", "MacroScope — Geopolitical Market Intelligence");
    setMeta('meta[property="og:description"]',  "content", "Real-time geopolitical events mapped to forex, stocks and commodity market impacts.");
    setMeta('meta[property="og:url"]',          "content", "https://macroscope.io");
    setMeta('meta[property="og:site_name"]',    "content", "MacroScope");
    setMeta('meta[name="twitter:card"]',        "content", "summary_large_image");
    setMeta('meta[name="twitter:title"]',       "content", "MacroScope — Geopolitical Market Intelligence");
    setMeta('meta[name="twitter:description"]', "content", "Real-time geopolitical events mapped to forex, stocks and commodity market impacts.");
    setMeta('meta[name="twitter:site"]',        "content", "@MacroScope_io");
    setLink('link[rel="canonical"]', "canonical", "https://macroscope.io");
  }, []);

  const toggleBookmark=useCallback((id)=>{
    setBookmarks(b=>{const n=new Set(b);n.has(id)?n.delete(id):n.add(id);return n;});
  },[]);

  const handleToggleCard=useCallback((id)=>{
    setExpandedId(prev=>prev===id?null:id);
    setSelectedId(id);
  },[]);

  const handleSelectOnly=useCallback((id)=>{
    setSelectedId(prev=>prev===id?null:id);
    setExpandedId(null);
  },[]);

  const handleDismiss=useCallback(()=>{ setSelectedId(null); setExpandedId(null); },[]);
  const handleClose=useCallback(()=>{ setSelectedId(null); setExpandedId(null); },[]);
  const handleOpenDetail=useCallback((id)=>{
    const ev = ALL_EVENTS.find(e=>e.id===id);
    if (ev) navigate(`#/event/${slugify(ev.title)}`);
  },[navigate, ALL_EVENTS]);

  const filtered=useMemo(()=>{
    const cutoff = Date.now() - filters.ageDays*24*60*60*1000;
    let ev=ALL_EVENTS;
    if(filters.category!=="all") ev=ev.filter(e=>e.category===filters.category);
    if(filters.region!=="all")   ev=ev.filter(e=>e.region===filters.region);
    if(isFinite(filters.ageDays)) ev=ev.filter(e=>new Date(e.timestamp).getTime()>=cutoff);
    if(search){const s=search.toLowerCase();ev=ev.filter(e=>e.country.toLowerCase().includes(s)||e.title.toLowerCase().includes(s));}
    if(showBookmarks) ev=ev.filter(e=>bookmarks.has(e.id));
    return ev;
  },[ALL_EVENTS,filters,search,bookmarks,showBookmarks]);

  // ── Route: detail page ───────────────────────────────────────────
  if (route.page === "event") {
    // Match by slug — compare against slugified title of each event
    // Falls back to numeric ID match for backward compatibility
    const detailEvent = ALL_EVENTS.find(e =>
      slugify(e.title) === route.slug || String(e.id) === route.slug
    );
    if (detailEvent) {
      return <EventDetailPage event={detailEvent} onBack={goBack} bookmarks={bookmarks} toggleBookmark={toggleBookmark}/>;
    }
  }

  const selectedEvent=ALL_EVENTS.find(e=>e.id===selectedId)||null;
  const cats=["all","war","economy","politics"];
  const regions=["all","Europe","Asia","Americas","Middle East","Africa","Global"];

  return (
    <div style={{width:"100vw",height:"100vh",background:"#030912",color:"#e2e8f0",fontFamily:"'DM Sans',sans-serif",display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500&family=DM+Serif+Display&display=swap');
        @keyframes msSpin      { to{transform:rotate(360deg)} }
        @keyframes msSlideIn   { from{transform:translateX(12px);opacity:0} to{transform:translateX(0);opacity:1} }
        @keyframes msFadeUp    { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
        @keyframes msPulse     { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes msDotPulse  { 0%{transform:scale(0.7);opacity:0.9} 100%{transform:scale(2.6);opacity:0} }
        @keyframes msPageIn    { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:4px;height:4px;}
        ::-webkit-scrollbar-track{background:transparent;}
        ::-webkit-scrollbar-thumb{background:#0f172a;border-radius:2px;}
        .mapboxgl-ctrl-group{background:rgba(3,9,18,0.92)!important;border:1px solid rgba(255,255,255,0.08)!important;border-radius:8px!important;box-shadow:none!important;}
        .mapboxgl-ctrl-group button{background:transparent!important;}
        .mapboxgl-ctrl-icon{filter:invert(0.45)!important;}
        .mapboxgl-ctrl-attrib{background:transparent!important;color:#1e293b!important;font-size:9px!important;}
        .mapboxgl-ctrl-attrib a{color:#334155!important;}
        select option{background:#030912;}
      `}</style>

      {/* LOADING OVERLAY — shown while first fetch is in progress */}
      {eventsLoading && (
        <div style={{position:"fixed",inset:0,background:"#030912",zIndex:2000,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
          <div style={{width:36,height:36,border:"2px solid rgba(10,132,255,0.2)",borderTopColor:"#0A84FF",borderRadius:"50%",animation:"msSpin 0.9s linear infinite"}}/>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:14,fontFamily:"'Space Mono',monospace",color:"#f1f5f9",marginBottom:6}}>MACRO<span style={{color:"#0A84FF"}}>SCOPE</span></div>
            <div style={{fontSize:10,color:"#334155",fontFamily:"monospace",letterSpacing:2}}>LOADING EVENTS…</div>
          </div>
        </div>
      )}

      {/* TOP BANNER */}
      <div style={{height:90,background:"rgba(3,9,18,0.99)",borderBottom:"1px solid rgba(255,255,255,0.05)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,position:"relative",zIndex:50}}>
        <div style={{position:"absolute",left:16,top:"50%",transform:"translateY(-50%)",display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:36,height:36,borderRadius:9,background:"linear-gradient(135deg,rgba(10,132,255,0.14),rgba(10,132,255,0.05))",border:"1px solid rgba(10,132,255,0.28)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🌐</div>
          <div>
            <h1 style={{margin:0,fontSize:17,fontFamily:"'Space Mono',monospace",fontWeight:700,color:"#f1f5f9",letterSpacing:-0.5}}>MACRO<span style={{color:"#0A84FF"}}>SCOPE</span></h1>
            <div style={{fontSize:7,color:"#1e293b",fontFamily:"monospace",letterSpacing:2,marginTop:1}}>GEOPOLITICAL MARKET INTELLIGENCE</div>
          </div>
        </div>
        <div style={{width:"min(728px,55%)",height:70,border:"1px dashed rgba(255,255,255,0.07)",borderRadius:8,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3}}>
          <div style={{fontSize:8,color:"#0f172a",fontFamily:"monospace",letterSpacing:2}}>ADVERTISEMENT</div>
          <div style={{fontSize:10,color:"#0f172a",fontFamily:"monospace"}}>728 × 70 — TOP BANNER AD SLOT</div>
        </div>
        <div style={{position:"absolute",right:16,top:"50%",transform:"translateY(-50%)",display:"flex",alignItems:"center",gap:10}}>
          {/* Backend status badge */}
          {(() => {
            const cfg = {
              live:       { dot:"#30D158", label:"LIVE DATA",    bg:"rgba(48,209,88,0.08)",  border:"rgba(48,209,88,0.25)" },
              mock:       { dot:"#FFD60A", label:"DEMO DATA",    bg:"rgba(255,214,10,0.08)", border:"rgba(255,214,10,0.25)" },
              connecting: { dot:"#0A84FF", label:"CONNECTING…",  bg:"rgba(10,132,255,0.08)", border:"rgba(10,132,255,0.2)",  spin:true },
              error:      { dot:"#FF3B30", label:"API ERROR",    bg:"rgba(255,59,48,0.08)",  border:"rgba(255,59,48,0.25)" },
            }[backendStatus] || {};
            return (
              <div style={{display:"flex",alignItems:"center",gap:6,background:cfg.bg,border:`1px solid ${cfg.border}`,borderRadius:6,padding:"4px 10px",cursor:"pointer"}}
                onClick={refetch} title="Click to refresh">
                <div style={{width:5,height:5,borderRadius:"50%",background:cfg.dot,animation:cfg.spin?"msSpin 1.2s linear infinite":"msPulse 2s infinite"}}/>
                <span style={{fontSize:8,fontFamily:"'Space Mono',monospace",color:cfg.dot,letterSpacing:1.5}}>{cfg.label}</span>
                <span style={{fontSize:8,color:"rgba(255,255,255,0.2)"}}>↻</span>
              </div>
            );
          })()}
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:13,fontFamily:"'Space Mono',monospace",color:"#1e293b"}}>{time}</div>
            <div style={{fontSize:7,color:"#0f172a",fontFamily:"monospace",letterSpacing:2}}>UTC LIVE</div>
          </div>
        </div>
      </div>

      {/* TOOLBAR */}
      <div style={{padding:"8px 16px",background:"rgba(3,9,18,0.98)",borderBottom:"1px solid rgba(255,255,255,0.05)",display:"flex",alignItems:"center",gap:10,flexShrink:0,flexWrap:"wrap"}}>
        {/* Stats */}
        <div style={{display:"flex",gap:6}}>
          {[{l:"EVENTS",v:filtered.length,c:"#e2e8f0"},{l:"CONFLICT",v:filtered.filter(e=>e.category==="war").length,c:"#FF3B30"},{l:"ECONOMIC",v:filtered.filter(e=>e.category==="economy").length,c:"#FFD60A"},{l:"POLITICAL",v:filtered.filter(e=>e.category==="politics").length,c:"#0A84FF"}].map(s=>(
            <div key={s.l} style={{background:"rgba(3,9,18,0.9)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:7,padding:"7px 12px",textAlign:"center",minWidth:60}}>
              <div style={{fontSize:18,fontFamily:"'Space Mono',monospace",color:s.c,lineHeight:1}}>{s.v}</div>
              <div style={{fontSize:7,color:"#334155",fontFamily:"monospace",letterSpacing:1,marginTop:2}}>{s.l}</div>
            </div>
          ))}
        </div>

        <div style={{width:1,height:24,background:"rgba(255,255,255,0.06)"}}/>

        {/* Category filters */}
        <div style={{display:"flex",gap:4,alignItems:"center"}}>
          {cats.map(c=>{
            const act=filters.category===c; const col=CAT_COLOR[c];
            return <button key={c} onClick={()=>setFilters(f=>({...f,category:c}))} style={{background:act?(col?col+"1a":"rgba(255,255,255,0.07)"):"rgba(255,255,255,0.02)",border:`1px solid ${act?(col||"rgba(255,255,255,0.2)")+"55":"rgba(255,255,255,0.06)"}`,color:act?(col||"#94a3b8"):"#334155",borderRadius:5,padding:"4px 10px",cursor:"pointer",fontSize:9,fontFamily:"monospace",letterSpacing:1,textTransform:"uppercase",transition:"all 0.2s"}}>{c}</button>;
          })}
        </div>

        <div style={{width:1,height:24,background:"rgba(255,255,255,0.06)"}}/>

        {/* Region */}
        <select value={filters.region} onChange={e=>setFilters(f=>({...f,region:e.target.value}))} style={{background:"rgba(3,9,18,0.9)",border:"1px solid rgba(255,255,255,0.06)",color:"#475569",borderRadius:5,padding:"5px 9px",fontSize:9,fontFamily:"monospace",cursor:"pointer",outline:"none"}}>
          {regions.map(r=><option key={r} value={r}>{r==="all"?"ALL REGIONS":r.toUpperCase()}</option>)}
        </select>

        <div style={{width:1,height:24,background:"rgba(255,255,255,0.06)"}}/>

        {/* Age filter */}
        <div style={{display:"flex",gap:4,alignItems:"center"}}>
          <span style={{fontSize:9,color:"#1e293b",fontFamily:"monospace",letterSpacing:1,whiteSpace:"nowrap"}}>AGE:</span>
          {AGE_FILTERS.map(f=>{
            const act=filters.ageDays===f.days;
            return <button key={f.label} onClick={()=>setFilters(prev=>({...prev,ageDays:f.days}))} style={{background:act?"rgba(255,255,255,0.08)":"rgba(255,255,255,0.02)",border:`1px solid ${act?"rgba(255,255,255,0.18)":"rgba(255,255,255,0.05)"}`,color:act?"#e2e8f0":"#334155",borderRadius:5,padding:"4px 9px",cursor:"pointer",fontSize:9,fontFamily:"monospace",letterSpacing:0.5,whiteSpace:"nowrap",transition:"all 0.2s"}}>{f.label}</button>;
          })}
        </div>

        <div style={{width:1,height:24,background:"rgba(255,255,255,0.06)"}}/>

        {/* Legend */}
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          {Object.entries(CAT_COLOR).map(([cat,col])=>(
            <div key={cat} style={{display:"flex",alignItems:"center",gap:4}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:col,boxShadow:`0 0 4px ${col}`}}/>
              <span style={{fontSize:8,color:"#334155",fontFamily:"monospace",letterSpacing:1,textTransform:"uppercase"}}>{cat}</span>
            </div>
          ))}
        </div>

        {/* Search + bookmarks + mode toggle */}
        <div style={{display:"flex",alignItems:"center",gap:6,marginLeft:"auto"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(3,9,18,0.9)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:8,padding:"5px 10px"}}>
            <span style={{fontSize:9,fontFamily:"'Space Mono',monospace",color:!panelMode?"#e2e8f0":"#334155",letterSpacing:1,transition:"color 0.2s"}}>DOTS</span>
            <div onClick={()=>setPanelMode(m=>!m)} style={{width:36,height:18,borderRadius:9,cursor:"pointer",background:panelMode?"#0A84FF":"rgba(255,255,255,0.08)",border:`1px solid ${panelMode?"#0A84FF":"rgba(255,255,255,0.1)"}`,position:"relative",transition:"background 0.25s,border-color 0.25s",flexShrink:0}}>
              <div style={{position:"absolute",top:2,left:panelMode?18:2,width:12,height:12,borderRadius:"50%",background:panelMode?"#fff":"rgba(255,255,255,0.4)",transition:"left 0.25s cubic-bezier(0.34,1.56,0.64,1),background 0.2s",boxShadow:panelMode?"0 1px 4px rgba(0,0,0,0.4)":"none"}}/>
            </div>
            <span style={{fontSize:9,fontFamily:"'Space Mono',monospace",color:panelMode?"#0A84FF":"#334155",letterSpacing:1,transition:"color 0.2s"}}>PANELS</span>
          </div>
          <div style={{width:1,height:20,background:"rgba(255,255,255,0.06)"}}/>
          <div style={{position:"relative"}}>
            <span style={{position:"absolute",left:9,top:"50%",transform:"translateY(-50%)",color:"#334155",fontSize:13,pointerEvents:"none"}}>⌕</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…"
              style={{background:"rgba(3,9,18,0.9)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:7,padding:"7px 12px 7px 30px",color:"#94a3b8",fontSize:11,fontFamily:"'Space Mono',monospace",outline:"none",width:160,transition:"border-color 0.2s"}}
              onFocus={e=>e.target.style.borderColor="rgba(10,132,255,0.4)"}
              onBlur={e=>e.target.style.borderColor="rgba(255,255,255,0.07)"}/>
          </div>
          <button onClick={()=>setShowBookmarks(b=>!b)} style={{background:showBookmarks?"rgba(255,214,10,0.1)":"rgba(255,255,255,0.02)",border:`1px solid ${showBookmarks?"rgba(255,214,10,0.3)":"rgba(255,255,255,0.06)"}`,borderRadius:7,padding:"7px 11px",color:showBookmarks?"#FFD60A":"#334155",cursor:"pointer",fontSize:14,transition:"all 0.2s"}}>★</button>

          {/* Backend status + refresh */}
          <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(3,9,18,0.9)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:7,padding:"5px 10px"}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:backendStatus==="live"?"#30D158":backendStatus==="error"?"#FF3B30":"#FFD60A",boxShadow:`0 0 4px ${backendStatus==="live"?"#30D158":backendStatus==="error"?"#FF3B30":"#FFD60A"}`}}/>
            <span style={{fontSize:8,color:"#334155",fontFamily:"monospace",letterSpacing:1}}>
              {backendStatus==="live"?"LIVE":backendStatus==="error"?"ERROR":"DEMO"}
            </span>
            {lastFetch && (
              <span style={{fontSize:8,color:"#1e293b",fontFamily:"monospace"}}>
                {lastFetch.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit",hour12:false})}
              </span>
            )}
            <button onClick={refetch} title="Refresh events" style={{background:"none",border:"none",color:"#334155",cursor:"pointer",fontSize:11,padding:0,lineHeight:1,transition:"color 0.15s"}}
              onMouseEnter={e=>e.currentTarget.style.color="#0A84FF"}
              onMouseLeave={e=>e.currentTarget.style.color="#334155"}>↺</button>
          </div>
        </div>
      </div>

      {/* BODY */}
      <div style={{flex:1,display:"flex",overflow:"hidden",minHeight:0}}>
        {/* Left sidebar ads */}
        <div style={{width:180,flexShrink:0,background:"rgba(3,9,18,0.95)",borderRight:"1px solid rgba(255,255,255,0.05)",display:"flex",flexDirection:"column",alignItems:"center",padding:"14px 10px",gap:12}}>
          <div style={{width:160,flex:1,border:"1px dashed rgba(255,255,255,0.06)",borderRadius:10,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:5,background:"rgba(255,255,255,0.006)"}}>
            <div style={{fontSize:8,color:"#0f172a",fontFamily:"monospace",letterSpacing:2}}>ADVERTISEMENT</div>
            <div style={{fontSize:10,color:"#0f172a",fontFamily:"monospace"}}>160 × 600</div>
            <div style={{fontSize:8,color:"#0a1020",fontFamily:"monospace",letterSpacing:1,textAlign:"center",lineHeight:1.6}}>ADSENSE<br/>SKYSCRAPER</div>
          </div>
          <div style={{width:160,height:150,border:"1px dashed rgba(255,255,255,0.05)",borderRadius:8,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,background:"rgba(255,255,255,0.004)"}}>
            <div style={{fontSize:8,color:"#0f172a",fontFamily:"monospace",letterSpacing:2}}>AD</div>
            <div style={{fontSize:9,color:"#0f172a",fontFamily:"monospace"}}>160 × 150</div>
          </div>
        </div>

        {/* Center: map + live feed */}
        <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",minWidth:0}}>
          <div style={{flex:1,position:"relative",overflow:"hidden",minHeight:0}}>
            <MapboxMap events={filtered} expandedId={expandedId} selectedId={selectedId} onToggle={handleToggleCard} onSelectOnly={handleSelectOnly} onDismiss={handleDismiss} filters={filters} panelMode={panelMode}/>
          </div>
          {/* Live feed */}
          <div style={{background:"rgba(3,9,18,0.97)",borderTop:"1px solid rgba(255,255,255,0.05)",flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 16px",borderBottom:feedVisible?"1px solid rgba(255,255,255,0.04)":"none"}}>
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <div style={{width:5,height:5,borderRadius:"50%",background:"#FF3B30",animation:"msPulse 1.5s infinite"}}/>
                <span style={{fontSize:9,fontFamily:"'Space Mono',monospace",color:"#FF3B30",letterSpacing:2}}>LIVE FEED</span>
                <span style={{fontSize:9,color:"#1e293b",fontFamily:"monospace"}}>· AUTO-REFRESH 5MIN</span>
              </div>
              <button onClick={()=>setFeedVisible(v=>!v)} style={{background:"none",border:"none",color:"#334155",cursor:"pointer",fontSize:9,fontFamily:"monospace",letterSpacing:1}}>{feedVisible?"▼ HIDE":"▲ SHOW"}</button>
            </div>
            {feedVisible&&<div style={{display:"flex",overflowX:"auto",padding:"8px 12px",scrollbarWidth:"none"}}>
              {filtered.slice(0,8).map(ev=>(
                <button key={ev.id} onClick={()=>handleToggleCard(ev.id)} style={{background:"none",border:"1px solid rgba(255,255,255,0.05)",borderRadius:6,padding:"6px 10px",cursor:"pointer",textAlign:"left",flexShrink:0,maxWidth:190,marginRight:6,color:"inherit",transition:"border-color 0.15s"}}
                  onMouseEnter={e=>e.currentTarget.style.borderColor=CAT_COLOR[ev.category]+"55"}
                  onMouseLeave={e=>e.currentTarget.style.borderColor="rgba(255,255,255,0.05)"}>
                  <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}>
                    <span style={{width:4,height:4,borderRadius:"50%",background:CAT_COLOR[ev.category],display:"inline-block"}}/>
                    <span style={{fontSize:8,color:"#334155",fontFamily:"monospace"}}>{ev.country}</span>
                  </div>
                  <div style={{fontSize:10,color:"#64748b",lineHeight:1.4}}>{ev.title.slice(0,45)}…</div>
                  <div style={{display:"flex",gap:3,marginTop:4}}>
                    {ev.assets.slice(0,2).map(a=>(
                      <span key={a.symbol} style={{fontSize:8,color:DIR_COLOR[a.direction],fontFamily:"monospace"}}>{DIR_ARROW[a.direction]}{a.symbol}</span>
                    ))}
                  </div>
                </button>
              ))}
            </div>}
          </div>
        </div>

        {/* Right panel */}
        <div style={{width:340,flexShrink:0,borderLeft:"1px solid rgba(255,255,255,0.05)",display:"flex",flexDirection:"column",overflow:"hidden",background:"rgba(3,9,18,0.98)"}}>
          {selectedEvent ? (
            <DetailSidePanel event={selectedEvent} onClose={handleClose} onOpenDetail={handleOpenDetail} bookmarks={bookmarks} toggleBookmark={toggleBookmark}/>
          ) : (
            <>
              <div style={{padding:"12px 14px 8px",borderBottom:"1px solid rgba(255,255,255,0.05)",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
                <span style={{fontSize:9,fontFamily:"'Space Mono',monospace",color:"#334155",letterSpacing:2}}>{showBookmarks?"BOOKMARKS":"GLOBAL EVENTS"} ({filtered.length})</span>
                <div style={{width:5,height:5,borderRadius:"50%",background:"#30D158",animation:"msPulse 2s infinite"}}/>
              </div>
              <div style={{flex:1,overflowY:"auto",scrollbarWidth:"thin",scrollbarColor:"#0f172a transparent"}}>
                {filtered.length===0
                  ? <div style={{padding:24,textAlign:"center",color:"#1e293b",fontSize:11,fontFamily:"monospace"}}>No events match filters</div>
                  : filtered.map(ev=>{
                    const col=CAT_COLOR[ev.category];
                    return (
                      <div key={ev.id} onClick={()=>handleToggleCard(ev.id)}
                        style={{padding:"10px 14px",cursor:"pointer",borderBottom:"1px solid rgba(255,255,255,0.03)",borderLeft:selectedId===ev.id?`2px solid ${col}`:"2px solid transparent",background:selectedId===ev.id?"rgba(10,132,255,0.04)":"transparent",transition:"all 0.15s",animation:"msFadeUp 0.3s ease"}}
                        onMouseEnter={e=>{if(selectedId!==ev.id)e.currentTarget.style.background="rgba(255,255,255,0.018)";}}
                        onMouseLeave={e=>{if(selectedId!==ev.id)e.currentTarget.style.background="transparent";}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                          <div style={{flex:1}}>
                            <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}>
                              <span style={{width:5,height:5,borderRadius:"50%",background:col,display:"inline-block",flexShrink:0,boxShadow:`0 0 4px ${col}`}}/>
                              <span style={{fontSize:8,color:"#1e293b",fontFamily:"monospace"}}>{ev.country} · {ev.region}</span>
                              <span style={{fontSize:7,color:"#1e293b",fontFamily:"monospace",marginLeft:"auto"}}>{timeAgo(ev.timestamp)}</span>
                            </div>
                            <div style={{fontSize:11,color:"#64748b",lineHeight:1.4,marginBottom:5}}>{ev.title.slice(0,52)}{ev.title.length>52?"...":""}</div>
                            <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                              {ev.assets.slice(0,3).map(a=>(
                                <div key={a.symbol} style={{display:"flex",alignItems:"center",gap:3,fontSize:8,fontFamily:"monospace",color:DIR_COLOR[a.direction]}}>
                                  <span>{DIR_ARROW[a.direction]}</span>
                                  <span style={{color:"#334155"}}>{a.symbol}</span>
                                  {a.direction!=="flat"&&<span>{a.pct}%</span>}
                                </div>
                              ))}
                            </div>
                          </div>
                          <button onClick={e=>{e.stopPropagation();toggleBookmark(ev.id);}} style={{background:"none",border:"none",cursor:"pointer",color:bookmarks.has(ev.id)?"#FFD60A":"#1e293b",fontSize:12,paddingLeft:6,flexShrink:0}}>★</button>
                        </div>
                      </div>
                    );
                  })
                }
              </div>
              <div style={{height:260,borderTop:"1px solid rgba(255,255,255,0.05)",flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:5,background:"rgba(255,255,255,0.004)"}}>
                <div style={{fontSize:8,color:"#0f172a",fontFamily:"monospace",letterSpacing:2}}>ADVERTISEMENT</div>
                <div style={{fontSize:10,color:"#0f172a",fontFamily:"monospace"}}>300 × 250</div>
                <div style={{fontSize:8,color:"#0a1020",fontFamily:"monospace",letterSpacing:1.5}}>ADSENSE SIDEBAR SLOT</div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}