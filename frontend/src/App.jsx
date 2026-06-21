import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import Matches from "./pages/Matches";
import AccessTerminal from "./pages/AccessTerminal";
import Profile from "./pages/Profile";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/Protected_route";
import CreateMatch from "./pages/CreateMatch";
import MatchDetails from "./pages/MatchDetails";
import Gateway from "./pages/Gateway";
import JoinPool from "./pages/JoinPool";
import MatchProposal from "./pages/MatchProposal";
import ReadyCheck from "./pages/ReadyCheck";
import MatchLocked from "./pages/MatchLocked";
import api from "./api/client";

const CHROMELESS_ROUTES = ["/", "/login", "/register", "/hub", "/join", "/create"];
const CHROMELESS_PREFIXES = ["/proposal/", "/ready/", "/match/"];

function Chrome() {
  const { pathname } = useLocation();
  if (CHROMELESS_ROUTES.includes(pathname)) return null;
  if (CHROMELESS_PREFIXES.some((p) => pathname.startsWith(p))) return null;
  return <Navbar />;
}

export default function App() {
  useEffect(() => {
    let cancelled = false;

    async function probeBackend() {
      try {
        const res = await api.get("/health");
        if (!cancelled) console.log("Backend connected", res.data);
      } catch (err) {
        if (cancelled) return;
        const detail = {
          message: err?.message,
          code: err?.code,
          status: err?.response?.status,
          data: err?.response?.data,
          baseURL: api?.defaults?.baseURL,
        };
        console.error("Backend connection failed", detail);
      }
    }

    probeBackend();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <BrowserRouter>
      <Chrome />
      <Routes>
        <Route path="/" element={<AccessTerminal />} />
        <Route
          path="/matches"
          element={
            <ProtectedRoute>
              <Matches />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<AccessTerminal />} />
        <Route path="/register" element={<AccessTerminal />} />
        <Route
          path="/hub"
          element={
            <ProtectedRoute>
              <Gateway />
            </ProtectedRoute>
          }
        />
        <Route
          path="/join"
          element={
            <ProtectedRoute>
              <JoinPool />
            </ProtectedRoute>
          }
        />
        <Route path="/create" element={<ProtectedRoute><CreateMatch /></ProtectedRoute>} />
        <Route
          path="/proposal/:matchId"
          element={
            <ProtectedRoute>
              <MatchProposal />
            </ProtectedRoute>
          }
        />
        <Route
          path="/ready/:matchId"
          element={
            <ProtectedRoute>
              <ReadyCheck />
            </ProtectedRoute>
          }
        />
        <Route
          path="/match/:matchId"
          element={
            <ProtectedRoute>
              <MatchLocked />
            </ProtectedRoute>
          }
        />
        <Route 
          path="/matches/:id" 
          element={
            <ProtectedRoute>
              <MatchDetails />
            </ProtectedRoute>
          } 
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
