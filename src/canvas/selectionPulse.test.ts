import { describe, expect, it } from "vitest";
import {
  getSelectionWhiteMix,
  MAXIMUM_SELECTION_WHITE_MIX,
  mixColourWithWhite,
  SELECTION_PULSE_PERIOD_MS,
} from "./selectionPulse";

describe("selected-object colour pulse", () => {
  it("smoothly blends halfway toward white and returns to normal", () => {
    const quarterPeriod = SELECTION_PULSE_PERIOD_MS / 4;
    const halfPeriod = SELECTION_PULSE_PERIOD_MS / 2;

    expect(getSelectionWhiteMix(0)).toBe(0);
    expect(getSelectionWhiteMix(quarterPeriod)).toBeCloseTo(0.25, 12);
    expect(getSelectionWhiteMix(halfPeriod)).toBe(MAXIMUM_SELECTION_WHITE_MIX);
    expect(getSelectionWhiteMix(quarterPeriod * 3)).toBeCloseTo(0.25, 12);
    expect(getSelectionWhiteMix(SELECTION_PULSE_PERIOD_MS)).toBe(0);
  });

  it("mixes fills and outlines toward solid white", () => {
    expect(mixColourWithWhite("#000000", 0)).toBe("rgb(0, 0, 0)");
    expect(mixColourWithWhite("#000000", 0.5)).toBe("rgb(128, 128, 128)");
    expect(mixColourWithWhite("#dedbd3", 0.5)).toBe("rgb(239, 237, 233)");
  });
});
