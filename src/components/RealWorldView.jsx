import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { CalendarPlus, MapPin, Users } from "lucide-react";

export default function RealWorldView({ character, activities, setActivities }) {
  const mapRef     = useRef(null);
  const mapNodeRef = useRef(null);
  const markersRef = useRef([]);
  const [selected, setSelected] = useState(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (mapRef.current || !mapNodeRef.current) return;
    const map = L.map(mapNodeRef.current, { zoomControl: false }).setView([1.3521, 103.8198], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);
    L.control.zoom({ position: "bottomright" }).addTo(map);
    mapRef.current = map;
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = activities.map((activity) => {
      const marker = L.marker([activity.lat, activity.lng]).addTo(mapRef.current);
      marker.on("click", () => setSelected(activity));
      marker.bindPopup(activity.title);
      return marker;
    });
  }, [activities]);

  function createActivity(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const activity = {
      id:            crypto.randomUUID(),
      title:         String(form.get("title")),
      host:          "you",
      date:          String(form.get("date")),
      location:      String(form.get("location")),
      lat:           Number(form.get("lat") || 1.3521),
      lng:           Number(form.get("lng") || 103.8198),
      capacity:      Number(form.get("capacity") || 8),
      joined:        1,
      type:          String(form.get("type") || "Social"),
      description:   String(form.get("description") || ""),
      hostCharacter: character,
      participants:  ["you"],
    };
    setActivities((items) => [activity, ...items]);
    setCreating(false);
    mapRef.current?.flyTo([activity.lat, activity.lng], 14, { duration: 0.8 });
  }

  function joinActivity(id) {
    setActivities((items) =>
      items.map((a) =>
        a.id === id
          ? {
              ...a,
              joined:       Math.min(a.capacity, a.joined + 1),
              participants: Array.from(new Set([...(a.participants || []), "you"])),
            }
          : a
      )
    );
  }

  function focusActivity(activity) {
    setSelected(activity);
    mapRef.current?.flyTo([activity.lat, activity.lng], 14, { duration: 0.8 });
  }

  const inputStyle = {
    padding: "12px 16px", borderRadius: 12,
    border: "1.5px solid var(--border)", background: "var(--surface)",
    fontSize: "0.95rem", color: "var(--text)", outline: "none", width: "100%",
    fontFamily: "inherit",
  };

  return (
    <div className="page-container anim-fade-in">

      {/* ── Hero ──────────────────────────────────────────────── */}
      <div className="page-hero page-hero-alt">
        <div className="hero-text">
          <div className="hero-label">Ventures</div>
          <div className="hero-title" style={{ fontSize: "1.45rem" }}>
            Real places,<br />real connection.
          </div>
          <p className="hero-desc" style={{ marginTop: 6 }}>
            Host an activity, drop it on the map, and meet people nearby.
          </p>
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, opacity: 0.9 }}>
            <MapPin size={16} />
            <span style={{ fontSize: "0.88rem", fontWeight: 700 }}>
              {activities.length} {activities.length === 1 ? "activity" : "activities"} nearby
            </span>
          </div>
        </div>
      </div>

      {/* ── Map ───────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div
          ref={mapNodeRef}
          style={{ width: "100%", height: 340, borderRadius: "var(--r-lg)" }}
          aria-label="Activity map"
        />
      </div>

      {/* ── Activities list ────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Nearby Activities</div>
            <div className="card-sub">Tap to focus on the map</div>
          </div>
          <button className="btn-primary" type="button" onClick={() => setCreating(true)}>
            <CalendarPlus size={16} />
            Create
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {activities.map((activity) => (
            <article
              key={activity.id}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "14px 16px", borderRadius: 16,
                border: "1.5px solid var(--border)", background: "var(--surface)",
                cursor: "pointer", transition: "background 0.15s",
              }}
              onClick={() => focusActivity(activity)}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                background: "linear-gradient(135deg, var(--brand-2), #3A7868)",
                display: "grid", placeItems: "center",
                color: "#fff", fontSize: "1.1rem", fontWeight: 900,
              }}>
                {activity.type?.[0] ?? "A"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--text)" }}>
                  {activity.title}
                </div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-2)", marginTop: 2 }}>
                  {activity.location} · {activity.type}
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-3)", marginTop: 1 }}>
                  {activity.date} · {activity.joined}/{activity.capacity} joined
                </div>
              </div>
              <button
                className="btn-secondary"
                type="button"
                style={{ padding: "7px 14px", fontSize: "0.82rem", flexShrink: 0 }}
                onClick={(e) => { e.stopPropagation(); focusActivity(activity); }}
              >
                View
              </button>
            </article>
          ))}
        </div>
      </div>

      {/* ── Create activity drawer ──────────────────────────────── */}
      {creating && (
        <div className="drawer-overlay" role="dialog" aria-modal="true" onClick={() => setCreating(false)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-handle" />
            <div className="drawer-title">New Activity</div>
            <p className="drawer-sub">Drop a pin and invite others to join.</p>
            <form style={{ display: "flex", flexDirection: "column", gap: 12 }} onSubmit={createActivity}>
              <input name="title"    placeholder="Activity title"                 required style={inputStyle} />
              <input name="location" placeholder="Location name"                 required style={inputStyle} />
              <input name="date"     type="datetime-local"                        required style={inputStyle} />
              <input name="type"     placeholder="Type e.g. Walk, Support, Games"         style={inputStyle} />
              <input name="description" placeholder="What should people know?"           style={inputStyle} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <input name="lat" type="number" step="0.0001" placeholder="Latitude"  defaultValue="1.3521"   style={inputStyle} />
                <input name="lng" type="number" step="0.0001" placeholder="Longitude" defaultValue="103.8198" style={inputStyle} />
              </div>
              <input name="capacity" type="number" min="2" defaultValue="8" placeholder="Max participants" style={inputStyle} />
              <button className="btn-primary" type="submit" style={{ width: "100%", justifyContent: "center" }}>
                Save Activity
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Activity detail drawer ──────────────────────────────── */}
      {selected && (
        <div className="drawer-overlay" role="dialog" aria-modal="true" onClick={() => setSelected(null)}>
          <div className="drawer" onClick={(e) => e.stopPropagation()}>
            <div className="drawer-handle" />
            <div className="drawer-title">{selected.title}</div>
            <p className="drawer-sub">{selected.location} · hosted by @{selected.host}</p>
            {selected.description && (
              <p style={{ color: "var(--text-2)", fontSize: "0.9rem", marginBottom: 16 }}>
                {selected.description}
              </p>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              <Users size={16} style={{ color: "var(--text-3)", flexShrink: 0 }} />
              {(selected.participants || ["Mia", "Kai", "Zoe"]).slice(0, 5).map((name) => (
                <span
                  key={name}
                  style={{
                    padding: "4px 12px", borderRadius: 999,
                    background: "var(--bg-2)", fontSize: "0.82rem", fontWeight: 700,
                  }}
                >
                  {name}
                </span>
              ))}
            </div>
            <button
              className="btn-primary"
              type="button"
              style={{ width: "100%", justifyContent: "center" }}
              onClick={() => joinActivity(selected.id)}
            >
              Join Activity
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
