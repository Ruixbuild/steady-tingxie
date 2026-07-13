// In-memory LRU cache + CDN loader for hanzi-writer stroke data, per handoff spec §9:
// "char data: LRU -> jsdelivr hanzi-writer-data@2.0/{char}.json; prefetch list chars
// on hub mount; failure -> friendly retry copy."

export type CharacterJson = {
  strokes: string[];
  medians: number[][][];
  radStrokes?: number[];
};

const MAX_ENTRIES = 200;
const cache = new Map<string, CharacterJson>();

function cacheGet(char: string): CharacterJson | undefined {
  const hit = cache.get(char);
  if (hit) {
    // refresh recency
    cache.delete(char);
    cache.set(char, hit);
  }
  return hit;
}

function cacheSet(char: string, data: CharacterJson) {
  if (cache.has(char)) cache.delete(char);
  cache.set(char, data);
  if (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

async function fetchCharData(char: string): Promise<CharacterJson> {
  const url = `https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/${encodeURIComponent(char)}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No stroke data for "${char}"`);
  return (await res.json()) as CharacterJson;
}

/** Cache-checked promise-based getter, shared by charDataLoader, prefetchChars, and getCharData. */
async function loadCharData(char: string): Promise<CharacterJson> {
  const cached = cacheGet(char);
  if (cached) return cached;
  const data = await fetchCharData(char);
  cacheSet(char, data);
  return data;
}

/** Matches hanzi-writer's CharDataLoaderFn signature. */
export function charDataLoader(
  char: string,
  onLoad: (data: CharacterJson) => void,
  onError: (err?: unknown) => void
): void {
  loadCharData(char).then(onLoad).catch(onError);
}

/** Promise-based getter, e.g. for Test mode's own stroke-count pass/fail threshold. */
export function getCharData(char: string): Promise<CharacterJson> {
  return loadCharData(char);
}

/** Fire-and-forget warm-up, called on list hub mount. */
export function prefetchChars(chars: string[]) {
  const unique = Array.from(new Set(chars.filter((c) => !cacheGet(c))));
  for (const char of unique) {
    loadCharData(char).catch(() => {
      // silent — the ladder/quiz will retry with friendly copy when actually needed
    });
  }
}
