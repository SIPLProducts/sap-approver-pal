import { describe, expect, it } from "vitest";
import {
  extractSearchTermOptions,
  getSearchTermParseError,
} from "./search-term-multi-select";

describe("extractSearchTermOptions", () => {
  it("maps Get_Search_Term rows preserving SAP response order", () => {
    expect(
      extractSearchTermOptions([
        { SEARCH_TERM: "PWMP-1180" },
        { SEARCH_TERM: "LUCKY ENGINEERS" },
        { SEARCH_TERM: "ARORA REFRACTORIES" },
      ]),
    ).toEqual([
      { code: "PWMP-1180", text: "" },
      { code: "LUCKY ENGINEERS", text: "" },
      { code: "ARORA REFRACTORIES", text: "" },
    ]);
  });

  it("unwraps generic middleware response envelopes", () => {
    expect(
      extractSearchTermOptions({
        ok: true,
        status: 200,
        data: {
          data: JSON.stringify([{ SEARCH_TERM: "PWMP-1180" }]),
        },
      }),
    ).toEqual([{ code: "PWMP-1180", text: "" }]);
  });

  it("surfaces middleware parse errors instead of returning empty options silently", () => {
    expect(
      getSearchTermParseError({
        data: {
          __parse_error: "Bad control character in string literal in JSON",
          __raw_preview: "[{...",
        },
      }),
    ).toBe("Bad control character in string literal in JSON");
  });
});