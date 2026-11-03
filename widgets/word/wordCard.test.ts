import { describe, expect, it } from "vitest";
import type { HaEntity } from "@dashboard/shared";
import { readWordCard } from "./wordCard.ts";

function sensor(state: string, attributes: Record<string, unknown> = {}): HaEntity {
  return {
    entity_id: "sensor.test",
    state,
    attributes,
    last_changed: "2026-01-01T00:00:00Z",
    last_updated: "2026-01-01T00:00:00Z",
  };
}

describe("readWordCard", () => {
  it("reads every field and capitalizes the word", () => {
    const definition = sensor("Using few words.", {
      phonetic: "/ləˈkɒnɪk/",
      meanings: [{ partOfSpeech: "adjective" }, { partOfSpeech: "noun" }],
    });
    expect(readWordCard(sensor("laconic"), definition)).toEqual({
      word: "Laconic",
      phonetic: "/ləˈkɒnɪk/",
      partOfSpeech: "adjective",
      definition: "Using few words.",
    });
  });

  it("leaves out a missing pronunciation and part of speech", () => {
    const card = readWordCard(sensor("laconic"), sensor("Using few words.", { phonetic: "" }));
    expect(card.phonetic).toBeNull();
    expect(card.partOfSpeech).toBeNull();
  });

  it("tolerates a malformed meanings attribute", () => {
    for (const meanings of ["adjective", [], [null], [{}], [{ partOfSpeech: 1 }]]) {
      const card = readWordCard(sensor("laconic"), sensor("Defined.", { meanings }));
      expect(card.partOfSpeech).toBeNull();
    }
  });

  it("treats unknown and unavailable sensors as having no value", () => {
    const card = readWordCard(sensor("unknown"), sensor("unavailable"));
    expect(card.word).toBeNull();
    expect(card.definition).toBeNull();
  });

  it("handles sensors that don't exist", () => {
    expect(readWordCard(undefined, undefined)).toEqual({
      word: null,
      phonetic: null,
      partOfSpeech: null,
      definition: null,
    });
  });

  it("passes through the sensor's own not-found message", () => {
    const card = readWordCard(sensor("zzzz"), sensor("No definition found"));
    expect(card.definition).toBe("No definition found");
  });
});
