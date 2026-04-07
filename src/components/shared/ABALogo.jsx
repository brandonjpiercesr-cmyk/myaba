// ⬡B:MACE.phase0:COMPONENT:abalogo_extract:20260405⬡
// ABALogo — extracted from MyABA.jsx. Used across many views and components.

export default function ABALogo({size=24,color="#a78bfa",glow=false}){
  return <img src="https://i.imgur.com/0be7HCF.png" alt="ABA" style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",filter:glow?"drop-shadow(0 0 6px rgba(139,92,246,.5))":"none"}} />;
}
