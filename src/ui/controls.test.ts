import { describe, expect, it } from "vitest";
import {
  formatTime,
  parseGravity,
  parsePositiveProperty,
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

  it.each(["-1", "1.001", "", "later"])("rejects %s", (value) => {
    expect(parseTime(value)).toBeNull();
  });

  it("always formats the timer with two decimal places", () => {
    expect(formatTime(0)).toBe("0.00");
    expect(formatTime(3.126)).toBe("3.13");
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
