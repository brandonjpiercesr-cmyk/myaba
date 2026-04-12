// ⬡B:MACE.phase0:VIEW:settings_extract:20260405⬡
// SettingsDrawer — extracted from MyABA.jsx lines 5924-6160.

import { useState, useEffect } from "react";
import { X, Bell, Volume2, VolumeX, LogOut, User, Mail, ChevronRight, Loader2, Eye } from "lucide-react";
import { ABABASE, subscribeToPush, unsubscribeFromPush } from "../utils/api.js";
import { resolveHamId } from "../utils/ham.js";

export default function SettingsDrawer({open,onClose,bg,setBg,BG,voiceOut,setVoiceOut,onLogout,user}){
  const[notifyBriefing,setNotifyBriefing]=useState(()=>{try{return localStorage.getItem("myaba_notifyBriefing")!=="false"}catch{return true}});
  const[notifyUrgent,setNotifyUrgent]=useState(()=>{try{return localStorage.getItem("myaba_notifyUrgent")!=="false"}catch{return true}});
  const[autoSpeak,setAutoSpeak]=useState(()=>{try{return localStorage.getItem("myaba_autoSpeak")==="true"}catch{return false}});
  const[pushEnabled,setPushEnabled]=useState(()=>{try{return localStorage.getItem("myaba_pushEnabled")==="true"}catch{return false}});
  const[pushLoading,setPushLoading]=useState(false);
  // ⬡B:MYABA.V2:ghost:20260313⬡ Ghost Mode state
  const[ghostMode,setGhostMode]=useState(false);
  const[ghostLoading,setGhostLoading]=useState(false);
  // ⬡B:pam:STATE:passcode_ui:20260328⬡
  const[passcodeSet,setPasscodeSet]=useState(false);
  const[showPasscodeForm,setShowPasscodeForm]=useState(false);
  const[newPasscode,setNewPasscode]=useState('');
  const[confirmPasscode,setConfirmPasscode]=useState('');
  const[passcodeMsg,setPasscodeMsg]=useState('');
  const[passcodeLoading,setPasscodeLoading]=useState(false);
  const[heldItems,setHeldItems]=useState(0);
  
  // Load PAM status on mount (ghost mode + passcode + held items)
  useEffect(()=>{
    if(!user?.email)return;
    (async()=>{
      try{
        const res=await fetch(`${ABABASE}/api/pam/status?userId=${encodeURIComponent(user.email)}`);
        if(res.ok){
          const data=await res.json();
          if(data.success){
            setGhostMode(data.dark_mode||false);
            setPasscodeSet(data.passcode_set||false);
            setHeldItems(data.held_items||0);
          }
        }
      }catch(e){console.error("[PAM] Status load failed:",e)}
    })();
  },[user?.email]);
  
  const handleGhostToggle=async(enable)=>{
    setGhostLoading(true);
    try{
      const res=await fetch(`${ABABASE}/api/pam/dark`,{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({userId:user?.email||user?.uid||"unknown",enabled:enable})
      });
      if(res.ok){
        const data=await res.json();
        setGhostMode(data.dark_mode||enable);
      }
    }catch(e){console.error("[PAM] Dark toggle failed:",e)}
    setGhostLoading(false);
  };
  
  // ⬡B:pam:HANDLER:passcode_save:20260328⬡
  const handleSavePasscode=async()=>{
    if(newPasscode.length<4){setPasscodeMsg('Must be 4+ characters.');return;}
    if(newPasscode!==confirmPasscode){setPasscodeMsg('Passcodes do not match.');return;}
    setPasscodeLoading(true);
    try{
      const res=await fetch(`${ABABASE}/api/pam/passcode`,{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({userId:user?.email||user?.uid||'unknown',passcode:newPasscode})
      });
      const data=await res.json();
      if(data.success){
        setPasscodeSet(true);setShowPasscodeForm(false);
        setNewPasscode('');setConfirmPasscode('');setPasscodeMsg('');
      }else{setPasscodeMsg(data.error||'Failed.');}
    }catch(e){setPasscodeMsg(e.message);}
    setPasscodeLoading(false);
  };
  
  useEffect(()=>{try{localStorage.setItem("myaba_notifyBriefing",String(notifyBriefing))}catch{}},[notifyBriefing]);
  useEffect(()=>{try{localStorage.setItem("myaba_notifyUrgent",String(notifyUrgent))}catch{}},[notifyUrgent]);
  useEffect(()=>{try{localStorage.setItem("myaba_autoSpeak",String(autoSpeak))}catch{}},[autoSpeak]);
  useEffect(()=>{try{localStorage.setItem("myaba_pushEnabled",String(pushEnabled))}catch{}},[pushEnabled]);
  
  const handlePushToggle=async(enable)=>{
    setPushLoading(true);
    try{
      if(enable){
        const sub=await subscribeToPush(user?.email||user?.uid||"unknown");
        if(sub)setPushEnabled(true);
      }else{
        await unsubscribeFromPush(user?.email||user?.uid||"unknown");
        setPushEnabled(false);
      }
    }catch(e){console.error(e)}
    setPushLoading(false);
  };
  
  if(!open)return null;
  
  const Toggle=({value,onChange,label,sublabel})=>(
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
      <div>
        <p style={{color:"rgba(255,255,255,.85)",fontSize:13,fontWeight:500,margin:0}}>{label}</p>
        {sublabel&&<p style={{color:"rgba(255,255,255,.4)",fontSize:11,margin:"2px 0 0"}}>{sublabel}</p>}
      </div>
      <button onClick={()=>onChange(!value)} style={{width:48,height:28,borderRadius:99,border:"none",cursor:"pointer",background:value?"rgba(139,92,246,.5)":"rgba(255,255,255,.1)",position:"relative",transition:"background .2s"}}>
        <div style={{position:"absolute",top:2,left:value?22:2,width:24,height:24,borderRadius:"50%",background:"white",boxShadow:"0 2px 4px rgba(0,0,0,.2)",transition:"left .2s"}}/>
      </button>
    </div>
  );
  
  const Section=({title,children})=>(
    <div style={{marginBottom:20}}>
      <p style={{color:"rgba(255,255,255,.35)",fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:1.5,marginBottom:8}}>{title}</p>
      <div style={{background:"rgba(255,255,255,.03)",borderRadius:14,padding:"4px 14px"}}>{children}</div>
    </div>
  );
  
  return(<div style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
    <div onClick={onClose} style={{position:"absolute",inset:0,background:"rgba(0,0,0,.6)"}}/>
    <div style={{position:"relative",zIndex:101,width:"100%",maxWidth:480,background:"rgba(12,10,24,.98)",backdropFilter:"blur(24px)",border:"1px solid rgba(255,255,255,.08)",borderRadius:"24px 24px 0 0",padding:"24px 20px calc(32px + env(safe-area-inset-bottom))",maxHeight:"85vh",overflowY:"auto"}}>
      
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
        <span style={{color:"rgba(255,255,255,.9)",fontSize:18,fontWeight:700}}>Settings</span>
        <button onClick={onClose} style={{background:"rgba(255,255,255,.08)",border:"none",color:"white",width:36,height:36,borderRadius:99,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><X size={18}/></button>
      </div>
      
      {/* User info */}
      {user&&<div style={{display:"flex",alignItems:"center",gap:12,padding:14,background:"rgba(139,92,246,.08)",borderRadius:14,marginBottom:20}}>
        {user.photoURL?<img src={user.photoURL} alt="" style={{width:44,height:44,borderRadius:"50%",border:"2px solid rgba(139,92,246,.3)"}}/>:<div style={{width:44,height:44,borderRadius:"50%",background:"rgba(139,92,246,.2)",display:"flex",alignItems:"center",justifyContent:"center"}}><User size={22} style={{color:"rgba(139,92,246,.7)"}}/></div>}
        <div style={{flex:1}}>
          <p style={{color:"rgba(255,255,255,.9)",fontSize:14,fontWeight:600,margin:0}}>{user.displayName||"User"}</p>
          <p style={{color:"rgba(255,255,255,.5)",fontSize:11,margin:"2px 0 0"}}>{user.email}</p>
        </div>
      </div>}
      
      {/* Voice */}
      <Section title="Voice">
        <Toggle value={voiceOut} onChange={setVoiceOut} label="Voice responses" sublabel="ABA speaks her responses aloud"/>
        <Toggle value={autoSpeak} onChange={setAutoSpeak} label="Auto-speak" sublabel="Automatically speak without tapping"/>
      </Section>
      
      {/* Notifications */}
      <Section title="Notifications">
        <Toggle value={notifyBriefing} onChange={setNotifyBriefing} label="Morning briefing" sublabel="Daily summary at 6 AM"/>
        <Toggle value={notifyUrgent} onChange={setNotifyUrgent} label="Urgent alerts" sublabel="Calls and texts for emergencies"/>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0"}}>
          <div>
            <p style={{color:"rgba(255,255,255,.85)",fontSize:13,fontWeight:500,margin:0}}>Push notifications</p>
            <p style={{color:"rgba(255,255,255,.4)",fontSize:11,margin:"2px 0 0"}}>Alerts even when app is closed</p>
          </div>
          <button onClick={()=>handlePushToggle(!pushEnabled)} disabled={pushLoading} style={{width:48,height:28,borderRadius:99,border:"none",cursor:pushLoading?"wait":"pointer",background:pushEnabled?"rgba(139,92,246,.5)":"rgba(255,255,255,.1)",position:"relative",transition:"background .2s",opacity:pushLoading?.5:1}}>
            <div style={{position:"absolute",top:2,left:pushEnabled?22:2,width:24,height:24,borderRadius:"50%",background:"white",boxShadow:"0 2px 4px rgba(0,0,0,.2)",transition:"left .2s"}}/>
          </button>
        </div>
      </Section>
      
      {/* ⬡B:MYABA.V2:ghost_ui:20260313⬡ Ghost Mode Section */}
      <Section title="Privacy">
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
          <div>
            <p style={{color:ghostMode?"rgba(139,92,246,.95)":"rgba(255,255,255,.85)",fontSize:13,fontWeight:500,margin:0}}>Ghost Mode {ghostMode&&"👻"}</p>
            <p style={{color:"rgba(255,255,255,.4)",fontSize:11,margin:"2px 0 0"}}>ABA handles everything silently for 24h</p>
          </div>
          <button onClick={()=>handleGhostToggle(!ghostMode)} disabled={ghostLoading} style={{width:48,height:28,borderRadius:99,border:"none",cursor:ghostLoading?"wait":"pointer",background:ghostMode?"rgba(139,92,246,.5)":"rgba(255,255,255,.1)",position:"relative",transition:"background .2s",opacity:ghostLoading?.5:1}}>
            <div style={{position:"absolute",top:2,left:ghostMode?22:2,width:24,height:24,borderRadius:"50%",background:"white",boxShadow:"0 2px 4px rgba(0,0,0,.2)",transition:"left .2s"}}/>
          </button>
        </div>
        {ghostMode&&<div style={{padding:"10px 0",color:"rgba(139,92,246,.7)",fontSize:11}}>
          ABA is handling your messages autonomously. Toggle off to resume normal notifications.
        </div>}
        {/* ⬡B:pam:UI:cip_passcode:20260328⬡ Passcode Management */}
        <div style={{padding:"12px 0",borderTop:"1px solid rgba(255,255,255,.05)"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div>
              <p style={{color:"rgba(255,255,255,.85)",fontSize:13,fontWeight:500,margin:0}}>{passcodeSet?"Passcode Set 🔒":"No Passcode 🔓"}</p>
              <p style={{color:"rgba(255,255,255,.4)",fontSize:11,margin:"2px 0 0"}}>{passcodeSet?"Protected content requires your passcode.":"Set one to protect sensitive content."}</p>
            </div>
            <button onClick={()=>{setShowPasscodeForm(!showPasscodeForm);setPasscodeMsg('');}} style={{padding:"6px 12px",borderRadius:8,border:"1px solid rgba(139,92,246,.3)",background:"rgba(139,92,246,.1)",color:"#a78bfa",cursor:"pointer",fontSize:11}}>{passcodeSet?"Change":"Set"}</button>
          </div>
          {showPasscodeForm&&<div style={{marginTop:10,display:"flex",flexDirection:"column",gap:8}}>
            <input type="password" value={newPasscode} onChange={e=>setNewPasscode(e.target.value)} placeholder="New passcode (4+ chars)" style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.05)",color:"white",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
            <input type="password" value={confirmPasscode} onChange={e=>setConfirmPasscode(e.target.value)} placeholder="Confirm passcode" style={{width:"100%",padding:"8px 12px",borderRadius:8,border:"1px solid rgba(255,255,255,.1)",background:"rgba(255,255,255,.05)",color:"white",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
            {passcodeMsg&&<p style={{color:"#f87171",fontSize:11,margin:0}}>{passcodeMsg}</p>}
            <div style={{display:"flex",gap:8}}>
              <button onClick={handleSavePasscode} disabled={passcodeLoading} style={{padding:"7px 14px",borderRadius:8,border:"none",background:"rgba(139,92,246,.3)",color:"#c4b5fd",cursor:"pointer",fontSize:12}}>{passcodeLoading?"Saving...":"Save"}</button>
              <button onClick={()=>{setShowPasscodeForm(false);setNewPasscode('');setConfirmPasscode('');setPasscodeMsg('');}} style={{padding:"7px 14px",borderRadius:8,border:"1px solid rgba(255,255,255,.1)",background:"none",color:"rgba(255,255,255,.5)",cursor:"pointer",fontSize:12}}>Cancel</button>
            </div>
          </div>}
          {heldItems>0&&<div style={{marginTop:10,padding:10,borderRadius:8,background:"rgba(251,191,36,.05)",border:"1px solid rgba(251,191,36,.15)"}}>
            <p style={{color:"#fbbf24",fontSize:12,fontWeight:500,margin:0}}>Aunt PAM is holding {heldItems} item{heldItems>1?"s":""}</p>
            <p style={{color:"rgba(255,255,255,.4)",fontSize:11,margin:"4px 0 0"}}>Say "Aunt PAM, show me what you are holding" in chat.</p>
          </div>}
        </div>
      </Section>
      
      {/* Appearance */}
      <Section title="Background">
        <div style={{padding:"8px 0"}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {Object.entries(BG).map(([k,{u,l}])=>(
              <button key={k} onClick={()=>setBg(k)} style={{position:"relative",aspectRatio:"16/10",borderRadius:10,overflow:"hidden",border:bg===k?"2px solid rgba(139,92,246,.8)":"2px solid rgba(255,255,255,.06)",cursor:"pointer",background:"#111",padding:0,boxShadow:bg===k?"0 0 14px rgba(139,92,246,.4)":"none"}}>
                <img src={u} alt={l} style={{width:"100%",height:"100%",objectFit:"cover",opacity:.8}}/>
                <span style={{position:"absolute",bottom:0,left:0,right:0,padding:"10px 4px 4px",background:"linear-gradient(transparent,rgba(0,0,0,.8))",color:bg===k?"rgba(139,92,246,.95)":"rgba(255,255,255,.6)",fontSize:8,fontWeight:600,textAlign:"center"}}>{l}</span>
              </button>
            ))}
          </div>
        </div>
      </Section>
      
      {/* ⬡B:MYABA:CONNECT_EMAIL:20260320⬡ */}
      <button onClick={()=>{
        // Map email to ham_id for Nylas OAuth
        const email=(user?.email||"").toLowerCase();
        const hamId=resolveHamId(email);
        window.open(`${ABABASE}/api/nylas/connect?ham_id=${encodeURIComponent(hamId)}`,"_blank");
      }} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"100%",padding:"14px 16px",borderRadius:14,border:"1px solid rgba(16,185,129,.2)",background:"rgba(16,185,129,.06)",color:"rgba(16,185,129,.8)",cursor:"pointer",fontSize:14,fontWeight:600,marginBottom:8}}>
        <Mail size={18}/>Connect Email
      </button>
      
      {/* Replay Tour */}
      <button onClick={()=>{try{localStorage.removeItem("myaba_tour_complete")}catch{};window.location.reload()}} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"100%",padding:"12px 16px",borderRadius:14,border:"1px solid rgba(139,92,246,.15)",background:"rgba(139,92,246,.04)",color:"rgba(139,92,246,.6)",cursor:"pointer",fontSize:12,fontWeight:500,marginBottom:8}}>
        <Sparkles size={16}/>Replay Welcome Tour
      </button>
      
      {/* Sign out */}
      <button onClick={onLogout} style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,width:"100%",padding:"14px 16px",borderRadius:14,border:"1px solid rgba(239,68,68,.2)",background:"rgba(239,68,68,.06)",color:"rgba(239,68,68,.8)",cursor:"pointer",fontSize:14,fontWeight:600}}>
        <LogOut size={18}/>Sign Out
      </button>
      
      {/* Version */}
      <div style={{marginTop:16,padding:"14px",background:"rgba(139,92,246,.05)",borderRadius:14,border:"1px solid rgba(139,92,246,.1)",textAlign:"center"}}>
        <p style={{color:"rgba(139,92,246,.7)",fontSize:11,fontWeight:600,margin:0}}>MyABA v2.25.0</p>
        <p style={{color:"rgba(255,255,255,.3)",fontSize:10,margin:"4px 0 0"}}>Pre-Alpha</p>
      </div>
    </div>
  </div>);
}

// ═══════════════════════════════════════════════════════════════════════════
// MYABA — v1.1.3-P1: All Phase 1 fixes applied
// ═══════════════════════════════════════════════════════════════════════════
// ⬡B:AUDRA.C4:FIX:wrap_errorboundary:20260403⬡ Wrapped in ErrorBoundary
