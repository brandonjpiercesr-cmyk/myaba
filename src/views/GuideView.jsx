// ⬡B:MACE.phase0:VIEW:guide_extract:20260405⬡
// GuideView — extracted from MyABA.jsx. GUIDE location/places assistant with OpenStreetMap.

import { useState, useEffect } from "react";
import { MapPin, Loader2, Search } from "lucide-react";
import { ABABASE } from "../utils/api.js";

export default function GuideView({ userId }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mapUrl, setMapUrl] = useState("https://www.openstreetmap.org/export/embed.html?bbox=-80.0,35.9,-79.6,36.2&layer=mapnik");
  const [userLoc, setUserLoc] = useState(null);
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          console.log("[GUIDE] Location:", pos.coords.latitude, pos.coords.longitude, "accuracy:", pos.coords.accuracy + "m");
          const lat = pos.coords.latitude, lng = pos.coords.longitude;
          setUserLoc({ lat, lng });
          const d = 0.02;
          setMapUrl(`https://www.openstreetmap.org/export/embed.html?bbox=${lng-d},${lat-d},${lng+d},${lat+d}&layer=mapnik&marker=${lat},${lng}`);
        },
        () => {}
      );
    }
  }, []);
  
  const doSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(ABABASE + "/api/air/process", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: query, user_id: userId, channel: "myaba", context: { app: "guide" } })
      });
      const data = await res.json();
      setResults(prev => [...prev, { role: "user", text: query }, { role: "aba", text: data.response || data.message || "No results" }]);
      if (userLoc) {
        const d = 0.05;
        setMapUrl(`https://www.openstreetmap.org/export/embed.html?bbox=${userLoc.lng-d},${userLoc.lat-d},${userLoc.lng+d},${userLoc.lat+d}&layer=mapnik&marker=${userLoc.lat},${userLoc.lng}`);
      }
    } catch { setResults(prev => [...prev, { role: "user", text: query }, { role: "aba", text: "Could not reach GUIDE right now" }]); }
    setQuery(""); setLoading(false);
  };

  return (<div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden"}}>
    <div style={{height:"45%",position:"relative",borderBottom:"1px solid rgba(255,255,255,.08)"}}>
      <iframe src={mapUrl} style={{width:"100%",height:"100%",border:"none",filter:"brightness(.85) contrast(1.1) hue-rotate(180deg) invert(1)"}} title="GUIDE Map"/>
      <div style={{position:"absolute",bottom:8,left:8,padding:"4px 10px",borderRadius:8,background:"rgba(0,0,0,.6)",backdropFilter:"blur(8px)"}}>
        <span style={{color:"rgba(16,185,129,.8)",fontSize:10,fontWeight:600}}>GUIDE Maps</span>
      </div>
    </div>
    <div style={{flex:1,overflowY:"auto",padding:"8px 12px"}}>
      {results.length===0&&<div style={{textAlign:"center",padding:"24px 16px"}}>
        <MapPin size={28} style={{color:"rgba(16,185,129,.4)",margin:"0 auto 8px"}}/>
        <p style={{color:"rgba(255,255,255,.4)",fontSize:13,margin:0}}>Ask GUIDE about places, directions, restaurants</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:6,justifyContent:"center",marginTop:12}}>
          {["Coffee near me","Directions to airport","Best restaurants","Gas stations"].map(s=><button key={s} onClick={()=>{setQuery(s);setTimeout(doSearch,100)}} style={{padding:"6px 12px",borderRadius:16,border:"1px solid rgba(16,185,129,.15)",background:"rgba(16,185,129,.06)",color:"rgba(16,185,129,.6)",fontSize:11,cursor:"pointer"}}>{s}</button>)}
        </div>
      </div>}
      {results.map((msg,i)=><div key={i} style={{display:"flex",justifyContent:msg.role==="user"?"flex-end":"flex-start",marginBottom:6}}>
        <div style={{maxWidth:"85%",padding:"8px 12px",borderRadius:14,background:msg.role==="user"?"rgba(16,185,129,.15)":"rgba(255,255,255,.04)",border:"1px solid "+(msg.role==="user"?"rgba(16,185,129,.15)":"rgba(255,255,255,.06)")}}>
          <span style={{color:"rgba(255,255,255,.85)",fontSize:13,lineHeight:1.5}}>{typeof msg.text==="string"?msg.text:JSON.stringify(msg.text)}</span>
        </div>
      </div>)}
    </div>
    <div style={{flexShrink:0,padding:"8px 12px 12px",display:"flex",gap:8}}>
      <input value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==="Enter"&&doSearch()} placeholder="Ask GUIDE about places..." style={{flex:1,padding:"10px 14px",borderRadius:14,border:"1px solid rgba(16,185,129,.12)",background:"rgba(255,255,255,.04)",color:"#fff",fontSize:13,outline:"none"}}/>
      <button onClick={doSearch} disabled={loading||!query.trim()} style={{padding:"10px 18px",borderRadius:14,border:"none",background:loading?"rgba(16,185,129,.1)":"rgba(16,185,129,.2)",color:"#10b981",cursor:"pointer"}}>{loading?<Loader2 size={16} className="animate-spin"/>:<Search size={16}/>}</button>
    </div>
  </div>);
}
