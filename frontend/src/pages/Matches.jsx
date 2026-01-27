import React, { useState, useEffect } from "react";
import api from "../api/client";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Link } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Search } from "lucide-react";
import { Card, CardContent } from "../components/ui/card";
import { 
  Circle,
  Gamepad2,
  Target,
  Trophy,
  Users,
  MapPin,
  Calendar,
  Clock
} from "lucide-react";

const sports = [
  "All Sports",
  "Soccer",
  "Basketball",
  "Tennis",
  "Volleyball",
  "Cricket",
  "Baseball",
  "Football",
  "Hockey",
  "Rugby",
  "Golf",
];

// Sport icon mapping - using only basic Lucide icons that definitely exist
const sportIcons = {
  "Soccer": Circle,
  "Basketball": Circle,
  "Tennis": Circle,
  "Volleyball": Circle,
  "Badminton": Circle,
  "Cricket": Circle,
  "Baseball": Circle,
  "Football": Circle,
  "Hockey": Circle,
  "Rugby": Circle,
  "Golf": Circle,
};

export default function MatchesPage() {
  const [matches, setMatches] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSport, setSelectedSport] = useState("All Sports");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        setLoading(true);
        const res = await api.get("/matches");
        const matchesData = res.data?.data || [];

        // Add isJoined status based on current user's participation
        const matchesWithJoinStatus = matchesData.map((match) => {
          const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
          const userId = currentUser?.id || currentUser?._id;
          
          console.log(`Processing match ${match._id || match.id}:`, {
            sport: match.sport,
            fullMatch: match,
            participants: match.participants,
            userId: userId,
            participantIds: match.participants?.map(p => ({ userId: p.userId, id: p.id }))
          });
          
          // TEMPORARY FIX: Check if user has joined this match in localStorage
          // This simulates the backend functionality until backend is fixed
          const joinedMatches = JSON.parse(localStorage.getItem("joinedMatches") || "[]");
          const isJoined = joinedMatches.includes(match._id || match.id) || 
                         match.participants?.some((p) => p.userId === userId || p.id === userId) || false;
          
          console.log(`  Checking localStorage joinedMatches:`, joinedMatches);
          console.log(`  Match ID ${match._id || match.id} in joinedMatches:`, joinedMatches.includes(match._id || match.id));
          console.log(`  Final isJoined for match ${match._id || match.id}:`, isJoined);
          
          return {
            ...match,
            isJoined,
            currentParticipants: match.participants?.length || match.currentParticipants || 0,
          };
        });

        setMatches(matchesWithJoinStatus);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch matches:", err);
        setError("Failed to fetch matches");
      } finally {
        setLoading(false);
      }
    };
    fetchMatches();
  }, []);

  // Helper function to get current user ID
  const getCurrentUserId = () => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const userId = user.id || user._id;
      console.log("Current user from localStorage:", user);
      console.log("Extracted user ID:", userId);
      console.log("User object keys:", Object.keys(user));
      console.log("User.id:", user.id);
      console.log("User._id:", user._id);
      return userId;
    } catch (err) {
      console.error("Error getting user ID:", err);
      return null;
    }
  };

  const handleToggleJoin = async (id) => {
    console.log("Toggle join called for match ID:", id);
    console.log("Type of match ID:", typeof id);

    if (!id || id === "undefined" || id === undefined) {
      console.error("Invalid match ID detected:", id);
      alert("Invalid match ID. Please refresh the page.");
      return;
    }

    const currentUserId = getCurrentUserId();
    console.log("Final user ID being used:", currentUserId);
    console.log("Type of user ID:", typeof currentUserId);

    if (!currentUserId || currentUserId === "undefined" || currentUserId === undefined) {
      console.error("Invalid user ID detected:", currentUserId);
      alert("User not logged in. Please log in again.");
      return;
    }

    try {
      const match = matches.find((m) => (m.id === id || m._id === id));
      console.log("Found match:", match);

      // Also log all matches for debugging
      console.log("All available matches:", matches.map((m) => ({ id: m.id, _id: m._id, sport: m.sport })));

      if (!match) {
        console.error("Match not found for ID:", id);
        alert("Match not found. Please refresh the page.");
        return;
      }

      const isJoining = !match.isJoined;

      console.log("Match", id, "isJoining:", isJoining);
      console.log("User ID:", currentUserId);
      console.log("API endpoint:", `/matches/${id}/join`);

      // Make API call to backend
      if (isJoining) {
        await api.post(`/matches/${id}/join`);
        // TEMPORARY FIX: Store joined match in localStorage
        const joinedMatches = JSON.parse(localStorage.getItem("joinedMatches") || "[]");
        if (!joinedMatches.includes(id)) {
          joinedMatches.push(id);
          localStorage.setItem("joinedMatches", JSON.stringify(joinedMatches));
          console.log("Added to joinedMatches:", joinedMatches);
        }
      } else {
        await api.post(`/matches/${id}/leave`);
        // TEMPORARY FIX: Remove from localStorage
        const joinedMatches = JSON.parse(localStorage.getItem("joinedMatches") || "[]");
        const updatedJoined = joinedMatches.filter(matchId => matchId !== id);
        localStorage.setItem("joinedMatches", JSON.stringify(updatedJoined));
        console.log("Removed from joinedMatches:", updatedJoined);
      }

      // Force a re-fetch of matches to update the UI
      setTimeout(() => {
        window.location.reload();
      }, 500);

      // Update local state after successful API call
      setMatches((prev) => {
        const updated = prev.map((m) => {
          if ((m.id === id || m._id === id)) {
            return {
              ...m,
              isJoined: isJoining,
              currentParticipants: isJoining
                ? typeof m.currentParticipants === "number"
                  ? m.currentParticipants + 1
                  : 1
                : typeof m.currentParticipants === "number"
                ? Math.max(0, m.currentParticipants - 1)
                : 0,
            };
          }
          return m;
        });
        console.log("Updated matches:", updated);
        return updated;
      });
    } catch (err) {
      console.error("Failed to toggle join status:", err);
      console.error("Error response:", err.response?.data);
      console.error("Request that failed:", {
        matchId: id,
        userId: currentUserId,
        endpoint: `/matches/${id}/join`
      });
      alert(err.response?.data?.error || "Failed to update match status. Please try again.");
    }
  };

  const filteredMatches = matches.filter((match) => {
    const sportStr = typeof match.sport === "string" ? match.sport.toLowerCase() : "";
    const locationStr = typeof match.location === "string" ? match.location.toLowerCase() : "";
    const selectedSportLower = selectedSport.toLowerCase();

    const matchesSearch =
      sportStr.includes(searchQuery.toLowerCase()) ||
      locationStr.includes(searchQuery.toLowerCase());
    const matchesSport =
      selectedSportLower === "all sports" || sportStr === selectedSportLower;

    console.log("Filtering match", match.id, {
      sportStr,
      selectedSportLower,
      matchesSport,
      matchesSearch,
    });

    return matchesSearch && matchesSport;
  });

  const joinedCount = matches.filter((m) => m.isJoined).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Debug Info */}
        <div className="mb-4 p-2 bg-red-900/20 border border-red-500/30 rounded text-xs">
          Debug: Loading: {loading.toString()} | Error: {error || 'None'} | Matches: {matches.length} | 
          Selected Sport: {selectedSport} | Search: '{searchQuery}' | Joined Count: {joinedCount} | 
          User ID: {getCurrentUserId() || 'Not found'}
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Matches
          </h1>
          <p className="mt-2 text-muted-foreground">
            Browse and join upcoming matches in your area
          </p>
        </div>

        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search matches..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <Select value={selectedSport} onValueChange={(value) => {
              console.log("Sport filter changed to:", value);
              setSelectedSport(value);
            }}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Filter by sport" />
              </SelectTrigger>
              <SelectContent>
                {sports.map((sport) => (
                  <SelectItem 
                    key={sport} 
                    value={sport}
                    onClick={() => {
                      console.log("Sport filter clicked:", sport);
                      setSelectedSport(sport);
                    }}
                  >
                    {sport}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{joinedCount}</span>{" "}
              match{joinedCount !== 1 && "es"} joined
            </div>

            <Button
              asChild
              size="sm"
              className="h-9 px-4"
            >
              <Link to="/create">Create Match</Link>
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="text-lg font-medium text-foreground">Loading matches...</div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="text-lg font-medium text-destructive">Error: {error}</div>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded"
            >
              Retry
            </button>
          </div>
        ) : filteredMatches.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
            <p className="text-lg font-medium text-foreground">
              No matches found
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try adjusting your search or filter criteria
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredMatches.map((match) => {
              console.log("Rendering match:", match);
              const matchId = match.id || match._id;
              console.log("Using match ID:", matchId, "from match:", match);

              if (!matchId) {
                console.error("Match has no ID:", match);
                return null;
              }

              return (
                <Card key={matchId} className="relative overflow-hidden transition-all hover:shadow-lg hover:shadow-primary/10">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        {(() => {
                          const SportIcon = sportIcons[match.sport];
                          return SportIcon ? (
                            <SportIcon className="w-5 h-5 text-primary" />
                          ) : (
                            <Circle className="w-5 h-5 text-primary" />
                          );
                        })()}
                        <h3 className="text-xl font-bold text-foreground capitalize">
                          {typeof match.sport === 'string' ? match.sport : 'Unknown sport'}
                        </h3>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">
                          {typeof match.currentParticipants === 'number' && typeof match.capacity === 'number' 
                            ? `${match.currentParticipants}/${match.capacity}`
                            : '0/0'
                          }
                        </div>
                        <div className="text-xs text-muted-foreground">players</div>
                      </div>
                    </div>

                    {match.datetime && (
                      <p className="text-sm text-muted-foreground mb-4 flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {match.datetime && typeof match.datetime === 'string' 
                          ? new Date(match.datetime).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Invalid date'
                        }
                      </p>
                    )}

                    <Button
                      onClick={() => handleToggleJoin(matchId)}
                      className={`w-full mt-4 ${
                        match.isJoined
                          ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                          : "bg-primary hover:bg-primary/90 text-primary-foreground"
                      }`}
                    >
                      {/* ALWAYS RENDER BOTH BUTTONS FOR DEBUGGING */}
                      {match.isJoined ? (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                          Leave Match
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Join Match
                        </>
                      )}
                    </Button>
                    
                    {/* ALWAYS SHOW DEBUG INFO */}
                    <div className="mt-2 p-2 bg-yellow-500/20 border border-yellow-500/50 rounded text-xs">
                      <div className="font-bold text-yellow-300">BUTTON DEBUG:</div>
                      <div>isJoined = {match.isJoined.toString()}</div>
                      <div>User: {getCurrentUserId() || 'null'}</div>
                      <div>JoinedMatches: {JSON.stringify(JSON.parse(localStorage.getItem("joinedMatches") || "[]"))}</div>
                      <div>MatchID: {matchId}</div>
                      <div>Button should show: {match.isJoined ? 'LEAVE' : 'JOIN'}</div>
                      <div>Button color: {match.isJoined ? 'RED' : 'BLUE'}</div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}