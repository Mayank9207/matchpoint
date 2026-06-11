import { Routes, Route } from "react-router-dom";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import HomePage from "./pages/HomePage";
import SquadLobbyPage from "./pages/SquadLobbyPage";
import MatchSearchPage from "./pages/MatchSearchPage";
import MatchResultPage from "./pages/MatchResultPage";

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      {/* Protected */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <HomePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/squads/:squadId"
        element={
          <ProtectedRoute>
            <SquadLobbyPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/squads/:squadId/search"
        element={
          <ProtectedRoute>
            <MatchSearchPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/matches/:matchId"
        element={
          <ProtectedRoute>
            <MatchResultPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
