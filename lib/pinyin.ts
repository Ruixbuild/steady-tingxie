// Pinyin normalization + live tone-mark rendering, per handoff spec §9.

const TONE_VOWELS: Record<string, [string, number]> = {
  ā: ["a", 1], á: ["a", 2], ǎ: ["a", 3], à: ["a", 4],
  ō: ["o", 1], ó: ["o", 2], ǒ: ["o", 3], ò: ["o", 4],
  ē: ["e", 1], é: ["e", 2], ě: ["e", 3], è: ["e", 4],
  ī: ["i", 1], í: ["i", 2], ǐ: ["i", 3], ì: ["i", 4],
  ū: ["u", 1], ú: ["u", 2], ǔ: ["u", 3], ù: ["u", 4],
  ǖ: ["ü", 1], ǘ: ["ü", 2], ǚ: ["ü", 3], ǜ: ["ü", 4],
};

const MARK_TABLE: Record<string, [string, string, string, string]> = {
  a: ["ā", "á", "ǎ", "à"],
  o: ["ō", "ó", "ǒ", "ò"],
  e: ["ē", "é", "ě", "è"],
  i: ["ī", "í", "ǐ", "ì"],
  u: ["ū", "ú", "ǔ", "ù"],
  ü: ["ǖ", "ǘ", "ǚ", "ǜ"],
};

/** Reverses any tone-mark vowel in a syllable back to its bare base letter (drops the tone, keeps no digit) — used when re-marking a syllable the child already put a tone on. */
export function stripToneMark(syllable: string): string {
  let base = "";
  for (const ch of syllable) {
    const marked = TONE_VOWELS[ch];
    base += marked ? marked[0] : ch;
  }
  return base;
}

/** One syllable, possibly containing a tone-mark vowel or a trailing digit, to canonical lowercase base-letters+digit form (no digit = neutral). */
export function toBaseDigit(syllable: string): string {
  const s = syllable.toLowerCase().replace(/v/g, "ü");

  const trailingDigit = s.match(/^(.*?)([1-4])$/);
  if (trailingDigit && !/[āáǎàōóǒòēéěèīíǐìūúǔùǖǘǚǜ]/.test(s)) {
    return s; // already base-letters+digit
  }

  let tone: number | null = null;
  let base = "";
  for (const ch of s) {
    const marked = TONE_VOWELS[ch];
    if (marked) {
      base += marked[0];
      tone = marked[1];
    } else {
      base += ch;
    }
  }

  return tone ? `${base}${tone}` : base;
}

/** Full possibly-multi-syllable string, e.g. "ni3 hao3", to canonical form for equality checks. */
export function normalize(input: string): string {
  return input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(toBaseDigit)
    .join(" ");
}

/**
 * Live-render a syllable as the child types digits: 'v'->'ü' is unconditional
 * (applies before any digit arrives), then a>o>e priority, else scan
 * left-to-right and mark the rightmost of i/u/ü present. (This positional
 * scan also naturally covers the spec's "iu"->u rule: in any syllable
 * containing "iu", u is the rightmost of {i,u,ü} by construction, so no
 * separate special case is needed here.)
 */
export function digitsToMarks(syllable: string): string {
  const s = syllable.toLowerCase().replace(/v/g, "ü");
  const match = s.match(/^(.*)([1-4])$/);
  if (!match) return s;

  const [, base, toneStr] = match;
  const tone = Number(toneStr);

  let targetIndex = -1;
  let targetVowel = "";

  if (base.includes("a")) {
    targetIndex = base.indexOf("a");
    targetVowel = "a";
  } else if (base.includes("o")) {
    targetIndex = base.indexOf("o");
    targetVowel = "o";
  } else if (base.includes("e")) {
    targetIndex = base.indexOf("e");
    targetVowel = "e";
  } else {
    for (let i = 0; i < base.length; i++) {
      if (base[i] === "i" || base[i] === "u" || base[i] === "ü") {
        targetIndex = i;
        targetVowel = base[i];
      }
    }
  }

  if (targetIndex === -1) return base;

  const marked = MARK_TABLE[targetVowel][tone - 1];
  return base.slice(0, targetIndex) + marked + base.slice(targetIndex + 1);
}

/** Applies digitsToMarks per-syllable to a full (possibly multi-syllable) live input string. */
export function liveRender(input: string): string {
  return input
    .split(/(\s+)/)
    .map((part) => (part.trim() ? digitsToMarks(part) : part))
    .join("");
}

/** Full possibly-multi-syllable string in any input form (digits, tone
 * marks, or a mix) to tone-mark form for display — e.g. showing a
 * correction as "nǐ hǎo" rather than "ni3 hao3". */
export function toMarks(input: string): string {
  return input
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((syl) => digitsToMarks(toBaseDigit(syl)))
    .join(" ");
}

export type PinyinVerdict = "exact" | "tones-wrong" | "wrong";

export function verdict(input: string, answer: string): PinyinVerdict {
  const normInput = normalize(input);
  const normAnswer = normalize(answer);

  if (normInput === normAnswer) return "exact";

  const lettersOnly = (s: string) => s.replace(/[1-4]/g, "");
  if (lettersOnly(normInput) === lettersOnly(normAnswer)) return "tones-wrong";

  return "wrong";
}
