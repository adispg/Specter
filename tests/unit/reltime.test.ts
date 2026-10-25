import { describe, expect, it } from "vitest";
import { relTime } from "@/lib/reltime";

const NOW = Date.parse("2026-10-26T12:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe("relTime", () => {
  it("reads anything under a minute as now", () => {
    expect(relTime(ago(0), NOW)).toBe("now");
    expect(relTime(ago(45_000), NOW)).toBe("now");
  });

  it("counts minutes, then hours, then days", () => {
    expect(relTime(ago(4 * MIN), NOW)).toBe("4m");
    expect(relTime(ago(3 * HOUR), NOW)).toBe("3h");
    expect(relTime(ago(2 * DAY), NOW)).toBe("2d");
  });

  it("falls back to a date once it is a week old", () => {
    expect(relTime(ago(9 * DAY), NOW)).toMatch(/\d/);
    expect(relTime(ago(9 * DAY), NOW)).not.toMatch(/^\d+[mhd]$/);
  });

  it("never reports a negative age for a clock skewed future timestamp", () => {
    expect(relTime(new Date(NOW + 5 * MIN).toISOString(), NOW)).toBe("now");
  });
});
