import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/client";

const RC_CSS = `
  .rc-scope{ --ink:#09090b; --void:#09090b; --base:#F0380F; --acid:#D8FF14; --boso:#1C18E8;
    --oni:#FF3333; --surface:#F2EEE2; --haze:#2B2B2B; --amber:#F0A91E; }
  .rc-scope *{ box-sizing:border-box; }
  .rc-scope ::selection{ background:var(--acid); color:var(--ink); }
  @keyframes rcBlink{ 0%,49%{ opacity:1; } 50%,100%{ opacity:0; } }
  @keyframes rcPing{ 0%{ transform:scale(0.6); opacity:1; } 100%{ transform:scale(2.6); opacity:0; } }
  @keyframes rcReveal{ 0%{ opacity:0; transform:translateY(8px); } 100%{ opacity:1; transform:translateY(0); } }
  @keyframes rcConfirmPulse{ 0%,100%{ box-shadow:6px 6px 0 0 var(--boso); transform:translate(0,0); } 50%{ box-shadow:10px 10px 0 0 var(--boso); transform:translate(-2px,-2px); } }
  @keyframes rcGlitch{ 0%{ transform:translate(0,0); clip-path:inset(0 0 0 0); } 10%{ transform:translate(-4px,2px); clip-path:inset(0 0 62% 0); } 20%{ transform:translate(5px,-3px); clip-path:inset(40% 0 0 0); } 30%{ transform:translate(-3px,1px); clip-path:inset(0 0 0 0); } 45%{ transform:translate(4px,2px); clip-path:inset(70% 0 8% 0); } 60%{ transform:translate(-2px,-2px); clip-path:inset(0 0 0 0); } 100%{ transform:translate(0,0); clip-path:inset(0 0 0 0); } }
  @keyframes rcRgbA{ 0%,100%{ opacity:0; transform:translate(0,0); } 12%,55%{ opacity:0.9; transform:translate(-3px,1px); } }
  @keyframes rcRgbB{ 0%,100%{ opacity:0; transform:translate(0,0); } 12%,55%{ opacity:0.9; transform:translate(3px,-1px); } }
  @keyframes rcBurst{ 0%{ opacity:0; } 8%{ opacity:1; } 30%{ opacity:0.4; } 100%{ opacity:0; } }
  @keyframes rcFlash{ 0%{ background:var(--surface); } 100%{ background:var(--acid); } }
  @keyframes rcSettle{ 0%{ transform:scale(1.12); } 100%{ transform:scale(1); } }

  .rc-confirm:hover{ filter:brightness(0.96); }
  .rc-decline:hover{ background:var(--oni); color:var(--surface); }

  .rc-scan{ position:fixed; inset:0; z-index:60; pointer-events:none; background:repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.16) 3px, rgba(0,0,0,0) 4px); mix-blend-mode:multiply; }
  .rc-scan::after{ content:""; position:absolute; inset:0; background:radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 54%, rgba(0,0,0,0.5) 100%); }
`;

const SPORTS = ["FOOTBALL", "BASKETBALL", "TENNIS", "VOLLEYBALL", "CRICKET", "BADMINTON",
  "KHOKHO", "SWIMMING", "TABLETENNIS", "HOCKEY", "RUGBY", "GOLF"];
const sportLabel = (n) => SPORTS[n] ?? `SPORT_${n}`;
const shortId = (id) => (id ? id.slice(-4).toUpperCase() : "----");
const pad = (n) => String(n).padStart(2, "0");
const stamp = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const mmss = (s) => `${Math.floor(s / 60)}:${pad(Math.max(0, s) % 60)}`;

const fmtTime = (e) => (e ? `${pad(new Date(e * 1000).getHours())}:${pad(new Date(e * 1000).getMinutes())}` : "--:--");
const fmtDay = (e) => {
  if (!e) return "";
  const d = new Date(e * 1000), t = new Date();
  if (d.toDateString() === t.toDateString()) return "TODAY";
  if (d.toDateString() === new Date(t.getTime() + 86400000).toDateString()) return "TMRW";
  return d.toLocaleDateString("en", { weekday: "short" }).toUpperCase();
};

const TTL = 600;

export default function ReadyCheck() {
  const { matchId } = useParams();
  const navigate = useNavigate();

  const [match, setMatch] = useState(null);
  const [mySquadId, setMySquadId] = useState(null);
  const [format, setFormat] = useState(null);
  const [remaining, setRemaining] = useState(TTL);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);
  const clockRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => { if (clockRef.current) clockRef.current.textContent = stamp(); }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!matchId) return;
    let alive = true;
    const tick = async () => {
      try {
        const { data } = await api.get(`/matches/${matchId}`);
        if (alive) setMatch(data);
      } catch (err) {
        if (alive) setError(err.response?.data?.detail || "Lost contact with match node.");
      }
    };
    tick();
    const t = setInterval(tick, 2000);
    return () => { alive = false; clearInterval(t); };
  }, [matchId]);

  useEffect(() => {
    const ids = match?.squad_ids;
    if (!ids?.length || mySquadId) return;
    let alive = true;
    (async () => {
      for (const id of ids) {
        try {
          const { data } = await api.get(`/squads/${id}`);
          if (!alive) return;
          setMySquadId(id);
          setFormat(data.format || null);
          break;
        } catch {}
      }
    })();
    return () => { alive = false; };
  }, [match?.squad_ids?.join(","), mySquadId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!match?.created_at) return;
    const start = new Date(match.created_at).getTime() / 1000;
    const t = setInterval(() => {
      setRemaining(Math.max(0, Math.round(TTL - (Date.now() / 1000 - start))));
    }, 1000);
    return () => clearInterval(t);
  }, [match?.created_at]);

  const confirmed = match?.confirmed_squads || [];
  const total = match?.squad_ids?.length || 0;
  const ready = confirmed.length;
  const youConfirmed = mySquadId ? confirmed.includes(mySquadId) : false;
  const locked = match?.status === "locked";
  const expired = !locked && (match?.status === "cancelled" || (Boolean(match) && remaining <= 0));
  const proposed = match?.status === "proposed" && !expired;

  const handleConfirm = useCallback(async () => {
    if (confirming || youConfirmed) return;
    setConfirming(true);
    try {
      await api.post(`/matches/${matchId}/confirm`);
      const { data } = await api.get(`/matches/${matchId}`);
      setMatch(data);
    } catch (err) {
      setError(err.response?.data?.detail || "Confirmation failed.");
    } finally {
      setConfirming(false);
    }
  }, [confirming, youConfirmed, matchId]);

  const room = match?.room;
  const ttlColor = remaining <= 60 ? "var(--oni)" : remaining <= 180 ? "var(--amber)" : "var(--acid)";
  const ttlPct = (remaining / TTL) * 100;
  const muted = { fontSize: "10px", fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--haze)" };

  const transmission = match
    ? `{match:"${matchId}", status:"${match.status}", ready:${ready}/${total}, ttl:${mmss(remaining)}}`
    : `{match:"${matchId}", status:"connecting…"}`;

  const glitchLayers = [
    { color: "var(--ink)", anim: "rcGlitch .7s steps(2) 1 both", blend: undefined },
    { color: "var(--oni)", anim: "rcRgbA .7s steps(2) 1 both", blend: "multiply" },
    { color: "var(--boso)", anim: "rcRgbB .7s steps(2) 1 both", blend: "multiply" },
  ];

  return (
    <div className="rc-scope">
      <style>{RC_CSS}</style>
      <div className="rc-root" style={{ position: "relative", display: "flex", flexDirection: "column", minHeight: "100vh", width: "100%", background: "var(--void)", fontFamily: "'JetBrains Mono',monospace", color: "var(--surface)" }}>

        <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", minHeight: "44px", padding: "8px 16px", background: "var(--acid)", color: "var(--ink)", borderBottom: "2px solid var(--ink)", fontSize: "10px", fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "8px", height: "8px", background: "var(--ink)", display: "inline-block", animation: "rcBlink 1s steps(1) infinite" }} />
            READY_CHECK // {shortId(matchId)}
          </div>
          <div ref={clockRef}>--:--:--</div>
        </div>

        <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "26px", padding: "32px 22px", width: "100%", maxWidth: "560px", margin: "0 auto" }}>

          <div style={{ width: "100%", display: "flex", alignItems: "stretch", border: "2px solid var(--haze)", background: "#0d0d0f" }}>
            <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", gap: "4px", padding: "12px 16px", minWidth: 0 }}>
              <span style={{ ...muted, fontSize: "9px" }}>// ROOM</span>
              <span style={{ fontFamily: "'Anton',sans-serif", fontSize: "22px", lineHeight: 0.8, textTransform: "uppercase", color: "var(--surface)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{room ? sportLabel(room.sport) : "—"}<span style={{ color: "var(--acid)" }}> · {format || (room ? `${room.capacity}P` : "—")}</span></span>
              <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--haze)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{room ? `ROOM ${shortId(room.id)}` : "LOCATING…"}</span>
            </div>
            <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "flex-end", gap: "2px", padding: "12px 16px", borderLeft: "1px solid var(--haze)" }}>
              <span style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.16em", color: "var(--haze)" }}>{fmtDay(room?.match_time)}</span>
              <span style={{ fontFamily: "'Anton',sans-serif", fontSize: "26px", lineHeight: 0.8, color: "var(--acid)" }}>{fmtTime(room?.match_time)}</span>
            </div>
          </div>

          <div style={{ width: "100%", display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ ...muted, flex: "0 0 auto", letterSpacing: "0.14em" }}>// PROPOSAL_TTL</span>
            <div style={{ flex: "1 1 auto", position: "relative", height: "6px", background: "#161616", border: "1px solid var(--haze)" }}>
              <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: `${ttlPct}%`, background: ttlColor, transition: "width 1s linear, background .4s ease" }} />
            </div>
            <span style={{ fontSize: "15px", fontWeight: 800, letterSpacing: "0.06em", color: ttlColor, flex: "0 0 auto", minWidth: "62px", textAlign: "right" }}>{mmss(remaining)}</span>
          </div>

          <div style={{ width: "100%" }}>
            {proposed && !youConfirmed && (
              <button className="rc-confirm" onClick={handleConfirm} disabled={confirming} style={{ width: "100%", cursor: confirming ? "default" : "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", fontFamily: "'Anton',sans-serif", textTransform: "uppercase", color: "var(--ink)", background: "var(--acid)", border: "2px solid var(--ink)", padding: "38px 20px", animation: "rcConfirmPulse 1.8s ease-in-out infinite" }}>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", fontWeight: 800, letterSpacing: "0.24em" }}>// YOUR UNIT</span>
                <span style={{ fontSize: "clamp(44px,11vw,72px)", lineHeight: 0.8, letterSpacing: "0.02em" }}>{confirming ? "SENDING…" : "CONFIRM"}</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", fontWeight: 700, letterSpacing: "0.14em" }}>HOLD YOUR SLOT — TAP TO READY UP</span>
              </button>
            )}
            {proposed && youConfirmed && (
              <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", border: "2px solid var(--acid)", background: "#0e1300", padding: "38px 20px", animation: "rcReveal .3s cubic-bezier(.34,1.4,.64,1) both" }}>
                <span style={{ position: "relative", width: "20px", height: "20px", background: "var(--acid)", border: "2px solid var(--ink)" }}>
                  <span style={{ position: "absolute", inset: "-7px", border: "1px solid var(--acid)", animation: "rcPing 1.8s ease-out infinite" }} />
                </span>
                <span style={{ fontFamily: "'Anton',sans-serif", fontSize: "clamp(36px,8vw,52px)", lineHeight: 0.82, textTransform: "uppercase", color: "var(--acid)" }}>CONFIRMED</span>
                <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--haze)" }}>WAITING FOR OTHERS...</span>
              </div>
            )}
          </div>

          <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={muted}>// SQUADS_READY</span>
              <span style={{ fontFamily: "'Anton',sans-serif", fontSize: "22px", lineHeight: 0.8, color: "var(--acid)" }}>{ready}<span style={{ color: "var(--haze)", fontSize: "16px" }}> / {total || "—"}</span></span>
            </div>
            <div style={{ display: "flex", gap: "6px" }}>
              {(total ? Array.from({ length: total }) : [0, 0]).map((_, i) => (
                <div key={i} style={{ flex: "1 1 0", height: "12px", border: `2px solid ${i < ready ? "var(--ink)" : "var(--haze)"}`, background: i < ready ? "var(--acid)" : "transparent", transition: "background .3s ease" }} />
              ))}
            </div>
          </div>
        </div>

        <div style={{ flex: "0 0 auto", borderTop: "2px solid var(--haze)", display: "flex", alignItems: "stretch" }}>
          <div style={{ flex: "1 1 auto", display: "flex", alignItems: "center", gap: "8px", padding: "0 16px", background: "#111", fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em", color: "var(--haze)", minWidth: 0 }}>
            <span style={{ color: "var(--acid)", flex: "0 0 auto" }}>RX&gt;</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{error ? `ERR: ${error}` : transmission}</span>
          </div>
          <button className="rc-decline" onClick={() => navigate("/hub")} style={{ flex: "0 0 auto", cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--oni)", background: "var(--void)", border: 0, borderLeft: "2px solid var(--oni)", padding: "16px 22px", transition: "background .2s ease, color .2s ease" }}>DECLINE</button>
        </div>

        {locked && (
          <div style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "22px", padding: "32px", textAlign: "center", background: "var(--acid)", color: "var(--ink)", animation: "rcFlash .25s steps(2) both" }}>
            <div style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "repeating-linear-gradient(to bottom, rgba(9,9,11,0) 0px, rgba(9,9,11,0) 2px, rgba(9,9,11,0.28) 3px, rgba(9,9,11,0) 5px)", animation: "rcBurst .9s ease-out both" }} />
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", fontWeight: 800, letterSpacing: "0.34em", textTransform: "uppercase", zIndex: 2 }}>// ALL SQUADS CONFIRMED</span>
            <div style={{ position: "relative", zIndex: 2, animation: "rcSettle .5s cubic-bezier(.34,1.5,.5,1) both" }}>
              {glitchLayers.map((g, i) => (
                <h1 key={i} aria-hidden={Boolean(g.blend)} style={{ position: g.blend ? "absolute" : "relative", inset: g.blend ? 0 : undefined, fontFamily: "'Anton',sans-serif", fontWeight: 400, lineHeight: 0.78, textTransform: "uppercase", margin: 0, color: g.color, fontSize: "clamp(56px,15vw,140px)", mixBlendMode: g.blend, pointerEvents: g.blend ? "none" : undefined, animation: g.anim }}>MATCH<br />LOCKED</h1>
              ))}
            </div>
            <button onClick={() => navigate(`/match/${matchId}`)} style={{ zIndex: 2, cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--acid)", background: "var(--ink)", border: 0, padding: "16px 30px" }}>OPEN MATCH ROOM ➔</button>
          </div>
        )}

        {expired && (
          <div style={{ position: "fixed", inset: 0, zIndex: 80, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "20px", padding: "32px", textAlign: "center", background: "var(--void)", color: "var(--surface)" }}>
            <span style={{ width: "14px", height: "14px", background: "var(--oni)", display: "inline-block", animation: "rcBlink .7s steps(1) infinite" }} />
            <h1 style={{ fontFamily: "'Anton',sans-serif", fontWeight: 400, lineHeight: 0.8, textTransform: "uppercase", margin: 0, color: "var(--oni)", fontSize: "clamp(40px,10vw,88px)" }}>PROPOSAL<br />EXPIRED</h1>
            <p style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--haze)", maxWidth: "36ch", lineHeight: 1.6 }}>TTL ELAPSED · REQUEUING CONFIRMED SQUADS · GHOST UNITS IDLED</p>
            <button onClick={() => navigate("/join")} style={{ cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink)", background: "var(--acid)", border: 0, padding: "14px 28px" }}>↺ BACK TO POOL</button>
          </div>
        )}

        <div className="rc-scan" />
      </div>
    </div>
  );
}
