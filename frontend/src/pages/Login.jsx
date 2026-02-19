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
        window.dispatchEvent(new Event("auth-change"));
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
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(700px_500px_at_80%_0%,oklch(0.7_0.18_50/0.18),transparent_60%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,oklch(0.7_0.18_50/0.06),transparent_45%,oklch(0_0_0))]" />
      <div className="relative container mx-auto flex min-h-screen items-center justify-center px-6 py-12">
        <div className="grid w-full max-w-5xl gap-10 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="hidden flex-col justify-center rounded-3xl border border-border bg-card/70 p-10 backdrop-blur lg:flex">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-background/60 px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Matchpoint Login
            </div>
            <h2 className="mt-6 text-3xl font-semibold">
              Back in the game. <span className="text-primary">Right on time.</span>
            </h2>
            <p className="mt-4 text-muted-foreground">
              Jump into open sessions, reconnect with your squad, and keep your weekly streak going.
            </p>
            <div className="mt-8 space-y-4">
              <div className="rounded-2xl border border-border bg-background/60 p-4">
                <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Upcoming</p>
                <p className="mt-2 text-lg font-semibold">City Courts • 6v6 Run</p>
                <p className="mt-1 text-sm text-muted-foreground">Tonight at 7:30 PM</p>
              </div>
              <div className="rounded-2xl border border-border bg-background/60 p-4">
                <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Your streak</p>
                <p className="mt-2 text-lg font-semibold">4 weeks in a row</p>
                <p className="mt-1 text-sm text-muted-foreground">Keep the momentum alive.</p>
              </div>
            </div>
          </div>

          <div className="w-full rounded-3xl border border-border bg-card/80 p-8 shadow-[0_0_35px_rgba(0,0,0,0.4)] backdrop-blur">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-background/60 px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Sign in
            </div>
            <h2 className="mt-5 text-2xl font-semibold text-foreground">Welcome back</h2>
            <p className="mt-2 text-sm text-muted-foreground">Login to continue your Matchpoint journey.</p>

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
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full">
                Login
              </Button>
            </form>

            <div className="mt-5 text-sm text-muted-foreground">
              No account?{" "}
              <Link className="text-primary hover:underline" to="/register">
                Register
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
