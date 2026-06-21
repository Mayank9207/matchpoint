import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/client";

const MP_CSS = `
  .mp-scope{ --ink:#09090b; --void:#09090b; --base:#F0380F; --acid:#D8FF14; --boso:#1C18E8;
    --oni:#FF3333; --surface:#F2EEE2; --haze:#2B2B2B; --amber:#F0A91E; }
  .mp-scope *{ box-sizing:border-box; }
  .mp-scope ::selection{ background:var(--acid); color:var(--ink); }
  @keyframes mpBlink{ 0%,49%{ opacity:1; } 50%,100%{ opacity:0; } }
  @keyframes mpPing{ 0%{ transform:scale(0.6); opacity:1; } 100%{ transform:scale(2.6); opacity:0; } }
  @keyframes mpReveal{ 0%{ opacity:0; transform:translateY(8px); } 100%{ opacity:1; transform:translateY(0); } }
  @keyframes mpStatePulse{ 0%,100%{ opacity:1; } 50%{ opacity:0.45; } }
  @keyframes mpLockSnap{ 0%{ transform:scale(1.5); opacity:0; } 60%{ transform:scale(0.9); } 100%{ transform:scale(1); opacity:1; } }

  .mp-scroll{ scrollbar-width:thin; scrollbar-color:var(--haze) var(--void); }
  .mp-scroll::-webkit-scrollbar{ width:5px; }
  .mp-scroll::-webkit-scrollbar-track{ background:var(--void); }
  .mp-scroll::-webkit-scrollbar-thumb{ background:var(--haze); }

  .mp-decline:hover{ background:var(--oni); color:var(--surface); }
  .mp-cta:hover{ filter:brightness(0.94); }

  .mp-scan{ position:fixed; inset:0; z-index:60; pointer-events:none; background:repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.16) 3px, rgba(0,0,0,0) 4px); mix-blend-mode:multiply; }
  .mp-scan::after{ content:""; position:absolute; inset:0; background:radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0) 54%, rgba(0,0,0,0.46) 100%); }

  .mp-body{ display:flex; flex-direction:column; }
  .mp-venue{ order:1; }
  .mp-squads{ order:2; }
  @media (min-width:900px){
    .mp-root{ height:100vh; overflow:hidden; }
    .mp-body{ display:grid; grid-template-columns:1fr 1fr; flex:1 1 auto; min-height:0; }
    .mp-venue{ order:0; min-height:0; overflow-y:auto; }
    .mp-squads{ order:0; min-height:0; overflow-y:auto; }
  }
`;

const SPORTS = ["FOOTBALL", "BASKETBALL", "TENNIS", "VOLLEYBALL", "CRICKET", "BADMINTON",
  "KHOKHO", "SWIMMING", "TABLETENNIS", "HOCKEY", "RUGBY", "GOLF"];
const TIERS = ["BEGINNER", "INTERMEDIATE", "COMPETITIVE"];

const sportLabel = (n) => SPORTS[n] ?? `SPORT_${n}`;
const tierLabel = (n) => TIERS[n] ?? `TIER_${n}`;
const shortId = (id) => (id ? id.slice(-4).toUpperCase() : "----");

const pad = (n) => String(n).padStart(2, "0");
const stamp = (d = new Date()) => `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

const fmtTime = (epoch) => {
  if (!epoch) return "--:--";
  const d = new Date(epoch * 1000);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fmtDay = (epoch) => {
  if (!epoch) return "";
  const d = new Date(epoch * 1000);
  const today = new Date();
  const tmr = new Date(today.getTime() + 86400000);
  if (d.toDateString() === today.toDateString()) return "TODAY";
  if (d.toDateString() === tmr.toDateString()) return "TOMORROW";
  return d.toLocaleDateString("en", { weekday: "short" }).toUpperCase();
};

const AMBIENT = [{ x: "24%", y: "30%" }, { x: "72%", y: "26%" }, { x: "30%", y: "70%" }, { x: "78%", y: "64%" }];

export default function MatchProposal() {
  const { matchId } = useParams();
  const navigate = useNavigate();

  const [match, setMatch] = useState(null);
  const [mySquadId, setMySquadId] = useState(null);
  const [squadMeta, setSquadMeta] = useState({});
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);
  const clockRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => {
      if (clockRef.current) clockRef.current.textContent = stamp();
    }, 1000);
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
    if (!ids?.length) return;
    let alive = true;
    (async () => {
      const meta = {};
      let mine = null;
      await Promise.all(ids.map(async (id) => {
        try {
          const { data } = await api.get(`/squads/${id}`);
          mine = id;
          meta[id] = {
            code: data.code,
            format: data.format,
            players: (data.members || []).map((m) => m.display_name),
          };
        } catch {}
      }));
      if (!alive) return;
      setSquadMeta(meta);
      if (mine) setMySquadId(mine);
    })();
    return () => { alive = false; };
  }, [match?.squad_ids?.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const confirmed = match?.confirmed_squads || [];
  const youConfirmed = mySquadId ? confirmed.includes(mySquadId) : false;
  const locked = match?.status === "locked";
  const accent = locked ? "var(--acid)" : "var(--amber)";

  const handleConfirm = useCallback(async () => {
    if (locked) { navigate(`/ready/${matchId}`); return; }
    if (youConfirmed || confirming) return;
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
  }, [locked, youConfirmed, confirming, matchId, navigate]);

  const room = match?.room;
  const squadIds = match?.squad_ids || [];
  const squadCount = squadIds.length;
  const confirmedCount = confirmed.length;

  const myMeta = mySquadId ? squadMeta[mySquadId] : null;
  const format = myMeta?.format || (room ? `${room.capacity}P` : "—");

  const labelStyle = { fontSize: "10px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--haze)" };

  const shackleTf = locked ? "translateY(0)" : "translateY(-7px)";
  const stateAnim = locked ? "mpLockSnap .4s cubic-bezier(.34,1.5,.5,1) both" : "mpStatePulse 1.6s ease-in-out infinite";

  const ctaLabel = locked ? "ENTER READY-CHECK ➔" : youConfirmed ? "CONFIRMED · WAITING…" : confirming ? "TRANSMITTING…" : "CONFIRM SLOT ➔";
  const ctaBg = locked ? "var(--acid)" : youConfirmed ? "#161800" : "var(--amber)";
  const ctaFg = locked ? "var(--ink)" : youConfirmed ? "var(--acid)" : "var(--ink)";

  const transmission = match
    ? `{match:"${matchId}", status:"${match.status}", squads:${squadCount}, confirmed:${confirmedCount}}`
    : `{match:"${matchId}", status:"connecting…"}`;

  return (
    <div className="mp-scope">
      <style>{MP_CSS}</style>
      <div className="mp-root" style={{ position: "relative", display: "flex", flexDirection: "column", minHeight: "100vh", width: "100%", background: "var(--void)", fontFamily: "'JetBrains Mono',monospace", color: "var(--surface)" }}>

        <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", minHeight: "44px", padding: "8px 16px", background: accent, color: "var(--ink)", borderBottom: "2px solid var(--ink)", fontSize: "10px", fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", flexWrap: "wrap", transition: "background .5s ease" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "8px", height: "8px", background: "var(--ink)", display: "inline-block", animation: "mpBlink 1s steps(1) infinite" }} />
            MATCH_NODE // {shortId(matchId)}
          </div>
          <div style={{ fontFamily: "'Anton',sans-serif", letterSpacing: "0.16em", fontSize: "12px" }}>UNIT: {myMeta?.code || (mySquadId ? shortId(mySquadId) : "····")}</div>
          <div ref={clockRef}>--:--:--</div>
        </div>

        <div style={{ flex: "0 0 auto", display: "flex", alignItems: "stretch", borderBottom: `2px solid ${accent}`, background: locked ? "#0e1300" : "#14110a", transition: "background .5s ease" }}>
          <div style={{ flex: "0 0 auto", width: "88px", display: "flex", alignItems: "center", justifyContent: "center", borderRight: `2px solid ${accent}` }}>
            <div style={{ position: "relative", width: "38px", height: "46px", animation: locked ? "mpLockSnap .4s cubic-bezier(.34,1.5,.5,1) both" : "none" }}>
              <div style={{ position: "absolute", left: "50%", top: 0, transform: `translateX(-50%) ${shackleTf}`, width: "24px", height: "22px", border: `4px solid ${accent}`, borderBottom: 0, borderRadius: "14px 14px 0 0", transition: "transform .4s cubic-bezier(.34,1.5,.5,1)" }} />
              <div style={{ position: "absolute", left: "50%", bottom: 0, transform: "translateX(-50%)", width: "38px", height: "28px", background: accent, border: "2px solid var(--ink)" }} />
              <div style={{ position: "absolute", left: "50%", bottom: "11px", transform: "translateX(-50%)", width: "5px", height: "9px", background: "var(--ink)" }} />
            </div>
          </div>
          <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", justifyContent: "center", gap: "4px", padding: "16px 20px", minWidth: 0 }}>
            <span style={labelStyle}>// MATCH_STATE</span>
            <div style={{ display: "flex", alignItems: "baseline", gap: "14px", flexWrap: "wrap" }}>
              <span style={{ fontFamily: "'Anton',sans-serif", fontSize: "clamp(38px,7vw,64px)", lineHeight: 0.78, letterSpacing: "0.01em", textTransform: "uppercase", color: accent, animation: stateAnim }}>{locked ? "LOCKED" : "PROPOSED"}</span>
              <span style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--haze)" }}>{locked ? "ALL PARTIES IN · ROOM SECURED" : "REVIEW & CONFIRM TO HOLD YOUR SLOT"}</span>
            </div>
          </div>
        </div>

        <div className="mp-body">

          <div className="mp-venue mp-scroll" style={{ background: "var(--void)", borderRight: "1px solid var(--haze)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "22px", padding: "24px 22px 30px" }}>

              <div>
                <div style={labelStyle}>// ASSIGNED_ROOM</div>
                <h1 style={{ fontFamily: "'Anton',sans-serif", fontWeight: 400, lineHeight: 0.8, letterSpacing: "-0.005em", textTransform: "uppercase", color: "var(--surface)", margin: "8px 0 0", fontSize: "clamp(34px,5.5vw,52px)" }}>
                  {room ? sportLabel(room.sport) : "—"}<span style={{ color: accent }}> · {format}</span>
                </h1>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", border: "2px solid var(--haze)", background: "#0d0d0f", padding: "13px 14px" }}>
                  <span style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.16em", color: "var(--haze)" }}>TIER</span>
                  <span style={{ fontSize: "15px", fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--surface)" }}>{room ? tierLabel(room.desired_tier) : "—"}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", border: "2px solid var(--haze)", background: "#0d0d0f", padding: "13px 14px" }}>
                  <span style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.16em", color: "var(--haze)" }}>CAPACITY</span>
                  <span style={{ fontSize: "15px", fontWeight: 800, letterSpacing: "0.04em", color: "var(--surface)" }}>{room ? `${room.capacity} SLOTS` : "—"}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", border: `2px solid ${accent}`, background: locked ? "#0e1300" : "#14110a", padding: "13px 14px", gridColumn: "1 / -1" }}>
                  <span style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.16em", color: "var(--haze)" }}>MATCH_TIME</span>
                  <span style={{ fontFamily: "'Anton',sans-serif", fontSize: "28px", lineHeight: 0.8, color: accent }}>
                    {fmtTime(room?.match_time)}<span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", color: "var(--haze)", marginLeft: "8px" }}>{fmtDay(room?.match_time)}</span>
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={labelStyle}>// VENUE_NODE</span>
                  <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: "var(--haze)" }}>{room ? `${room.lat.toFixed(4)}° · ${room.lon.toFixed(4)}°` : "—"}</span>
                </div>
                <div style={{ position: "relative", height: "190px", border: "2px solid var(--haze)", background: "radial-gradient(circle at 50% 50%, #111 0%, var(--void) 80%)", overflow: "hidden" }}>
                  <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(var(--haze) 1px, transparent 1px), linear-gradient(90deg, var(--haze) 1px, transparent 1px)", backgroundSize: "34px 34px", opacity: 0.16 }} />
                  {AMBIENT.map((a, i) => (
                    <div key={i} style={{ position: "absolute", left: a.x, top: a.y, transform: "translate(-50%,-50%)", width: "8px", height: "8px", background: "var(--haze)", border: "1px solid var(--ink)" }} />
                  ))}
                  <div style={{ position: "absolute", left: "54%", top: "48%", transform: "translate(-50%,-50%)", zIndex: 2 }}>
                    <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: "120px", height: "1px", background: accent, opacity: 0.5 }} />
                    <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: "1px", height: "120px", background: accent, opacity: 0.5 }} />
                    <div style={{ position: "relative", width: "16px", height: "16px", background: accent, border: "2px solid var(--ink)" }}>
                      <div style={{ position: "absolute", inset: "-6px", border: `1px solid ${accent}`, animation: "mpPing 1.8s ease-out infinite" }} />
                    </div>
                  </div>
                  <div style={{ position: "absolute", bottom: "10px", left: "12px", fontSize: "10px", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: accent }}>▸ {room ? `ROOM ${shortId(room.id)}` : "LOCATING…"}</div>
                </div>
              </div>

            </div>
          </div>

          <div className="mp-squads mp-scroll" style={{ background: "var(--void)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "18px", padding: "24px 22px 30px" }}>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "8px" }}>
                  <span style={labelStyle}>// GROUPED_SQUADS</span>
                  <span style={{ fontFamily: "'Anton',sans-serif", fontSize: "26px", lineHeight: 0.8, color: accent }}>
                    {confirmedCount}<span style={{ color: "var(--haze)", fontSize: "18px" }}>/{squadCount || "—"}</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", fontWeight: 800, letterSpacing: "0.1em", color: "var(--haze)", marginLeft: "6px" }}>CONFIRMED</span>
                  </span>
                </div>
                <div style={{ display: "flex", gap: "5px" }}>
                  {(squadIds.length ? squadIds : [0, 0]).map((_, i) => (
                    <div key={i} style={{ flex: "1 1 0", height: "10px", border: `2px solid ${i < confirmedCount ? "var(--ink)" : "var(--haze)"}`, background: i < confirmedCount ? accent : "transparent" }} />
                  ))}
                </div>
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--haze)" }}>
                  {locked ? "ALL SQUADS LOCKED IN — MATCH IS GO" : `${squadCount || "—"} SQUADS · ${confirmedCount} CONFIRMED`}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {squadIds.map((id) => {
                  const meta = squadMeta[id];
                  const isYou = id === mySquadId;
                  const isConf = confirmed.includes(id);
                  const on = isConf || locked;
                  const c = locked ? "var(--acid)" : isConf ? "var(--acid)" : "var(--amber)";
                  const players = meta?.players || null;
                  return (
                    <div key={id} style={{ border: `2px solid ${on ? "var(--acid)" : "var(--haze)"}`, background: on ? "#0e1300" : "#0d0d0f", animation: "mpReveal .3s cubic-bezier(.34,1.4,.64,1) both" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "12px 14px", borderBottom: `1px solid ${on ? "rgba(216,255,20,0.25)" : "var(--haze)"}` }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                          <span style={{ fontFamily: "'Anton',sans-serif", fontSize: "20px", lineHeight: 0.8, color: locked ? "var(--acid)" : "var(--surface)" }}>{meta?.code || shortId(id)}</span>
                          {isYou && (
                            <span style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink)", background: "var(--acid)", padding: "3px 7px" }}>YOU</span>
                          )}
                        </div>
                        <span style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "9px", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: c }}>
                          <span style={{ width: "8px", height: "8px", background: c, display: "inline-block", animation: on ? "none" : "mpBlink 1s steps(1) infinite" }} />
                          {on ? "CONFIRMED" : "AWAITING"}
                        </span>
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", padding: "11px 14px" }}>
                        {players ? players.map((p, j) => (
                          <span key={j} style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: j === 0 ? c : "var(--surface)", background: "#0d0d0f", border: "1px solid var(--haze)", padding: "5px 8px" }}>{p}</span>
                        )) : (
                          <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--haze)", background: "#0d0d0f", border: "1px solid var(--haze)", padding: "5px 8px" }}>▪ ROSTER HIDDEN</span>
                        )}
                      </div>
                    </div>
                  );
                })}
                {!squadIds.length && (
                  <div style={{ fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", color: "var(--haze)", padding: "12px 0" }}>{error || "ESTABLISHING LINK…"}</div>
                )}
              </div>

            </div>
          </div>

        </div>

        <div style={{ flex: "0 0 auto", borderTop: `2px solid ${accent}`, transition: "border-color .5s ease" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 16px", background: "#111", borderBottom: "1px solid var(--haze)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: "var(--haze)" }}>
            <span style={{ color: accent, flex: "0 0 auto" }}>RX&gt;</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{error ? `ERR: ${error}` : transmission}</span>
          </div>
          <div style={{ display: "flex", alignItems: "stretch" }}>
            <button className="mp-decline" onClick={() => navigate("/hub")} style={{ flex: "0 0 auto", cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--oni)", background: "var(--void)", border: 0, borderRight: "2px solid var(--haze)", padding: "0 22px", transition: "background .2s ease, color .2s ease" }}>DECLINE</button>
            <button className="mp-cta" onClick={handleConfirm} disabled={(youConfirmed && !locked) || confirming} style={{ flex: "1 1 auto", cursor: (youConfirmed && !locked) || confirming ? "default" : "pointer", fontFamily: "'Anton',sans-serif", fontSize: "clamp(22px,3.6vw,38px)", lineHeight: 0.9, letterSpacing: "0.02em", textTransform: "uppercase", color: ctaFg, background: ctaBg, border: 0, padding: "20px 16px 16px", transition: "background .2s ease, color .2s ease" }}>{ctaLabel}</button>
          </div>
        </div>

        <div className="mp-scan" />
      </div>
    </div>
  );
}
