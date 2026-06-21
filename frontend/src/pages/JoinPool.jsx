import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/client";
import PoolWaitingRoom from "./PoolWaitingRoom";

const YU_CSS = `
  .yu-scope{ --ink:#0B0B0B; --void:#0B0B0B; --base:#F0380F; --acid:#D8FF14; --boso:#1C18E8;
    --oni:#E8341C; --surface:#F2EEE2; --haze:#2B2B2B; }
  .yu-scope *{ box-sizing:border-box; }
  .yu-scope ::selection{ background:var(--acid); color:var(--ink); }
  @keyframes yuBlink{ 0%,49%{ opacity:1; } 50%,100%{ opacity:0; } }
  @keyframes yuJoinIn{ 0%{ opacity:0; transform:translateX(-14px); } 100%{ opacity:1; transform:translateX(0); } }
  @keyframes yuReveal{ 0%{ opacity:0; transform:translateY(-8px); } 100%{ opacity:1; transform:translateY(0); } }
  @keyframes yuPing{ 0%{ transform:scale(0.7); opacity:1; } 100%{ transform:scale(2.6); opacity:0; } }
  @keyframes yuSweep{ 0%{ transform:rotate(0deg); } 100%{ transform:rotate(360deg); } }

  .yu-scroll{ scrollbar-width:thin; scrollbar-color:var(--haze) var(--void); }
  .yu-scroll::-webkit-scrollbar{ width:5px; }
  .yu-scroll::-webkit-scrollbar-track{ background:var(--void); }
  .yu-scroll::-webkit-scrollbar-thumb{ background:var(--haze); }

  .yu-code-input{ width:100%; min-width:0; font-family:'Anton',sans-serif; font-size:clamp(34px,8vw,56px);
    line-height:1; letter-spacing:0.18em; text-align:center; text-transform:uppercase; color:var(--acid);
    background:transparent; border:0; padding:18px 0; outline:none; }
  .yu-code-input::placeholder{ color:var(--haze); }

  .yu-door{ transform:translate(0,0); box-shadow:0 0 0 0 var(--ink);
    transition:transform .1s cubic-bezier(0,0,.2,1), box-shadow .1s cubic-bezier(0,0,.2,1); }
  .yu-door:hover{ transform:translate(-6px,-6px); z-index:2; }
  .yu-door-host:hover{ box-shadow:14px 14px 0px 0px var(--oni); }
  .yu-door-join:hover{ box-shadow:14px 14px 0px 0px var(--boso); }
  .yu-door:focus-visible{ outline:3px solid var(--ink); outline-offset:-9px; }

  .yu-cta{ transition:filter .12s ease; }
  .yu-cta:hover{ filter:brightness(0.94); }
  .yu-cta:disabled{ opacity:0.55; cursor:not-allowed; }
  .yu-leave:hover{ background:var(--oni); color:var(--surface); }

  .yu-gate{ display:flex; flex-direction:column; gap:24px; }
  @media (min-width:760px){ .yu-gate{ flex-direction:row; } }

  .yu-body{ display:flex; flex-direction:column; }
  .yu-left{ order:1; }
  .yu-right{ order:2; }
  @media (min-width:960px){
    .yu-root{ height:100vh; overflow:hidden; }
    .yu-body{ display:grid; grid-template-columns:1fr 1fr; flex:1 1 auto; min-height:0; }
    .yu-left{ order:0; min-height:0; overflow-y:auto; }
    .yu-right{ order:0; min-height:0; overflow-y:auto; }
  }
`;

const SPORT_NAMES = {
  0: "FOOTBALL", 1: "BASKETBALL", 2: "TENNIS", 3: "VOLLEYBALL", 4: "CRICKET",
  5: "BADMINTON", 6: "KHO-KHO", 7: "SWIMMING", 8: "TABLE TENNIS", 9: "HOCKEY",
  10: "RUGBY", 11: "GOLF",
};
const TIER_NAMES = { 0: "ROOKIE", 1: "SEASONED", 2: "ELITE" };

const fmtTime = (iso) => {
  if (!iso) return "--:--";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "--:--";
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const errText = (err, fallback) => {
  const detail = err?.response?.data?.detail || err?.message;
  return typeof detail === "string" ? detail : fallback;
};

const labelStyle = { fontSize: "10px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--haze)" };

export default function JoinPool() {
  const navigate = useNavigate();
  const location = useLocation();

  const incoming = location.state?.squad || null;

  const [stage, setStage] = useState(incoming ? "lobby" : "gate");
  const [role, setRole] = useState(incoming ? "leader" : "member");
  const [squad, setSquad] = useState(incoming);
  const [codeInput, setCodeInput] = useState("");
  const [joining, setJoining] = useState(false);
  const [entering, setEntering] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [myId, setMyId] = useState(null);
  const [poolCount, setPoolCount] = useState(0);
  const copyTimer = useRef(null);

  useEffect(() => {
    let cancelled = false;
    api.get("/auth/me")
      .then((r) => {
        const uid = r?.data?.id ?? r?.data?._id ?? null;
        if (cancelled) return null;
        setMyId(uid);
        if (incoming) return null;
        return api.get("/squads/current").then((s) => {
          if (cancelled || !s?.data) return;
          const mine = s.data.members?.find((m) => m.user_id === uid);
          setSquad(s.data);
          setRole(mine?.is_leader ? "leader" : "member");
          setStage("lobby");
        });
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [incoming]);

  useEffect(() => {
    let cancelled = false;
    api.get("/squads/pool/count").then((r) => {
      if (!cancelled && typeof r?.data?.count === "number") setPoolCount(r.data.count);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (stage !== "lobby" || !squad?.id) return undefined;
    let cancelled = false;
    const poll = () =>
      api.get(`/squads/${squad.id}`).then((r) => {
        if (!cancelled) setSquad(r.data);
      }).catch(() => {});
    const id = setInterval(poll, 4000);
    return () => { cancelled = true; clearInterval(id); };
  }, [stage, squad?.id]);

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  const joinByCode = async () => {
    const code = codeInput.trim().toUpperCase();
    if (code.length < 4) { setError("CODE TOO SHORT"); return; }
    setJoining(true);
    setError("");
    try {
      const res = await api.post("/squads/join", { code });
      setSquad(res.data);
      setRole("member");
      setStage("lobby");
    } catch (err) {
      setError(errText(err, "COULD NOT JOIN UNIT").toUpperCase());
    } finally {
      setJoining(false);
    }
  };

  const enterPool = async () => {
    if (!squad?.id || entering) return;
    setEntering(true);
    setError("");
    try {
      const res = await api.post(`/squads/${squad.id}/enter`);
      setSquad(res.data);
    } catch (err) {
      setError(errText(err, "COULD NOT ENTER POOL").toUpperCase());
    } finally {
      setEntering(false);
    }
  };

  const leave = async () => {
    if (squad?.id) {
      try { await api.post(`/squads/${squad.id}/leave`); } catch {}
    }
    navigate("/hub");
  };

  const copyCode = () => {
    if (!squad?.code) return;
    try { navigator.clipboard?.writeText(squad.code); } catch {}
    setCopied(true);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1400);
  };

  const members = squad?.members || [];
  const isLeader = role === "leader";
  const entered = Boolean(squad?.status && squad.status !== "forming");
  const accent = squad?.paid ? "var(--oni)" : "var(--acid)";
  const leaderName = members.find((m) => m.is_leader)?.display_name || "LEADER";
  const statusLabel = entered ? "SEARCHING" : "FORMING";

  const statusBar = (left) => (
    <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", minHeight: "44px", padding: "8px 16px", background: "var(--acid)", color: "var(--ink)", borderBottom: "2px solid var(--ink)", fontSize: "10px", fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span style={{ width: "8px", height: "8px", background: "var(--oni)", display: "inline-block", animation: "yuBlink 1s steps(1) infinite" }} />
        {left}
      </div>
      <div style={{ fontFamily: "'Anton',sans-serif", letterSpacing: "0.16em", fontSize: "12px" }}>MATCHPOINT</div>
      <div>POOL: {poolCount}</div>
    </div>
  );

  const wrap = (children) => (
    <div className="yu-scope">
      <style>{YU_CSS}</style>
      <div className="yu-root" style={{ display: "flex", flexDirection: "column", minHeight: "100vh", width: "100%", background: "var(--void)", fontFamily: "'JetBrains Mono',monospace", color: "var(--surface)" }}>
        {children}
      </div>
    </div>
  );

  if (stage === "gate") {
    return wrap(
      <>
        {statusBar(<button type="button" onClick={() => navigate("/hub")} style={{ background: "none", border: 0, cursor: "pointer", fontSize: "10px", fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--ink)" }}>« HUB</button>)}
        <div className="yu-gate" style={{ flex: "1 1 auto", minHeight: 0, padding: "24px" }}>
          <button type="button" onClick={() => navigate("/create")} className="yu-door yu-door-host" style={{ flex: "1 1 0", minHeight: "240px", textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "20px", padding: "26px", background: "var(--base)", color: "var(--ink)", border: "2px solid var(--ink)" }}>
            <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase" }}>[01] // LEADER</span>
            <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: "12px" }}>
              <h2 style={{ fontFamily: "'Anton',sans-serif", fontWeight: 400, margin: 0, lineHeight: 0.82, textTransform: "uppercase", fontSize: "clamp(40px,7vw,68px)" }}>HOST</h2>
              <p style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.28em", textTransform: "uppercase", margin: 0, opacity: 0.82 }}>SHARE A CODE</p>
            </div>
          </button>
          <button type="button" onClick={() => { setError(""); setStage("code"); }} className="yu-door yu-door-join" style={{ flex: "1 1 0", minHeight: "240px", textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: "20px", padding: "26px", background: "var(--acid)", color: "var(--ink)", border: "2px solid var(--ink)" }}>
            <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase" }}>[02] // MEMBER</span>
            <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: "12px" }}>
              <h2 style={{ fontFamily: "'Anton',sans-serif", fontWeight: 400, margin: 0, lineHeight: 0.82, textTransform: "uppercase", fontSize: "clamp(40px,7vw,68px)" }}>JOIN</h2>
              <p style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.28em", textTransform: "uppercase", margin: 0, opacity: 0.82 }}>ENTER A CODE</p>
            </div>
          </button>
        </div>
      </>
    );
  }

  if (stage === "code") {
    return wrap(
      <>
        {statusBar(<button type="button" onClick={() => { setError(""); setStage("gate"); }} style={{ background: "none", border: 0, cursor: "pointer", fontSize: "10px", fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--ink)" }}>« BACK</button>)}
        <div style={{ flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center", padding: "28px" }}>
          <div style={{ width: "100%", maxWidth: "460px", display: "flex", flexDirection: "column", gap: "18px" }}>
            <span style={labelStyle}>// ENTER UNIT CODE</span>
            <div style={{ border: "2px solid var(--acid)", background: "#111", padding: "0 20px" }}>
              <input
                autoFocus
                className="yu-code-input"
                value={codeInput}
                maxLength={12}
                placeholder="------"
                onChange={(e) => { setError(""); setCodeInput(e.target.value.toUpperCase()); }}
                onKeyDown={(e) => { if (e.key === "Enter") joinByCode(); }}
              />
            </div>
            {error && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "10px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--oni)" }}>
                <span style={{ width: "7px", height: "7px", background: "var(--oni)", display: "inline-block" }} />
                {error}
              </div>
            )}
            <button className="yu-cta" onClick={joinByCode} disabled={joining} style={{ cursor: "pointer", fontFamily: "'Anton',sans-serif", fontSize: "clamp(22px,4vw,32px)", lineHeight: 0.9, letterSpacing: "0.02em", textTransform: "uppercase", color: "var(--ink)", background: "var(--acid)", border: "2px solid var(--ink)", padding: "18px 16px 14px" }}>
              {joining ? "JOINING…" : "JOIN UNIT ➔"}
            </button>
          </div>
        </div>
      </>
    );
  }

  const tierList = squad && squad.tier != null ? (TIER_NAMES[squad.tier] || `TIER ${squad.tier}`) : "ANY";
  const distanceKm = squad?.max_distance ? Math.round(squad.max_distance / 1000) : null;
  const transmission = `{unit:${members.length}, role:"${role.toUpperCase()}", code:"${squad?.code || "----"}", status:"${statusLabel}"}`;

  if (entered) {
    return <PoolWaitingRoom squad={squad} onCancel={leave} />;
  }

  return wrap(
    <>
      {statusBar(<>POOL // {poolCount} SEARCHING</>)}

      <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "10px", padding: "9px 16px", background: "#111", borderBottom: "1px solid var(--haze)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--haze)", flexWrap: "wrap" }}>
        <span style={{ color: "var(--surface)" }}>UNIT_{squad?.code || "----"}</span>
        <span>/</span>
        <span style={{ color: accent }}>{statusLabel}</span>
      </div>

      <div className="yu-body">
        <div className="yu-left yu-scroll" style={{ background: "var(--void)", borderRight: "1px solid var(--haze)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "26px 22px 32px" }}>

            <div>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px" }}>
                <div style={labelStyle}>// UNIT ROSTER</div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "9px", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: accent }}>
                  <span style={{ width: "7px", height: "7px", background: accent, display: "inline-block", animation: "yuBlink 1.4s steps(1) infinite" }} />
                  LIVE
                </div>
              </div>
              <h1 style={{ fontFamily: "'Anton',sans-serif", fontWeight: 400, color: "var(--surface)", margin: "8px 0 0", lineHeight: 0.8, letterSpacing: "-0.01em", textTransform: "uppercase", fontSize: "clamp(40px,6vw,64px)" }}>
                UNIT: {String(members.length).padStart(2, "0")}
              </h1>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {members.map((m, i) => {
                const self = myId && m.user_id === myId;
                const border = m.is_leader ? "var(--acid)" : (self ? "var(--surface)" : "var(--haze)");
                return (
                  <div key={m.user_id || i} style={{ display: "flex", alignItems: "stretch", border: `2px solid ${border}`, background: m.is_leader ? "#161800" : "#111", animation: "yuJoinIn .34s cubic-bezier(.34,1.4,.64,1) both" }}>
                    <div style={{ flex: "0 0 auto", width: "44px", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Anton',sans-serif", fontSize: "20px", color: m.is_leader ? "var(--ink)" : "var(--haze)", background: m.is_leader ? "var(--acid)" : "transparent", borderRight: `2px solid ${border}` }}>{String(i + 1).padStart(2, "0")}</div>
                    <div style={{ flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "12px 14px", minWidth: 0 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: "14px", fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", color: m.is_leader ? "var(--acid)" : "var(--surface)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{self ? "YOU" : m.display_name}</div>
                        <div style={{ fontSize: "9px", fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--haze)", marginTop: "4px" }}>{m.is_leader ? "LEADER" : "MEMBER"}</div>
                      </div>
                      {m.is_leader && (
                        <span style={{ flex: "0 0 auto", display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "9px", fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink)", background: "var(--acid)", border: "1px solid var(--ink)", padding: "4px 8px" }}>◆ LEADER</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <span style={labelStyle}>// {isLeader ? "INVITE" : "UNIT CODE"}</span>
              <div style={{ display: "flex", alignItems: "stretch", border: "2px solid var(--acid)", background: "#111", animation: "yuReveal .3s cubic-bezier(.34,1.4,.64,1) both" }}>
                <div style={{ flex: "1 1 auto", display: "flex", flexDirection: "column", justifyContent: "center", gap: "4px", padding: "14px 18px", minWidth: 0 }}>
                  <span style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--haze)" }}>{isLeader ? "SHARE TO RECRUIT" : "JOINED VIA"}</span>
                  <span style={{ fontFamily: "'Anton',sans-serif", fontSize: "clamp(34px,7vw,52px)", lineHeight: 0.8, letterSpacing: "0.06em", color: "var(--acid)" }}>{squad?.code || "----"}</span>
                </div>
                <button onClick={copyCode} style={{ flex: "0 0 auto", cursor: "pointer", width: "96px", fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--ink)", background: "var(--acid)", border: 0 }}>{copied ? "COPIED" : "COPY"}</button>
              </div>
            </div>
          </div>
        </div>

        <div className="yu-right yu-scroll" style={{ position: "relative", background: "var(--void)" }}>

          {isLeader ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "22px", padding: "26px 22px 32px" }}>
              <div style={labelStyle}>// MATCH BRIEF</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div style={{ background: "#111", border: "2px solid var(--haze)", padding: "14px 16px" }}>
                  <div style={{ ...labelStyle, fontSize: "9px" }}>SPORT</div>
                  <div style={{ fontFamily: "'Anton',sans-serif", fontSize: "22px", color: "var(--surface)", marginTop: "6px", lineHeight: 1 }}>{SPORT_NAMES[squad?.sport] || "—"}</div>
                </div>
                <div style={{ background: "#111", border: "2px solid var(--haze)", padding: "14px 16px" }}>
                  <div style={{ ...labelStyle, fontSize: "9px" }}>TIER</div>
                  <div style={{ fontFamily: "'Anton',sans-serif", fontSize: "22px", color: accent, marginTop: "6px", lineHeight: 1 }}>{tierList}</div>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <div style={{ background: "#111", border: "2px solid var(--haze)", padding: "14px 16px" }}>
                  <div style={{ ...labelStyle, fontSize: "9px" }}>MAX TRAVEL</div>
                  <div style={{ fontFamily: "'Anton',sans-serif", fontSize: "30px", color: accent, marginTop: "4px", lineHeight: 0.9 }}>{distanceKm ?? "—"}<span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", fontWeight: 800, marginLeft: "4px" }}>KM</span></div>
                </div>
                <div style={{ background: "#111", border: "2px solid var(--haze)", padding: "14px 16px" }}>
                  <div style={{ ...labelStyle, fontSize: "9px" }}>MODE</div>
                  <div style={{ fontFamily: "'Anton',sans-serif", fontSize: "22px", color: "var(--surface)", marginTop: "6px", lineHeight: 1 }}>{squad?.paid ? "PAID" : "FREE"}{squad?.paid && squad?.price ? ` ₹${squad.price}` : ""}</div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <span style={labelStyle}>// WINDOW</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <div style={{ background: "#111", border: "2px solid var(--haze)", padding: "10px 14px" }}>
                    <span style={{ ...labelStyle, fontSize: "9px" }}>FROM</span>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--surface)", marginTop: "4px" }}>{fmtTime(squad?.start_time)}</div>
                  </div>
                  <div style={{ background: "#111", border: "2px solid var(--haze)", padding: "10px 14px" }}>
                    <span style={{ ...labelStyle, fontSize: "9px" }}>UNTIL</span>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--surface)", marginTop: "4px" }}>{fmtTime(squad?.end_time)}</div>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid var(--haze)", paddingTop: "18px" }}>
                <span style={labelStyle}>// ORIGIN</span>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", background: "#161800", border: `2px solid ${accent}`, padding: "14px 16px" }}>
                  <span style={{ position: "relative", width: "12px", height: "12px", background: accent, border: "1px solid var(--ink)", display: "inline-block" }}>
                    <span style={{ position: "absolute", inset: "-4px", border: `1px solid ${accent}`, animation: "yuPing 1.8s ease-out infinite" }} />
                  </span>
                  <span style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.06em", color: accent }}>
                    {squad?.lat != null ? `${squad.lat.toFixed(4)}°N  ${squad.lon.toFixed(4)}°E` : "—"}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ height: "100%", minHeight: "340px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "24px", padding: "40px 28px", textAlign: "center", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(var(--haze) 1px, transparent 1px), linear-gradient(90deg, var(--haze) 1px, transparent 1px)", backgroundSize: "40px 40px", opacity: 0.14 }} />
              <div style={{ position: "relative", width: "min(60%,220px)", aspectRatio: "1 / 1", zIndex: 2 }}>
                <div style={{ position: "absolute", inset: 0, border: "1px solid var(--haze)", borderRadius: "50%" }} />
                <div style={{ position: "absolute", inset: "24%", border: "1px solid var(--haze)", borderRadius: "50%" }} />
                <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "conic-gradient(from 0deg, transparent 0deg, rgba(216,255,20,0.22) 50deg, transparent 90deg)", animation: "yuSweep 4s linear infinite" }} />
                <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: "14px", height: "14px", background: "var(--oni)", border: "1px solid var(--ink)" }}>
                  <div style={{ position: "absolute", inset: "-5px", border: "1px solid var(--oni)", animation: "yuPing 1.8s ease-out infinite" }} />
                </div>
              </div>
              <div style={{ zIndex: 2 }}>
                <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--oni)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                  <span style={{ width: "7px", height: "7px", background: "var(--oni)", display: "inline-block", animation: "yuBlink 1s steps(1) infinite" }} />
                  {entered ? "IN POOL" : "STANDBY"}
                </div>
                <h2 style={{ fontFamily: "'Anton',sans-serif", fontWeight: 400, margin: "14px 0 0", lineHeight: 0.85, textTransform: "uppercase", color: "var(--surface)", fontSize: "clamp(30px,4.5vw,46px)" }}>
                  {entered ? "SEARCHING…" : <>WAITING FOR<br />{leaderName}</>}
                </h2>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: "0 0 auto", borderTop: "2px solid var(--oni)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 16px", background: "#111", borderBottom: "1px solid var(--haze)", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: error ? "var(--oni)" : "var(--haze)", whiteSpace: "nowrap", overflow: "hidden" }}>
          <span style={{ color: error ? "var(--oni)" : accent, flex: "0 0 auto" }}>{error ? "ERR>" : "TX>"}</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{error || transmission}</span>
        </div>
        <div style={{ display: "flex", alignItems: "stretch" }}>
          <button onClick={leave} className="yu-leave" style={{ flex: "0 0 auto", cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--oni)", background: "var(--void)", border: 0, borderRight: "2px solid var(--haze)", padding: "0 22px", transition: "background .12s ease, color .12s ease" }}>LEAVE</button>

          {isLeader ? (
            <button onClick={enterPool} disabled={entering || entered} className="yu-cta" style={{ flex: "1 1 auto", cursor: "pointer", fontFamily: "'Anton',sans-serif", fontSize: "clamp(24px,3.4vw,38px)", lineHeight: 0.9, letterSpacing: "0.02em", textTransform: "uppercase", color: entered ? "var(--surface)" : "var(--ink)", background: entered ? "var(--boso)" : "var(--acid)", border: 0, padding: "20px 16px 16px" }}>
              {entered ? "IN POOL // SEARCHING ➔" : entering ? "ENTERING…" : "ENTER POOL ➔"}
            </button>
          ) : (
            <div style={{ flex: "1 1 auto", display: "flex", alignItems: "center", justifyContent: "center", gap: "12px", fontFamily: "'JetBrains Mono',monospace", fontSize: "13px", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--haze)", background: "#111", padding: "20px 16px" }}>
              <span style={{ width: "8px", height: "8px", background: "var(--oni)", display: "inline-block", animation: "yuBlink 1s steps(1) infinite" }} />
              {entered ? "LEADER ENTERED POOL" : "WAITING FOR LEADER"}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
