import { describe, it, expect } from "vitest";
import { IDLE_MS, isIdleExpired } from "./session-guard";

describe("session idle timeout", () => {
  it("is exactly 30 minutes", () => {
    expect(IDLE_MS).toBe(1_800_000);
  });
  it("is not expired just under 30 minutes", () => {
    expect(isIdleExpired(0 + 1, 1_800_000)).toBe(false);
  });
  it("is expired at 30 minutes", () => {
    expect(isIdleExpired(1000, 1000 + 1_800_000)).toBe(true);
  });
  it("is expired with no recorded activity", () => {
    expect(isIdleExpired(null, Date.now())).toBe(true);
  });
});
