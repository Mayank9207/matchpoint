import React, { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
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
import { Card, CardContent } from "../components/ui/card";
import { X, Plus, Loader2 } from "lucide-react";
import useGoogleMaps from "../hooks/useGoogleMaps";

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

console.log("Maps key:", import.meta.env.VITE_GOOGLE_MAPS_API_KEY);


export default function CreateMatch() {
  const navigate = useNavigate();
  const {
    googleReady,
    google,
    loadError: mapsError,
    geocodeText,
    parseAddressComponents,
  } = useGoogleMaps({
    loader: {
      language: "en",
    },
  });
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [usingPlaceElement, setUsingPlaceElement] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    sport: "",
    dateTime: "",
    capacity: "",
    gender: "any",
    minAge: "18",
    maxAge: "100",
    description: "",
    latitude: "",
    longitude: "",
    locationDetails: {
      address: "",
      locality: "",
      city: "",
      state: "",
      pincode: "",
    },
  });
  const [images, setImages] = useState([]);
  const [imageInput, setImageInput] = useState("");
  const [searchValue, setSearchValue] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(null);
  const searchInputRef = useRef(null);
  const placeElementContainerRef = useRef(null);
  const placeElementRef = useRef(null);

  const setLocationFromLatLng = useCallback(
    (lat, lng, components, formattedAddress) => {
      const parsed = parseAddressComponents(components || []);
      setFormData((prev) => ({
        ...prev,
        latitude: lat.toString(),
        longitude: lng.toString(),
        locationDetails: {
          address: parsed.address || formattedAddress || "",
          locality: parsed.locality || parsed.city || "",
          city: parsed.city || "",
          state: parsed.state || "",
          pincode: parsed.pincode || "",
        },
      }));
      setSelectedLocation({
        formatted: formattedAddress,
        lat,
        lng,
        parsed,
      });
    },
    [parseAddressComponents]
  );

  // Initialize PlaceAutocompleteElement when available (preferred API)
  useEffect(() => {
    if (!googleReady || !google || !placeElementContainerRef.current) return;
    const PlaceAutocompleteElement = google.maps?.places?.PlaceAutocompleteElement;
    if (!PlaceAutocompleteElement || placeElementRef.current) return;

    const element = new PlaceAutocompleteElement({
      requestedLanguage: "en",
    });
    element.className =
      "w-full h-10 px-3 py-2 text-sm border border-input bg-background rounded-md ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
    element.placeholder = "Search for a location (address, city, landmark...)";

    const handleSelect = async (event) => {
      try {
        const place =
          event?.place ||
          (event?.placePrediction?.toPlace ? event.placePrediction.toPlace() : null);
        if (!place) return;

        if (place.fetchFields) {
          await place.fetchFields({
            fields: [
              "location",
              "addressComponents",
              "formattedAddress",
              "displayName",
            ],
          });
        }

        const location = place.location;
        if (!location) return;
        const lat = typeof location.lat === "function" ? location.lat() : location.lat;
        const lng = typeof location.lng === "function" ? location.lng() : location.lng;
        const components = place.addressComponents || place.address_components || [];
        const formatted =
          place.formattedAddress ||
          place.formatted_address ||
          place.displayName ||
          "";

        setSearchValue(formatted);
        setLocationFromLatLng(lat, lng, components, formatted);
      } catch (err) {
        console.error("PlaceAutocompleteElement select error:", err);
      }
    };

    element.addEventListener("gmp-placeselect", handleSelect);
    element.addEventListener("gmp-select", handleSelect);

    placeElementContainerRef.current.innerHTML = "";
    placeElementContainerRef.current.appendChild(element);
    placeElementRef.current = element;
    setUsingPlaceElement(true);

    return () => {
      element.removeEventListener("gmp-placeselect", handleSelect);
      element.removeEventListener("gmp-select", handleSelect);
      if (placeElementContainerRef.current?.contains(element)) {
        placeElementContainerRef.current.removeChild(element);
      }
      placeElementRef.current = null;
      setUsingPlaceElement(false);
    };
  }, [googleReady, google, setLocationFromLatLng]);

  const resolveManualLocation = async () => {
    if (!searchValue?.trim()) return;
    try {
      setGeocoding(true);
      const result = await geocodeText(searchValue.trim());
      if (!result) {
        alert("Could not resolve that location. Try a more specific query.");
        return;
      }
      setLocationFromLatLng(
        result.lat,
        result.lng,
        result.components,
        result.formattedAddress
      );
    } catch (err) {
      console.error("Manual geocode failed:", err);
      alert("Failed to resolve location. Check your query or try again.");
    } finally {
      setGeocoding(false);
    }
  };

  const addImage = () => {
    if (imageInput.trim()) {
      setImages((prev) => [...prev, imageInput.trim()]);
      setImageInput("");
    }
  };

  const removeImage = (index) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (
      !formData.sport ||
      !formData.dateTime ||
      !formData.capacity ||
      !formData.latitude ||
      !formData.longitude
    ) {
      alert(
        "Please fill in all required fields: Sport, Date & Time, Capacity, and Location"
      );
      setLoading(false);
      return;
    }

    const capacityNum = Number(formData.capacity);
    if (!Number.isFinite(capacityNum) || capacityNum < 2 || capacityNum > 22) {
      alert("Capacity must be between 2 and 22 players");
      setLoading(false);
      return;
    }

    try {
      const latitudeNum = Number(formData.latitude);
      const longitudeNum = Number(formData.longitude);
      if (!Number.isFinite(latitudeNum) || !Number.isFinite(longitudeNum)) {
        alert("Latitude and longitude must be valid numbers.");
        setLoading(false);
        return;
      }

      const payload = {
        title: formData.title,
        sport: formData.sport.toLowerCase(),
        datetime: formData.dateTime,
        capacity: capacityNum,
        gender: formData.gender,
        age: {
          minAge: Number(formData.minAge),
          maxAge: Number(formData.maxAge),
        },
        description: formData.description,
        images,
        location: {
          lat: latitudeNum,
          lng: longitudeNum,
          // Include GeoJSON shape to align with 2dsphere expectations
          type: "Point",
          coordinates: [longitudeNum, latitudeNum],
        },
        locationDetails: formData.locationDetails,
      };

      console.log("Sending payload:", payload);

      const response = await api.post("/matches", payload);
      console.log("Response:", response.data);

      alert("Match created successfully!");
      setFormData({
        title: "",
        sport: "",
        dateTime: "",
        capacity: "",
        gender: "any",
        minAge: "18",
        maxAge: "100",
        description: "",
        latitude: "",
        longitude: "",
        locationDetails: {
          address: "",
          locality: "",
          city: "",
          state: "",
          pincode: "",
        },
      });
      setSearchValue("");
      setSelectedLocation(null);
      setImages([]);
      navigate("/matches");
    } catch (err) {
      console.error("Error creating match:", err);
      console.error("Error response:", err.response?.data);
      alert(
        err.response?.data?.error ||
          err.message ||
          "Failed to create match. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="w-full px-4 py-8 sm:px-6 lg:px-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Create Match
            </h1>
            <p className="mt-2 text-muted-foreground">
              Set up a new sports match for others to join
            </p>
          </div>

          <Card>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Match Title</Label>
                  <Input
                    id="title"
                    placeholder="Enter match title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sport">Sport</Label>
                  <select
                    id="sport"
                    value={formData.sport}
                    onChange={(e) => {
                      setFormData({ ...formData, sport: e.target.value });
                    }}
                    className="w-full h-10 px-3 py-2 text-sm border border-input bg-background rounded-md ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <option value="">Select a sport</option>
                    {sports.map((sport) => (
                      <option key={sport.toLowerCase()} value={sport.toLowerCase()}>
                        {sport}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dateTime">Date & Time</Label>
                  <Input
                    id="dateTime"
                    type="datetime-local"
                    value={formData.dateTime}
                    onChange={(e) =>
                      setFormData({ ...formData, dateTime: e.target.value })
                    }
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="capacity">Capacity</Label>
                    <Input
                      id="capacity"
                      type="number"
                      placeholder="Number of players"
                      min="2"
                      max="22"
                      value={formData.capacity}
                      onChange={(e) =>
                        setFormData({ ...formData, capacity: e.target.value })
                      }
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gender">Gender</Label>
                    <Select
                      value={formData.gender}
                      onValueChange={(value) =>
                        setFormData({ ...formData, gender: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="any">Any</SelectItem>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="mixed">Mixed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Age Range</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label
                        htmlFor="minAge"
                        className="text-sm text-muted-foreground"
                      >
                        Min Age
                      </Label>
                      <Input
                        id="minAge"
                        type="number"
                        min="1"
                        max="100"
                        value={formData.minAge}
                        onChange={(e) =>
                          setFormData({ ...formData, minAge: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="maxAge"
                        className="text-sm text-muted-foreground"
                      >
                        Max Age
                      </Label>
                      <Input
                        id="maxAge"
                        type="number"
                        min="1"
                        max="100"
                        value={formData.maxAge}
                        onChange={(e) =>
                          setFormData({ ...formData, maxAge: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <textarea
                    id="description"
                    className="w-full min-h-[100px] px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 border border-input bg-background rounded-md"
                    placeholder="Describe your match..."
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Images</Label>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter image URL"
                        value={imageInput}
                        onChange={(e) => setImageInput(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        onClick={addImage}
                        disabled={!imageInput.trim()}
                        variant="outline"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>

                    {images.length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {images.map((image, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={image}
                              alt={`Preview ${index + 1}`}
                              className="w-full h-24 object-cover rounded-lg border border-border"
                              onError={(e) => {
                                e.target.src =
                                  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%23f3f4f6'/%3E%3Ctext x='50' y='50' text-anchor='middle' dy='.3em' fill='%239ca3af' font-size='12' font-family='sans-serif'%3EError%3C/text%3E%3C/svg%3E";
                              }}
                            />
                            <Button
                              type="button"
                              onClick={() => removeImage(index)}
                              size="sm"
                              variant="destructive"
                              className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Location Search</Label>
                  {mapsError && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      {mapsError}
                    </div>
                  )}
                  {usingPlaceElement ? (
                    <div ref={placeElementContainerRef} className="w-full" />
                  ) : (
                    <Input
                      ref={searchInputRef}
                      type="text"
                      value={searchValue}
                      onChange={(e) => setSearchValue(e.target.value)}
                      placeholder="Search for a location (address, city, landmark...)"
                      className="w-full h-10 px-3 py-2 text-sm border border-input bg-background rounded-md ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      onBlur={() => {
                        if (!selectedLocation && searchValue) resolveManualLocation();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          resolveManualLocation();
                        }
                      }}
                    />
                  )}

                  {selectedLocation && (
                    <div className="mt-2 p-3 bg-muted rounded-lg">
                      <p className="text-sm font-medium">Selected Location:</p>
                      <p className="text-xs text-muted-foreground">
                        {selectedLocation.formatted || searchValue}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Coordinates: {formData.latitude}, {formData.longitude}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {[
                          formData.locationDetails.locality,
                          formData.locationDetails.city,
                          formData.locationDetails.state,
                          formData.locationDetails.pincode,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center gap-3 mt-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={resolveManualLocation}
                      disabled={usingPlaceElement || !searchValue?.trim() || geocoding}
                      className="w-full sm:w-auto"
                    >
                      {geocoding ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Resolving...
                        </>
                      ) : (
                        "Use this location"
                      )}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      {usingPlaceElement
                        ? "Select a place from suggestions to fill details."
                        : "Tip: you can type a city/locality and confirm."}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <Input
                      placeholder="Latitude"
                      type="number"
                      step="any"
                      value={formData.latitude}
                      onChange={(e) =>
                        setFormData({ ...formData, latitude: e.target.value })
                      }
                    />
                    <Input
                      placeholder="Longitude"
                      type="number"
                      step="any"
                      value={formData.longitude}
                      onChange={(e) =>
                        setFormData({ ...formData, longitude: e.target.value })
                      }
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Search for a location above to automatically fill coordinates
                    and location details
                  </p>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={
                    loading ||
                    !formData.sport ||
                    !formData.dateTime ||
                    !formData.capacity ||
                    !formData.latitude ||
                    !formData.longitude
                  }
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Creating Match...
                    </>
                  ) : (
                    "Create Match"
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
