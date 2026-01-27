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
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 shadow-lg">
        <h2 className="text-2xl font-semibold text-foreground">Create account</h2>
        <p className="mt-2 text-sm text-muted-foreground">Start matching with players near you.</p>

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
              placeholder="••••••••"
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

        <div className="mt-4 text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link className="text-primary hover:underline" to="/login">
            Login
          </Link>
        </div>
      </div>
    </div>
  );
}
