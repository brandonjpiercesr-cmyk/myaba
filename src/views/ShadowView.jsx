// ⬡B:MACE.phase0:VIEW:shadow_extract:20260405⬡
// ShadowView — extracted from MyABA.jsx. SHADOW (Stealthy Historical Audit and Daily Oversight Watch) portal iframe.

export default function ShadowView() {
  return (
    <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
      <iframe
        src="https://aba-portal.onrender.com/shadow"
        style={{
          width: "100%",
          height: "100%",
          border: "none",
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}
        title="SHADOW Oversight"
        allow="clipboard-write"
      />
    </div>
  );
}
