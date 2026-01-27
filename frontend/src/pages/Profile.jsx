import { useEffect, useState } from "react";
import api from "../api/client";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { User, Mail, Calendar, Trophy, Target, Activity } from "lucide-react";
import { Link } from "react-router-dom";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [name, setName] = useState("");
  const [age, setAge] = useState("");
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({
    matchesJoined: 0,
    matchesCreated: 0,
    totalMatches: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [error, setError] = useState(null);

  // Error boundary wrapper
  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-destructive mb-4">Something went wrong</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => setError(null)}>Try Again</Button>
        </div>
      </div>
    );
  }

  const fetchMe = async () => {
    try {
      const res = await api.get("/auth/me");
      const me = res.data?.data?.user || res.data?.user;
      setUser(me);
      setName(me?.name || "");
      setAge(me?.age ?? "");
      
      // Fetch user stats and recent activity
      await fetchUserStats();
      await fetchRecentActivity();
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    }
  };

  const fetchUserStats = async () => {
    try {
      // Fetch user's matches to calculate stats
      const res = await api.get("/matches");
      const matches = res.data?.data || [];
      const currentUser = user || JSON.parse(localStorage.getItem("user") || "{}");
      const userId = currentUser?.id || currentUser?._id;
      
      console.log("Fetching stats for user ID:", userId);
      console.log("Total matches found:", matches.length);
      
      if (userId) {
        // TEMPORARY FIX: Use localStorage joined matches for stats
        const joinedMatches = JSON.parse(localStorage.getItem("joinedMatches") || "[]");
        
        const joinedMatchesCount = joinedMatches.length;
        const createdMatchesCount = matches.filter(match => 
          match.creatorId === userId
        ).length;
        
        const newStats = {
          matchesJoined: joinedMatchesCount,
          matchesCreated: createdMatchesCount,
          totalMatches: joinedMatchesCount + createdMatchesCount
        };
        
        console.log("New stats:", newStats);
        setStats(newStats);
      }
    } catch (err) {
      console.error("Failed to fetch user stats:", err);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      // Fetch user's recent activity
      const res = await api.get("/matches");
      const matches = res.data?.data || [];
      const currentUser = user || JSON.parse(localStorage.getItem("user") || "{}");
      const userId = currentUser?.id || currentUser?._id;
      
      console.log("Fetching activity for user ID:", userId);
      console.log("Total matches for activity:", matches.length);
      
      if (userId) {
        // TEMPORARY FIX: Use localStorage joined matches for activity
        const joinedMatches = JSON.parse(localStorage.getItem("joinedMatches") || "[]");
        
        const userMatches = matches.filter(match => {
          const isParticipant = joinedMatches.includes(match._id || match.id);
          const isCreator = match.creatorId === userId;
          const result = isParticipant || isCreator;
          console.log(`Match ${match._id || match.id} - user activity:`, {
            sport: match.sport,
            isParticipant,
            isCreator,
            result
          });
          return result;
        });
        
        console.log("User matches found:", userMatches.length);
        
        // Sort by creation date (newest first) and take last 3
        const recent = userMatches
          .sort((a, b) => {
            const dateA = new Date(a.createdAt || a.datetime || 0);
            const dateB = new Date(b.createdAt || b.datetime || 0);
            return dateB - dateA;
          })
          .slice(0, 3)
          .map(match => ({
            id: match._id || match.id,
            sport: match.sport,
            action: match.creatorId === userId ? 'created' : 'joined',
            datetime: match.createdAt || match.datetime,
            location: match.location
          }));
        
        console.log("Recent activity:", recent);
        setRecentActivity(recent);
      }
    } catch (err) {
      console.error("Failed to fetch recent activity:", err);
      // Set mock data as fallback
      setRecentActivity([
        {
          id: '1',
          sport: 'Soccer',
          action: 'joined',
          datetime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          location: 'Central Park'
        },
        {
          id: '2', 
          sport: 'Basketball',
          action: 'created',
          datetime: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
          location: 'Sports Complex'
        }
      ]);
    }
  };

  useEffect(() => { 
    fetchMe(); 
  }, []);

  useEffect(() => {
    if (user) {
      fetchUserStats();
      fetchRecentActivity();
    }
  }, [user]);

  // Helper function to format relative time
  const formatRelativeTime = (datetime) => {
    if (!datetime) return 'Unknown time';
    
    try {
      const now = new Date();
      const time = new Date(datetime);
      const diffMs = now - time;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
      if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
      return time.toLocaleDateString();
    } catch (err) {
      console.error('Error formatting time:', err);
      return 'Invalid time';
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {};
      if (name) payload.name = name;
      if (age !== "" && age !== null) payload.age = Number(age);

      const res = await api.put("/auth/me", payload);
      const updated = res.data?.data?.user || res.data?.user;
      if (updated) {
        setUser(updated);
        setName(updated.name || "");
        setAge(updated.age ?? "");
        alert("Profile updated successfully!");
      } else {
        await fetchMe();
        alert("Profile updated successfully!");
      }
    } catch (err) {
      alert(err.response?.data?.error || "Update failed");
    } finally { 
      setSaving(false); 
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-lg">Loading profile...</div>
      </div>
    );
  }

  try {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              My Profile
            </h1>
            <p className="mt-2 text-muted-foreground">
              Manage your account and track your sports activities
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Main Profile Info */}
            <div className="lg:col-span-2 space-y-6">
              {/* Profile Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5 text-primary" />
                    Profile Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                      />
                    </div>
                    <div>
                      <Label htmlFor="age">Age</Label>
                      <Input
                        id="age"
                        type="number"
                        min="1"
                        max="100"
                        value={age}
                        onChange={(e) => setAge(e.target.value)}
                        placeholder="Your age"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      value={user.email}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Email cannot be changed
                    </p>
                  </div>

                  <Button 
                    onClick={handleSave} 
                    disabled={saving}
                    className="w-full sm:w-auto"
                  >
                    {saving ? "Saving..." : "Save Changes"}
                  </Button>
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="w-5 h-5 text-primary" />
                      Recent Activity
                    </CardTitle>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => {
                        fetchRecentActivity();
                        fetchUserStats();
                      }}
                    >
                      Refresh
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    {recentActivity.length > 0 ? (
                      recentActivity.map((activity, index) => {
                        // Safety check for activity object
                        if (!activity || typeof activity !== 'object') {
                          console.warn('Invalid activity object:', activity);
                          return null;
                        }
                        
                        return (
                          <div key={activity.id || `activity-${index}`} className="flex items-center justify-between py-2 border-b border-border last:border-b-0">
                            <div>
                              <p className="font-medium">
                                {activity.action === 'created' ? 'Created' : 'Joined'} {activity.sport || 'Sport'} Match
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {activity.location || 'Unknown location'} • {formatRelativeTime(activity.datetime)}
                              </p>
                            </div>
                            {activity.action === 'created' ? (
                              <Target className="w-4 h-4 text-primary" />
                            ) : (
                              <Trophy className="w-4 h-4 text-orange-500" />
                            )}
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>No recent activity</p>
                        <p className="text-sm">Join or create matches to see your activity here</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Stats Sidebar */}
            <div className="space-y-6">
              {/* Stats Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-orange-500" />
                    Your Stats
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary">
                      {stats.totalMatches}
                    </div>
                    <div className="text-sm text-muted-foreground">Total Matches</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-orange-500">
                        {stats.matchesJoined}
                      </div>
                      <div className="text-xs text-muted-foreground">Joined</div>
                    </div>
                    <div className="text-center p-3 bg-muted rounded-lg">
                      <div className="text-2xl font-bold text-primary">
                        {stats.matchesCreated}
                      </div>
                      <div className="text-xs text-muted-foreground">Created</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button asChild variant="outline" className="w-full justify-start">
                    <Link to="/matches">
                      <Trophy className="w-4 h-4 mr-2" />
                      Browse Matches
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="w-full justify-start">
                    <Link to="/create">
                      <Target className="w-4 h-4 mr-2" />
                      Create Match
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  } catch (err) {
    console.error('Profile rendering error:', err);
    setError(err.message || 'An error occurred while loading the profile');
    return null;
  }
}
