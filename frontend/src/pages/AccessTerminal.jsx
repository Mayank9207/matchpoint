import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/client";

const TERMINAL_CSS = `
  .tc-scope{ --ink:#0B0B0B; --void:#0B0B0B; --base:#F0380F; --acid:#D8FF14; --boso:#1C18E8;
    --oni:#E8341C; --surface:#F2EEE2; --haze:#2B2B2B; }
  .tc-scope *{ box-sizing:border-box; }
  .tc-scope ::selection{ background:var(--acid); color:var(--ink); }
  @keyframes panelPop{ 0%{ transform:scale(0.95); opacity:0; } 100%{ transform:scale(1); opacity:1; } }
  @keyframes marq{ 0%{ transform:translateX(0); } 100%{ transform:translateX(-50%); } }
  @keyframes blink{ 0%,49%{ opacity:1; } 50%,100%{ opacity:0; } }

  .tc-content{ display:flex; flex-direction:column; }
  .tc-left{ order:2; }
  .tc-right{ order:1; }
  .tc-nav{ display:none; }
  .tc-footer{ flex-direction:column; gap:12px; align-items:stretch; }
  .tc-footer-fields{ flex-direction:column; }

  @media (min-width:1024px){
    .tc-root{ height:100vh; overflow:hidden; }
    .tc-content{ display:grid; grid-template-columns:1fr 1fr 48px; flex:1 1 auto; min-height:0; overflow:hidden; }
    .tc-left{ order:0; min-height:0; overflow:hidden; }
    .tc-right{ order:0; min-height:0; overflow:hidden; }
    .tc-nav{ display:flex; order:0; }
    .tc-footer{ flex-direction:row; align-items:center; gap:20px; }
    .tc-footer-fields{ flex-direction:row; }
  }

  .btn-oauth:hover{ transform:translate(-4px,-4px); box-shadow:8px 8px 0 0 var(--acid); border-color:var(--surface); }
  .btn-oauth:active{ transform:translate(0,0); box-shadow:0 0 0 0 var(--acid); }
  .btn-oauth:disabled{ opacity:0.55; cursor:not-allowed; transform:none; box-shadow:none; }
  .inp-auth:focus{ box-shadow:inset 0 0 0 3px var(--oni); }
  .btn-init:hover{ transform:translate(-4px,-4px); box-shadow:8px 8px 0 0 var(--acid); }
  .btn-init:active{ transform:translate(0,0); box-shadow:0 0 0 0 var(--ink); }
  .btn-init:disabled{ opacity:0.6; cursor:not-allowed; transform:none; box-shadow:none; }
  .btn-bypass:hover{ transform:translate(-5px,-5px); box-shadow:10px 10px 0 0 var(--oni); }
  .btn-bypass:active{ transform:translate(0,0); box-shadow:0 0 0 0 var(--ink); }
  .nav-link{ cursor:pointer; }
  .tc-toggle{ background:none; border:0; cursor:pointer; }
`;

const SCRAMBLE_CHARS = "#@!%*";

function TacticalNavItem({ num, label }) {
  const ref = useRef(null);
  const timer = useRef(null);

  const handleEnter = () => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    clearInterval(timer.current);
    timer.current = setInterval(() => {
      frame++;
      el.textContent = label
        .split("")
        .map((c, i) =>
          i < frame ? c : SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]
        )
        .join("");
      if (frame >= label.length) {
        clearInterval(timer.current);
        el.textContent = label;
      }
    }, 22);
  };

  useEffect(() => () => clearInterval(timer.current), []);

  return (
    <div className="nav-link" onMouseEnter={handleEnter} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
      <span style={{ fontSize: "9px", fontWeight: 800, letterSpacing: "0.1em", color: "var(--boso)" }}>[{num}]</span>
      <span
        ref={ref}
        className="nav-label"
        style={{ writingMode: "vertical-rl", fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink)" }}
      >
        {label}
      </span>
    </div>
  );
}

export default function AccessTerminal() {
  const navigate = useNavigate();

  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [secureKey, setSecureKey] = useState("");
  const [operatorName, setOperatorName] = useState("");

  const [squadHash, setSquadHash] = useState("");

  const [squadsInPool, setSquadsInPool] = useState(142);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [otpOpen, setOtpOpen] = useState(false);
  const [otpEmail, setOtpEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [otpNotice, setOtpNotice] = useState("");

  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (localStorage.getItem("access_token")) navigate("/hub");
  }, [navigate]);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/squads/pool/count")
      .then((res) => {
        const n = res?.data?.count;
        if (!cancelled && typeof n === "number") setSquadsInPool(n);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const completeAuth = useCallback(
    (data) => {
      const token = data?.access_token;
      const user = data?.user;
      if (!token) {
        setError("AUTH OK BUT NO TOKEN RETURNED");
        return;
      }
      localStorage.setItem("access_token", token);
      if (user) localStorage.setItem("user", JSON.stringify(user));
      window.dispatchEvent(new Event("auth-change"));
      navigate("/hub");
    },
    [navigate]
  );

  const extractError = (err, fallback) =>
    err?.response?.data?.detail || err?.response?.data?.error || err?.message || fallback;

  const handleManualSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      if (mode === "register") {
        await api.post("/auth/signup", {
          email,
          password: secureKey,
          display_name: operatorName || email.split("@")[0],
        });
        openOtp(email, "VERIFICATION CODE DISPATCHED. CHECK YOUR INBOX.");
      } else {
        const res = await api.post("/auth/login", { email, password: secureKey });
        completeAuth(res.data);
      }
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      if (status === 403 && detail === "EMAIL_NOT_VERIFIED") {
        openOtp(email, "EMAIL NOT VERIFIED. NEW CODE SENT.");
      } else {
        setError(String(extractError(err, "AUTH FAILED")).toUpperCase());
      }
    } finally {
      setBusy(false);
    }
  };

  const openOtp = (forEmail, message) => {
    setOtpEmail(forEmail);
    setOtpCode("");
    setOtpError("");
    setOtpNotice(message || "");
    setOtpOpen(true);
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setOtpError("");
    setOtpNotice("");
    setOtpBusy(true);
    try {
      const res = await api.post("/auth/verify-otp", { email: otpEmail, code: otpCode });
      setOtpOpen(false);
      completeAuth(res.data);
    } catch (err) {
      setOtpError(String(extractError(err, "INVALID CODE")).toUpperCase());
    } finally {
      setOtpBusy(false);
    }
  };

  const handleResendOtp = async () => {
    setOtpError("");
    setOtpNotice("");
    setOtpBusy(true);
    try {
      await api.post("/auth/resend-otp", { email: otpEmail });
      setOtpNotice("NEW CODE SENT.");
    } catch (err) {
      setOtpError(String(extractError(err, "RESEND FAILED")).toUpperCase());
    } finally {
      setOtpBusy(false);
    }
  };

  const loadGis = () =>
    new Promise((resolve, reject) => {
      if (window.google?.accounts?.id) return resolve(window.google);
      const existing = document.getElementById("google-gis");
      if (existing) {
        existing.addEventListener("load", () => resolve(window.google));
        existing.addEventListener("error", reject);
        return;
      }
      const s = document.createElement("script");
      s.id = "google-gis";
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.defer = true;
      s.onload = () => resolve(window.google);
      s.onerror = reject;
      document.head.appendChild(s);
    });

  const handleGoogle = async () => {
    setError("");
    setNotice("");
    if (!googleClientId) {
      setError("GOOGLE SIGN-IN NOT CONFIGURED (SET VITE_GOOGLE_CLIENT_ID)");
      return;
    }
    setBusy(true);
    try {
      const google = await loadGis();
      google.accounts.id.initialize({
        client_id: googleClientId,
        callback: async (response) => {
          try {
            const res = await api.post("/auth/google", { credential: response.credential });
            completeAuth(res.data);
          } catch (err) {
            setError(String(extractError(err, "GOOGLE AUTH FAILED")).toUpperCase());
          } finally {
            setBusy(false);
          }
        },
      });
      google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed?.() || notification.isSkippedMoment?.()) {
          setBusy(false);
          setError("GOOGLE PROMPT BLOCKED — ALLOW THIRD-PARTY COOKIES / POPUPS");
        }
      });
    } catch {
      setBusy(false);
      setError("COULD NOT LOAD GOOGLE SIGN-IN");
    }
  };

  const handleBypass = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    const code = squadHash.trim();
    if (!code) return;
    if (!localStorage.getItem("access_token")) {
      setError("AUTH REQUIRED // INITIALIZE A SESSION BEFORE INJECTION");
      return;
    }
    setBusy(true);
    try {
      await api.post("/squads/join", { code });
      navigate("/matches");
    } catch (err) {
      setError(String(extractError(err, "INJECTION REJECTED")).toUpperCase());
    } finally {
      setBusy(false);
    }
  };

  const isRegister = mode === "register";

  return (
    <div className="tc-scope">
      <style>{TERMINAL_CSS}</style>

      <div className="tc-root" style={{ display: "flex", flexDirection: "column", minHeight: "100vh", width: "100%", background: "var(--void)", fontFamily: "'JetBrains Mono',monospace", color: "var(--surface)", position: "relative" }}>

        <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", minHeight: "46px", padding: "8px 16px", background: "var(--acid)", color: "var(--ink)", borderBottom: "2px solid var(--ink)", fontSize: "10px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", position: "relative", zIndex: 5, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "9px", height: "9px", background: "var(--oni)", display: "inline-block", animation: "blink 1s steps(1) infinite" }} />
            SYS.STAT // ONLINE
          </div>
          <div style={{ fontFamily: "'Anton',sans-serif", letterSpacing: "0.18em", fontSize: "13px" }}>MATCHPOINT.EXE // MONO_STATE</div>
          <div>POOL: ACTIVE</div>
        </div>

        <div style={{ flex: "0 0 auto", height: "72px", background: "var(--void)", borderBottom: "1px solid var(--haze)", display: "flex", alignItems: "center", overflow: "hidden", position: "relative", zIndex: 4 }}>
          <div style={{ display: "flex", whiteSpace: "nowrap", animation: "marq 22s linear infinite", willChange: "transform" }}>
            {[0, 1].map((i) => (
              <span key={i} style={{ fontFamily: "'Anton',sans-serif", fontSize: "54px", lineHeight: 1, letterSpacing: "0.02em", color: "transparent", WebkitTextStroke: "1px var(--acid)", paddingRight: "0.3em" }}>
                MATCHPOINT&nbsp;//&nbsp;DETERMINISTIC&nbsp;COLLISION&nbsp;//&nbsp;INGEST&nbsp;·&nbsp;EVALUATE&nbsp;·&nbsp;LOCK&nbsp;//&nbsp;
              </span>
            ))}
          </div>
        </div>

        <div className="tc-content">

          <div className="tc-left" style={{ background: "var(--base)", color: "var(--ink)", borderRight: "2px solid var(--ink)" }}>
            <div style={{ height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-start", gap: "24px", padding: "64px 36px 36px", animation: "panelPop 0.55s cubic-bezier(.34,1.56,.64,1) both", animationDelay: "0.05s" }}>
              <div>
                <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--acid)", marginBottom: "14px" }}>// ENGINE TELEMETRY</div>
                <h1 style={{ fontFamily: "'Anton',sans-serif", fontWeight: 400, color: "var(--acid)", margin: 0, lineHeight: 0.8, letterSpacing: "-0.02em", textTransform: "uppercase", fontSize: "clamp(52px,6.5vw,112px)" }}>
                  <span style={{ display: "block" }}>DETERMINISTIC</span>
                  <span style={{ display: "block", color: "var(--ink)", WebkitTextStroke: "2px var(--acid)" }}>COLLISION.</span>
                </h1>
                <p style={{ fontSize: "12px", lineHeight: 1.35, fontWeight: 500, letterSpacing: "0.01em", maxWidth: "48ch", margin: "20px 0 0", color: "var(--ink)" }}>
                  WAITING IS A DESIGN FLAW. WE BUILT A MONOLITHIC MATCHING APPARATUS. INCOMING SQUADS ARE PROCESSED AS CONTINUOUS DATA STREAMS. MATCHES DO NOT GRADUALLY FORM; THEY ARE MATHEMATICALLY EXECUTED THE EXACT MILLISECOND PARAMETERS ALIGN. INGEST. EVALUATE. LOCK.
                </p>
              </div>

              <div style={{ borderTop: "2px solid var(--ink)", paddingTop: "14px", display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "12px" }}>
                <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase" }}>&gt; SQUADS_IN_POOL</span>
                <span style={{ fontFamily: "'Anton',sans-serif", fontSize: "30px", lineHeight: 0.8, color: "var(--ink)" }}>{squadsInPool}</span>
              </div>
            </div>
          </div>

          <div className="tc-right" style={{ background: "var(--void)", padding: "64px 36px 36px", display: "flex", flexDirection: "column", justifyContent: "flex-start", gap: "18px", position: "relative", borderRight: "1px solid var(--haze)" }}>

            <button type="button" onClick={handleGoogle} disabled={busy} className="btn-oauth" style={{ width: "100%", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "16px", fontFamily: "'JetBrains Mono',monospace", fontSize: "16px", fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--surface)", background: "transparent", border: "1px solid var(--haze)", borderRadius: 0, padding: "24px 18px", transform: "translate(0,0)", boxShadow: "0 0 0 0 var(--acid)", transition: "transform .1s cubic-bezier(0,0,.2,1), box-shadow .1s cubic-bezier(0,0,.2,1)" }}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="var(--surface)" aria-hidden="true" style={{ flex: "0 0 auto" }}>
                <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
              </svg>
              AUTHENTICATE // GOOGLE
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "14px", color: "var(--surface)", fontSize: "10px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase" }}>
              <span style={{ flex: 1, height: "1px", background: "var(--haze)" }} />
              OR MANUAL OVERRIDE
              <span style={{ flex: 1, height: "1px", background: "var(--haze)" }} />
            </div>

            <form onSubmit={handleManualSubmit} style={{ background: "var(--surface)", color: "var(--ink)", border: "2px solid var(--ink)", boxShadow: "8px 8px 0px 0px var(--oni)", padding: "26px", display: "flex", flexDirection: "column", gap: "16px", animation: "panelPop 0.55s cubic-bezier(.34,1.56,.64,1) both", animationDelay: "0.2s" }}>
              {isRegister && (
                <label style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                  <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase" }}>OPERATOR_HANDLE</span>
                  <input className="inp-auth" type="text" placeholder="callsign" value={operatorName} onChange={(e) => setOperatorName(e.target.value)} style={{ width: "100%", fontFamily: "'JetBrains Mono',monospace", fontSize: "13px", fontWeight: 600, letterSpacing: "0.04em", color: "var(--ink)", background: "#fff", border: "2px solid var(--ink)", borderRadius: 0, padding: "13px 14px", outline: "none", transition: "box-shadow .1s ease" }} />
                </label>
              )}
              <label style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase" }}>OPERATOR_ID [EMAIL]</span>
                <input className="inp-auth" type="email" required placeholder="operator@matchpoint.sys" value={email} onChange={(e) => setEmail(e.target.value)} style={{ width: "100%", fontFamily: "'JetBrains Mono',monospace", fontSize: "13px", fontWeight: 600, letterSpacing: "0.04em", color: "var(--ink)", background: "#fff", border: "2px solid var(--ink)", borderRadius: 0, padding: "13px 14px", outline: "none", transition: "box-shadow .1s ease" }} />
              </label>
              <label style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase" }}>SECURE_KEY</span>
                <input className="inp-auth" type="password" required placeholder="••••••••••••" value={secureKey} onChange={(e) => setSecureKey(e.target.value)} style={{ width: "100%", fontFamily: "'JetBrains Mono',monospace", fontSize: "13px", fontWeight: 600, letterSpacing: "0.2em", color: "var(--ink)", background: "#fff", border: "2px solid var(--ink)", borderRadius: 0, padding: "13px 14px", outline: "none", transition: "box-shadow .1s ease" }} />
              </label>

              {error && (
                <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--oni)" }}>! {error}</div>
              )}
              {notice && (
                <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--boso)" }}>&gt; {notice}</div>
              )}

              <button type="submit" disabled={busy} className="btn-init" style={{ marginTop: "4px", alignSelf: "flex-start", cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--surface)", background: "var(--ink)", border: "2px solid var(--ink)", borderRadius: 0, padding: "14px 22px", transform: "translate(0,0)", boxShadow: "0 0 0 0 var(--ink)", transition: "transform .1s cubic-bezier(0,0,.2,1), box-shadow .1s cubic-bezier(0,0,.2,1)" }}>
                {busy ? "PROCESSING…" : isRegister ? "REGISTER_OPERATOR" : "INITIALIZE_SESSION"}
              </button>

              <button type="button" className="tc-toggle" onClick={() => { setMode(isRegister ? "login" : "register"); setError(""); setNotice(""); }} style={{ alignSelf: "flex-start", fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink)", textDecoration: "underline", padding: 0 }}>
                {isRegister ? "« RETURN TO LOGIN" : "NEW OPERATOR? // REGISTER »"}
              </button>
            </form>
          </div>

          <div className="tc-nav" style={{ background: "var(--acid)", color: "var(--ink)", flexDirection: "column", alignItems: "center", justifyContent: "space-between", padding: "18px 0", gap: 0, overflow: "hidden" }}>
            <div style={{ flex: "0 0 auto", fontSize: "9px", fontWeight: 800, letterSpacing: "0.3em", writingMode: "vertical-rl", textTransform: "uppercase" }}>PIPELINE</div>
            <div style={{ flex: "1 1 auto", minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "space-around", alignItems: "center", padding: "14px 0" }}>
              <TacticalNavItem num="01" label="AUTHENTICATE" />
              <TacticalNavItem num="02" label="INJECT_DATA" />
              <TacticalNavItem num="03" label="SYSTEM_EVAL" />
              <TacticalNavItem num="04" label="DEPLOYMENT" />
            </div>
            <div style={{ flex: "0 0 auto", width: "12px", height: "12px", background: "var(--oni)", animation: "blink 1.4s steps(1) infinite" }} />
          </div>
        </div>

        <form className="tc-footer" onSubmit={handleBypass} style={{ flex: "0 0 auto", display: "flex", background: "var(--void)", borderTop: "2px solid var(--boso)", padding: "16px 36px" }}>
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ width: "9px", height: "9px", background: "var(--acid)", display: "inline-block", animation: "blink 1s steps(1) infinite" }} />
            <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--acid)" }}>// DIRECT INJECTION</span>
          </div>
          <div className="tc-footer-fields" style={{ flex: "1 1 auto", display: "flex", gap: "12px", minWidth: 0 }}>
            <div style={{ flex: "1 1 auto", display: "flex", alignItems: "center", gap: "10px", minWidth: 0, background: "#111", border: "2px solid var(--haze)", padding: "0 14px" }}>
              <span style={{ flex: "0 0 auto", fontFamily: "'JetBrains Mono',monospace", fontSize: "14px", fontWeight: 800, color: "var(--acid)" }}>&gt;</span>
              <input type="text" value={squadHash} onChange={(e) => setSquadHash(e.target.value)} placeholder="ENTER_SQUAD_HASH_OR_JOIN_CODE..." style={{ flex: "1 1 auto", minWidth: 0, fontFamily: "'JetBrains Mono',monospace", fontSize: "13px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--surface)", background: "transparent", border: 0, borderRadius: 0, padding: "15px 0", outline: "none" }} />
            </div>
            <button type="submit" disabled={busy} className="btn-bypass" style={{ flex: "0 0 auto", cursor: "pointer", fontFamily: "'Anton',sans-serif", fontSize: "clamp(26px,2.6vw,38px)", lineHeight: 0.85, letterSpacing: "0.01em", textTransform: "uppercase", color: "var(--acid)", background: "var(--boso)", border: "2px solid var(--ink)", borderRadius: 0, padding: "12px 28px 9px", whiteSpace: "nowrap", boxShadow: "0px 0px 0px 0px var(--ink)", transform: "translate(0,0)", transition: "transform .1s cubic-bezier(0,0,.2,1), box-shadow .1s cubic-bezier(0,0,.2,1)" }}>
              EXECUTE_BYPASS
            </button>
          </div>
        </form>
      </div>

      {otpOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(11,11,11,0.92)", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "'JetBrains Mono',monospace" }}>
          <form onSubmit={handleVerifyOtp} style={{ width: "100%", maxWidth: "420px", background: "var(--surface)", color: "var(--ink)", border: "2px solid var(--ink)", boxShadow: "10px 10px 0px 0px var(--boso)", padding: "30px", display: "flex", flexDirection: "column", gap: "16px", animation: "panelPop 0.4s cubic-bezier(.34,1.56,.64,1) both" }}>
            <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--oni)" }}>// VERIFY ACCESS</div>
            <div style={{ fontSize: "12px", fontWeight: 600, lineHeight: 1.4 }}>
              A ONE-TIME CODE WAS DISPATCHED TO<br />
              <span style={{ fontWeight: 800 }}>{otpEmail}</span>
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
              <span style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase" }}>VERIFICATION_CODE</span>
              <input className="inp-auth" type="text" inputMode="numeric" autoFocus required value={otpCode} onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" maxLength={8} style={{ width: "100%", fontFamily: "'JetBrains Mono',monospace", fontSize: "22px", fontWeight: 800, letterSpacing: "0.5em", textAlign: "center", color: "var(--ink)", background: "#fff", border: "2px solid var(--ink)", borderRadius: 0, padding: "13px 14px", outline: "none", transition: "box-shadow .1s ease" }} />
            </label>

            {otpError && (
              <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--oni)" }}>! {otpError}</div>
            )}
            {otpNotice && (
              <div style={{ fontSize: "10px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--boso)" }}>&gt; {otpNotice}</div>
            )}

            <button type="submit" disabled={otpBusy} className="btn-init" style={{ alignSelf: "stretch", cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", fontWeight: 800, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--surface)", background: "var(--ink)", border: "2px solid var(--ink)", borderRadius: 0, padding: "14px 22px", transform: "translate(0,0)", boxShadow: "0 0 0 0 var(--ink)", transition: "transform .1s cubic-bezier(0,0,.2,1), box-shadow .1s cubic-bezier(0,0,.2,1)" }}>
              {otpBusy ? "VERIFYING…" : "CONFIRM_CODE"}
            </button>

            <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
              <button type="button" className="tc-toggle" disabled={otpBusy} onClick={handleResendOtp} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink)", textDecoration: "underline", padding: 0 }}>
                RESEND_CODE
              </button>
              <button type="button" className="tc-toggle" disabled={otpBusy} onClick={() => setOtpOpen(false)} style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "10px", fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--haze)", textDecoration: "underline", padding: 0 }}>
                ABORT
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
