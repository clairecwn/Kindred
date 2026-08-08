export const KINDRED_SETTINGS_KEY = "kindred.settings";

export const DEFAULT_KINDRED_SETTINGS = {
  colorblind: "none",
  textSize: "100",
  highContrast: false,
  reducedMotion: false,
  captions: false,
  musicVol: 70,
  sfxVol: 80,
  ambient: true,
  timeOverride: "auto",
  seasonOverride: "auto",
  presenceShare: true,
  emotionVisible: false,
  analytics: true,
};

export function readKindredSettings() {
  if (typeof window === "undefined") return DEFAULT_KINDRED_SETTINGS;

  try {
    const saved = window.localStorage.getItem(KINDRED_SETTINGS_KEY);
    return saved
      ? { ...DEFAULT_KINDRED_SETTINGS, ...JSON.parse(saved) }
      : DEFAULT_KINDRED_SETTINGS;
  } catch {
    return DEFAULT_KINDRED_SETTINGS;
  }
}

export function saveKindredSettings(settings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KINDRED_SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent("kindred-settings-changed", { detail: settings }));
}

export function applyKindredSettings(settings, cycle = {}) {
  if (typeof document === "undefined") return;

  const html = document.documentElement;
  const next = { ...DEFAULT_KINDRED_SETTINGS, ...settings };

  if (next.colorblind && next.colorblind !== "none") {
    html.dataset.colorblind = next.colorblind;
  } else {
    delete html.dataset.colorblind;
  }

  html.dataset.textSize = String(next.textSize || "100");

  if (next.highContrast) html.dataset.contrast = "high";
  else delete html.dataset.contrast;

  if (next.reducedMotion) html.dataset.reducedMotion = "true";
  else delete html.dataset.reducedMotion;

  if (next.captions) html.dataset.captions = "true";
  else delete html.dataset.captions;

  if (next.timeOverride && next.timeOverride !== "auto") {
    html.dataset.time = next.timeOverride;
  } else if (cycle.timeOfDay) {
    html.dataset.time = cycle.timeOfDay;
  } else {
    delete html.dataset.time;
  }

  if (next.seasonOverride && next.seasonOverride !== "auto") {
    html.dataset.season = next.seasonOverride;
  } else if (cycle.season) {
    html.dataset.season = cycle.season;
  } else {
    delete html.dataset.season;
  }
}
