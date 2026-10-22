import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ display: "flex", width: "100%", height: "100%", alignItems: "center", justifyContent: "center", background: "#101010", color: "#f3f0e9", fontFamily: "Arial", padding: 80 }}>
      <div style={{ display: "flex", flexDirection: "column", width: "100%", borderLeft: "10px solid #ff765f", paddingLeft: 58 }}>
        <div style={{ color: "#ff765f", fontSize: 25, letterSpacing: 8, textTransform: "uppercase" }}>Stories kept close</div>
        <div style={{ marginTop: 30, fontSize: 78, fontWeight: 700, letterSpacing: -4 }}>Smarties Archive</div>
        <div style={{ marginTop: 22, color: "#bdb8af", fontSize: 30 }}>A quiet corner for stories worth keeping.</div>
      </div>
    </div>,
    size,
  );
}
