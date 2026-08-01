import { describe, expect, it } from "vitest";
import { advancePlayback, getNextIntegerSecond } from "./playback";

describe("playback pausing", () => {
  it("schedules a pause for the next integer second", () => {
    expect(getNextIntegerSecond(0)).toBe(1);
    expect(getNextIntegerSecond(1)).toBe(2);
    expect(getNextIntegerSecond(3.72)).toBe(4);
  });

  it("continues playing until the scheduled second", () => {
    expect(advancePlayback(2.4, 0.2, 3)).toEqual({
      time: 2.6,
      reachedScheduledPause: false,
    });
  });

  it("stops exactly on the scheduled integer instead of overshooting", () => {
    expect(advancePlayback(2.95, 0.08, 3)).toEqual({
      time: 3,
      reachedScheduledPause: true,
    });
  });
});
