export const initialJournalEntries = [
  {
    id: "j-1",
    date: "2026-05-10",
    text: "I felt proud after finishing a small task that had been sitting in my head.",
    emotion: "content"
  },
  {
    id: "j-2",
    date: "2026-05-09",
    text: "A slow walk helped me feel less tense.",
    emotion: "calm"
  }
];

export const initialActivities = [
  {
    id: "a-1",
    title: "Sunset Yoga",
    host: "yogini_sun",
    date: "2026-05-17T18:30",
    location: "Marina Barrage",
    lat: 1.2809,
    lng: 103.8717,
    capacity: 10,
    joined: 6,
    type: "Movement"
  },
  {
    id: "a-2",
    title: "Mental Health Circle",
    host: "mindful_jo",
    date: "2026-05-16T18:00",
    location: "Online / Singapore",
    lat: 1.3521,
    lng: 103.8198,
    capacity: 20,
    joined: 12,
    type: "Support"
  },
  {
    id: "a-3",
    title: "Morning Park Walk",
    host: "wanderer_99",
    date: "2026-05-18T07:00",
    location: "East Coast Park",
    lat: 1.3008,
    lng: 103.9122,
    capacity: 8,
    joined: 4,
    type: "Outdoor"
  }
];

export const shops = [
  {
    id: "home",
    name: "Nest & Nook",
    category: "Home",
    x: 18,
    y: 28,
    color: "#e97451",
    items: [
      { id: "sofa", name: "Cloud Sofa", price: 350 },
      { id: "lamp", name: "Warm Lamp", price: 140 },
      { id: "rug", name: "Round Rug", price: 180 }
    ]
  },
  {
    id: "style",
    name: "Pawprint Tailor",
    category: "Avatar",
    x: 48,
    y: 20,
    color: "#5d8edb",
    items: [
      { id: "scarf", name: "Soft Scarf", price: 120 },
      { id: "cap", name: "Tiny Cap", price: 90 },
      { id: "satchel", name: "Explorer Satchel", price: 160 }
    ]
  },
  {
    id: "garden",
    name: "Sprout Market",
    category: "Land",
    x: 75,
    y: 34,
    color: "#4fbf7f",
    items: [
      { id: "fern", name: "Fern Planter", price: 80 },
      { id: "tree", name: "Fruit Tree", price: 220 },
      { id: "pond", name: "Tiny Pond", price: 300 }
    ]
  }
];

export const streetPlayers = [
  { id: "p-1", name: "Mia", mood: "calm", x: 28, y: 66 },
  { id: "p-2", name: "Kai", mood: "tired", x: 55, y: 70 },
  { id: "p-3", name: "Zoe", mood: "excited", x: 82, y: 63 }
];
