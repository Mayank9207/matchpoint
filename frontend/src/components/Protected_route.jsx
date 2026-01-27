import { Navigate } from "react-router-dom";

// This component protects routes by checking for the stored access token.
// Use the same key `access_token` as the rest of the app.
export default function ProtectedRoute({ children }) {
  const token = localStorage.getItem("access_token");
  return token ? children : <Navigate to="/login" />;
}
