import { useState, useEffect } from "react";
import api from "../api/client";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [age, setAge] = useState("");
  const navigate = useNavigate();

  // Redirect if already logged in
  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (token) {
      navigate("/matches");
    }
  }, [navigate]);

  const handleRegister = async () => {
    try {
      const payload = { name, email, password };
      if (age !== "") payload.age = Number(age);
      const res = await api.post("/auth/register", payload);
      const token = res.data?.data?.token;
      const userData = res.data?.data?.user;

      console.log("Register response:", res.data);
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
        alert("Registered but no token received");
      }
    } catch (err) {
      console.error("Register error:", err);
      alert(err.response?.data?.error || "Register failed");
    }
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground">
      <div className="absolute inset-0 bg-[radial-gradient(700px_500px_at_20%_0%,oklch(0.7_0.18_50/0.18),transparent_60%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,oklch(0.7_0.18_50/0.06),transparent_45%,oklch(0_0_0))]" />
      <div className="relative container mx-auto flex min-h-screen items-center justify-center px-6 py-12">
        <div className="grid w-full max-w-5xl gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="w-full rounded-3xl border border-border bg-card/80 p-8 shadow-[0_0_35px_rgba(0,0,0,0.4)] backdrop-blur">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-background/60 px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Create account
            </div>
            <h2 className="mt-5 text-2xl font-semibold text-foreground">Start matching today</h2>
            <p className="mt-2 text-sm text-muted-foreground">Build your profile and join the best local games.</p>

            <form
              className="mt-6 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                handleRegister();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

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

              <div className="space-y-2">
                <Label htmlFor="age">Age (optional)</Label>
                <Input
                  id="age"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="18"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                />
              </div>

              <Button type="submit" className="w-full">
                Register
              </Button>
            </form>

            <div className="mt-5 text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link className="text-primary hover:underline" to="/login">
                Login
              </Link>
            </div>
          </div>

          <div className="hidden flex-col justify-center rounded-3xl border border-border bg-card/70 p-10 backdrop-blur lg:flex">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border bg-background/60 px-4 py-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Matchpoint Community
            </div>
            <h2 className="mt-6 text-3xl font-semibold">
              Your next squad is <span className="text-primary">one tap away.</span>
            </h2>
            <p className="mt-4 text-muted-foreground">
              Create a profile, choose your sports, and get invited to matches that fit your schedule.
            </p>
            <div className="mt-8 space-y-4">
              <div className="rounded-2xl border border-border bg-background/60 p-4">
                <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Suggested</p>
                <p className="mt-2 text-lg font-semibold">Northside Arena • Saturday League</p>
                <p className="mt-1 text-sm text-muted-foreground">Open spots available</p>
              </div>
              <div className="rounded-2xl border border-border bg-background/60 p-4">
                <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Match rate</p>
                <p className="mt-2 text-lg font-semibold">92% profile completion</p>
                <p className="mt-1 text-sm text-muted-foreground">Finish setup for better matches.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
