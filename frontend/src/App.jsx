import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Home from "./pages/Home";
import Matches from "./pages/Matches";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Profile from "./pages/Profile";
import Navbar from "./components/Navbar";
import ProtectedRoute from "./components/Protected_route";
import CreateMatch from "./pages/CreateMatch";
import api from "./api/client";


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
     <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route
          path="/matches"
          element={
            <ProtectedRoute>
              <Matches />
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/create" element={<ProtectedRoute><CreateMatch /></ProtectedRoute>} />
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
