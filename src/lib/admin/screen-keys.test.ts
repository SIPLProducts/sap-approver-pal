import { describe, it, expect } from "vitest";
import { resolveActivityKey, roleNameToScreenKeys } from "./screen-keys";

describe("SAP permission mapping", () => {
  it("matches activity codes regardless of case/spaces/dashes", () => {
    expect(resolveActivityKey("sd-sales order")).toBe("sd.sales_order");
    expect(resolveActivityKey("SD.SALES_ORDER")).toBe("sd.sales_order");
  });
  it("accepts BMW aliases", () => {
    expect(resolveActivityKey("BMW.PRICE_APPROVAL")).toBe("sd.price");
    expect(resolveActivityKey("BMW.STATUS_REPORT")).toBe("sd.bmw_status");
  });
  it("BMW- PRICE APPROVALS grants only Price Approvals", () => {
    expect(roleNameToScreenKeys("BMW- PRICE APPROVALS")).toEqual(["sd.price"]);
  });
  it("BMW- SO PH APPROVALS grants Sales Order Approvals", () => {
    expect(roleNameToScreenKeys("BMW- SO PH APPROVALS")).toEqual(["sd.sales_order"]);
  });
  it("BMW_ALL grants all six BMW screens", () => {
    expect(roleNameToScreenKeys("BMW_ALL")).toHaveLength(6);
  });
});
