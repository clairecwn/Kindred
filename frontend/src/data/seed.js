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
    type: "Movement",
    description: "Gentle outdoor yoga at sunset.",
    hostCharacter: { animal: "bunny", skin: "ivory", outfit: "kimono" },
    participants: ["yogini_sun", "Mia", "Ari", "Sam", "Noor", "Jules"]
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
    type: "Support",
    description: "Small group sharing circle with guided reflection.",
    hostCharacter: { animal: "cat", skin: "sky", outfit: "hoodie" },
    participants: ["mindful_jo", "Kai", "Ren", "Tala", "Bea"]
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
    type: "Outdoor",
    description: "Easy morning walk with coffee after.",
    hostCharacter: { animal: "fox", skin: "honey", outfit: "explorer" },
    participants: ["wanderer_99", "Zoe", "Min", "Chris"]
  }
];

export const shops = [
  {
    id: "home",
    name: "Nest & Nook",
    category: "Home",
    x: 18,
    y: 32,
    color: "#e97451",
    items: [
      { id: "sofa", type: "sofa", name: "Cloud Sofa", price: 350, description: "A soft living-room centerpiece for visits and quiet idle moments." },
      { id: "lamp", type: "lamp", name: "Warm Lamp", price: 140, description: "Adds a warm animated glow to your home world." },
      { id: "rug", type: "rug", name: "Round Rug", price: 180, description: "A cozy floor piece for decorating social corners." }
    ]
  },
  {
    id: "style",
    name: "Pawprint Tailor",
    category: "Avatar",
    x: 48,
    y: 24,
    color: "#5d8edb",
    items: [
      { id: "scarf", type: "scarf", name: "Soft Scarf", price: 0, description: "A layered neck accessory that pairs with most outfits." },
      { id: "cap", type: "cap", name: "Tiny Cap", price: 90, description: "A compact hat for a playful street look." },
      { id: "satchel", type: "satchel", name: "Explorer Satchel", price: 160, description: "A crossbody accessory for outings and activity hosting." }
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
      { id: "fern", type: "fern", name: "Fern Planter", price: 0, description: "A small animated plant for home paths and shop patios." },
      { id: "tree", type: "tree", name: "Fruit Tree", price: 220, description: "A friendly landmark that adds height and shade." },
      { id: "pond", type: "pond", name: "Tiny Pond", price: 300, description: "A rippling water decoration for garden depth." }
    ]
  },
  {
    id: "arcade",
    name: "Soft Arena",
    category: "Games",
    x: 32,
    y: 58,
    color: "#d76ba8",
    items: [
      { id: "arena-token", type: "token", name: "Practice Token", price: 0, description: "Unlocks gentle bot matches for coins and low-pressure practice." },
      { id: "team-banner", type: "banner", name: "Team Banner", price: 210, description: "A small banner for friend matches and world bridges." },
      { id: "spark-trail", type: "trail", name: "Spark Trail", price: 260, description: "A soft movement trail when walking through social spaces." }
    ]
  },
  {
    id: "estate",
    name: "House Registry",
    category: "Homes",
    x: 66,
    y: 58,
    color: "#8e7cc3",
    items: [
      { id: "loft", type: "house", name: "Canopy Loft", price: 520, description: "A taller home shell with a balcony and garden deck." },
      { id: "lakehouse", type: "house", name: "Lakehouse", price: 680, description: "A calm waterside home that expands your decorating land." },
      { id: "tea-garden", type: "house", name: "Tea Garden Lot", price: 0, description: "A free starting extension for visits with close friends." }
    ]
  }
];

export const streetPlayers = [
  { id: "p-1", name: "Mia", mood: "calm", x: 24, y: 70, status: "hosting a tea-room bridge" },
  { id: "p-2", name: "Kai", mood: "tired", x: 52, y: 74, status: "looking for a bot match" },
  { id: "p-3", name: "Zoe", mood: "excited", x: 82, y: 66, status: "shopping for arcade gear" },
  { id: "p-4", name: "Noor", mood: "grateful", x: 43, y: 52, status: "decorating a lakehouse" }
];
