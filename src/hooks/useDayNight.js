import { useState, useEffect } from "react";
import { applyKindredSettings, readKindredSettings } from "../lib/app-settings.js";

function getTimeOfDay(hour) {
  if (hour >= 5  && hour < 8)  return "dawn";
  if (hour >= 8  && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 20) return "evening";
  return "night";
}

function getSeason(month) {
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "autumn";
  return "winter";
}

function getSkyColors(timeOfDay) {
  const map = {
    dawn:      { top: "#FFD4A8", bottom: "#FF9870", star: false },
    morning:   { top: "#B8DCF0", bottom: "#D4E8F8", star: false },
    afternoon: { top: "#87CEEB", bottom: "#A8D5BA", star: false },
    evening:   { top: "#FF9060", bottom: "#FF6040", star: false },
    night:     { top: "#1A1838", bottom: "#2A2050", star: true  },
  };
  return map[timeOfDay] || map.morning;
}

export function useDayNight(override = null) {
  const [timeOfDay, setTimeOfDay] = useState(() => {
    if (override) return override;
    return getTimeOfDay(new Date().getHours());
  });
  const [season, setSeason] = useState(() =>
    getSeason(new Date().getMonth())
  );

  useEffect(() => {
    if (override) {
      setTimeOfDay(override);
      return;
    }

    function update() {
      const now = new Date();
      setTimeOfDay(getTimeOfDay(now.getHours()));
      setSeason(getSeason(now.getMonth()));
    }

    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [override]);

  // Apply data attributes to document root for CSS variable switching
  useEffect(() => {
    applyKindredSettings(readKindredSettings(), { timeOfDay, season });
  }, [timeOfDay, season]);

  const sky = getSkyColors(timeOfDay);

  return { timeOfDay, season, sky, isNight: timeOfDay === "night" };
}
