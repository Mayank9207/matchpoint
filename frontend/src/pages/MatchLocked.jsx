import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../api/client";

const ML_CSS = `
  .ml-scope{ --ink:#09090b; --void:#09090b; --acid:#D8FF14; --boso:#1C18E8;
    --oni:#FF3333; --surface:#F2EEE2; --haze:#2B2B2B; --amber:#F0A91E; }
  .ml-scope *{ box-sizing:border-box; }
  .ml-scope ::selection{ background:var(--acid); color:var(--ink); }
  @keyframes mlBlink{ 0%,49%{ opacity:1; } 50%,100%{ opacity:0; } }
  @keyframes mlPing{ 0%{ transform:scale(0.6); opacity:1; } 100%{ transform:scale(2.4); opacity:0; } }
  @keyframes mlGlitch{ 0%{ transform:translate(0,0); clip-path:inset(0 0 0 0); } 12%{ transform:translate(-3px,1px); clip-path:inset(0 0 60% 0); } 24%{ transform:translate(4px,-2px); clip-path:inset(45% 0 0 0); } 40%{ transform:translate(-2px,1px); clip-path:inset(0 0 0 0); } 100%{ transform:translate(0,0); clip-path:inset(0 0 0 0); } }
  @keyframes mlRgbA{ 0%,100%{ opacity:0; } 14%,46%{ opacity:0.85; transform:translate(-2px,1px); } }
  @keyframes mlRgbB{ 0%,100%{ opacity:0; } 14%,46%{ opacity:0.85; transform:translate(2px,-1px); } }
  .ml-link:hover{ background:var(--acid); color:var(--ink); }
  .ml-cta:hover{ filter:brightness(0.95); }
  .ml-report:hover{ color:var(--oni); }
  .ml-scroll{ scrollbar-width:thin; scrollbar-color:var(--haze) var(--void); }
  .ml-scroll::-webkit-scrollbar{ width:5px; }
  .ml-scroll::-webkit-scrollbar-thumb{ background:var(--haze); }
  .ml-scan{ position:fixed; inset:0; z-index:60; pointer-events:none; background:repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.14) 3px, rgba(0,0,0,0) 4px); mix-blend-mode:multiply; }
`;

const SPORTS = ["FOOTBALL", "BASKETBALL", "TENNIS", "VOLLEYBALL", "CRICKET", "BADMINTON",
  "KHOKHO", "SWIMMING", "TABLETENNIS", "HOCKEY", "RUGBY", "GOLF"];
const TIERS = ["BEGINNER", "INTERMEDIATE", "COMPETITIVE"];
const sportLabel = (n) => SPORTS[n] ?? `SPORT_${n}`;
const tierLabel = (n) => TIERS[n] ?? `TIER_${n}`;
const shortId = (id) => (id ? id.slice(-4).toUpperCase() : "----");
const pad = (n) => String(n).padStart(2, "0");

const fmtFull = (e) => {
  if (!e) return { day: "—", time: "--:--" };
  const d = new Date(e * 1000);
  const wd = d.toLocaleDateString("en", { weekday: "short" }).toUpperCase();
  const mo = d.toLocaleDateString("en", { month: "short" }).toUpperCase();
  return { day: `${wd} ${pad(d.getDate())} ${mo}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
};

const calendarUrl = (room, fmt) => {
  if (!room?.match_time) return null;
  const z = (t) => new Date(t * 1000).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const start = z(room.match_time), end = z(room.match_time + 7200);
  const text = encodeURIComponent(`MatchPoint · ${sportLabel(room.sport)} ${fmt || ""}`.trim());
  const loc = encodeURIComponent(`${room.lat},${room.lon}`);
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${start}/${end}&location=${loc}&details=${encodeURIComponent("Your locked MatchPoint game.")}`;
};

export default function MatchLocked() {
  const { matchId } = useParams();
  const navigate = useNavigate();
  const [match, setMatch] = useState(null);
  const [format, setFormat] = useState(null);
  const [myMembers, setMyMembers] = useState(null);
  const [mySquadId, setMySquadId] = useState(null);
  const [imgOk, setImgOk] = useState(true);
  const [error, setError] = useState(null);
  const clockRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => {
      if (clockRef.current) { const d = new Date(); clockRef.current.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }
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
        if (alive) setError(err.response?.data?.detail || "Could not load match.");
      }
    };
    tick();
    const t = setInterval(tick, 5000);
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
          setMyMembers((data.members || []).map((m) => m.display_name));
          break;
        } catch {}
      }
    })();
    return () => { alive = false; };
  }, [match?.squad_ids?.join(","), mySquadId]); // eslint-disable-line react-hooks/exhaustive-deps

  const room = match?.room;
  const when = fmtFull(room?.match_time);
  const squadCount = match?.squad_ids?.length || 0;
  const players = room?.capacity || 0;
  const fmt = format || (room ? `${room.capacity}P` : "");
  const locked = match?.status === "locked";
  const mapsUrl = room ? `https://www.google.com/maps/search/?api=1&query=${room.lat},${room.lon}` : null;
  const calUrl = calendarUrl(room, fmt);

  const muted = { fontSize: "10px", fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--haze)" };
  const card = { border: "2px solid var(--haze)", background: "#0d0d0f" };

  return (
    <div className="ml-scope">
      <style>{ML_CSS}</style>
      <div className="ml-scroll" style={{ minHeight: "100vh", width: "100%", background: "var(--void)", fontFamily: "'JetBrains Mono',monospace", color: "var(--surface)", overflowY: "auto" }}>
        <div style={{ width: "100%", maxWidth: "480px", margin: "0 auto", display: "flex", flexDirection: "column", minHeight: "100vh" }}>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", minHeight: "44px", padding: "8px 16px", background: "var(--acid)", color: "var(--ink)", borderBottom: "2px solid var(--ink)", fontSize: "10px", fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ width: "8px", height: "8px", background: "var(--ink)", display: "inline-block", animation: "mlBlink 1.4s steps(1) infinite" }} />
              MATCH_ROOM // {shortId(matchId)}
            </div>
            <div ref={clockRef}>--:--:--</div>
          </div>

          <div style={{ position: "relative", padding: "30px 18px 24px", borderBottom: "2px solid var(--acid)", background: "linear-gradient(180deg, #0e1300 0%, var(--void) 100%)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
              <span style={muted}>// MATCH_STATE</span>
              <span style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: locked ? "var(--ink)" : "var(--amber)", background: locked ? "var(--acid)" : "transparent", border: locked ? "0" : "1px solid var(--amber)", padding: "4px 8px" }}>{locked ? "● LOCKED" : (match?.status || "····").toUpperCase()}</span>
            </div>
            <div style={{ position: "relative" }}>
              <h1 style={{ position: "relative", fontFamily: "'Anton',sans-serif", fontWeight: 400, lineHeight: 0.8, letterSpacing: "0.01em", textTransform: "uppercase", margin: 0, color: "var(--acid)", fontSize: "clamp(46px,15vw,72px)", animation: "mlGlitch .7s steps(2) 1 both" }}>MATCH<br />LOCKED</h1>
              <h1 aria-hidden="true" style={{ position: "absolute", inset: 0, fontFamily: "'Anton',sans-serif", fontWeight: 400, lineHeight: 0.8, textTransform: "uppercase", margin: 0, color: "var(--oni)", fontSize: "clamp(46px,15vw,72px)", mixBlendMode: "screen", pointerEvents: "none", animation: "mlRgbA .7s steps(2) 1 both" }}>MATCH<br />LOCKED</h1>
              <h1 aria-hidden="true" style={{ position: "absolute", inset: 0, fontFamily: "'Anton',sans-serif", fontWeight: 400, lineHeight: 0.8, textTransform: "uppercase", margin: 0, color: "var(--boso)", fontSize: "clamp(46px,15vw,72px)", mixBlendMode: "screen", pointerEvents: "none", animation: "mlRgbB .7s steps(2) 1 both" }}>MATCH<br />LOCKED</h1>
            </div>
            <p style={{ margin: "12px 0 0", fontSize: "11px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--haze)" }}>THE GAME IS SET · SEE YOU ON THE FIELD</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "18px 16px 28px", flex: "1 1 auto" }}>

            <div style={{ position: "relative", height: "200px", border: "2px solid var(--acid)", overflow: "hidden", background: "#0d0d0f" }}>
              {room?.image_url && imgOk ? (
                <img src={room.image_url} alt="venue" onError={() => setImgOk(false)} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : (
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "10px", background: "radial-gradient(circle at 50% 45%, #14180a 0%, var(--void) 80%)" }}>
                  <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(var(--haze) 1px, transparent 1px), linear-gradient(90deg, var(--haze) 1px, transparent 1px)", backgroundSize: "28px 28px", opacity: 0.18 }} />
                  <span style={{ fontFamily: "'Anton',sans-serif", fontSize: "34px", color: "var(--haze)", zIndex: 1 }}>▣</span>
                  <span style={{ ...muted, color: "var(--haze)", zIndex: 1 }}>NO_IMAGE</span>
                </div>
              )}
              <span style={{ position: "absolute", top: "8px", left: "8px", fontSize: "9px", fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink)", background: "var(--acid)", padding: "3px 7px" }}>VENUE</span>
            </div>

            <div style={{ ...card, borderColor: "var(--acid)", background: "#0e1300", padding: "16px" }}>
              <span style={muted}>// ASSIGNED_ROOM</span>
              <h2 style={{ fontFamily: "'Anton',sans-serif", fontWeight: 400, lineHeight: 0.82, textTransform: "uppercase", margin: "8px 0 0", color: "var(--surface)", fontSize: "clamp(28px,8vw,40px)" }}>{room ? sportLabel(room.sport) : "—"}<span style={{ color: "var(--acid)" }}> · {fmt}</span></h2>
              <div style={{ display: "flex", alignItems: "baseline", gap: "10px", marginTop: "14px", flexWrap: "wrap" }}>
                <span style={{ fontFamily: "'Anton',sans-serif", fontSize: "clamp(30px,9vw,44px)", lineHeight: 0.8, color: "var(--acid)" }}>{when.time}</span>
                <span style={{ fontSize: "13px", fontWeight: 800, letterSpacing: "0.1em", color: "var(--surface)" }}>{when.day}</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div style={{ ...card, padding: "12px 14px" }}>
                <span style={{ ...muted, fontSize: "9px" }}>TIER</span>
                <div style={{ fontSize: "15px", fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--surface)", marginTop: "5px" }}>{room ? tierLabel(room.desired_tier) : "—"}</div>
              </div>
              <div style={{ ...card, padding: "12px 14px" }}>
                <span style={{ ...muted, fontSize: "9px" }}>HEADCOUNT</span>
                <div style={{ fontSize: "15px", fontWeight: 800, letterSpacing: "0.04em", color: "var(--surface)", marginTop: "5px" }}>{players} PLAYERS</div>
              </div>
              <div style={{ ...card, padding: "12px 14px", gridColumn: "1 / -1", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                {room?.paid ? (
                  <>
                    <div>
                      <span style={{ ...muted, fontSize: "9px" }}>COST_SPLIT</span>
                      <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--haze)", marginTop: "5px" }}>₹{room.price} / HEAD</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ ...muted, fontSize: "9px" }}>YOUR SHARE</span>
                      <div style={{ fontFamily: "'Anton',sans-serif", fontSize: "24px", lineHeight: 0.8, color: "var(--amber)", marginTop: "4px" }}>₹{room.price}</div>
                    </div>
                  </>
                ) : (
                  <span style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink)", background: "var(--acid)", padding: "5px 9px" }}>FREE GAME</span>
                )}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={muted}>// VENUE_NODE</span>
                {mapsUrl && (
                  <a className="ml-link" href={mapsUrl} target="_blank" rel="noreferrer" style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--acid)", border: "1px solid var(--acid)", padding: "4px 8px", textDecoration: "none", transition: "background .15s ease, color .15s ease" }}>OPEN IN MAPS ↗</a>
                )}
              </div>
              <div style={{ position: "relative", height: "150px", border: "2px solid var(--haze)", background: "radial-gradient(circle at 50% 50%, #111 0%, var(--void) 80%)", overflow: "hidden" }}>
                <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(var(--haze) 1px, transparent 1px), linear-gradient(90deg, var(--haze) 1px, transparent 1px)", backgroundSize: "30px 30px", opacity: 0.16 }} />
                <div style={{ position: "absolute", left: "52%", top: "48%", transform: "translate(-50%,-50%)" }}>
                  <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: "110px", height: "1px", background: "var(--acid)", opacity: 0.5 }} />
                  <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: "1px", height: "110px", background: "var(--acid)", opacity: 0.5 }} />
                  <div style={{ position: "relative", width: "15px", height: "15px", background: "var(--acid)", border: "2px solid var(--ink)" }}>
                    <div style={{ position: "absolute", inset: "-6px", border: "1px solid var(--acid)", animation: "mlPing 2s ease-out infinite" }} />
                  </div>
                </div>
                <div style={{ position: "absolute", bottom: "8px", left: "10px", fontSize: "10px", fontWeight: 800, letterSpacing: "0.1em", color: "var(--acid)" }}>
                  {room ? `LAT ${room.lat.toFixed(4)} · LON ${room.lon.toFixed(4)}` : "LOCATING…"}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <span style={muted}>// LOCKED_ROSTER</span>
                <span style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--acid)" }}>{squadCount || "—"} SQUADS · {players} PLAYERS</span>
              </div>
              {(match?.squad_ids || []).map((id) => {
                const mine = id === mySquadId;
                return (
                  <div key={id} style={{ ...card, borderColor: "var(--acid)", background: "#0e1300", padding: "11px 13px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "9px", marginBottom: mine && myMembers ? "9px" : 0 }}>
                      <span style={{ fontFamily: "'Anton',sans-serif", fontSize: "17px", lineHeight: 0.8, color: "var(--acid)" }}>SQUAD {shortId(id)}</span>
                      {mine && <span style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.12em", color: "var(--ink)", background: "var(--acid)", padding: "2px 6px" }}>YOU</span>}
                    </div>
                    {mine && myMembers ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                        {myMembers.map((p, j) => (
                          <span key={j} style={{ fontSize: "10px", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--surface)", background: "#0d0d0f", border: "1px solid var(--haze)", padding: "4px 7px" }}>{p}</span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}
              {!squadCount && <div style={{ fontSize: "11px", color: "var(--haze)" }}>{error || "LOADING ROSTER…"}</div>}
            </div>

          </div>

          <div style={{ position: "sticky", bottom: 0, borderTop: "2px solid var(--acid)", background: "var(--void)" }}>
            <div style={{ display: "flex", alignItems: "stretch" }}>
              {calUrl && (
                <a className="ml-link" href={calUrl} target="_blank" rel="noreferrer" style={{ flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--acid)", background: "var(--void)", borderRight: "2px solid var(--acid)", padding: "0 16px", textDecoration: "none", transition: "background .15s ease, color .15s ease" }}>＋ CAL</a>
              )}
              <button className="ml-cta" onClick={() => navigate("/hub")} style={{ flex: "1 1 auto", cursor: "pointer", fontFamily: "'Anton',sans-serif", fontSize: "clamp(22px,6vw,32px)", lineHeight: 0.9, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--ink)", background: "var(--acid)", border: 0, padding: "18px 12px 14px", transition: "filter .2s ease" }}>SEE YOU THERE ➔</button>
            </div>
            <button className="ml-report" onClick={() => navigate("/hub")} style={{ width: "100%", cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: "9px", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--haze)", background: "#0d0d0f", border: 0, borderTop: "1px solid var(--haze)", padding: "9px", transition: "color .15s ease" }}>can't make it? report a problem</button>
          </div>

        </div>
        <div className="ml-scan" />
      </div>
    </div>
  );
}
