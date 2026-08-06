import { describe, expect, it } from "vitest";
import {
  scalarToWorldHorizontal,
  scalarToWorldVertical,
  worldHorizontalToScalar,
  worldVerticalToScalar,
} from "./signConvention";

describe("vertical sign convention", () => {
  it("keeps world values when upward is positive", () => {
    expect(worldVerticalToScalar(-4, "up")).toBe(-4);
    expect(scalarToWorldVertical(-4, "up")).toBe(-4);
  });

  it("negates values when downward is positive", () => {
    expect(worldVerticalToScalar(-4, "down")).toBe(4);
    expect(scalarToWorldVertical(4, "down")).toBe(-4);
  });

  it("round-trips a value in either convention", () => {
    for (const direction of ["up", "down"] as const) {
      expect(
        scalarToWorldVertical(worldVerticalToScalar(-3.125, direction), direction),
      ).toBe(-3.125);
    }
  });
});

describe("horizontal sign convention", () => {
  it("keeps world values when rightward is positive", () => {
    expect(worldHorizontalToScalar(-4, "right")).toBe(-4);
    expect(scalarToWorldHorizontal(-4, "right")).toBe(-4);
  });

  it("negates values when leftward is positive", () => {
    expect(worldHorizontalToScalar(4, "left")).toBe(-4);
    expect(scalarToWorldHorizontal(-4, "left")).toBe(4);
  });
});
