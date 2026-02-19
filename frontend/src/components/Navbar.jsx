// frontend/src/components/Navbar.jsx
import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { Trophy, Menu, X, LogOut, User, Home, PlusCircle, Calendar } from "lucide-react";
import api from "../api/client";

export default function Navbar() {
  const location = useLocation();
  const [me, setMe] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(
    !!localStorage.getItem("access_token")
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem("access_token");
      if (!token) {
        setMe(null);
        setIsLoggedIn(false);
        return;
      }
      setIsLoggedIn(true);
      
      // For now, if token exists, consider user logged in
      // Try to get user data but don't fail if API call fails
      api.get("/auth/me")
        .then((res) => {
          console.log("Auth response:", res.data);
          const user = res.data?.data?.user || res.data?.user || res.data;
          console.log("Extracted user:", user);
          setMe(user);
        })
        .catch((err) => {
          console.error("Auth check failed:", err);
          // Set a basic user object if API fails but token exists
          setMe({ name: "User" });
        });
    };
    
    checkAuth();
    window.addEventListener("storage", checkAuth);
    window.addEventListener("auth-change", checkAuth);
    return () => {
      window.removeEventListener("storage", checkAuth);
      window.removeEventListener("auth-change", checkAuth);
    };
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem("access_token");
    setMe(null);
    setIsLoggedIn(false);
    window.location.href = "/";
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="w-full px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo / Brand */}
          <Link to={isLoggedIn ? "/matches" : "/"} className="flex items-center gap-3 group">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Trophy className="w-5 h-5 text-primary" />
              </div>
              <span className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">MatchPoint</span>
            </div>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex md:items-center md:gap-6">
            {isLoggedIn ? (
              <>
                <Link 
                  to="/matches" 
                  className="text-sm font-medium text-foreground hover:text-primary transition-colors px-3 py-2 rounded-md hover:bg-accent"
                >
                  Matches
                </Link>
                <Link 
                  to="/create" 
                  className="text-sm font-medium text-foreground hover:text-primary transition-colors px-3 py-2 rounded-md hover:bg-accent"
                >
                  Create Match
                </Link>
                <Link 
                  to="/profile" 
                  className="text-sm font-medium text-foreground hover:text-primary transition-colors px-3 py-2 rounded-md hover:bg-accent flex items-center gap-2"
                >
                  <User className="w-4 h-4" />
                  Profile
                </Link>
                <div className="flex items-center gap-3 ml-4 pl-4 border-l border-border">
                  <span className="text-sm text-muted-foreground">Hi, {me?.name || 'User'}</span>
                  <Button
                    onClick={handleLogout}
                    variant="outline"
                    size="sm"
                    className="flex items-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-4">
                <Link 
                  to="/login" 
                  className="text-sm font-medium text-foreground hover:text-primary transition-colors px-3 py-2 rounded-md hover:bg-accent"
                >
                  Login
                </Link>
                <Link 
                  to="/register" 
                  className="text-sm font-medium text-foreground hover:text-primary transition-colors px-3 py-2 rounded-md hover:bg-accent"
                >
                  Register
                </Link>
              </div>
            )}
          </div>

          {/* Mobile toggle */}
          <div className="md:hidden">
            <Button
              onClick={() => setMobileOpen(s => !s)}
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0"
              aria-label="Toggle menu"
            >
              {mobileOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background">
          <div className="px-4 py-4 space-y-2">
            {isLoggedIn ? (
              <>
                <Link 
                  to="/matches" 
                  onClick={() => setMobileOpen(false)} 
                  className="block px-4 py-3 text-base font-medium text-foreground rounded-md hover:bg-accent transition-colors"
                >
                  Matches
                </Link>
                <Link 
                  to="/create" 
                  onClick={() => setMobileOpen(false)} 
                  className="block px-4 py-3 text-base font-medium text-foreground rounded-md hover:bg-accent transition-colors"
                >
                  Create Match
                </Link>
                <Link 
                  to="/profile" 
                  onClick={() => setMobileOpen(false)} 
                  className="block px-4 py-3 text-base font-medium text-foreground rounded-md hover:bg-accent transition-colors flex items-center gap-2"
                >
                  <User className="w-4 h-4" />
                  Profile
                </Link>
                <div className="border-t border-border pt-4 mt-4">
                  <div className="px-4 py-2 text-sm text-muted-foreground">Hi, {me?.name || 'User'}</div>
                  <Button 
                    onClick={() => { setMobileOpen(false); handleLogout(); }} 
                    variant="outline" 
                    className="w-full mt-2 flex items-center justify-center gap-2"
                  >
                    <LogOut className="w-4 h-4" />
                    Logout
                  </Button>
                </div>
              </>
            ) : (
              <>
                <Link 
                  to="/login" 
                  onClick={() => setMobileOpen(false)} 
                  className="block px-4 py-3 text-base font-medium text-foreground rounded-md hover:bg-accent transition-colors"
                >
                  Login
                </Link>
                <Link 
                  to="/register" 
                  onClick={() => setMobileOpen(false)} 
                  className="block px-4 py-3 text-base font-medium text-foreground rounded-md hover:bg-accent transition-colors"
                >
                  Register
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}

export { Navbar };
