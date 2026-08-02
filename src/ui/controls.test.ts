import { describe, expect, it } from "vitest";
import {
  formatPlaybackTime,
  formatTime,
  parseGravity,
  parsePositiveProperty,
  parseSignedValue,
  parseTime,
  parseWorldCoordinate,
} from "./controls";

describe("parseGravity", () => {
  it.each(["9.8", "9.81", "1.625", "0", ".125"])("accepts %s", (value) => {
    expect(parseGravity(value)).toBe(Number(value));
  });

  it.each(["9.8001", "-9.8", "", "gravity", "1."])("rejects %s", (value) => {
    expect(parseGravity(value)).toBeNull();
  });
});

describe("parsePositiveProperty", () => {
  it.each(["1", "0.5", ".001"])("accepts positive value %s", (value) => {
    expect(parsePositiveProperty(value)).toBe(Number(value));
  });

  it.each(["0", "-0.1", "1.0001", ""])("rejects %s", (value) => {
    expect(parsePositiveProperty(value)).toBeNull();
  });
});

describe("parseTime", () => {
  it.each(["0", "1", "2.5", "12.12"])("accepts %s", (value) => {
    expect(parseTime(value)).toBe(Number(value));
  });

  it("accepts arbitrary decimal precision for direct scene inspection", () => {
    expect(parseTime("1.001")).toBe(1.001);
    expect(parseTime("0.123456789123")).toBe(0.123456789123);
    expect(parseTime(".0000001")).toBe(0.0000001);
  });

  it.each(["-1", "1.", "", "later"])("rejects %s", (value) => {
    expect(parseTime(value)).toBeNull();
  });

  it("shows the available numeric precision without padding or rounding", () => {
    expect(formatTime(0)).toBe("0");
    expect(formatTime(3.126)).toBe("3.126");
    expect(formatTime(0.123456789123)).toBe("0.123456789123");
  });

  it("limits the live playback display to exactly two decimal places", () => {
    expect(formatPlaybackTime(0)).toBe("0.00");
    expect(formatPlaybackTime(1.23456789)).toBe("1.23");
    expect(formatPlaybackTime(3.126)).toBe("3.13");
  });
});

describe("parseWorldCoordinate", () => {
  it.each(["-1000000", "-32.001", "0", "12.5", "1000000"])("accepts %s", (value) => {
    expect(parseWorldCoordinate(value)).toBe(Number(value));
  });

  it.each(["1.0001", "", "high", "Infinity", "1e3"])(
    "rejects %s",
    (value) => {
      expect(parseWorldCoordinate(value)).toBeNull();
    },
  );
});

describe("parseSignedValue", () => {
  it.each(["4", "-2.5", "0", "3.125", "-.25"])("accepts %s", (value) => {
    expect(parseSignedValue(value)).toBe(Number(value));
  });

  it.each(["3.1251", "1.", "", "fast", "1e3"])("rejects %s", (value) => {
    expect(parseSignedValue(value)).toBeNull();
  });
});
