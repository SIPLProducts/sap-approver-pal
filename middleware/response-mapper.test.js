import { describe, expect, it } from "vitest";
import { mapSapResponse } from "./response-mapper.js";

const collectionFields = [
  { field_name: "[].MSGTXT", target_column: "msgtxt" },
  { field_name: "[].STATUS", target_column: "status" },
];

describe("mapSapResponse", () => {
  it("preserves a direct PR Release response when fields use collection notation", () => {
    const raw = { MSGTXT: "Purchase requisition released", STATUS: "S" };
    expect(mapSapResponse(collectionFields, raw)).toEqual(raw);
  });

  it("preserves a top-level SAP response array", () => {
    const raw = [{ MSGTXT: "Purchase requisition released", STATUS: "S" }];
    expect(mapSapResponse(collectionFields, raw)).toEqual(raw);
  });

  it("preserves a nested SAP response envelope", () => {
    const raw = { DATA: [{ MSGTXT: "Purchase requisition released", STATUS: "S" }] };
    expect(mapSapResponse(collectionFields, raw)).toEqual(raw);
  });

  it("still aliases ordinary object response fields", () => {
    const raw = { RESULT: { MESSAGE: "Done" } };
    expect(
      mapSapResponse(
        [{ field_name: "RESULT.MESSAGE", target_column: "message" }],
        raw,
      ),
    ).toEqual({ message: "Done" });
  });
});