import { describe, expect, it } from "vitest";
import { buildZgpCancelPayload } from "./zgp-cancel-payload";

describe("buildZgpCancelPayload", () => {
  it("keeps user_name as the first key in the exact SAP cancel object", () => {
    const payload = buildZgpCancelPayload(
      "22011196",
      {
        type_from: "NRGP",
        type_to: "",
        number_from: "",
        number_to: "",
        material_from: "",
        material_to: "",
        date_from: "",
        date_to: "",
        plant_from: "",
        plant_to: "",
        vendor_from: "",
        vendor_to: "",
      },
      {
        TYPE: "NRGP",
        UNIQUE_NO: "2000000121",
        MATERIAL: "300000890",
        DESCRIPTION: "Oil Gear SAE 85W-140",
      },
    );

    expect(Object.keys(payload.cancel)).toEqual([
      "user_name",
      "type_from",
      "type_to",
      "number_from",
      "number_to",
      "material_from",
      "material_to",
      "date_from",
      "date_to",
      "plant_from",
      "plant_to",
      "vendor_from",
      "vendor_to",
      "type",
      "unique",
      "material",
      "DESCRIPTION",
    ]);
    expect(payload).toEqual({
      cancel: {
        user_name: "22011196",
        type_from: "NRGP",
        type_to: "",
        number_from: "",
        number_to: "",
        material_from: "",
        material_to: "",
        date_from: "",
        date_to: "",
        plant_from: "",
        plant_to: "",
        vendor_from: "",
        vendor_to: "",
        type: "NRGP",
        unique: "2000000121",
        material: "300000890",
        DESCRIPTION: "Oil Gear SAE 85W-140",
      },
    });
  });

  it("rejects a cancel payload without a signed-in SAP user ID", () => {
    expect(() => buildZgpCancelPayload("", {}, {})).toThrow();
  });
});