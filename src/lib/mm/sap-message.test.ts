import { describe, expect, it } from "vitest";
import {
  collectSapMessages,
  extractFalseStatusMessage,
  extractFalseStatusMessagePreferMessage,
  extractMessagesArrayError,
  extractTypeEErrorMessage,
} from "./sap-message";

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

describe("extractFalseStatusMessagePreferMessage", () => {
  it("returns the exact MESSAGE key for a Gate Pass Save STATUS FALSE response", () => {
    expect(
      extractFalseStatusMessagePreferMessage({ STATUS: "FALSE", MESSAGE: "Please maintain remarks" }),
    ).toBe("Please maintain remarks");
  });

  it("falls back to MSGTXT when MESSAGE is missing", () => {
    expect(
      extractFalseStatusMessagePreferMessage({ data: { GET: { STATUS: "false", MSGTXT: "No data" } } }),
    ).toBe("No data");
  });

  it("ignores successful STATUS TRUE responses", () => {
    expect(extractFalseStatusMessagePreferMessage({ STATUS: "TRUE", MESSAGE: "ok" })).toBeNull();
  });
});

describe("extractMessagesArrayError", () => {
  it("returns the exact Gate Pass Save TYPE E message", () => {
    const response = {
      MESSAGES: [
        {
          TYPE: "E",
          MESSAGE: "Please maintain remarks",
        },
      ],
    };

    expect(extractMessagesArrayError(response)).toBe("Please maintain remarks");
    expect(collectSapMessages(response)).toEqual([
      {
        type: "E",
        message: "Please maintain remarks",
      },
    ]);
  });

  it("returns the exact Material Reservation Save TYPE E message", () => {
    const response = {
      MESSAGES: [
        {
          TYPE: "E",
          MESSAGE: "Requested quantity should be lessthan or equal to total stock",
        },
      ],
    };

    expect(extractMessagesArrayError(response)).toBe(
      "Requested quantity should be lessthan or equal to total stock",
    );
    expect(collectSapMessages(response)).toEqual([
      {
        type: "E",
        message: "Requested quantity should be lessthan or equal to total stock",
      },
    ]);
  });

  it("Gate Pass Plant Head save: full error chain surfaces the exact MESSAGE", () => {
    // Mirrors saveGatePass: extractMessagesArrayError ?? extractTypeEErrorMessage
    // ?? extractFalseStatusMessagePreferMessage.
    const chain = (j: any) =>
      extractMessagesArrayError(j) ??
      extractTypeEErrorMessage(j) ??
      extractFalseStatusMessagePreferMessage(j) ??
      null;

    expect(chain({ MESSAGES: [{ TYPE: "E", MESSAGE: "Please maintain remarks" }] })).toBe(
      "Please maintain remarks",
    );
    expect(chain({ data: { MESSAGES: [{ TYPE: "E", MESSAGE: "Please maintain remarks" }] } })).toBe(
      "Please maintain remarks",
    );
    expect(chain({ STATUS: "FALSE", MESSAGE: "Please maintain remarks" })).toBe(
      "Please maintain remarks",
    );
  });

  it("handles the raw middleware envelope used by Gate Pass Save", () => {
    const middlewareResponse = {
      ok: true,
      status: 200,
      latency_ms: 42,
      data: {
        MESSAGES: [{ TYPE: "E", MESSAGE: "Please maintain remarks" }],
      },
    };

    const sapPayload = middlewareResponse.data;
    expect(extractMessagesArrayError(sapPayload)).toBe("Please maintain remarks");
    expect(collectSapMessages(sapPayload)).toEqual([
      { type: "E", message: "Please maintain remarks" },
    ]);
  });

  it("handles a JSON-encoded raw middleware payload used by Gate Pass Save", () => {
    const middlewareResponse = {
      ok: true,
      status: 200,
      data: JSON.stringify({
        MESSAGES: [{ TYPE: "E", MESSAGE: "Please maintain remarks" }],
      }),
    };

    const sapPayload = JSON.parse(middlewareResponse.data);
    expect(extractMessagesArrayError(sapPayload)).toBe("Please maintain remarks");
    expect(collectSapMessages(sapPayload)).toEqual([
      { type: "E", message: "Please maintain remarks" },
    ]);
  });

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

describe("gate pass save failure shapes", () => {
  it("extracts the exact MESSAGE from a MESSAGES array payload", () => {
    const payload = { MESSAGES: [{ TYPE: "E", MESSAGE: "Please maintain remarks" }] };
    expect(extractMessagesArrayError(payload)).toBe("Please maintain remarks");
    expect(collectSapMessages(payload)).toEqual([
      { type: "E", message: "Please maintain remarks" },
    ]);
  });

  it("flags any E/A entry in collected messages as an error", () => {
    const collected = collectSapMessages({
      MESSAGES: [
        { TYPE: "S", MESSAGE: "Line ok" },
        { TYPE: "E", MESSAGE: "Please maintain remarks" },
      ],
    });
    const firstErr = collected.find((m) =>
      ["E", "A"].includes(String(m.type ?? "").trim().toUpperCase()),
    );
    expect(firstErr?.message).toBe("Please maintain remarks");
  });
});
