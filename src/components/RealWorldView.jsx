import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { CalendarPlus, MapPin, Users } from "lucide-react";

export default function RealWorldView({ character, activities, setActivities }) {
  const mapRef = useRef(null);
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
    markersRef.current.forEach((marker) => marker.remove());
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
      id: crypto.randomUUID(),
      title: String(form.get("title")),
      host: "you",
      date: String(form.get("date")),
      location: String(form.get("location")),
      lat: Number(form.get("lat") || 1.3521),
      lng: Number(form.get("lng") || 103.8198),
      capacity: Number(form.get("capacity") || 8),
      joined: 1,
      type: String(form.get("type") || "Social"),
      description: String(form.get("description") || ""),
      hostCharacter: character,
      participants: ["you"]
    };
    setActivities((items) => [activity, ...items]);
    setCreating(false);
    mapRef.current?.flyTo([activity.lat, activity.lng], 14, { duration: 0.8 });
  }

  function joinActivity(id) {
    setActivities((items) => items.map((activity) => (
      activity.id === id
        ? {
            ...activity,
            joined: Math.min(activity.capacity, activity.joined + 1),
            participants: Array.from(new Set([...(activity.participants || []), "you"]))
          }
        : activity
    )));
  }

  function focusActivity(activity) {
    setSelected(activity);
    mapRef.current?.flyTo([activity.lat, activity.lng], 14, { duration: 0.8 });
  }

  return (
    <div className="page-grid">
      <section className="hero-panel map-hero">
        <div>
          <p className="eyebrow">Real world</p>
        <h1>Host or join nearby activities.</h1>
          <p>Create your own activity, drop it onto the map, and browse everything available around you.</p>
        </div>
        <div className="suggestion-card">
          <MapPin size={24} />
          <strong>{activities.length} activities</strong>
          <span>Inspect host characters, see who joined, or create your own pin.</span>
        </div>
      </section>

      <section className="map-panel">
        <div ref={mapNodeRef} className="map-node" />
      </section>

      <section className="wide-panel">
        <div className="section-heading">
          <div>
            <h2>Activities Near You</h2>
            <p>Browse all available activities and focus their pins on the map.</p>
          </div>
          <button className="primary-button small" type="button" onClick={() => setCreating(true)}>
            <CalendarPlus size={17} /> Create
          </button>
        </div>
        <div className="activity-list">
          {activities.map((activity) => (
            <article className="activity-card" key={activity.id}>
              <button className="host-avatar" type="button" onClick={() => focusActivity(activity)} aria-label={`Show ${activity.title} on map`}>
                <span className={`mini-avatar ${activity.hostCharacter?.animal || "fox"}`} />
              </button>
              <div>
                <strong>{activity.title}</strong>
                <span>{activity.location} - {activity.type}</span>
                <small>{activity.date} - @{activity.host} - {activity.joined}/{activity.capacity} joined</small>
              </div>
              <button type="button" onClick={() => focusActivity(activity)}>View</button>
            </article>
          ))}
        </div>
      </section>

      {creating && (
        <div className="drawer" role="dialog" aria-modal="true">
          <div>
            <h2>Create Activity</h2>
            <button type="button" onClick={() => setCreating(false)}>Close</button>
          </div>
          <form className="activity-form" onSubmit={createActivity}>
            <input name="title" placeholder="Activity title" required />
            <input name="location" placeholder="Location name" required />
            <input name="date" type="datetime-local" required />
            <input name="type" placeholder="Type, e.g. Walk, Support, Games" />
            <input name="description" placeholder="What should people know?" />
            <div className="two-col">
              <input name="lat" type="number" step="0.0001" placeholder="Latitude" defaultValue="1.3521" />
              <input name="lng" type="number" step="0.0001" placeholder="Longitude" defaultValue="103.8198" />
            </div>
            <input name="capacity" type="number" min="2" defaultValue="8" />
            <button className="primary-button" type="submit">Save activity</button>
          </form>
        </div>
      )}

      {selected && (
        <div className="drawer compact" role="dialog" aria-modal="true">
          <div>
            <h2>{selected.title}</h2>
            <button type="button" onClick={() => setSelected(null)}>Close</button>
          </div>
          <p>{selected.location} - hosted by @{selected.host}</p>
          {selected.description && <p>{selected.description}</p>}
          <div className="participant-strip">
            <Users size={17} />
            {(selected.participants || ["Mia", "Kai", "Zoe"]).slice(0, 5).map((name) => (
              <span key={name}>{name}</span>
            ))}
          </div>
          <button className="primary-button" type="button" onClick={() => joinActivity(selected.id)}>Join activity</button>
        </div>
      )}
    </div>
  );
}
