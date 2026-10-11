/**
 * Shared passage and scoring for the SynthID passage/detection components.
 *
 * Both components must agree on every g-score, so the passage, the key, and the
 * scoring live here rather than in either component: the generator writes the
 * passage by keeping the highest-g candidate at each position, and the
 * detector re-derives the same g-scores from only the key and the written text.
 *
 * Simplifications (captioned on screen): each position is keyed on the single
 * previous word rather than an n-gram, and the highest-g candidate wins
 * outright instead of a bracket over draws from the model's probabilities.
 * Words with one option are the low-entropy case: they're written regardless,
 * still scored by the detector, and carry no signal.
 */

/** One position in the passage; `options[0]` is what the human author wrote. */
export type Slot = { readonly options: readonly string[]; readonly after?: string };

export type Candidate = { readonly word: string; readonly g: number };

export type WrittenWord = {
  readonly word: string;
  /** The previous word (lowercased), which keys this position's g-scores. */
  readonly context: string;
  readonly g: number;
  /** Every option scored at this position; a single entry means no choice. */
  readonly candidates: readonly Candidate[];
  /** Punctuation printed after the word. */
  readonly after: string;
};

export type Writer = "watermarked" | "human";

export type MeanGTest = { readonly meanG: number; readonly z: number };

// Chosen so the default views read cleanly: the watermarked passage clears the
// z >= 4 bar (z ≈ 4.8) and the human one sits on the 0.5
// baseline (z ≈ 0). Re-verify both with a quick node script if the key or the
// passage changes.
const KEY = "key-79";

/** Word before the first slot; keys the opening position. */
export const PROMPT = "After";

const PASSAGE: readonly Slot[] = [
  { options: ["the"] },
  { options: ["storm", "rain", "flood", "gale"] },
  { options: ["passed", "cleared", "ended", "eased"], after: "," },
  { options: ["the"] },
  { options: ["village", "town", "harbor", "valley"] },
  { options: ["felt", "seemed", "looked", "sat"] },
  { options: ["quiet", "calm", "still", "hushed"], after: "." },
  { options: ["Neighbors", "Locals", "Families", "Volunteers"] },
  { options: ["gathered", "met", "worked", "walked"] },
  { options: ["along"] },
  { options: ["the"] },
  { options: ["river", "shore", "road", "square"], after: "," },
  { options: ["clearing", "sweeping", "hauling", "stacking"] },
  { options: ["branches", "debris", "mud", "stones"] },
  { options: ["and"] },
  { options: ["sharing", "trading", "swapping", "comparing"] },
  { options: ["stories", "news", "rumors", "notes"] },
  { options: ["until"] },
  { options: ["dusk", "dark", "nightfall", "sundown"], after: "." },
  { options: ["The"] },
  { options: ["old", "small", "stone", "wooden"] },
  { options: ["bridge", "pier", "wall", "church"] },
  { options: ["had"] },
  { options: ["held", "survived", "stood", "lasted"], after: "," },
  { options: ["and"] },
  { options: ["most", "many", "some", "all"] },
  { options: ["agreed", "said", "felt", "thought"] },
  { options: ["it"] },
  { options: ["could", "might", "would", "may"] },
  { options: ["have"] },
  { options: ["been"] },
  { options: ["worse", "deadlier", "harder", "grimmer"], after: "." },
];

/** One more than the largest {@link keyedHash}; dividing by it maps a hash into [0, 1). */
export const HASH_RANGE = 4294967296;

/**
 * Mix the key, the previous word, and this word into one unsigned 32-bit
 * number: FNV-1a over key|context|word with a mulberry32 finaliser. Exposed so
 * the detection component can show the raw number before it's scaled.
 */
export function keyedHash(context: string, word: string): number {
  const s = `${KEY}|${context.toLowerCase()}|${word.toLowerCase()}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h = Math.imul(h ^ (h >>> 15), 1 | h);
  h = (h + Math.imul(h ^ (h >>> 7), 61 | h)) ^ h;

  return (h ^ (h >>> 14)) >>> 0;
}

/**
 * Keyed pseudorandom g-score in [0, 1). Depends only on the key and the text,
 * never the model, which is what lets a detector recompute it.
 */
export function gScore(context: string, word: string): number {
  return keyedHash(context, word) / HASH_RANGE;
}

/**
 * Write the passage word by word. The watermarked writer keeps the highest-g
 * candidate (ties fall to the earlier option); the human writer keeps their
 * own word, `options[0]`. Either way the next position is keyed on the word
 * actually written.
 */
export function writePassage(writer: Writer): WrittenWord[] {
  const out: WrittenWord[] = [];
  let context = PROMPT.toLowerCase();
  for (const slot of PASSAGE) {
    const candidates = slot.options.map((word) => ({ word, g: gScore(context, word) }));
    const chosen =
      writer === "human"
        ? candidates[0]!
        : candidates.reduce((best, c) => (c.g > best.g ? c : best));
    out.push({ word: chosen.word, context, g: chosen.g, candidates, after: slot.after ?? "" });
    context = chosen.word.toLowerCase();
  }

  return out;
}

/**
 * Mean-g z-test against unwatermarked text, where each g is uniform on [0, 1)
 * (mean 0.5, variance 1/12). Only a high mean counts as evidence.
 * An empty list scores as the null.
 */
export function meanGTest(gs: readonly number[]): MeanGTest {
  if (gs.length === 0) return { meanG: 0.5, z: 0 };

  const meanG = gs.reduce((sum, g) => sum + g, 0) / gs.length;
  const z = (meanG - 0.5) / Math.sqrt(1 / 12 / gs.length);

  return { meanG, z };
}

/** Same bar as the green-list detector: z >= 4 reads as watermarked. */
export const isFlagged = (z: number): boolean => z >= 4;
