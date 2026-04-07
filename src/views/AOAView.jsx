// ⬡B:MACE.phase0:VIEW:aoa_extract:20260405⬡
// AOAView — extracted from MyABA.jsx. Anatomy of ABA (AOA) portal iframe.
// ⬡B:aoa.triplet:CIP:iframe_embed:20260403⬡

export default function AOAView({ userId }) {
  // Loads the real AOA Portal in an iframe. T10 auth handled by the portal itself.
  return (
    <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
      <iframe
        src="https://aba-portal.onrender.com"
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
        title="AOA Portal"
        allow="clipboard-write"
      />
    </div>
  );
}
