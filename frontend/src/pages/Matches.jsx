import React, { useState, useEffect, useCallback } from "react";
import api from "../api/client";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Link, useNavigate } from "react-router-dom";
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
  Users,
  MapPin,
  Calendar,
  Clock
} from "lucide-react";
import useGoogleMaps from "../hooks/useGoogleMaps";

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

const distanceOptions = [
  { label: "Any distance", value: "any" },
  { label: "Within 2 km", value: "2" },
  { label: "Within 5 km", value: "5" },
  { label: "Within 10 km", value: "10" },
  { label: "Within 25 km", value: "25" },
  { label: "Within 50 km", value: "50" },
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
  const navigate = useNavigate();
  const {
    googleReady,
    loadError: mapsError,
    geocodeText,
    reverseGeocode,
  } = useGoogleMaps({ loader: { language: "en" } });
  const [matches, setMatches] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSport, setSelectedSport] = useState("All Sports");
  const [distanceFilter, setDistanceFilter] = useState("any");
  const [userLocation, setUserLocation] = useState(() => {
    if (typeof window === "undefined") return null;
    try {
      const saved = JSON.parse(localStorage.getItem("user_location") || "null");
      if (saved && Number.isFinite(saved.lat) && Number.isFinite(saved.lng)) {
        return { lat: saved.lat, lng: saved.lng };
      }
    } catch (err) {
      console.error("Failed to read saved location:", err);
    }
    return null;
  });
  const [locationStatus, setLocationStatus] = useState("idle");
  const [locationError, setLocationError] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [locationSearch, setLocationSearch] = useState("");
  const [resolvingLocation, setResolvingLocation] = useState(false);
  const [resolvedAddresses, setResolvedAddresses] = useState({});

  const [currentUserId, setCurrentUserId] = useState(null);

  const fallbackUserId = useCallback(() => {
    try {
      const user = JSON.parse(localStorage.getItem("user") || "null");
      return user?.id || user?._id || null;
    } catch (err) {
      console.error("Error getting user ID from storage:", err);
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadMe() {
      try {
        const res = await api.get("/auth/me");
        const user = res.data?.data?.user || res.data?.user;
        if (!cancelled) {
          setCurrentUserId(user?._id || user?.id || null);
        }
      } catch (err) {
        if (!cancelled) {
          setCurrentUserId(fallbackUserId());
        }
      }
    }

    loadMe();
    return () => {
      cancelled = true;
    };
  }, [fallbackUserId]);

  const requestLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationStatus("unsupported");
      setLocationError("Geolocation is not supported in this browser.");
      return;
    }

    setLocationStatus("loading");
    setLocationError("");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(nextLocation);
        setLocationStatus("granted");
        try {
          localStorage.setItem(
            "user_location",
            JSON.stringify({ ...nextLocation, savedAt: Date.now() })
          );
        } catch (err) {
          console.error("Failed to persist location:", err);
        }
      },
      (err) => {
        console.error("Location error:", err);
        setLocationStatus("denied");
        setLocationError(err.message || "Location permission was denied.");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000,
      }
    );
  };

  const haversineKm = (from, to) => {
    if (!from || !to) return null;
    const toRad = (value) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(to.lat - from.lat);
    const dLng = toRad(to.lng - from.lng);
    const lat1 = toRad(from.lat);
    const lat2 = toRad(to.lat);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  };

  const formatDistance = (km) => {
    if (!Number.isFinite(km)) return null;
    if (km < 1) return `${Math.round(km * 1000)} m`;
    return `${km.toFixed(1)} km`;
  };

  const getLocationLabel = (match) => {
    const matchId = match._id || match.id;
    if (matchId && resolvedAddresses[matchId]) return resolvedAddresses[matchId];
    if (typeof match.location === "string") {
      return match.location;
    }
    if (match.locationDetails) {
      const { address, locality, city, state, pincode } = match.locationDetails;
      const parts = [address, locality, city, state, pincode].filter(Boolean);
      if (parts.length > 0) return parts.join(", ");
    }
    const coords = match.location?.coordinates;
    if (Array.isArray(coords) && coords.length === 2) {
      const lat = coords[1];
      const lng = coords[0];
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return `Lat ${lat.toFixed(3)}, Lng ${lng.toFixed(3)}`;
      }
    }
    return "";
  };

  const getMatchDistanceKm = (match) => {
    if (Number.isFinite(match.distanceKm)) {
      return match.distanceKm;
    }
    if (!userLocation) return null;
    const coords = match.location?.coordinates;
    if (!Array.isArray(coords) || coords.length !== 2) return null;
    const lat = coords[1];
    const lng = coords[0];
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return haversineKm(userLocation, { lat, lng });
  };

  const fetchMatches = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      const shouldUseGeo = userLocation && distanceFilter !== "any";

      if (selectedSport && selectedSport !== "All Sports") {
        params.set("sport", selectedSport.toLowerCase());
      }

      if (shouldUseGeo) {
        params.set("lat", userLocation.lat);
        params.set("lng", userLocation.lng);
        params.set("radius", distanceFilter);
        params.set("sort", "distance");
      }

      const query = params.toString();
      const url = query ? `/matches?${query}` : "/matches";
      const res = await api.get(url);
      const matchesData = res.data?.data || [];
      const userId = currentUserId;

      const matchesWithJoinStatus = matchesData.map((match) => {
        const participantIds = match.participants?.map(
          (p) => p.user?._id || p.user
        );
        const isJoined =
          userId && participantIds?.some((id) => String(id) === String(userId));

        return {
          ...match,
          isJoined: Boolean(isJoined),
          currentParticipants:
            match.participants?.length ?? match.currentParticipants ?? 0,
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
  }, [selectedSport, distanceFilter, userLocation, currentUserId]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  useEffect(() => {
    if (distanceFilter === "any") return;
    if (userLocation || locationStatus === "loading") return;
    requestLocation();
  }, [distanceFilter, userLocation, locationStatus]);

  // Reverse geocode matches lacking human-readable locations
  useEffect(() => {
    if (!googleReady) return;
    const pending = matches.filter((m) => {
      const id = m._id || m.id;
      const coords = m.location?.coordinates;
      return (
        id &&
        Array.isArray(coords) &&
        coords.length === 2 &&
        !resolvedAddresses[id] &&
        !m.locationDetails?.address &&
        !m.locationDetails?.city
      );
    });

    pending.forEach(async (match) => {
      const id = match._id || match.id;
      const coords = match.location.coordinates;
      try {
        const res = await reverseGeocode({ lat: coords[1], lng: coords[0] });
        if (res?.formattedAddress) {
          setResolvedAddresses((prev) => ({ ...prev, [id]: res.formattedAddress }));
        }
      } catch (err) {
        console.error("Reverse geocode failed for match", id, err);
      }
    });
  }, [matches, resolvedAddresses, reverseGeocode, googleReady]);

  const resolveLocationFromText = async () => {
    if (!locationSearch?.trim()) return;
    try {
      setResolvingLocation(true);
      const res = await geocodeText(locationSearch.trim());
      if (!res) {
        setLocationError("Could not resolve that place. Try a more specific query.");
        return;
      }
      const next = { lat: res.lat, lng: res.lng };
      setUserLocation(next);
      setLocationStatus("manual");
      setLocationError("");
      localStorage.setItem(
        "user_location",
        JSON.stringify({ ...next, savedAt: Date.now(), source: "manual" })
      );
    } catch (err) {
      console.error("Manual location resolve failed:", err);
      setLocationError("Manual location lookup failed.");
    } finally {
      setResolvingLocation(false);
    }
  };

  const handleToggleJoin = async (id) => {
    if (!id || id === "undefined" || id === undefined) {
      alert("Invalid match ID. Please refresh the page.");
      return;
    }

    if (!currentUserId || currentUserId === "undefined" || currentUserId === undefined) {
      alert("User not logged in. Please log in again.");
      return;
    }

    try {
      const match = matches.find((m) => (m.id === id || m._id === id));
      if (!match) {
        alert("Match not found. Please refresh the page.");
        return;
      }

      const isJoining = !match.isJoined;

      if (isJoining) {
        await api.post(`/matches/${id}/join`);
      } else {
        await api.post(`/matches/${id}/leave`);
      }

      await fetchMatches();
    } catch (err) {
      console.error("Failed to toggle join status:", err);
      alert(err.response?.data?.error || "Failed to update match status. Please try again.");
    }
  };

  const filteredMatches = matches.filter((match) => {
    const sportStr = typeof match.sport === "string" ? match.sport.toLowerCase() : "";
    const titleStr = typeof match.title === "string" ? match.title.toLowerCase() : "";
    const locationLabel = getLocationLabel(match);
    const locationStr = locationLabel ? locationLabel.toLowerCase() : "";
    const selectedSportLower = selectedSport.toLowerCase();
    const query = searchQuery.toLowerCase();

    const matchesSearch =
      sportStr.includes(query) ||
      titleStr.includes(query) ||
      locationStr.includes(query);
    const matchesSport =
      selectedSportLower === "all sports" || sportStr === selectedSportLower;

    return matchesSearch && matchesSport;
  });

  const distanceLimitKm =
    distanceFilter !== "any" && userLocation ? Number(distanceFilter) : null;

  const matchesForRender = filteredMatches
    .map((match) => ({
      ...match,
      _distanceKm: getMatchDistanceKm(match),
    }))
    .filter((match) => {
      if (!Number.isFinite(distanceLimitKm)) return true;
      return Number.isFinite(match._distanceKm) && match._distanceKm <= distanceLimitKm;
    })
    .sort((a, b) => {
      if (!Number.isFinite(distanceLimitKm)) return 0;
      if (!Number.isFinite(a._distanceKm) || !Number.isFinite(b._distanceKm)) return 0;
      return a._distanceKm - b._distanceKm;
    });

  const joinedCount = matches.filter((m) => m.isJoined).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="w-full px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Matches
          </h1>
          <p className="mt-2 text-muted-foreground">
            Browse and join upcoming matches in your area
          </p>
        </div>

        <div className="mb-6 space-y-3">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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

              <Select value={distanceFilter} onValueChange={(value) => setDistanceFilter(value)}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Distance" />
                </SelectTrigger>
                <SelectContent>
                  {distanceOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="text-sm text-muted-foreground">
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

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1">
              <span className={`h-2 w-2 rounded-full ${userLocation ? "bg-primary" : "bg-muted-foreground"}`} />
              {userLocation ? "Location enabled" : locationStatus === "loading" ? "Locating..." : "Location off"}
            </span>
            {distanceFilter !== "any" && !userLocation && (
              <span className="text-destructive">Enable location to filter by distance.</span>
            )}
            {locationError && (
              <span className="text-destructive">{locationError}</span>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={requestLocation}
              disabled={locationStatus === "loading"}
            >
              {userLocation ? "Update location" : "Use my location"}
            </Button>
            <div className="flex items-center gap-2">
              <Input
                placeholder="Or type city/locality"
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                className="h-7 w-44"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-3 text-xs"
                onClick={resolveLocationFromText}
                disabled={resolvingLocation || !googleReady}
              >
                {resolvingLocation ? "Resolving..." : "Set"}
              </Button>
            </div>
            {mapsError && (
              <span className="text-destructive">{mapsError}</span>
            )}
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
        ) : matchesForRender.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16">
            <p className="text-lg font-medium text-foreground">
              No matches found
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {distanceFilter !== "any" && !userLocation
                ? "Enable location to filter by distance."
                : "Try adjusting your search or filter criteria"}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {matchesForRender.map((match) => {
              const matchId = match.id || match._id;
              const distanceLabel = formatDistance(match._distanceKm);
              const locationLabel = getLocationLabel(match);

              if (!matchId) {
                return null;
              }

              return (
                <Card 
                  key={matchId} 
                  className="group relative overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1 cursor-pointer bg-card border-border"
                >
                  <CardContent className="p-6">
                    <div onClick={() => navigate(`/matches/${matchId}`)} className="block">
                      {/* Sport Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                            {(() => {
                              const SportIcon = sportIcons[match.sport];
                              return SportIcon ? (
                                <SportIcon className="w-5 h-5 text-primary" />
                              ) : (
                                <Circle className="w-5 h-5 text-primary" />
                              );
                            })()}
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-foreground capitalize">
                              {typeof match.sport === 'string' ? match.sport : 'Unknown sport'}
                            </h3>
                            <div className="text-sm text-muted-foreground">
                              {match.age?.minAge || 18}-{match.age?.maxAge || 100} years
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xl font-bold text-primary">
                            {typeof match.currentParticipants === 'number' && typeof match.capacity === 'number' 
                              ? `${match.currentParticipants}/${match.capacity}`
                              : '0/0'
                            }
                          </div>
                          <div className="text-xs text-muted-foreground">players</div>
                        </div>
                      </div>

                      {/* Date & Time */}
                      {match.datetime && (
                        <div className="mb-4">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="w-4 h-4" />
                            {new Date(match.datetime).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric'
                            })}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                            <Clock className="w-4 h-4" />
                            {new Date(match.datetime).toLocaleTimeString(undefined, {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </div>
                        </div>
                      )}

                      {(locationLabel || distanceLabel) && (
                        <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                          <div className="flex min-w-0 items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            <span className="truncate">
                              {locationLabel || "Location not specified"}
                            </span>
                          </div>
                          {distanceLabel && (
                            <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
                              {distanceLabel} away
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Join/Leave Button */}
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleJoin(matchId);
                      }}
                      className={`w-full transition-colors ${
                        match.isJoined
                          ? "bg-destructive hover:bg-destructive/90 text-destructive-foreground"
                          : "bg-primary hover:bg-primary/90 text-primary-foreground"
                      }`}
                    >
                      {match.isJoined ? (
                        <>
                          <Users className="w-4 h-4 mr-2" />
                          Leave Match
                        </>
                      ) : (
                        <>
                          <Users className="w-4 h-4 mr-2" />
                          Join Match
                        </>
                      )}
                    </Button>
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
