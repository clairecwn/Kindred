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
    y: 28,
    color: "#e97451",
    items: [
      { id: "sofa", name: "Cloud Sofa", price: 350, description: "A soft living-room centerpiece for visits and quiet idle moments." },
      { id: "lamp", name: "Warm Lamp", price: 140, description: "Adds a warm animated glow to your home world." },
      { id: "rug", name: "Round Rug", price: 180, description: "A cozy floor piece for decorating social corners." }
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
      { id: "scarf", name: "Soft Scarf", price: 120, description: "A layered neck accessory that pairs with most outfits." },
      { id: "cap", name: "Tiny Cap", price: 90, description: "A compact hat for a playful street look." },
      { id: "satchel", name: "Explorer Satchel", price: 160, description: "A crossbody accessory for outings and activity hosting." }
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
      { id: "fern", name: "Fern Planter", price: 80, description: "A small animated plant for home paths and shop patios." },
      { id: "tree", name: "Fruit Tree", price: 220, description: "A friendly landmark that adds height and shade." },
      { id: "pond", name: "Tiny Pond", price: 300, description: "A rippling water decoration for garden depth." }
    ]
  }
];

export const streetPlayers = [
  { id: "p-1", name: "Mia", mood: "calm", x: 28, y: 66, status: "hosting a tea-room bridge" },
  { id: "p-2", name: "Kai", mood: "tired", x: 55, y: 70, status: "looking for a bot match" },
  { id: "p-3", name: "Zoe", mood: "excited", x: 82, y: 63, status: "shopping for arcade gear" }
];
