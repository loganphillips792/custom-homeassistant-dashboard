import type { HaEntity } from "@sdk";

const NO_VALUE = ["unknown", "unavailable", ""];

export interface WordCard {
  word: string | null;
  phonetic: string | null;
  partOfSpeech: string | null;
  definition: string | null;
}

function value(entity: HaEntity | undefined): string | null {
  return entity && !NO_VALUE.includes(entity.state) ? entity.state : null;
}

function firstPartOfSpeech(meanings: unknown): string | null {
  if (!Array.isArray(meanings)) return null;
  const first: unknown = meanings[0];
  if (typeof first !== "object" || first === null || !("partOfSpeech" in first)) return null;
  return typeof first.partOfSpeech === "string" && first.partOfSpeech ? first.partOfSpeech : null;
}

/**
 * Reads the two sensors, leaving out whatever they don't have. Not every dictionary entry has a
 * pronunciation, and the definition sensor goes unavailable when its lookup fails.
 */
export function readWordCard(
  word: HaEntity | undefined,
  definition: HaEntity | undefined,
): WordCard {
  const { phonetic, meanings } = definition?.attributes ?? {};
  const text = value(word);
  return {
    word: text && text.charAt(0).toUpperCase() + text.slice(1),
    phonetic: typeof phonetic === "string" && phonetic ? phonetic : null,
    partOfSpeech: firstPartOfSpeech(meanings),
    definition: value(definition),
  };
}
