import { describe, expect, it } from "vitest";
import { collectSapMessages, extractFalseStatusMessage, extractMessagesArrayError } from "./sap-message";

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
describe("collectSapMessages", () => {
  it("returns every message exactly as received, in order", () => {
    expect(
      collectSapMessages({
        data: {
          MESSAGES: [
            { TYPE: "E", MESSAGE: "Document Already Approved" },
            { TYPE: "E", MESSAGE: "YOU ARE NOT AUTHORIZED FOR HOD APPROVAL" },
          ],
        },
      }),
    ).toEqual([
      { type: "E", message: "Document Already Approved" },
      { type: "E", message: "YOU ARE NOT AUTHORIZED FOR HOD APPROVAL" },
    ]);
  });

  it("falls back to a single envelope message", () => {
    expect(collectSapMessages({ TYPE: "E", MSGTXT: "No POs Found" })).toEqual([
      { type: "E", message: "No POs Found" },
    ]);
  });

  it("returns an empty list when there is no message", () => {
    expect(collectSapMessages({ DATA: [{ MATERIAL: "1" }] })).toEqual([]);
  });
});
