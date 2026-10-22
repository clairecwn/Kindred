/**
 * spelling.js — reading kids' and fast-typed spelling without "correcting"
 * the user. Nothing here changes what the user sees; it only lets the
 * affect lexicon recognise a word it would otherwise miss.
 *
 * Two layers, both deterministic:
 *   1. PHONETIC MAP of common developmental and texting spellings
 *      ("tierd", "lonley", "embarased", "hapy"). Exact, high confidence.
 *   2. GUARDED EDIT DISTANCE against the affect lexicon: Damerau-Levenshtein
 *      distance 1, only for words of 6+ letters sharing the first letter.
 *      Short words are excluded because one edit turns "years" into "fears".
 *      A fuzzy match carries FUZZY_WEIGHT, so it counts less than a real hit.
 */

import { VAD_LEXICON, lookupToken } from "./lexicon.js";

export const SPELLING_VERSION = "spelling-2026.10.1";
export const FUZZY_WEIGHT = 0.6;
export const PHONETIC_WEIGHT = 0.9;

export const PHONETIC_MAP = Object.freeze({
  hapy: "happy", hapi: "happy", happie: "happy", hppy: "happy",
  saad: "sad", sadd: "sad",
  angy: "angry", angery: "angry", angrey: "angry",
  scard: "scared", scaird: "scared", skared: "scared", scarred: "scared",
  anoyed: "annoyed", anoid: "annoyed", annoied: "annoyed",
  frustated: "frustrated", frusterated: "frustrated", frustraited: "frustrated",
  lonley: "lonely", lonly: "lonely", lonelee: "lonely",
  embarased: "embarrassed", embarassed: "embarrassed", embarrased: "embarrassed",
  nervus: "nervous", nervos: "nervous", nervouse: "nervous",
  worryed: "worried", woried: "worried", wurried: "worried",
  stresed: "stressed", stresd: "stressed", stresss: "stressed",
  tierd: "tired", tird: "tired", tiered: "tired", tiyerd: "tired",
  jelous: "jealous", jellus: "jealous", jelly: "jealous",
  exsited: "excited", excitd: "excited", exiceted: "excited",
  upsat: "upset", upseted: "upset",
  gud: "good", gd: "good",
  luv: "love", lub: "love",
  h8: "hate", h8te: "hate", gr8: "great", gr8t: "great",
  bord: "bored", boared: "bored", boored: "bored",
  wierd: "weird",
  awsome: "awesome", awsum: "awesome",
  greatful: "grateful", gratefull: "grateful",
  sory: "sorry", sowwy: "sorry", sry: "sorry", soz: "sorry",
  afriad: "afraid", afaid: "afraid",
  misrable: "miserable", miserible: "miserable",
});

function damerauWithin1(a, b) {
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i += 1;
  if (la === lb) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true;                         // substitution
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2); // transposition
  }
  return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1); // deletion / insertion
}

const FUZZY_KEYS = Object.keys(VAD_LEXICON).filter((key) => key.length >= 6 && /^[a-z]+$/.test(key));

/**
 * @returns {null | { key, v, a, d, weight, via: "phonetic"|"fuzzy", surface }}
 */
export function lookupMisspelling(word) {
  const raw = String(word ?? "").toLowerCase().replace(/['’]/g, "");
  if (!raw || !/^[a-z0-9]+$/.test(raw)) return null;
  const mapped = PHONETIC_MAP[raw];
  if (mapped && mapped !== raw) {
    const entry = lookupToken(mapped);
    if (entry) return { ...entry, weight: PHONETIC_WEIGHT, via: "phonetic", surface: raw };
  }
  if (raw.length < 6) return null;
  const candidates = FUZZY_KEYS.filter((key) => key[0] === raw[0] && damerauWithin1(raw, key));
  if (candidates.length !== 1) return null; // ambiguous or nothing: no guess
  const entry = lookupToken(candidates[0]);
  return entry ? { ...entry, weight: FUZZY_WEIGHT, via: "fuzzy", surface: raw } : null;
}
