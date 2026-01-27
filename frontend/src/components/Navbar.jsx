// frontend/src/components/Navbar.jsx
import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Trophy, Menu, X, LogOut, User, Home, PlusCircle, Calendar } from "lucide-react";
import api from "../api/client";

export default function Navbar() {
  const [me, setMe] = useState(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem("access_token");
      if (!token) {
        setMe(null);
        return;
      }
      api.get("/auth/me")
        .then((res) => {
          const user = res.data?.data?.user || res.data?.user;
          setMe(user);
        })
        .catch(() => {
          setMe(null);
        });
    };
    checkAuth();
    window.addEventListener("storage", checkAuth);
    return () => window.removeEventListener("storage", checkAuth);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    setMe(null);
    window.location.href = "/";
  };

  const token = !!localStorage.getItem("access_token");
  const isLoggedIn = token && !!me;

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo / Brand */}
          <Link to={isLoggedIn ? "/matches" : "/"} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Trophy className="w-6 h-6 text-orange-500" />
              <span className="text-lg font-semibold text-foreground">MatchPoint</span>
            </div>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex md:items-center md:gap-4">
            {isLoggedIn ? (
              <>
                <Link to="/matches" className="text-sm text-foreground hover:text-primary px-3 py-2 rounded-md">Matches</Link>
                <Link to="/create" className="text-sm text-foreground hover:text-primary px-3 py-2 rounded-md">Create</Link>
                <Link to="/profile" className="text-sm text-foreground hover:text-primary px-3 py-2 rounded-md">Profile</Link>
                {me?.name && <span className="text-sm text-muted-foreground">Hi, {me.name}</span>}
                <button
                  onClick={handleLogout}
                  className="ml-2 rounded-md bg-secondary px-3 py-1 text-sm text-secondary-foreground hover:bg-secondary/80"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link to="/login" className="text-sm text-foreground hover:text-primary px-3 py-2 rounded-md">Login</Link>
                <Link to="/register" className="text-sm text-foreground hover:text-primary px-3 py-2 rounded-md">Register</Link>
              </>
            )}
          </div>

          {/* Mobile toggle */}
          <div className="md:hidden">
            <button
              onClick={() => setMobileOpen(s => !s)}
              className="inline-flex items-center justify-center rounded-md p-2 text-foreground hover:bg-secondary"
              aria-label="Toggle menu"
            >
              {mobileOpen ? (
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M18 6 6 18" strokeWidth="1.6" />
                  <path d="m6 6 12 12" strokeWidth="1.6" />
                </svg>
              ) : (
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <line x1="4" x2="20" y1="6" y2="6" strokeWidth="1.6" />
                  <line x1="4" x2="20" y1="12" y2="12" strokeWidth="1.6" />
                  <line x1="4" x2="20" y1="18" y2="18" strokeWidth="1.6" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={`md:hidden border-t border-border ${mobileOpen ? "block" : "hidden"}`}>
        <div className="space-y-1 px-4 pb-3 pt-2">
          {isLoggedIn ? (
            <>
              <Link to="/matches" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-base text-foreground rounded-md hover:bg-secondary">Matches</Link>
              <Link to="/create" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-base text-foreground rounded-md hover:bg-secondary">Create</Link>
              <Link to="/profile" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-base text-foreground rounded-md hover:bg-secondary">Profile</Link>
              {me?.name && <div className="px-3 py-2 text-sm text-muted-foreground">Hi, {me.name}</div>}
              <button onClick={() => { setMobileOpen(false); handleLogout(); }} className="w-full text-left px-3 py-2 text-base text-foreground rounded-md hover:bg-secondary">Logout</button>
            </>
          ) : (
            <>
              <Link to="/login" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-base text-foreground rounded-md hover:bg-secondary">Login</Link>
              <Link to="/register" onClick={() => setMobileOpen(false)} className="block px-3 py-2 text-base text-foreground rounded-md hover:bg-secondary">Register</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

export { Navbar };
