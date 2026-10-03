import { useCallback, useState } from "react";
import { useApp } from "./AppContext.jsx";

const LOCATE_TIMEOUT_MS = 10000;
const PERMISSION_DENIED = 1;

// Asks the browser for the user's position. Shows a specific message when it can't, with
// `fallback` saying what to do instead (e.g. "Tap the map instead.").
export function useGeolocation({ fallback = "" } = {}) {
  const { toast } = useApp();
  const [locating, setLocating] = useState(false);

  const locate = useCallback(onPoint => {
    const instead = fallback ? ` ${fallback}` : "";
    if (!navigator.geolocation) {
      toast(`This browser can't share your location.${instead}`, "error");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      position => {
        setLocating(false);
        onPoint({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      error => {
        setLocating(false);
        toast(error?.code === PERMISSION_DENIED
          ? `Location is blocked for this site. Allow it in your browser settings and try again.${instead}`
          : `Couldn't find your location. Try again in a moment.${instead}`, "error");
      },
      { enableHighAccuracy: true, timeout: LOCATE_TIMEOUT_MS, maximumAge: 60000 }
    );
  }, [toast, fallback]);

  return { locate, locating };
}
