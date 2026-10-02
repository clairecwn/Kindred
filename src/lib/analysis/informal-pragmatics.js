/**
 * Contextual internet shorthand and informal-writing pragmatics.
 *
 * These forms are not expanded into fixed emotions. "lmao" can mark genuine
 * amusement, soften a complaint, or frame disbelief; "wtf" can intensify
 * delight or anger; "gg" can praise a game or resign to a bad outcome.
 */

export const INFORMAL_PRAGMATICS_VERSION = "informal-pragmatics-2026.10.1";

const ENTRIES = Object.freeze([
  { token: "fml", forms: ["fml", "fmlll"], function: "distress", gloss: "strong fed-up or defeated reaction", v: -0.72, a: 0.42, d: -0.48 },
  { token: "smh", forms: ["smh", "smfh"], function: "disapproval", gloss: "disapproval, disbelief, or weary frustration", v: -0.34, a: 0.30, d: 0.02 },
  { token: "yikes", forms: ["yikes", "yikess"], function: "alarm", gloss: "alarm, discomfort, or negative surprise", v: -0.35, a: 0.52, d: -0.18 },
  { token: "oof", forms: ["oof", "ooff"], function: "impact", gloss: "sympathetic discomfort, setback, or being taken aback", v: -0.25, a: 0.24, d: -0.14 },
  { token: "cringe", forms: ["cringe", "cringey", "cringy"], function: "disapproval", gloss: "embarrassed discomfort or social disapproval", v: -0.38, a: 0.28, d: -0.06 },
  { token: "mid", forms: ["mid"], function: "disapproval", gloss: "dismissively mediocre or disappointing", v: -0.24, a: -0.08, d: 0.08 },

  { token: "slay", forms: ["slay", "slayed", "slayyy"], function: "praise", gloss: "strong approval or admiration", v: 0.56, a: 0.55, d: 0.46 },
  { token: "goated", forms: ["goated", "the goat"], function: "praise", gloss: "exceptionally good; strong approval", v: 0.62, a: 0.45, d: 0.50 },
  { token: "that slaps", forms: ["that slaps", "this slaps"], function: "praise", gloss: "highly enjoyable or impressive", v: 0.60, a: 0.52, d: 0.38 },
  { token: "ate that", forms: ["ate that", "ate and left no crumbs"], function: "praise", gloss: "performed extremely well", v: 0.62, a: 0.52, d: 0.52 },

  { token: "wtf", forms: ["wtf", "wtaf", "what the fuck"], function: "exclamation", gloss: "strong shock, disbelief, frustration, or awe", bias: -0.10, a: 0.68 },
  { token: "wth", forms: ["wth", "wthelly", "what the hell"], function: "exclamation", gloss: "shock, disbelief, or frustrated questioning", bias: -0.08, a: 0.55 },
  { token: "omfg", forms: ["omfg", "omggg", "oh my fucking god"], function: "exclamation", gloss: "very strong surprise; direction comes from context", bias: 0, a: 0.72 },
  { token: "omg", forms: ["omg", "oh my god", "ohmygod"], function: "exclamation", gloss: "surprise or emphasis; can be positive or negative", bias: 0, a: 0.52 },
  { token: "bruh", forms: ["bruh", "bruhh", "bruhhh"], function: "address-exasperation", gloss: "address marker often framing disbelief or exasperation; context-dependent", bias: -0.04, a: 0.26 },

  // A small, sourced cross-cultural starter set. These remain explicit
  // interjections rather than identity guesses; code-mixing is not evidence
  // of ethnicity, location, or a single emotional norm.
  { token: "hay naku", forms: ["hay naku", "hay nako", "ay naku", "ay nako"], function: "exasperation", gloss: "Filipino interjection commonly expressing annoyance, desperation, or weary frustration", v: -0.28, a: 0.18, d: -0.06 },
  { token: "hala", forms: ["hala", "halaaa"], function: "exclamation", gloss: "Filipino warning or surprise marker; emotional direction comes from context", bias: -0.04, a: 0.40 },
  { token: "sayang", forms: ["sayang"], function: "regret", gloss: "Filipino expression of pity, regret, or a missed opportunity", v: -0.34, a: -0.02, d: -0.18 },
  { token: "grabe", forms: ["grabe", "grabeee"], function: "exclamation", gloss: "Filipino intensity marker roughly 'too much/extreme'; direction comes from context", bias: 0, a: 0.42 },

  { token: "lmao", forms: ["lmao", "lmfao", "rofl", "roflmao"], function: "laughter", gloss: "strong laughter marker that can also soften distress or frame disbelief", a: 0.45 },
  { token: "lol", forms: ["lol", "lolol", "lel"], function: "laughter", gloss: "laughter or a tone-softening discourse marker; not automatically positive", a: 0.24 },
  { token: "haha", forms: ["haha", "hahaha", "hehe", "hehehe"], function: "laughter", gloss: "written laughter; surrounding content determines whether it is joy, awkwardness, or softening", a: 0.28 },

  { token: "ggwp", forms: ["ggwp", "gg wp", "good game well played"], function: "praise", gloss: "sportsmanlike praise or positive closure", v: 0.36, a: 0.18, d: 0.26 },
  { token: "gg bro", forms: ["gg bro", "ggs bro"], function: "resigned-closure", gloss: "often frames an outcome as over or lost; can be playful, so confidence stays modest", v: -0.30, a: -0.05, d: -0.28 },
  { token: "gg", forms: ["gg", "ggs"], function: "outcome", gloss: "good-game praise or resigned 'it is over'; surrounding outcome determines direction", a: 0.08 },

  { token: "idk", forms: ["idk", "idek"], function: "uncertainty", gloss: "uncertainty or difficulty articulating", d: -0.12 },
  { token: "tbh", forms: ["tbh", "ngl", "not gonna lie"], function: "candour", gloss: "frames the following statement as candid or contrastive" },
  { token: "fr", forms: ["fr", "frfr", "for real"], function: "agreement-intensifier", gloss: "sincerity, agreement, or emphasis" },
  { token: "ikr", forms: ["ikr"], function: "agreement", gloss: "strong agreement with shared stance" },
  { token: "wdym", forms: ["wdym", "wym"], function: "clarification-challenge", gloss: "request for clarification, often with disbelief", a: 0.15 },
  { token: "no cap", forms: ["no cap"], function: "sincerity", gloss: "asserts that the statement is truthful or sincere" },
  { token: "deadass", forms: ["deadass"], function: "agreement-intensifier", gloss: "seriousness or strong emphasis; not a death reference" },
]);

const NORMALISATIONS = Object.freeze([
  [/\btdy\b/gi, "today"], [/\btmrw?\b/gi, "tomorrow"], [/\brn\b/gi, "right now"],
  [/\bbc\b/gi, "because"], [/\bbcz\b/gi, "because"], [/\bcuz\b/gi, "because"],
  [/\btho\b/gi, "though"], [/\babt\b/gi, "about"], [/\bppl\b/gi, "people"],
  [/\bu\b/gi, "you"], [/\bur\b/gi, "your"], [/\br\b/gi, "are"],
  [/\bcant\b/gi, "cannot"], [/\bdont\b/gi, "don't"], [/\bwont\b/gi, "won't"],
]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^$()|[\]{}\\]/g, "\\$&");
}

function findEntries(text) {
  const matches = [];
  for (const entry of ENTRIES) {
    for (const form of entry.forms) {
      const re = new RegExp("\\b" + escapeRegExp(form) + "\\b", "gi");
      let match;
      while ((match = re.exec(text)) !== null) {
        matches.push({ ...entry, matchedText: match[0], index: match.index, length: match[0].length });
        if (match.index === re.lastIndex) re.lastIndex += 1;
      }
    }
  }
  matches.sort((a, b) => a.index - b.index || b.length - a.length);
  const accepted = [];
  for (const match of matches) {
    const end = match.index + match.length;
    if (accepted.some((item) => match.index < item.index + item.length && end > item.index)) continue;
    accepted.push(match);
  }
  return accepted.sort((a, b) => a.index - b.index);
}

export function normaliseInformalWriting(text) {
  let normalized = String(text ?? "");
  const replacements = [];
  for (const [pattern, replacement] of NORMALISATIONS) {
    normalized = normalized.replace(pattern, (surface) => {
      replacements.push({ surface, normalized: replacement });
      return replacement;
    });
  }
  return { normalizedText: normalized.replace(/\s+/g, " ").trim(), replacements };
}

export function collapseExpressiveLengthening(word) {
  const raw = String(word ?? "").toLowerCase();
  if (/^reall+y$/.test(raw)) return "really";
  if (/^so+$/.test(raw)) return "so";
  if (/^ver+y$/.test(raw)) return "very";
  if (/^dam+n$/.test(raw)) return "damn";
  return raw.replace(/([a-z])\1{2,}/g, "$1");
}

export function resolveInformalMarkers(text, contextValence = 0) {
  const direction = Math.sign(contextValence);
  const markers = findEntries(String(text ?? "")).map((entry) => {
    let v = entry.v ?? 0;
    let a = entry.a ?? 0;
    let d = entry.d ?? 0;
    let masksDistress = false;

    if (entry.function === "exclamation" || entry.function === "address-exasperation") {
      v = direction === 0 ? (entry.bias ?? 0) : 0.18 * direction + (entry.bias ?? 0);
    } else if (entry.function === "laughter") {
      v = direction > 0 ? 0.24 : direction < 0 ? -0.04 : 0.06;
      masksDistress = direction < 0;
    } else if (entry.function === "outcome") {
      v = direction > 0 ? 0.22 : direction < 0 ? -0.22 : 0;
      d = direction < 0 ? -0.16 : direction > 0 ? 0.16 : 0;
    } else if (entry.function === "uncertainty") {
      v = direction < 0 ? -0.08 : 0;
    } else if (entry.function === "agreement-intensifier") {
      v = direction === 0 ? 0 : 0.08 * direction;
      a = direction === 0 ? 0 : 0.12;
    }

    return {
      token: entry.token,
      matchedText: entry.matchedText,
      index: entry.index,
      length: entry.length,
      function: entry.function,
      gloss: entry.gloss,
      v,
      a,
      d,
      masksDistress,
    };
  });

  const value = String(text ?? "");
  const exclamations = (value.match(/!{2,}|\?{2,}|!\?|\?!/g) ?? []).length;
  const ellipses = (value.match(/\.{3,}/g) ?? []).length;
  const lengthened = (value.match(/\b[a-z]*([a-z])\1{2,}[a-z]*\b/gi) ?? []).length;
  const orthographicArousal = Math.min(0.24, 0.08 * exclamations + 0.05 * lengthened);
  const orthographicDeactivation = Math.min(0.12, 0.04 * ellipses);
  const normalized = normaliseInformalWriting(text);

  return {
    version: INFORMAL_PRAGMATICS_VERSION,
    ...normalized,
    markers,
    orthography: { exclamations, ellipses, lengthened, arousalDelta: orthographicArousal - orthographicDeactivation },
    maskedDistress: markers.some((marker) => marker.masksDistress),
  };
}

export function informalGlossary(analysis) {
  return (analysis?.markers ?? []).map((marker) => ({
    surface: marker.matchedText,
    token: marker.token,
    function: marker.function,
    gloss: marker.gloss,
  }));
}
