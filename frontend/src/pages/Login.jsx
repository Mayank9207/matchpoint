import { useState, useEffect } from "react";
import api from "../api/client";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      navigate("/matches");
    }
  }, [navigate]);

  const handleLogin = async () => {
    try {
      const res = await api.post("/auth/login", { email, password });
      const token = res.data?.data?.token;
      const userData = res.data?.data?.user;
      
      console.log("Login response:", res.data);
      console.log("User data:", userData);
      
      if (token) {
        localStorage.setItem("access_token", token);
        // Store user data in localStorage
        if (userData) {
          localStorage.setItem("user", JSON.stringify(userData));
          console.log("Stored user data:", userData);
        }
        navigate("/matches");
      } else {
        alert("Login succeeded but no token returned");
      }
    } catch (err) {
      console.error("Login error:", err);
      alert(err.response?.data?.error || "Login failed");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-lg">
        <h2 className="text-2xl font-semibold text-foreground">Login</h2>
        <p className="mt-2 text-sm text-muted-foreground">Welcome back to Matchpoint.</p>

        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            handleLogin();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <Button type="submit" className="w-full">
            Login
          </Button>
        </form>

        <div className="mt-4 text-sm text-muted-foreground">
          No account?{" "}
          <Link className="text-primary hover:underline" to="/register">
            Register
          </Link>
        </div>
      </div>
    </div>
  );
}
