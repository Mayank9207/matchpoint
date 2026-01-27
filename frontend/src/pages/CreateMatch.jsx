import React, { useState } from "react";
import api from "../api/client";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { CalendarIcon, MapPinIcon, UsersIcon, TrophyIcon } from "lucide-react";

const sports = [
  "Soccer",
  "Basketball",
  "Tennis",
  "Volleyball",
  "Baseball",
  "Football",
  "Hockey",
  "Rugby",
  "Cricket",
  "Golf",
];

export default function CreateMatch() {
  const [formData, setFormData] = useState({
    sport: "",
    dateTime: "",
    capacity: "",
    latitude: "",
    longitude: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.sport || !formData.dateTime || !formData.capacity || !formData.latitude || !formData.longitude) {
      alert("Please fill in all fields");
      return;
    }
    
    if (Number(formData.capacity) < 2) {
      alert("Capacity must be at least 2 players");
      return;
    }
    
    console.log("Submitting form with data:", formData);
    
    try {
      const payload = {
        sport: formData.sport.toLowerCase(), // Ensure lowercase for consistency
        datetime: formData.dateTime,
        capacity: Number(formData.capacity),
        location: {
          lat: Number(formData.latitude),
          lng: Number(formData.longitude),
        },
      };
      
      console.log("Sending payload:", payload);
      
      const response = await api.post("/matches", payload);
      console.log("Response:", response.data);
      
      alert("Match created successfully!");
      // Reset form after success
      setFormData({
        sport: "",
        dateTime: "",
        capacity: "",
        latitude: "",
        longitude: "",
      });
      // Redirect to matches page to see the new match
      window.location.href = "/matches";
    } catch (err) {
      console.error("Error creating match:", err);
      console.error("Error response:", err.response?.data);
      alert(err.response?.data?.error || err.message || "Failed to create match. Please try again.");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <Card className="w-full max-w-md border border-border shadow-2xl shadow-primary/5">
        <CardHeader className="pb-4">
          <CardTitle className="text-xl font-medium">Create Match</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Sport Selection */}
            <div className="space-y-2">
              <Label htmlFor="sport" className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                <TrophyIcon className="h-4 w-4" />
                Sport (Current: {formData.sport || 'None'})
              </Label>
              <Select
                value={formData.sport}
                onValueChange={(value) => {
                  console.log("Sport selected:", value);
                  setFormData({ ...formData, sport: value });
                }}
              >
                <SelectTrigger id="sport" className="h-11">
                  <SelectValue placeholder="Select a sport" />
                </SelectTrigger>
                <SelectContent>
                  {sports.map((sport) => (
                    <SelectItem 
                      key={sport} 
                      value={sport.toLowerCase()}
                      onClick={() => {
                        console.log("Sport clicked:", sport.toLowerCase());
                        setFormData({ ...formData, sport: sport.toLowerCase() });
                      }}
                    >
                      {sport}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Date & Time */}
            <div className="space-y-2">
              <Label htmlFor="dateTime" className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                <CalendarIcon className="h-4 w-4" />
                Date & Time
              </Label>
              <Input
                id="dateTime"
                type="datetime-local"
                className="h-11"
                value={formData.dateTime}
                onChange={(e) => setFormData({ ...formData, dateTime: e.target.value })}
              />
            </div>

            {/* Capacity */}
            <div className="space-y-2">
              <Label htmlFor="capacity" className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                <UsersIcon className="h-4 w-4" />
                Capacity
              </Label>
              <Input
                id="capacity"
                type="number"
                placeholder="Number of players"
                className="h-11"
                min="2"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
              />
            </div>

            {/* Location */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                <MapPinIcon className="h-4 w-4" />
                Location
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  id="latitude"
                  type="number"
                  step="any"
                  placeholder="Latitude"
                  className="h-11"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                />
                <Input
                  id="longitude"
                  type="number"
                  step="any"
                  placeholder="Longitude"
                  className="h-11"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                />
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full h-11 mt-6"
              disabled={!formData.sport || !formData.dateTime || !formData.capacity || !formData.latitude || !formData.longitude}
            >
              Create Match
            </Button>
            <p className="mt-4 text-xs text-muted-foreground text-center">
              Tip: Use Google Maps to find precise coordinates for your match location.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}