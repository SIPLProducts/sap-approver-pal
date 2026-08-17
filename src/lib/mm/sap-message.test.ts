import { describe, expect, it } from "vitest";
import { extractFalseStatusMessage, extractMessagesArrayError } from "./sap-message";

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

describe("extractMessagesArrayError", () => {
  it("returns the exact MESSAGE of the first E entry", () => {
    expect(
      extractMessagesArrayError({
        MESSAGES: [
          { TYPE: "S", MESSAGE: "Processed" },
          { TYPE: "E", MESSAGE: "Gate pass not found" },
        ],
      }),
    ).toBe("Gate pass not found");
  });

  it("finds MESSAGES nested inside middleware wrappers", () => {
    expect(
      extractMessagesArrayError({ data: { GET: { MESSAGES: [{ TYPE: "A", MESSAGE: "Aborted" }] } } }),
    ).toBe("Aborted");
  });

  it("ignores success-only message arrays", () => {
    expect(extractMessagesArrayError({ MESSAGES: [{ TYPE: "S", MESSAGE: "ok" }] })).toBeNull();
  });
});