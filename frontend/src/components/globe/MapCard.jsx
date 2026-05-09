import { CAT_COLOR, DIR_COLOR, DIR_ARROW, timeAgo } from "../../lib/events";

// Floating popup that appears next to a globe marker.
// Two visual modes: collapsed (compact preview) and expanded (full asset predictions).
// Scales down with viewport zoom so it never dominates the globe view.
export default function MapCard({ event, expanded, onToggle, scale = 1, style }) {
  const col = CAT_COLOR[event.category];
  const s = scale;
  const baseW = expanded ? 260 : 180;
  const w = baseW * s;
  const radius = Math.round(10 * s);
  const pad = Math.round(10 * s);
  const padSm = Math.round(6 * s);
  const fs = {
    label:   Math.max(6, Math.round(8 * s)),
    cat:     Math.max(6, Math.round(8 * s)),
    country: Math.max(7, Math.round(10 * s)),
    title:   Math.max(8, Math.round(11 * s)),
    body:    Math.max(7, Math.round(11 * s)),
    asset:   Math.max(6, Math.round(9 * s)),
    hint:    Math.max(5, Math.round(8 * s)),
  };
  const dotR = Math.max(3, Math.round(6 * s));
  const connH = Math.max(4, Math.round(8 * s));
  const pinR = Math.max(2, Math.round(6 * s));
  const gapRow = Math.max(2, Math.round(6 * s));

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
