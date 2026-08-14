import { describe, expect, it } from "vitest";
import { extractFalseStatusMessage } from "./sap-message";

describe("extractFalseStatusMessage", () => {
  it("returns MSGTXT from a top-level STATUS FALSE response", () => {
    expect(extractFalseStatusMessage({ STATUS: "FALSE", MSGTXT: "No POs Found" })).toBe(
      "No POs Found",
    );
  });

  it("finds case-insensitive STATUS FALSE inside middleware and array wrappers", () => {
    expect(
      extractFalseStatusMessage({
        ok: true,
        data: { GET: [{ status: "false", msgtxt: "No POs Found" }] },
      }),
    ).toBe("No POs Found");
  });

  it("does not treat successful rows as failures", () => {
    expect(extractFalseStatusMessage({ data: [{ STATUS: "TRUE", EBELN: "4500000010" }] })).toBeNull();
  });
});