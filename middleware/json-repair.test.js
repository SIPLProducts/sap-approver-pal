import { describe, expect, it } from "vitest";
import { safeParseSapJson } from "./json-repair.js";

describe("safeParseSapJson", () => {
  it("repairs raw control characters inside SAP JSON string values", () => {
    const raw = '[{"SEARCH_TERM":"PWMP-1180"},{"SEARCH_TERM":"LUCKY\nENGINEERS"},{"SEARCH_TERM":"ARORA REFRACTORIES"}]';

    const parsed = safeParseSapJson(raw);

    expect(parsed.repaired).toBe(true);
    expect(parsed.value).toEqual([
      { SEARCH_TERM: "PWMP-1180" },
      { SEARCH_TERM: "LUCKY\nENGINEERS" },
      { SEARCH_TERM: "ARORA REFRACTORIES" },
    ]);
  });

  it("keeps existing SAP repairs for missing values and dangling commas", () => {
    const parsed = safeParseSapJson('[{"SEARCH_TERM":"PWMP-1180","EXTRA":,}]');

    expect(parsed.repaired).toBe(true);
    expect(parsed.value).toEqual([{ SEARCH_TERM: "PWMP-1180", EXTRA: null }]);
  });
});