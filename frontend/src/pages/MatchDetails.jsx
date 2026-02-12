import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../api/client";
import { Button } from "../components/ui/button";
import { Card, CardContent } from "../components/ui/card";
import {
  Calendar,
  Clock,
  MapPin,
  Users,
  User,
  ArrowLeft,
  Loader2,
  Eye,
  Image as ImageIcon,
} from "lucide-react";

export default function MatchDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [match, setMatch] = useState(null);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState(null);

  /* ---------------- Fetch current user ---------------- */
  useEffect(() => {
    api
      .get("/auth/me")
      .then((res) => setMe(res.data.data.user))
      .catch(() => setMe(null));
  }, []);

  /* ---------------- Fetch match ---------------- */
  const fetchMatch = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get(`/matches/${id}`);
      setMatch(res.data.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.error || "Failed to load match");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchMatch();
  }, [fetchMatch]);

  /* ---------------- Derived state ---------------- */
  const userJoined =
    me &&
    match?.participants?.some(
      (p) => String(p.user?._id || p.user) === String(me._id)
    );

  const matchFull =
    match?.participants?.length >= match?.capacity;

  const isHost=
    me && String(match.host?._id) === String(me._id);

  /* ---------------- Actions ---------------- */
  const handleJoin = async () => {
    setActionLoading(true);
    try {
      await api.post(`/matches/${id}/join`);
      await fetchMatch();
    } catch (err) {
      alert(err.response?.data?.error || "Join failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeave = async () => {
    setActionLoading(true);
    try {
      await api.post(`/matches/${id}/leave`);
      await fetchMatch();
    } catch (err) {
      alert(err.response?.data?.error || "Leave failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelMatch = async () => {
    setActionLoading(true);
    try {
      await api.patch(`/matches/${id}`, { action: "cancel" });
      await fetchMatch();
    } catch (err) {
      alert(err.response?.data?.error || "Cancel failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReschedule = async (newDateTime) => {
    setActionLoading(true);
    try {
      await api.patch(`/matches/${id}`, {
        action: "reschedule",
        datetime: newDateTime,
      });
      await fetchMatch();
    } catch (err) {
      alert(err.response?.data?.error || "Update failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateCapacity = async (newCapacity) => {
    setActionLoading(true);
    try{
      await api.patch(`/matches/${id}`, {
        action: "update_capacity",
        capacity: newCapacity,
      });
      await fetchMatch();
    } catch (err) {
      alert(err.response?.data?.error || "Update failed");
    } finally {
      setActionLoading(false);
    }
  }
  /* ---------------- States ---------------- */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !match) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-lg font-medium">{error || "Match not found"}</div>
          <Button onClick={() => navigate("/matches")} variant="outline">
            Back to Matches
          </Button>
        </div>
      </div>
    );
  }



  /* ---------------- UI ---------------- */
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="max-w-6xl mx-auto px-4 py-8">
        <Button
          onClick={() => navigate("/matches")}
          variant="outline"
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Matches
        </Button>

        {/* Header */}
        <div className="mb-8 flex flex-col lg:flex-row lg:justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">
              {match.title || `${match.sport} Match`}
            </h1>
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {new Date(match.datetime).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {new Date(match.datetime).toLocaleTimeString()}
              </span>
              <span className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                {match.participants.length}/{match.capacity}
              </span>
            </div>
          </div>

          <Button
            size="lg"
            disabled={actionLoading || (!userJoined && matchFull)}
            onClick={userJoined ? handleLeave : handleJoin}
            className={
              userJoined
                ? "bg-destructive hover:bg-destructive/90"
                : "bg-primary hover:bg-primary/90"
            }
          >
            {actionLoading && (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            )}
            {userJoined
              ? "Leave Match"
              : matchFull
              ? "Match Full"
              : "Join Match"}
          </Button>
        </div>

        {isHost && match.status === "scheduled" && (
  <div className="mt-4 flex gap-3">
    <Button
      variant="outline"
      onClick={handleCancelMatch}
      disabled={actionLoading}
    >
      Cancel Match
    </Button>

    {/* TEMP placeholders */}
    <Button
      variant="outline"
      onClick={() => {
        const d = prompt("Enter new datetime (ISO)");
        if (d) handleReschedule(d);
      }}
    >
      Reschedule
    </Button>

    <Button
      variant="outline"
      onClick={() => {
        const c = prompt("New capacity");
        if (c) handleUpdateCapacity(c);
      }}
    >
      Update Capacity
    </Button>
  </div>
)}


        {/* Content */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardContent className="p-6 space-y-3">
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  <span>
                    {match.location?.coordinates
                      ? `Lat ${match.location.coordinates[1]}, Lng ${match.location.coordinates[0]}`
                      : "Location not specified"}
                  </span>
                </div>
                <div>
                  Age: {match.age.minAge} – {match.age.maxAge}
                </div>
                <div>Gender: {match.gender}</div>
              </CardContent>
            </Card>

            {match.description && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="font-semibold mb-2">Description</h2>
                  <p className="text-muted-foreground">
                    {match.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {Array.isArray(match.images) && match.images.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h2 className="font-semibold mb-4 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" /> Images
                  </h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {match.images.map((img, i) => (
                      <img
                        key={i}
                        src={img}
                        alt="Match"
                        className="h-32 w-full object-cover rounded"
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <h2 className="font-semibold mb-3">Host</h2>
                <div className="flex items-center gap-3">
                  <User className="w-5 h-5" />
                  <div>
                    <div>{match.host?.name || "Unknown"}</div>
                    <div className="text-xs text-muted-foreground">
                      {match.host?.email || ""}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6 space-y-2">
                <div className="flex justify-between">
                  <span>Status</span>
                  <span className="capitalize">{match.status}</span>
                </div>
                <div className="flex justify-between">
                  <span>Visibility</span>
                  <span className="capitalize">{match.visibility}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
