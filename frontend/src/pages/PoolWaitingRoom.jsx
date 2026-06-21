import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

const PW_CSS = `
  .pw-scope{ --ink:#0B0B0B; --void:#0B0B0B; --base:#F0380F; --acid:#D8FF14; --boso:#1C18E8;
    --oni:#E8341C; --surface:#F2EEE2; --haze:#2B2B2B; }
  .pw-scope *{ box-sizing:border-box; }
  .pw-scope ::selection{ background:var(--acid); color:var(--ink); }
  @keyframes pwBlink{ 0%,49%{ opacity:1; } 50%,100%{ opacity:0; } }
  @keyframes pwPing{ 0%{ transform:scale(0.6); opacity:1; } 100%{ transform:scale(2.8); opacity:0; } }
  @keyframes pwBlipIn{ 0%{ transform:translate(-50%,-50%) scale(0); opacity:0; }
    30%{ transform:translate(-50%,-50%) scale(1.4); opacity:1; } 100%{ transform:translate(-50%,-50%) scale(1); opacity:1; } }
  @keyframes pwScan{ 0%{ background-position:0 0; } 100%{ background-position:-40px 0; } }
  @keyframes pwTakeover{ 0%{ opacity:0; transform:scale(1.1); } 100%{ opacity:1; transform:scale(1); } }
  @keyframes pwGlow{ 0%,100%{ opacity:0.4; } 50%{ opacity:0.9; } }

  .pw-scroll{ scrollbar-width:thin; scrollbar-color:var(--haze) var(--void); }
  .pw-scroll::-webkit-scrollbar{ width:5px; }
  .pw-scroll::-webkit-scrollbar-track{ background:var(--void); }
  .pw-scroll::-webkit-scrollbar-thumb{ background:var(--haze); }

  .pw-cancel:hover{ background:var(--oni); color:var(--surface); }

  .pw-body{ display:flex; flex-direction:column; }
  .pw-radar{ order:1; }
  .pw-stats{ order:2; }
  @media (min-width:900px){
    .pw-root{ height:100vh; overflow:hidden; }
    .pw-body{ display:grid; grid-template-columns:1.25fr 0.75fr; flex:1 1 auto; min-height:0; }
    .pw-radar{ order:0; min-height:0; }
    .pw-stats{ order:0; min-height:0; overflow-y:auto; }
  }
`;

const BLIP_SLOTS = [
  { x: "32%", y: "30%" }, { x: "70%", y: "26%" }, { x: "76%", y: "62%" },
  { x: "30%", y: "66%" }, { x: "58%", y: "74%" }, { x: "22%", y: "46%" }, { x: "68%", y: "46%" },
];

const mmss = (s) => {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};
const stamp = (d = new Date()) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
};
const labelStyle = { fontSize: "10px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--haze)" };

export default function PoolWaitingRoom({ squad, onCancel }) {
  const navigate = useNavigate();

  const region = squad?.region_id || "—";
  const matchId = squad?.match_id || null;
  const found = (squad?.status === "proposed" || squad?.status === "locked") && Boolean(matchId);

  const [pool, setPool] = useState(null);
  const queuedAtRef = useRef(squad?.queued_at ? new Date(squad.queued_at).getTime() : Date.now());
  const [ownWait, setOwnWait] = useState(0);
  const [feed, setFeed] = useState([{ t: stamp(), msg: "ENTERED POOL · REGION SYNCED", color: "var(--haze)" }]);
  const prevUnitsRef = useRef(null);
  const sweepRef = useRef(null);
  const edgeRef = useRef(null);
  const clockRef = useRef(null);
  const angleRef = useRef(0);

  useEffect(() => {
    if (squad?.queued_at) queuedAtRef.current = new Date(squad.queued_at).getTime();
  }, [squad?.queued_at]);

  useEffect(() => {
    if (!squad?.region_id || found) return undefined;
    let cancelled = false;
    const poll = () =>
      api.get("/matches/pool-status", { params: { region_id: squad.region_id } })
        .then((r) => { if (!cancelled) setPool(r.data); })
        .catch(() => {});
    poll();
    const id = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, [squad?.region_id, found]);

  useEffect(() => {
    const id = setInterval(() => {
      setOwnWait((Date.now() - queuedAtRef.current) / 1000);
      if (clockRef.current) clockRef.current.textContent = stamp();
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const units = pool?.units_searching ?? 0;
  const threshold = pool?.density_threshold ?? 6;
  const near = units >= threshold - 1;
  useEffect(() => {
    let raf;
    let last = performance.now();
    const loop = (now) => {
      const dt = (now - last) / 1000; last = now;
      angleRef.current = (angleRef.current + (near ? 200 : 100) * dt) % 360;
      const t = `rotate(${angleRef.current}deg)`;
      if (sweepRef.current) sweepRef.current.style.transform = t;
      if (edgeRef.current) edgeRef.current.style.transform = t;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [near]);

  useEffect(() => {
    if (!pool) return;
    const prev = prevUnitsRef.current;
    if (prev !== null && pool.units_searching !== prev) {
      const up = pool.units_searching > prev;
      setFeed((f) => [
        { t: stamp(), msg: `${up ? "UNIT JOINED" : "UNIT LEFT"} POOL · DENSITY ${pool.units_searching}`, color: up ? "var(--acid)" : "var(--haze)" },
        ...f,
      ].slice(0, 6));
    }
    prevUnitsRef.current = pool.units_searching;
  }, [pool?.units_searching]);

  useEffect(() => {
    if (!found) return undefined;
    const t = setTimeout(() => navigate(`/proposal/${matchId}`), 1500);
    return () => clearTimeout(t);
  }, [found, matchId]);

  const oldestWait = pool?.oldest_wait_seconds ?? ownWait;
  const patienceLimit = pool?.patience_limit_seconds ?? 600;
  const densColor = near ? "var(--acid)" : "var(--surface)";
  const patPct = Math.min(100, (oldestWait / patienceLimit) * 100);
  const patColor = patPct > 75 ? "var(--oni)" : patPct > 45 ? "var(--base)" : "var(--acid)";

  const densSegs = Array.from({ length: threshold }, (_, i) => {
    const on = i < units;
    return {
      bg: on ? "var(--acid)" : "transparent",
      bd: on ? "var(--ink)" : "var(--haze)",
      glow: i === units - 1 && near ? "0 0 12px 0 var(--acid)" : "none",
    };
  });

  const blips = useMemo(() => {
    const others = Math.max(0, Math.min(BLIP_SLOTS.length, units - 1));
    return BLIP_SLOTS.slice(0, others);
  }, [units]);

  return (
    <div className="pw-scope">
      <style>{PW_CSS}</style>
      <div className="pw-root" style={{ position: "relative", display: "flex", flexDirection: "column", minHeight: "100vh", width: "100%", background: "var(--void)", fontFamily: "'JetBrains Mono',monospace", color: "var(--surface)" }}>

        <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", minHeight: "44px", padding: "8px 16px", background: "var(--acid)", color: "var(--ink)", borderBottom: "2px solid var(--ink)", fontSize: "10px", fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "8px", height: "8px", background: "var(--ink)", display: "inline-block", animation: "pwBlink 1s steps(1) infinite" }} />
            IN POOL // REGION {region}
          </div>
          <div style={{ fontFamily: "'Anton',sans-serif", letterSpacing: "0.16em", fontSize: "12px" }}>MATCHPOINT</div>
          <div ref={clockRef}>--:--:--</div>
        </div>

        <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "10px", padding: "9px 16px", background: "#111", borderBottom: "1px solid var(--haze)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--haze)", flexWrap: "wrap" }}>
          <span style={{ color: "var(--surface)" }}>UNIT_{squad?.code || "----"}</span>
          <span>/</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "var(--acid)" }}>
            <span style={{ width: "7px", height: "7px", background: "var(--acid)", display: "inline-block", animation: "pwBlink 1.4s steps(1) infinite" }} />
            SEARCHING
          </span>
        </div>

        <div className="pw-body">

          <div className="pw-radar" style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "18px", padding: "32px 20px", background: "radial-gradient(circle at 50% 46%, #10120c 0%, var(--void) 78%)", borderRight: "1px solid var(--haze)", overflow: "hidden", minHeight: "300px" }}>
            <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(var(--haze) 1px, transparent 1px), linear-gradient(90deg, var(--haze) 1px, transparent 1px)", backgroundSize: "40px 40px", opacity: 0.12, pointerEvents: "none" }} />
            <div style={{ position: "absolute", top: "18px", left: "18px", ...labelStyle }}>// SCANNING POOL</div>
            <div style={{ position: "absolute", top: "18px", right: "18px", fontSize: "10px", fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: near ? "var(--acid)" : "var(--haze)" }}>{near ? "TEMPO: SURGE" : "TEMPO: STEADY"}</div>

            <div style={{ position: "relative", width: "min(76vw,440px)", aspectRatio: "1 / 1", maxHeight: "54vh", zIndex: 2 }}>
              <div style={{ position: "absolute", inset: 0, border: "1.5px solid var(--haze)", borderRadius: "50%" }} />
              <div style={{ position: "absolute", inset: "16%", border: "1px solid var(--haze)", borderRadius: "50%" }} />
              <div style={{ position: "absolute", inset: "34%", border: "1px solid var(--haze)", borderRadius: "50%" }} />
              <div style={{ position: "absolute", inset: "52%", border: "1px solid var(--haze)", borderRadius: "50%" }} />
              <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: "1px", background: "var(--haze)", opacity: 0.6 }} />
              <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: "1px", background: "var(--haze)", opacity: 0.6 }} />
              <div style={{ position: "absolute", inset: "-4%", borderRadius: "50%", boxShadow: `0 0 ${near ? "40px" : "16px"} 0 var(--acid)`, opacity: 0.5, animation: `pwGlow ${near ? "0.9s" : "2.4s"} ease-in-out infinite`, pointerEvents: "none" }} />
              <div ref={sweepRef} style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "conic-gradient(from 0deg, transparent 0deg, rgba(216,255,20,0.04) 30deg, rgba(216,255,20,0.30) 78deg, rgba(216,255,20,0.02) 90deg, transparent 92deg)", willChange: "transform" }} />
              <div ref={edgeRef} style={{ position: "absolute", left: "50%", top: "50%", width: "50%", height: "2px", background: "linear-gradient(90deg, var(--acid), transparent)", transformOrigin: "left center", willChange: "transform" }} />

              {blips.map((b, i) => (
                <div key={i} style={{ position: "absolute", left: b.x, top: b.y, transform: "translate(-50%,-50%)", width: "10px", height: "10px", background: "var(--acid)", border: "1px solid var(--ink)", animation: "pwBlipIn .5s cubic-bezier(.34,1.5,.64,1) both" }}>
                  <div style={{ position: "absolute", inset: "-5px", border: "1px solid var(--acid)", animation: "pwPing 2s ease-out infinite" }} />
                </div>
              ))}

              <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: "16px", height: "16px", background: "var(--acid)", border: "2px solid var(--ink)", zIndex: 3 }}>
                <div style={{ position: "absolute", inset: "-7px", border: "1px solid var(--acid)", animation: "pwPing 1.8s ease-out infinite" }} />
              </div>
            </div>

            <div style={{ zIndex: 2, textAlign: "center" }}>
              <div style={labelStyle}>// YOUR WAIT</div>
              <div style={{ fontFamily: "'Anton',sans-serif", fontSize: "clamp(40px,8vw,64px)", lineHeight: 0.8, letterSpacing: "0.02em", color: "var(--acid)", marginTop: "6px" }}>{mmss(ownWait)}</div>
            </div>
          </div>

          <div className="pw-stats pw-scroll" style={{ background: "var(--void)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "26px", padding: "26px 22px 30px" }}>

              <div style={labelStyle}>// WHY YOU WAIT</div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px" }}>
                  <span style={{ ...labelStyle, fontSize: "10px" }}>// DENSITY</span>
                  <span style={{ fontFamily: "'Anton',sans-serif", fontSize: "30px", lineHeight: 0.8, color: densColor }}>{units}<span style={{ color: "var(--haze)", fontSize: "22px" }}>/{threshold}</span><span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", color: "var(--haze)", marginLeft: "6px" }}>UNITS</span></span>
                </div>
                <div style={{ display: "flex", gap: "4px" }}>
                  {densSegs.map((g, i) => (
                    <div key={i} style={{ flex: "1 1 0", height: "26px", border: `2px solid ${g.bd}`, background: g.bg, boxShadow: g.glow }} />
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: densColor }}>
                  <span style={{ color: "var(--acid)" }}>▸</span> WAVE FIRES AT {threshold}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", borderTop: "1px solid var(--haze)", paddingTop: "24px" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px" }}>
                  <span style={{ ...labelStyle, fontSize: "10px" }}>// OLDEST WAIT</span>
                  <span style={{ fontFamily: "'Anton',sans-serif", fontSize: "26px", lineHeight: 0.8, color: patColor }}>{mmss(oldestWait)}<span style={{ color: "var(--haze)", fontSize: "18px" }}> / {mmss(patienceLimit)}</span></span>
                </div>
                <div style={{ position: "relative", height: "26px", border: "2px solid var(--ink)", background: "#111", overflow: "hidden" }}>
                  <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${patPct}%`, background: patColor, transition: "width .5s linear" }} />
                  <div style={{ position: "absolute", top: "-2px", bottom: "-2px", right: 0, width: "3px", background: "var(--oni)" }} />
                  <div style={{ position: "absolute", inset: 0, background: "repeating-linear-gradient(90deg, transparent 0 18px, rgba(0,0,0,0.25) 18px 20px)", animation: "pwScan 1.6s linear infinite", pointerEvents: "none" }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--oni)" }}>
                  <span>▸</span> FAILSAFE FIRES AT {mmss(patienceLimit)}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid var(--haze)", paddingTop: "24px" }}>
                <span style={{ ...labelStyle, fontSize: "10px" }}>// POOL FEED</span>
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  {feed.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "10px", fontWeight: 600, letterSpacing: "0.04em", color: f.color, padding: "6px 10px", background: "#0d0d0f", borderLeft: `2px solid ${f.color}` }}>
                      <span style={{ color: "var(--haze)", flex: "0 0 auto" }}>{f.t}</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.msg}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        </div>

        <div style={{ flex: "0 0 auto", borderTop: "2px solid var(--haze)", display: "flex", alignItems: "stretch" }}>
          <div style={{ flex: "1 1 auto", display: "flex", alignItems: "center", gap: "10px", padding: "0 16px", background: "#111", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: "var(--haze)", minWidth: 0 }}>
            <span style={{ color: "var(--acid)", flex: "0 0 auto" }}>RX&gt;</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{`{region:"${region}", density:${units}/${threshold}, oldest:${mmss(oldestWait)}/${mmss(patienceLimit)}}`}</span>
          </div>
          <button onClick={onCancel} className="pw-cancel" style={{ flex: "0 0 auto", cursor: "pointer", fontFamily: "'Anton',sans-serif", fontSize: "clamp(20px,3vw,30px)", lineHeight: 0.9, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--oni)", background: "var(--void)", border: 0, borderLeft: "2px solid var(--oni)", padding: "18px 26px 14px", transition: "background .12s ease, color .12s ease" }}>CANCEL ✕</button>
        </div>

        {found && (
          <div style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "24px", padding: "32px", textAlign: "center", background: "var(--acid)", color: "var(--ink)", animation: "pwTakeover .4s cubic-bezier(.34,1.4,.64,1) both" }}>
            <div style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.3em", textTransform: "uppercase" }}>WAVE FIRED · ROUTING TO PROPOSAL</div>
            <h2 style={{ fontFamily: "'Anton',sans-serif", fontWeight: 400, lineHeight: 0.8, textTransform: "uppercase", margin: 0, fontSize: "clamp(56px,13vw,128px)" }}>MATCH<br />FOUND</h2>
          </div>
        )}

      </div>
    </div>
  );
}
