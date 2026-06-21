import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

const PR_CSS = `
  .pr-scope{ --ink:#09090b; --void:#09090b; --base:#F0380F; --acid:#D8FF14; --boso:#1C18E8;
    --oni:#FF3333; --surface:#F2EEE2; --haze:#2B2B2B; }
  .pr-scope *{ box-sizing:border-box; }
  .pr-scope ::selection{ background:var(--acid); color:var(--ink); }
  @keyframes prBlink{ 0%,49%{ opacity:1; } 50%,100%{ opacity:0; } }
  @keyframes prReveal{ 0%{ opacity:0; transform:translateY(-8px); } 100%{ opacity:1; transform:translateY(0); } }
  @keyframes prPing{ 0%{ transform:scale(0.7); opacity:1; } 100%{ transform:scale(2.6); opacity:0; } }
  .pr-scroll{ scrollbar-width:thin; scrollbar-color:var(--haze) var(--void); }
  .pr-scroll::-webkit-scrollbar{ width:5px; }
  .pr-scroll::-webkit-scrollbar-track{ background:var(--void); }
  .pr-scroll::-webkit-scrollbar-thumb{ background:var(--haze); }

  .pr-body{ display:flex; flex-direction:column; }
  .pr-config{ order:1; }
  .pr-map{ order:2; min-height:240px; }
  @media (min-width:900px){
    .pr-root{ height:100vh; overflow:hidden; }
    .pr-body{ display:grid; grid-template-columns:1fr 1fr; flex:1 1 auto; min-height:0; }
    .pr-config{ order:0; min-height:0; overflow-y:auto; }
    .pr-map{ order:0; min-height:0; }
  }

  .pr-time{ width:100%; min-width:0; font-family:'JetBrains Mono',monospace; font-size:14px;
    font-weight:700; color:var(--surface); background:transparent; border:0; padding:13px 0;
    outline:none; color-scheme:dark; }
  .pr-launch{ transition:background .12s ease; }
  .pr-launch:hover{ background:var(--base); }
  .pr-launch:active{ background:var(--ink); }
  .pr-launch:disabled{ opacity:0.55; cursor:not-allowed; }
`;

const SPORT_MAP = { FTBL: 0, TNS: 2, CRKT: 4, BMTN: 5, VLYB: 3 };
const TIER_MAP = { RKE: 0, MID: 1, ELT: 2 };

const FORMAT_MAP = {
  FTBL: [["5V5", 10], ["7V7", 14], ["11V11", 22]],
  TNS: [["1V1", 2], ["2V2", 4]],
  CRKT: [["6V6", 12], ["8V8", 16], ["11V11", 22]],
  BMTN: [["1V1", 2], ["2V2", 4]],
  VLYB: [["6V6", 12]],
};

const OVERS_MAP = {
  CRKT: ["T10", "T20"],
};

const DISCIPLINES = [
  ["FTBL", "FTBL"],
  ["TNS", "TNS"],
  ["CRKT", "CRKT"],
  ["BMTN", "BMTN"],
  ["VLYB", "VLYB"],
];

const TIERS = [
  ["ROOKIE", "AMATEUR", "RKE"],
  ["SEASONED", "MID-TIER", "MID"],
  ["ELITE", "CHANGER", "ELT"],
];

const NODES = [
  { x: "22%", y: "28%" },
  { x: "68%", y: "24%" },
  { x: "80%", y: "58%" },
  { x: "34%", y: "66%" },
  { x: "58%", y: "80%" },
];

function selStyle(active, accent) {
  return active
    ? { background: accent, color: "var(--ink)", borderColor: "var(--ink)", boxShadow: "4px 4px 0px 0px var(--boso)", transform: "translate(-2px,-2px)" }
    : { background: "transparent", color: "var(--surface)", borderColor: "var(--haze)", boxShadow: "0px 0px 0px 0px var(--ink)", transform: "translate(0,0)" };
}

export default function CreateMatch() {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const draggingRef = useRef(false);
  const clockRef = useRef(null);

  const [poolCount, setPoolCount] = useState(142);
  const [discipline, setDiscipline] = useState("FTBL");
  const [format, setFormat] = useState("5V5");
  const [overs, setOvers] = useState("T20");
  const [tier, setTier] = useState("MID");
  const [paid, setPaid] = useState(false);
  const [price, setPrice] = useState(250);
  const [time, setTime] = useState("18:30");
  const [capacity, setCapacity] = useState(10);
  const [pinX, setPinX] = useState(50);
  const [pinY, setPinY] = useState(45);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const pad = (n) => String(n).padStart(2, "0");
    const tick = () => {
      const d = new Date();
      if (clockRef.current) {
        clockRef.current.textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

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

  const accent = paid ? "var(--oni)" : "var(--acid)";
  const formats = FORMAT_MAP[discipline] || [];
  const oversOptions = OVERS_MAP[discipline] || [];

  const latNum = 12.9716 + ((50 - pinY) / 50) * 0.08;
  const lonNum = 77.5946 + ((pinX - 50) / 50) * 0.08;
  const lat = latNum.toFixed(4) + "° N";
  const lon = lonNum.toFixed(4) + "° E";

  const oversTx = oversOptions.length ? `, overs:"${overs}"` : "";
  const transmission = `{discipline:"${discipline}", format:"${format}"${oversTx}, tier:"${tier}", mode:"${paid ? "PAID" : "FREE"}"${paid ? `, price:${price}` : ""}, cap:${capacity}}`;

  const pickDiscipline = (d) => {
    const first = FORMAT_MAP[d][0];
    setDiscipline(d);
    setFormat(first[0]);
    setCapacity(first[1]);
    const firstOvers = OVERS_MAP[d]?.[0];
    if (firstOvers) setOvers(firstOvers);
  };

  const pickFormat = (f, cap) => {
    setFormat(f);
    setCapacity(cap);
  };

  const setPin = (e) => {
    const el = mapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = Math.max(2, Math.min(98, ((e.clientX - r.left) / r.width) * 100));
    const y = Math.max(2, Math.min(92, ((e.clientY - r.top) / r.height) * 100));
    setPinX(x);
    setPinY(y);
  };

  const launch = async () => {
    if (launching) return;
    setError("");

    const [hh, mm] = time.split(":").map(Number);
    const start = new Date();
    start.setHours(hh || 0, mm || 0, 0, 0);
    if (start.getTime() <= Date.now()) start.setDate(start.getDate() + 1);
    const startEpoch = Math.floor(start.getTime() / 1000);
    const endEpoch = startEpoch + 2 * 3600;

    const payload = {
      sport: SPORT_MAP[discipline],
      tier: TIER_MAP[tier],
      lat: Number(latNum.toFixed(6)),
      lon: Number(lonNum.toFixed(6)),
      max_distance: 10000,
      start_time: startEpoch,
      end_time: endEpoch,
      capacity,
      format,
      overs: oversOptions.length ? overs : null,
      paid,
      price: paid ? price : 0,
    };

    setLaunching(true);
    try {
      const res = await api.post("/squads/create", payload);
      navigate("/join", { state: { squad: res.data } });
    } catch (err) {
      const detail =
        err?.response?.data?.detail || err?.message || "Failed to launch squad room.";
      setError(typeof detail === "string" ? detail : "Failed to launch squad room.");
    } finally {
      setLaunching(false);
    }
  };

  return (
    <div className="pr-scope">
      <style>{PR_CSS}</style>

      <div
        className="pr-root"
        style={{ display: "flex", flexDirection: "column", minHeight: "100vh", width: "100%", background: "var(--void)", fontFamily: "'JetBrains Mono',monospace", color: "var(--surface)" }}
      >
        <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", minHeight: "44px", padding: "8px 16px", background: "var(--acid)", color: "var(--ink)", borderBottom: "2px solid var(--ink)", fontSize: "10px", fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => navigate("/hub")}
            style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: 0, cursor: "pointer", fontSize: "10px", fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--ink)" }}
          >
            <span style={{ width: "8px", height: "8px", background: "var(--oni)", display: "inline-block", animation: "prBlink 1s steps(1) infinite" }} />
            SYS.READY // MATCH_MAKER_NODE
          </button>
          <div style={{ fontFamily: "'Anton',sans-serif", letterSpacing: "0.16em", fontSize: "12px" }}>POOL: {poolCount}</div>
          <div ref={clockRef}>--:--:--</div>
        </div>

        <div className="pr-body">
          <div className="pr-config pr-scroll" style={{ background: "var(--void)", borderRight: "1px solid var(--haze)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "26px 22px 32px" }}>
              <div>
                <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--haze)" }}>// PUBLISH ROOM — STEP 02 / 03</div>
                <h1 style={{ fontFamily: "'Anton',sans-serif", fontWeight: 400, color: "var(--surface)", margin: "8px 0 0", lineHeight: 0.82, letterSpacing: "-0.01em", textTransform: "uppercase", fontSize: "clamp(34px,5vw,52px)" }}>OPEN A GAME</h1>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--haze)" }}>// DISCIPLINE</span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "8px" }}>
                  {DISCIPLINES.map(([code, label]) => (
                    <button
                      key={code}
                      onClick={() => pickDiscipline(code)}
                      style={{ cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", border: "2px solid var(--ink)", padding: "14px 2px", transition: "transform .1s cubic-bezier(0,0,.2,1), box-shadow .1s cubic-bezier(0,0,.2,1)", ...selStyle(discipline === code, accent) }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--haze)" }}>// FORMAT</span>
                  <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: accent }}>SQUAD TARGET: {capacity}</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  {formats.map(([f, cap]) => (
                    <button
                      key={f}
                      onClick={() => pickFormat(f, cap)}
                      style={{ flex: "1 1 0", minWidth: "84px", cursor: "pointer", fontFamily: "'Anton',sans-serif", fontSize: "24px", lineHeight: 0.9, letterSpacing: "0.02em", textTransform: "uppercase", border: "2px solid var(--ink)", padding: "16px 8px 12px", transition: "transform .1s cubic-bezier(0,0,.2,1), box-shadow .1s cubic-bezier(0,0,.2,1)", ...selStyle(format === f, accent) }}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              {oversOptions.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--haze)" }}>// OVERS</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {oversOptions.map((o) => (
                      <button
                        key={o}
                        onClick={() => setOvers(o)}
                        style={{ flex: "1 1 0", minWidth: "84px", cursor: "pointer", fontFamily: "'Anton',sans-serif", fontSize: "24px", lineHeight: 0.9, letterSpacing: "0.02em", textTransform: "uppercase", border: "2px solid var(--ink)", padding: "16px 8px 12px", transition: "transform .1s cubic-bezier(0,0,.2,1), box-shadow .1s cubic-bezier(0,0,.2,1)", ...selStyle(overs === o, accent) }}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--haze)" }}>// SKILL_TIER</span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                  {TIERS.map(([label, sub, code]) => (
                    <button
                      key={code}
                      onClick={() => setTier(code)}
                      style={{ cursor: "pointer", textAlign: "left", fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase", border: "2px solid var(--ink)", padding: "14px 12px", transition: "transform .1s cubic-bezier(0,0,.2,1), box-shadow .1s cubic-bezier(0,0,.2,1)", ...selStyle(tier === code, accent) }}
                    >
                      {label}
                      <span style={{ display: "block", fontSize: "9px", letterSpacing: "0.16em", marginTop: "6px", opacity: 0.7 }}>{sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--haze)" }}>// MODE</span>
                <div style={{ position: "relative", display: "grid", gridTemplateColumns: "1fr 1fr", border: "2px solid var(--ink)", background: "#111", height: "60px" }}>
                  <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: "50%", background: accent, borderRight: "2px solid var(--ink)", transform: `translateX(${paid ? "100%" : "0%"})`, transition: "transform .28s cubic-bezier(.7,0,.2,1), background .28s ease" }} />
                  <button onClick={() => setPaid(false)} style={{ position: "relative", zIndex: 2, cursor: "pointer", background: "transparent", border: 0, fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: paid ? "var(--surface)" : "var(--ink)", transition: "color .2s ease" }}>AMATEUR // FREE</button>
                  <button onClick={() => setPaid(true)} style={{ position: "relative", zIndex: 2, cursor: "pointer", background: "transparent", border: 0, fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: paid ? "var(--ink)" : "var(--surface)", transition: "color .2s ease" }}>PAID // SPLIT</button>
                </div>
              </div>

              {paid && (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px", borderLeft: "2px solid var(--oni)", paddingLeft: "16px", animation: "prReveal .3s cubic-bezier(.34,1.4,.64,1) both" }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--haze)" }}>// PRICE / HEAD</span>
                      <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--oni)" }}>TURF EST: ₹{price * capacity}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#111", border: "2px solid var(--oni)", padding: "0 14px" }}>
                      <span style={{ fontFamily: "'Anton',sans-serif", fontSize: "22px", color: "var(--oni)" }}>₹</span>
                      <span style={{ flex: "1 1 auto", fontFamily: "'JetBrains Mono',monospace", fontSize: "18px", fontWeight: 800, color: "var(--surface)", padding: "14px 0" }}>{price}</span>
                      <button onClick={() => setPrice((p) => p + 50)} style={{ cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", fontWeight: 800, letterSpacing: "0.06em", background: "transparent", color: "var(--oni)", border: "1px solid var(--oni)", padding: "6px 10px" }}>+50</button>
                      <button onClick={() => setPrice((p) => p + 100)} style={{ cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", fontWeight: 800, letterSpacing: "0.06em", background: "transparent", color: "var(--oni)", border: "1px solid var(--oni)", padding: "6px 10px" }}>+100</button>
                    </div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--haze)" }}>// MATCH_TIME</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#111", border: "2px solid var(--oni)", padding: "0 14px" }}>
                      <input type="time" className="pr-time" value={time} onChange={(e) => setTime(e.target.value)} />
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", borderTop: "1px solid var(--haze)", paddingTop: "18px" }}>
                <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--haze)" }}>// CAPACITY_OVERRIDE</span>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <button onClick={() => setCapacity((c) => Math.max(2, c - 1))} style={{ cursor: "pointer", width: "42px", height: "42px", fontFamily: "'Anton',sans-serif", fontSize: "26px", lineHeight: 1, background: "var(--surface)", color: "var(--ink)", border: "2px solid var(--ink)" }}>–</button>
                  <span style={{ fontFamily: "'Anton',sans-serif", fontSize: "30px", lineHeight: 0.8, color: accent, minWidth: "46px", textAlign: "center" }}>{String(capacity).padStart(2, "0")}</span>
                  <button onClick={() => setCapacity((c) => Math.min(22, c + 1))} style={{ cursor: "pointer", width: "42px", height: "42px", fontFamily: "'Anton',sans-serif", fontSize: "26px", lineHeight: 1, background: "var(--surface)", color: "var(--ink)", border: "2px solid var(--ink)" }}>+</button>
                </div>
              </div>
            </div>
          </div>

          <div
            className="pr-map"
            style={{ position: "relative", background: "radial-gradient(circle at 50% 45%, #111 0%, var(--void) 78%)", overflow: "hidden", cursor: "crosshair", touchAction: "none" }}
            ref={mapRef}
            onPointerDown={(e) => { draggingRef.current = true; e.currentTarget.setPointerCapture?.(e.pointerId); setPin(e); }}
            onPointerMove={(e) => { if (draggingRef.current) setPin(e); }}
            onPointerUp={() => { draggingRef.current = false; }}
          >
            <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(var(--haze) 1px, transparent 1px), linear-gradient(90deg, var(--haze) 1px, transparent 1px)", backgroundSize: "40px 40px", opacity: 0.16, pointerEvents: "none" }} />
            <div style={{ position: "absolute", top: "18px", left: "18px", fontSize: "10px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--haze)", pointerEvents: "none" }}>// DROP_PIN — DRAG TO SET</div>

            {NODES.map((n, i) => (
              <div key={i} style={{ position: "absolute", left: n.x, top: n.y, transform: "translate(-50%,-50%)", width: "9px", height: "9px", background: "var(--haze)", border: "1px solid var(--ink)", pointerEvents: "none" }} />
            ))}

            <div style={{ position: "absolute", left: `${pinX}%`, top: `${pinY}%`, transform: "translate(-50%,-50%)", zIndex: 3, pointerEvents: "none" }}>
              <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: "140px", height: "1px", background: accent, opacity: 0.5 }} />
              <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: "1px", height: "140px", background: accent, opacity: 0.5 }} />
              <div style={{ position: "relative", width: "18px", height: "18px", background: accent, border: "2px solid var(--ink)" }}>
                <div style={{ position: "absolute", inset: "-6px", border: `1px solid ${accent}`, animation: "prPing 1.8s ease-out infinite" }} />
              </div>
            </div>

            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, display: "flex", alignItems: "stretch", borderTop: "2px solid var(--ink)", background: "var(--void)", fontSize: "11px", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase" }}>
              <div style={{ flex: "1 1 0", padding: "14px 16px", borderRight: "1px solid var(--haze)" }}>
                <div style={{ color: "var(--haze)", fontSize: "9px" }}>LAT</div>
                <div style={{ color: accent, fontSize: "15px", marginTop: "4px" }}>{lat}</div>
              </div>
              <div style={{ flex: "1 1 0", padding: "14px 16px" }}>
                <div style={{ color: "var(--haze)", fontSize: "9px" }}>LON</div>
                <div style={{ color: accent, fontSize: "15px", marginTop: "4px" }}>{lon}</div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ flex: "0 0 auto", borderTop: "2px solid var(--oni)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 16px", background: "#111", borderBottom: "1px solid var(--haze)", fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em", color: error ? "var(--oni)" : "var(--haze)", whiteSpace: "nowrap", overflow: "hidden" }}>
            <span style={{ color: error ? "var(--oni)" : "var(--acid)", flex: "0 0 auto" }}>{error ? "ERR>" : "TX>"}</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{error || transmission}</span>
          </div>
          <button
            className="pr-launch"
            onClick={launch}
            disabled={launching}
            style={{ width: "100%", cursor: "pointer", fontFamily: "'Anton',sans-serif", fontSize: "clamp(26px,4vw,40px)", lineHeight: 0.9, letterSpacing: "0.02em", textTransform: "uppercase", color: "var(--surface)", background: "var(--oni)", border: 0, padding: "22px 16px 18px" }}
          >
            {launching ? "LAUNCHING…" : "LAUNCH SQUAD ROOM  ➔"}
          </button>
        </div>
      </div>
    </div>
  );
}
