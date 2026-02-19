import { useCallback, useEffect, useMemo, useState } from "react";
import { importLibrary, setOptions } from "@googlemaps/js-api-loader";

// Module-scoped promise so Google Maps loads only once.
let googleLoadPromise = null;

// Loads Google Maps once and exposes lightweight geocoding helpers.
export default function useGoogleMaps(options = {}) {
  const apiKey =
    options.apiKey || options.key || import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const [googleObj, setGoogleObj] = useState(null);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    if (!apiKey) {
      setLoadError("Google Maps API key missing");
      return undefined;
    }

    if (!googleLoadPromise) {
      googleLoadPromise = (async () => {
        // Configure loader options first
        setOptions({
          key: apiKey,
          language: options.loader?.language || "en",
          // Leave region unset by default for worldwide results.
          region: options.loader?.region,
          libraries: ["places"],
          ...options.loader,
        });
        // Load core and places libraries (ensures geocoder + places)
        await Promise.all([importLibrary("maps"), importLibrary("places")]);
        return window.google;
      })();
    }

    googleLoadPromise
      .then((google) => {
        if (cancelled) return;
        setGoogleObj(google);
        setLoadError(null);
      })
      .catch((err) => {
        console.error("Google Maps load error:", err);
        if (!cancelled) {
          setLoadError(err?.message || "Failed to load Google Maps");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [apiKey, options.loader]);

  const parseAddressComponents = useCallback((components = []) => {
    const out = {
      address: "",
      locality: "",
      city: "",
      state: "",
      pincode: "",
      country: "",
    };

    // If a parsed object is passed in, normalize and return it.
    if (!Array.isArray(components)) {
      const maybeArray =
        components?.addressComponents ||
        components?.address_components ||
        components?.components;
      if (Array.isArray(maybeArray)) {
        components = maybeArray;
      } else if (components && typeof components === "object") {
        return {
          ...out,
          ...components,
        };
      } else {
        return out;
      }
    }

    components.forEach((component) => {
      const types = component.types || [];
      const longName = component.long_name || component.longText || component.long_text;
      const shortName = component.short_name || component.shortText || component.shortTextValue;
      const name = longName || shortName || component.name || "";
      if (types.includes("street_number") || types.includes("route")) {
        out.address = out.address ? `${out.address}, ${name}` : name;
      }
      if (types.includes("sublocality") || types.includes("sublocality_level_1")) {
        out.locality = name;
      }
      if (types.includes("locality")) {
        out.city = name;
      }
      if (types.includes("administrative_area_level_1")) {
        out.state = name;
      }
      if (types.includes("country")) {
        out.country = name;
      }
      if (types.includes("postal_code")) {
        out.pincode = name;
      }
    });

    return out;
  }, []);

  const geocodeText = useCallback(
    async (text, opts = {}) => {
      if (!googleObj || !text) return null;
      const geocoder = new googleObj.maps.Geocoder();
      const response = await geocoder.geocode({
        address: text,
        componentRestrictions: opts.country
          ? { country: opts.country }
          : undefined,
      });
      const result = response?.results?.[0];
      if (!result?.geometry?.location) return null;
      const lat = result.geometry.location.lat();
      const lng = result.geometry.location.lng();
      return {
        lat,
        lng,
        formattedAddress: result.formatted_address,
        components: parseAddressComponents(result.address_components),
      };
    },
    [googleObj, parseAddressComponents]
  );

  const reverseGeocode = useCallback(
    async ({ lat, lng }) => {
      if (!googleObj || lat == null || lng == null) return null;
      const geocoder = new googleObj.maps.Geocoder();
      const response = await geocoder.geocode({
        location: { lat, lng },
      });
      const result = response?.results?.[0];
      if (!result?.geometry) return null;
      return {
        formattedAddress: result.formatted_address,
        components: parseAddressComponents(result.address_components),
      };
    },
    [googleObj, parseAddressComponents]
  );

  const toGeoJsonPoint = useCallback((lat, lng) => {
    if (lat == null || lng == null) return null;
    const latNum = Number(lat);
    const lngNum = Number(lng);
    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return null;
    return { type: "Point", coordinates: [lngNum, latNum], lat: latNum, lng: lngNum };
  }, []);

  return useMemo(
    () => ({
      googleReady: !!googleObj,
      google: googleObj,
      loadError,
      geocodeText,
      reverseGeocode,
      parseAddressComponents,
      toGeoJsonPoint,
    }),
    [googleObj, loadError, geocodeText, reverseGeocode, parseAddressComponents, toGeoJsonPoint]
  );
}
