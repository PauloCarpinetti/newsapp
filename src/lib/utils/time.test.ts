import { describe, expect, it } from "vitest";
import { calculateTargetHourUTC } from "./time";

describe("calculateTargetHourUTC", () => {
  it("returns the same hour for the UTC timezone (identity case)", () => {
    expect(calculateTargetHourUTC("07:30", "UTC")).toBe(7);
  });

  it("converts a fixed-offset timezone behind UTC (America/Sao_Paulo, UTC-3)", () => {
    expect(calculateTargetHourUTC("07:00", "America/Sao_Paulo")).toBe(10);
  });

  it("converts a fixed-offset timezone ahead of UTC (Asia/Tokyo, UTC+9)", () => {
    expect(calculateTargetHourUTC("07:00", "Asia/Tokyo")).toBe(22);
  });

  it("handles a half-hour offset timezone (Asia/Kolkata, UTC+5:30)", () => {
    expect(calculateTargetHourUTC("07:00", "Asia/Kolkata")).toBe(1);
  });

  it("wraps around midnight correctly", () => {
    expect(calculateTargetHourUTC("23:00", "America/Sao_Paulo")).toBe(2);
  });

  it("is independent of the machine's local timezone", () => {
    const originalTZ = process.env.TZ;
    process.env.TZ = "Pacific/Auckland";

    expect(calculateTargetHourUTC("07:00", "America/Sao_Paulo")).toBe(10);

    process.env.TZ = originalTZ;
  });
});
