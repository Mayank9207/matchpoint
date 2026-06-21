import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

const GATEWAY_CSS = `
  .gw-scope{ --ink:#0B0B0B; --void:#0B0B0B; --base:#F0380F; --acid:#D8FF14; --boso:#1C18E8;
    --oni:#E8341C; --surface:#F2EEE2; --haze:#2B2B2B; }
  .gw-scope *{ box-sizing:border-box; }
  .gw-scope ::selection{ background:var(--acid); color:var(--ink); }
  @keyframes gwPanelPop{ 0%{ transform:scale(0.97); } 100%{ transform:scale(1); } }
  @keyframes gwBlink{ 0%,49%{ opacity:1; } 50%,100%{ opacity:0; } }

  .gw-doors{ display:flex; flex-direction:column; }
  @media (min-width:760px){
    .gw-root{ height:100vh; overflow:hidden; }
    .gw-doors{ flex-direction:row; flex:1 1 auto; min-height:0; }
  }

  .gw-door{ transform:translate(0,0); box-shadow:0 0 0 0 var(--ink);
    transition:transform .1s cubic-bezier(0,0,.2,1), box-shadow .1s cubic-bezier(0,0,.2,1); }
  .gw-door:hover{ transform:translate(-6px,-6px); z-index:2; }
  .gw-door-host:hover{ box-shadow:14px 14px 0px 0px var(--oni); }
  .gw-door-join:hover{ box-shadow:14px 14px 0px 0px var(--boso); }
  .gw-door:focus-visible{ outline:3px solid var(--ink); outline-offset:-9px; }
`;

export default function Gateway() {
  const navigate = useNavigate();
  const [poolCount, setPoolCount] = useState(142);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/squads/pool/count")
      .then((res) => {
        const n = res?.data?.count;
        if (!cancelled && typeof n === "number") setPoolCount(n);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="gw-scope">
      <style>{GATEWAY_CSS}</style>

      <div
        className="gw-root"
        style={{ display: "flex", flexDirection: "column", minHeight: "100vh", width: "100%", background: "var(--void)", fontFamily: "'JetBrains Mono',monospace", color: "var(--surface)" }}
      >
        <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", minHeight: "44px", padding: "8px 16px", background: "var(--acid)", color: "var(--ink)", borderBottom: "2px solid var(--ink)", fontSize: "10px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "8px", height: "8px", background: "var(--oni)", display: "inline-block", animation: "gwBlink 1s steps(1) infinite" }} />
            AUTH // OK
          </div>
          <div style={{ fontFamily: "'Anton',sans-serif", letterSpacing: "0.16em", fontSize: "12px" }}>MATCHPOINT</div>
          <div>POOL: {poolCount}</div>
        </div>

        <div className="gw-doors" style={{ flex: "1 1 auto", minHeight: 0, padding: "24px", gap: "24px", background: "var(--void)" }}>
          <button
            type="button"
            onClick={() => navigate("/create")}
            className="gw-door gw-door-host"
            style={{ flex: "1 1 0", minHeight: "280px", textAlign: "left", cursor: "pointer", position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "24px", padding: "28px 26px", background: "var(--base)", color: "var(--ink)", border: "2px solid var(--ink)", borderRadius: 0, animation: "gwPanelPop 0.5s cubic-bezier(.34,1.56,.64,1) both" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start" }}>
              <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase" }}>[01] // HOST</span>
            </div>
            <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: "16px" }}>
              <h2 style={{ fontFamily: "'Anton',sans-serif", fontWeight: 400, margin: 0, lineHeight: 0.82, letterSpacing: "0.01em", textTransform: "uppercase", fontSize: "clamp(44px,7vw,72px)" }}>HOST_GAME</h2>
              <p style={{ fontSize: "11px", lineHeight: 1, fontWeight: 800, letterSpacing: "0.32em", textTransform: "uppercase", margin: 0, opacity: 0.8 }}>// INITIALIZE_NEW_SERVER_NODE</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate("/join")}
            className="gw-door gw-door-join"
            style={{ flex: "1 1 0", minHeight: "280px", textAlign: "left", cursor: "pointer", position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "24px", padding: "28px 26px", background: "var(--acid)", color: "var(--ink)", border: "2px solid var(--ink)", borderRadius: 0, animation: "gwPanelPop 0.5s cubic-bezier(.34,1.56,.64,1) both", animationDelay: "0.07s" }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start" }}>
              <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase" }}>[02] // DEPLOY</span>
            </div>
            <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: "16px" }}>
              <h2 style={{ fontFamily: "'Anton',sans-serif", fontWeight: 400, margin: 0, lineHeight: 0.82, letterSpacing: "0.01em", textTransform: "uppercase", fontSize: "clamp(44px,7vw,72px)" }}>JOIN_POOL</h2>
              <p style={{ fontSize: "11px", lineHeight: 1, fontWeight: 800, letterSpacing: "0.32em", textTransform: "uppercase", margin: 0, opacity: 0.8 }}>// INJECT_INTO_ACTIVE_POOL</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
