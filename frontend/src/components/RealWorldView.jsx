import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import L from "leaflet";
import {
  CalendarPlus, MapPin, Users, ShieldCheck, Flag, UserX, Sparkles,
  X, Clock, Wallet, Accessibility, Crosshair, Loader2, Globe2,
} from "lucide-react";
import {
  createActivity, EVIDENCE_CATEGORY, ENERGY_DEMAND, SOCIAL_INTENSITY, STRUCTURE,
} from "../ventures/activity-model.js";
import { buildUserContext } from "../ventures/user-context.js";
import { recommend } from "../ventures/recommender.js";
import { loadSupply } from "../ventures/supply/index.js";
import { buildOrbIcon, buildPickerIcon, categoryColor } from "../ventures/orb-icon.js";
import {
  canHost,
  summariseHostHistory,
  visibleParticipantRoster,
  allowsBringAFriend,
  assessVenueRisk,
  createBlock,
  createReport,
  filterBlockedHosts,
  HOST_COOLING_PERIOD_DAYS,
} from "../ventures/safety.js";
import "../ventures/ventures.css";

// ── Legacy-activity -> activity-model adapter ───────────────────────────
// RealWorldView has always stored activities in a flat, loosely-typed shape
// (see src/data/seed.js). Ventures' scoring engine wants the normalised
// schema from src/ventures/activity-model.js. This maps one to the other
// without changing the shape callers of setActivities rely on. Explicit
// fields set by the new create-activity form (evidenceCategory,
// energyDemand, socialIntensity, accessibility) win over the inferred
// defaults so real hosted activities carry real data end to end.
const TYPE_TO_EVIDENCE = {
  Movement: EVIDENCE_CATEGORY.EXERCISE,
  Outdoor: EVIDENCE_CATEGORY.GREEN_BLUE_SPACE,
  Support: EVIDENCE_CATEGORY.SOCIAL_CONNECTION,
  Volunteering: EVIDENCE_CATEGORY.VOLUNTEERING,
  Arts: EVIDENCE_CATEGORY.ARTS_CREATIVE,
  Games: EVIDENCE_CATEGORY.SOCIAL_CONNECTION,
};

function socialIntensityFor(activity) {
  if (activity.socialIntensity != null) return activity.socialIntensity;
  const cap = activity.capacity ?? 8;
  if (cap <= 1) return SOCIAL_INTENSITY.SOLO;
  if (cap <= 4) return SOCIAL_INTENSITY.FAMILIAR_SMALL;
  if (cap <= 10) return SOCIAL_INTENSITY.NEW_SMALL;
  return SOCIAL_INTENSITY.GROUP_EVENT;
}

function toModelActivity(activity) {
  return createActivity({
    id: activity.id,
    title: activity.title,
    description: activity.description,
    sourceType: "user",
    evidenceCategory: activity.evidenceCategory ?? TYPE_TO_EVIDENCE[activity.type] ?? EVIDENCE_CATEGORY.BEHAVIOURAL_ACTIVATION,
    energyDemand: activity.energyDemand ?? (activity.type === "Movement" ? ENERGY_DEMAND.MODERATE : ENERGY_DEMAND.LOW),
    socialIntensity: socialIntensityFor(activity),
    durationMinutes: activity.durationMinutes ?? 45,
    structure: STRUCTURE.SCHEDULED,
    noCommitment: activity.type === "Outdoor",
    cost: activity.cost ?? { amount: 0, currency: "SGD" },
    country: "SG",
    date: activity.date ?? null,
    location: {
      name: activity.location, lat: activity.lat, lng: activity.lng,
      isPublicVenue: activity.isPublicVenue ?? true,
      isDaytime: activity.isDaytime ?? true,
      transitNearby: true,
    },
    accessibility: activity.accessibility ?? { languageCodes: ["en"], mobilityLevelRequired: "any" },
    hostId: activity.host,
    capacity: activity.capacity,
    joined: activity.joined,
    participants: (activity.participants || []).map((name) => ({ userId: name, displayName: name })),
    raw: activity,
  });
}

const ENERGY_OPTIONS = [
  { value: ENERGY_DEMAND.MINIMAL, label: "Minimal" },
  { value: ENERGY_DEMAND.LOW, label: "Low" },
  { value: ENERGY_DEMAND.MODERATE, label: "Moderate" },
  { value: ENERGY_DEMAND.HIGH, label: "High" },
];
const SOCIAL_OPTIONS = [
  { value: SOCIAL_INTENSITY.SOLO, label: "Solo / drop-in" },
  { value: SOCIAL_INTENSITY.PARALLEL, label: "Around others, no interaction" },
  { value: SOCIAL_INTENSITY.FAMILIAR_SMALL, label: "Small familiar group" },
  { value: SOCIAL_INTENSITY.NEW_SMALL, label: "Small group with strangers" },
  { value: SOCIAL_INTENSITY.GROUP_EVENT, label: "Larger group event" },
];
const LANGUAGE_OPTIONS = [
  { code: "en", label: "English" },
  { code: "zh", label: "Chinese" },
  { code: "ms", label: "Malay" },
  { code: "ta", label: "Tamil" },
];
const DAYTIME_START_HOUR = 7;
const DAYTIME_END_HOUR = 19;

function evidenceLabel(cat) {
  return {
    [EVIDENCE_CATEGORY.EXERCISE]: "Exercise",
    [EVIDENCE_CATEGORY.GREEN_BLUE_SPACE]: "Green / blue space",
    [EVIDENCE_CATEGORY.VOLUNTEERING]: "Volunteering",
    [EVIDENCE_CATEGORY.ARTS_CREATIVE]: "Arts & creative",
    [EVIDENCE_CATEGORY.SOCIAL_CONNECTION]: "Social connection",
    [EVIDENCE_CATEGORY.BEHAVIOURAL_ACTIVATION]: "Gentle activation",
  }[cat] ?? "Activity";
}

function formatWhen(dateStr) {
  if (!dateStr) return "Drop in anytime";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function RealWorldView({ emotion, character, activities, setActivities, journalEntries = [], player = null }) {
  const mapRef       = useRef(null);
  const mapNodeRef   = useRef(null);
  const markersRef   = useRef([]);
  const pickerMarkerRef = useRef(null);
  const pickingRef   = useRef(false);
  const lastFetchCenterRef = useRef(null);
  const fetchTimerRef = useRef(null);

  const [selectedModel, setSelectedModel] = useState(null);
  const [creating, setCreating]     = useState(false);
  const [picking, setPicking]       = useState(false);
  const [pickedPoint, setPickedPoint] = useState(null);
  const [formError, setFormError]   = useState(null);
  const [reporting, setReporting]   = useState(null);
  const [blocks, setBlocks]         = useState([]);
  const [reports, setReports]       = useState([]);
  const [liveSupply, setLiveSupply] = useState([]);
  const [loadingSupply, setLoadingSupply] = useState(false);
  const [privateVenue, setPrivateVenue] = useState(false);

  const viewerId = "you";

  useEffect(() => { pickingRef.current = picking; }, [picking]);

  // ── Map init ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (mapRef.current || !mapNodeRef.current) return;
    const map = L.map(mapNodeRef.current, { zoomControl: false }).setView([1.3521, 103.8198], 12);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);

    map.on("click", (e) => {
      if (!pickingRef.current) return;
      setPickedPoint({ lat: e.latlng.lat, lng: e.latlng.lng });
      setPicking(false);
    });

    const scheduleFetch = () => {
      clearTimeout(fetchTimerRef.current);
      fetchTimerRef.current = setTimeout(() => fetchLiveSupply(map.getCenter()), 500);
    };
    map.on("moveend", scheduleFetch);
    scheduleFetch();

    mapRef.current = map;
    return () => { clearTimeout(fetchTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Real activity supply: Overpass + data.gov.sg, cached, silent-fail ──
  const fetchLiveSupply = useCallback((center) => {
    if (!center) return;
    const last = lastFetchCenterRef.current;
    if (last && Math.abs(last.lat - center.lat) < 0.01 && Math.abs(last.lng - center.lng) < 0.01) return;
    lastFetchCenterRef.current = { lat: center.lat, lng: center.lng };
    setLoadingSupply(true);
    loadSupply({
      seedActivities: [],
      center: { lat: center.lat, lng: center.lng },
      country: "SG",
      datagovsgUrls: {
        sportsgUrl: import.meta.env?.VITE_DATAGOVSG_SPORTSG_URL,
        communityClubUrl: import.meta.env?.VITE_DATAGOVSG_CC_URL,
      },
      fetchImpl: typeof fetch !== "undefined" ? fetch : undefined,
    })
      .then((list) => setLiveSupply(Array.isArray(list) ? list : []))
      .catch(() => {})
      .finally(() => setLoadingSupply(false));
  }, []);

  const visibleActivities = useMemo(
    () => filterBlockedHosts(activities, blocks, viewerId),
    [activities, blocks]
  );

  // Every pin on the map, in the normalised schema: real hosted activities
  // plus real live supply (OSM parks/libraries/facilities, data.gov.sg).
  const modelActivities = useMemo(
    () => [...visibleActivities.map(toModelActivity), ...liveSupply],
    [visibleActivities, liveSupply]
  );

  const checkinBand = useMemo(() => {
    const latestCheckin = journalEntries.find((e) => e.source === "checkin" && (e.checkinScore?.band || e.analysis?.todayScore?.band));
    return latestCheckin?.checkinScore?.band ?? latestCheckin?.analysis?.todayScore?.band ?? null;
  }, [journalEntries]);

  const isNewAccount = useMemo(() => {
    if (!player?.joinedAt) return false;
    const ageDays = (Date.now() - new Date(player.joinedAt).getTime()) / 86400000;
    return ageDays < 14;
  }, [player?.joinedAt]);

  const isFirstTimeHost = useMemo(() => !activities.some((a) => a.host === viewerId), [activities]);
  const mustStayPublicDaytime = isNewAccount || isFirstTimeHost;

  const userContext = useMemo(
    () => buildUserContext({
      emotion, checkinBand, userId: viewerId,
      currentSocialRung: player?.socialRung ?? 0,
      country: "SG", isNewAccount,
    }),
    [emotion, checkinBand, player?.socialRung, isNewAccount]
  );

  // At most 3 algorithmic recommendations, invitation-framed, via the
  // existing recommender -- fed by real hosted + real live-supply activities.
  const recommendations = useMemo(
    () => recommend(modelActivities, userContext, { noveltySalt: new Date().toDateString() }),
    [modelActivities, userContext]
  );
  const recommendedIds = useMemo(() => new Set(recommendations.map((r) => r.activity.id)), [recommendations]);

  // ── Pins ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = modelActivities
      .filter((a) => a.location.lat != null && a.location.lng != null)
      .map((activity) => {
        const marker = L.marker([activity.location.lat, activity.location.lng], {
          icon: buildOrbIcon({
            color: categoryColor(activity.evidenceCategory),
            recommended: recommendedIds.has(activity.id),
          }),
        }).addTo(mapRef.current);
        marker.on("click", () => setSelectedModel(activity));
        return marker;
      });
  }, [modelActivities, recommendedIds]);

  // Temporary marker for the location being picked while hosting.
  useEffect(() => {
    if (!mapRef.current) return;
    if (pickerMarkerRef.current) { pickerMarkerRef.current.remove(); pickerMarkerRef.current = null; }
    if (pickedPoint) {
      pickerMarkerRef.current = L.marker([pickedPoint.lat, pickedPoint.lng], { icon: buildPickerIcon() }).addTo(mapRef.current);
    }
  }, [pickedPoint]);

  // Escape closes whichever panel is open.
  useEffect(() => {
    function onKey(e) {
      if (e.key !== "Escape") return;
      if (selectedModel) setSelectedModel(null);
      else if (reporting) setReporting(null);
      else if (creating) { setCreating(false); setPicking(false); }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedModel, reporting, creating]);

  function findLegacyActivity(id) {
    return activities.find((a) => a.id === id);
  }

  function focusPoint(lat, lng) {
    if (lat != null && lng != null) mapRef.current?.flyTo([lat, lng], 14, { duration: 0.8 });
  }

  function openDetail(activity) {
    setSelectedModel(activity);
    focusPoint(activity.location.lat, activity.location.lng);
  }

  function resetCreateForm() {
    setCreating(false);
    setPicking(false);
    setPickedPoint(null);
    setFormError(null);
    setPrivateVenue(false);
  }

  function createActivityForm(event) {
    event.preventDefault();
    setFormError(null);

    const hostCheck = canHost({ accountCreatedAt: player?.joinedAt ?? character?.accountCreatedAt ?? null });
    if (!hostCheck.canHost) { setFormError(hostCheck.reason); return; }
    if (!pickedPoint) { setFormError("Tap the map to choose a location before saving."); return; }

    const form = new FormData(event.currentTarget);
    const dateStr = String(form.get("date") || "");
    const hour = dateStr ? new Date(dateStr).getHours() : null;
    const isDaytime = hour == null ? true : hour >= DAYTIME_START_HOUR && hour < DAYTIME_END_HOUR;

    if (mustStayPublicDaytime && !isDaytime) {
      setFormError(`New hosts and first meetups must stay at public, daytime venues (${DAYTIME_START_HOUR}:00-${DAYTIME_END_HOUR}:00).`);
      return;
    }

    const languageCodes = LANGUAGE_OPTIONS.filter((l) => form.get(`lang-${l.code}`)).map((l) => l.code);

    const activity = {
      id:            crypto.randomUUID(),
      title:         String(form.get("title")),
      host:          viewerId,
      date:          dateStr,
      location:      String(form.get("location") || "Pinned location"),
      lat:           pickedPoint.lat,
      lng:           pickedPoint.lng,
      capacity:      Number(form.get("capacity") || 8),
      joined:        1,
      type:          String(form.get("type") || "Social"),
      description:   String(form.get("description") || ""),
      evidenceCategory: String(form.get("evidenceCategory") || EVIDENCE_CATEGORY.BEHAVIOURAL_ACTIVATION),
      energyDemand:  String(form.get("energyDemand") || ENERGY_DEMAND.LOW),
      socialIntensity: Number(form.get("socialIntensity") ?? SOCIAL_INTENSITY.NEW_SMALL),
      cost:          { amount: Number(form.get("cost") || 0), currency: "SGD" },
      isPublicVenue: mustStayPublicDaytime ? true : !privateVenue,
      isDaytime,
      accessibility: {
        wheelchairAccessible: form.get("wheelchair") === "yes" ? true : form.get("wheelchair") === "no" ? false : null,
        mobilityLevelRequired: String(form.get("mobilityLevelRequired") || "any"),
        languageCodes: languageCodes.length ? languageCodes : ["en"],
      },
      hostCharacter: character,
      participants:  [viewerId],
      hostCanHost:   true,
    };
    setActivities((items) => [activity, ...items]);
    resetCreateForm();
    focusPoint(activity.lat, activity.lng);
  }

  function joinActivity(id) {
    setActivities((items) =>
      items.map((a) =>
        a.id === id
          ? { ...a, joined: Math.min(a.capacity, a.joined + 1), participants: Array.from(new Set([...(a.participants || []), viewerId])) }
          : a
      )
    );
    setSelectedModel(null);
  }

  function handleBlock(hostId) {
    if (!hostId || hostId === viewerId) return;
    setBlocks((prev) => [...prev, createBlock({ blockerId: viewerId, blockedId: hostId, reason: "not comfortable" })]);
    setSelectedModel(null);
  }

  function submitReport(event) {
    event.preventDefault();
    if (!reporting) return;
    const form = new FormData(event.currentTarget);
    const report = createReport({
      reporterId: viewerId,
      reportedId: reporting.hostId,
      activityId: reporting.id,
      category: String(form.get("category") || "other"),
      details: String(form.get("details") || ""),
    });
    setReports((prev) => [...prev, report]);
    setReporting(null);
  }

  const legacyForSelected = selectedModel ? findLegacyActivity(selectedModel.id) : null;
  const isUserHosted = !!selectedModel?.hostId;
  const venueRisk = selectedModel ? assessVenueRisk(selectedModel, { userId: viewerId, pastParticipation: [] }) : null;
  const hostHistory = summariseHostHistory([]);

  return (
    <div className="ventures-root anim-fade-in">
      <div ref={mapNodeRef} className={`ventures-map${selectedModel ? " is-blurred" : ""}`} aria-label="Activity map" />

      <div className="ventures-hud">
        <div className="venture-chip">
          <MapPin size={15} />
          {modelActivities.length} {modelActivities.length === 1 ? "activity" : "activities"} nearby
          {loadingSupply && <Loader2 size={13} className="anim-spin" style={{ animation: "spin 1s linear infinite" }} />}
        </div>

        <button type="button" className="venture-btn venture-btn--gold venture-create-btn" onClick={() => setCreating(true)}>
          <CalendarPlus size={16} /> Host
        </button>

        {recommendations.length > 0 && (
          <div className="venture-reco-rail">
            {recommendations.map(({ activity, copy, isNoCommitment }) => (
              <article key={activity.id} className="venture-reco-card" onClick={() => openDetail(activity)}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <Sparkles size={13} style={{ color: "#3A9B7A", flexShrink: 0 }} />
                  <div className="venture-reco-title">{copy}</div>
                </div>
                <div className="venture-reco-chips">
                  {isNoCommitment && <span className="venture-reco-chip">No commitment</span>}
                  <span className="venture-reco-chip">{activity.cost.amount === 0 ? "Free" : `${activity.cost.currency} ${activity.cost.amount}`}</span>
                  <span className="venture-reco-chip">{activity.location.name || "Nearby"}</span>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* ── Activity detail panel (right side, map blurred behind) ────── */}
      {selectedModel && (
        <div className="venture-panel-overlay" onClick={() => setSelectedModel(null)}>
          <div className="venture-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="venture-btn venture-btn--dark venture-btn--icon venture-panel-close" onClick={() => setSelectedModel(null)} aria-label="Close">
              <X size={16} />
            </button>

            <div>
              <span className="venture-flag" style={{ background: categoryColor(selectedModel.evidenceCategory), color: "#fff" }}>
                {evidenceLabel(selectedModel.evidenceCategory)}
              </span>
              <div className="venture-panel-title" style={{ marginTop: 8 }}>{selectedModel.title}</div>
              {selectedModel.description && <p className="venture-panel-desc">{selectedModel.description}</p>}
            </div>

            <div className="venture-panel-row"><Clock size={15} /> {formatWhen(selectedModel.date)}</div>
            <div className="venture-panel-row"><MapPin size={15} /> {selectedModel.location.name || "Location shown on map"}</div>
            <div className="venture-panel-row"><Wallet size={15} /> {selectedModel.cost.amount === 0 ? "Free" : `${selectedModel.cost.currency} ${selectedModel.cost.amount}`}</div>

            <div className="venture-flag-row">
              <span className="venture-flag">
                <Accessibility size={11} style={{ verticalAlign: -2, marginRight: 3 }} />
                {selectedModel.accessibility.wheelchairAccessible === true ? "Wheelchair accessible" : selectedModel.accessibility.wheelchairAccessible === false ? "Not wheelchair accessible" : "Accessibility unconfirmed"}
              </span>
              <span className="venture-flag">Mobility: {selectedModel.accessibility.mobilityLevelRequired}</span>
              <span className="venture-flag"><Globe2 size={11} style={{ verticalAlign: -2, marginRight: 3 }} /> {(selectedModel.accessibility.languageCodes || ["en"]).join(", ")}</span>
            </div>

            {isUserHosted ? (
              <>
                <div className="venture-panel-sub">Hosted by @{selectedModel.hostId}</div>
                <div className={`venture-safety-box${venueRisk?.suppress ? " is-warning" : ""}`}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800, color: "inherit" }}>
                    <ShieldCheck size={15} /> Before you join
                  </div>
                  <span>{hostHistory.isFirstTimeHost ? "This host has no track record yet -- first meetups stay at public, daytime venues by default." : `${hostHistory.completed} activities hosted successfully.`}</span>
                  <span>{allowsBringAFriend(selectedModel) ? "You're welcome to bring a friend along." : "This activity is at capacity for a plus-one."}</span>
                  {venueRisk?.reasons?.map((r) => <span key={r}>{r}.</span>)}
                </div>

                <div className="venture-panel-row"><Users size={15} />
                  {selectedModel.capacity ? `${selectedModel.joined}/${selectedModel.capacity} joined` : `${selectedModel.joined} joined`}
                </div>
                <div className="venture-roster">
                  {visibleParticipantRoster(selectedModel.participants, viewerId).slice(0, 6).map((p) => (
                    <span key={p.userId} className="venture-roster-pill">{p.displayName}</span>
                  ))}
                </div>

                <button type="button" className="venture-btn venture-btn--gold" style={{ width: "100%" }} onClick={() => joinActivity(selectedModel.id)}>
                  Join Activity
                </button>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className="venture-btn venture-btn--dark venture-btn--sm" style={{ flex: 1 }} onClick={() => setReporting(selectedModel)}>
                    <Flag size={13} /> Report
                  </button>
                  <button type="button" className="venture-btn venture-btn--red venture-btn--sm" style={{ flex: 1 }} onClick={() => handleBlock(selectedModel.hostId)}>
                    <UserX size={13} /> Block host
                  </button>
                </div>
              </>
            ) : (
              <div className="venture-safety-box">
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 800, color: "inherit" }}>
                  <ShieldCheck size={15} /> Public spot
                </div>
                <span>A free, public place -- no booking or host needed, just show up whenever suits you.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Create-activity panel (map stays interactive for pin drop) ── */}
      {creating && (
        <div className="venture-panel" role="dialog" aria-modal="true">
          <button type="button" className="venture-btn venture-btn--dark venture-btn--icon venture-panel-close" onClick={resetCreateForm} aria-label="Close">
            <X size={16} />
          </button>
          <div className="venture-panel-title">Host a Venture</div>
          <p className="venture-panel-sub">Real place, real time -- invite others at their own pace.</p>

          {mustStayPublicDaytime && (
            <div className="venture-hint-banner">
              <ShieldCheck size={16} />
              <span>{isNewAccount ? `New accounts can host after ${HOST_COOLING_PERIOD_DAYS} days from joining, and first meetups stay at public, daytime venues (${DAYTIME_START_HOUR}:00-${DAYTIME_END_HOUR}:00), never a private address.` : `Your first hosted meetup stays at a public, daytime venue (${DAYTIME_START_HOUR}:00-${DAYTIME_END_HOUR}:00), never a private address.`}</span>
            </div>
          )}

          <form className="venture-form" onSubmit={createActivityForm}>
            <input name="title" className="venture-input" placeholder="Activity title" required />
            <textarea name="description" className="venture-textarea" placeholder="What should people know?" rows={3} />

            <button
              type="button"
              className={`venture-pick-location-btn${picking ? " is-picking" : ""}${pickedPoint ? " has-pin" : ""}`}
              onClick={() => setPicking((p) => !p)}
            >
              <Crosshair size={16} />
              {pickedPoint ? `Pinned at ${pickedPoint.lat.toFixed(4)}, ${pickedPoint.lng.toFixed(4)}` : picking ? "Tap anywhere on the map now..." : "Tap the map to choose a location"}
            </button>
            <input name="location" className="venture-input" placeholder="Venue name (e.g. East Coast Park)" required />

            <div className="venture-form-grid2">
              <input name="date" type="datetime-local" className="venture-input" required />
              <input name="capacity" type="number" min="2" defaultValue="8" className="venture-input" placeholder="Capacity" />
            </div>

            <div className="venture-form-grid2">
              <select name="cost" className="venture-select" defaultValue="0">
                <option value="0">Free</option>
                <option value="5">SGD 5</option>
                <option value="10">SGD 10</option>
                <option value="20">SGD 20</option>
              </select>
              <select name="type" className="venture-select" defaultValue="Social">
                <option value="Movement">Movement</option>
                <option value="Outdoor">Outdoor</option>
                <option value="Support">Support</option>
                <option value="Arts">Arts</option>
                <option value="Games">Social</option>
              </select>
            </div>

            <div>
              <div className="venture-form-label">Energy demand</div>
              <select name="energyDemand" className="venture-select" defaultValue={ENERGY_DEMAND.LOW}>
                {ENERGY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <div className="venture-form-label">Social intensity</div>
              <select name="socialIntensity" className="venture-select" defaultValue={SOCIAL_INTENSITY.NEW_SMALL}>
                {SOCIAL_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <div className="venture-form-label">Category</div>
              <select name="evidenceCategory" className="venture-select" defaultValue={EVIDENCE_CATEGORY.SOCIAL_CONNECTION}>
                {Object.values(EVIDENCE_CATEGORY).map((c) => <option key={c} value={c}>{evidenceLabel(c)}</option>)}
              </select>
            </div>

            <div className="venture-form-label">Accessibility</div>
            <select name="wheelchair" className="venture-select" defaultValue="unknown">
              <option value="unknown">Wheelchair access unknown</option>
              <option value="yes">Wheelchair accessible</option>
              <option value="no">Not wheelchair accessible</option>
            </select>
            <select name="mobilityLevelRequired" className="venture-select" defaultValue="any">
              <option value="any">Any mobility level</option>
              <option value="low">Low mobility needed</option>
              <option value="moderate">Moderate mobility needed</option>
              <option value="high">High mobility needed</option>
            </select>
            <div className="venture-checkbox-row">
              {LANGUAGE_OPTIONS.map((l) => (
                <label key={l.code} className="venture-checkbox-pill">
                  <input type="checkbox" name={`lang-${l.code}`} defaultChecked={l.code === "en"} /> {l.label}
                </label>
              ))}
            </div>

            {!mustStayPublicDaytime && (
              <label className="venture-checkbox-pill" style={{ alignSelf: "flex-start" }}>
                <input type="checkbox" checked={privateVenue} onChange={(e) => setPrivateVenue(e.target.checked)} />
                This is a private address (not for a first meetup with someone new)
              </label>
            )}

            {formError && <div className="venture-error">{formError}</div>}

            <button type="submit" className="venture-btn venture-btn--gold" style={{ width: "100%" }}>
              Save Activity
            </button>
          </form>
        </div>
      )}

      {/* ── Report panel ─────────────────────────────────────────────── */}
      {reporting && (
        <div className="venture-panel-overlay" onClick={() => setReporting(null)}>
          <div className="venture-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="venture-btn venture-btn--dark venture-btn--icon venture-panel-close" onClick={() => setReporting(null)} aria-label="Close">
              <X size={16} />
            </button>
            <div className="venture-panel-title">Report {reporting.title}</div>
            <p className="venture-panel-sub">This is easy and never held against you for reporting.</p>
            <form className="venture-form" onSubmit={submitReport}>
              <select name="category" className="venture-select" defaultValue="unsafe_venue">
                <option value="harassment">Harassment</option>
                <option value="unsafe_venue">Unsafe venue</option>
                <option value="no_show">Host didn't show</option>
                <option value="other">Other</option>
              </select>
              <input name="details" className="venture-input" placeholder="Anything else we should know? (optional)" />
              <button type="submit" className="venture-btn venture-btn--gold" style={{ width: "100%" }}>Submit report</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
