import { describe, expect, it } from "vitest";
import { createParticle } from "../model/Particle";
import {
  advancePlayback,
  earliestPauseTime,
  getNextIntegerSecond,
  getNextGroundContactPauseTime,
  getNextMaximumHeightPauseTime,
} from "./playback";

describe("playback pausing", () => {
  it("schedules a pause for the next integer second", () => {
    expect(getNextIntegerSecond(0)).toBe(1);
    expect(getNextIntegerSecond(1)).toBe(2);
    expect(getNextIntegerSecond(3.72)).toBe(4);
    expect(getNextIntegerSecond(3.123456789123)).toBe(4);
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

  it("finds the exact maximum-height time for an enabled particle", () => {
    const particle = createParticle("launched", { x: 0, y: 0 });
    particle.initialVelocity.y = 9.8;
    particle.pauseAtMaximumHeight = true;

    expect(getNextMaximumHeightPauseTime([particle], 0, 9.8)).toBe(1);
    expect(advancePlayback(0.99, 0.02, 1)).toEqual({
      time: 1,
      reachedScheduledPause: true,
    });
  });

  it("does not trigger at t = 0 or without negative acceleration", () => {
    const stationary = createParticle("stationary", { x: 0, y: 10 });
    stationary.pauseAtMaximumHeight = true;
    const launched = createParticle("launched", { x: 0, y: 10 });
    launched.initialVelocity.y = 5;
    launched.pauseAtMaximumHeight = true;

    expect(getNextMaximumHeightPauseTime([stationary], 0, 9.8)).toBeNull();
    expect(getNextMaximumHeightPauseTime([launched], 0, 0)).toBeNull();
    expect(getNextMaximumHeightPauseTime([launched], 5 / 9.8, 9.8)).toBeNull();
  });

  it("uses whichever automatic or requested pause comes first", () => {
    expect(earliestPauseTime(2, 1.5)).toBe(1.5);
    expect(earliestPauseTime(null, 1.5)).toBe(1.5);
    expect(earliestPauseTime(2, null)).toBe(2);
  });

  it("finds the exact first positive-time ground contact", () => {
    const particle = createParticle("falling", { x: 0, y: 10 });
    particle.pauseAtGroundContact = true;
    const impactTime = Math.sqrt(20 / 9.8);

    expect(
      getNextGroundContactPauseTime([particle], 0, 9.8, true, 0),
    ).toBeCloseTo(impactTime, 12);
    expect(
      getNextGroundContactPauseTime(
        [particle],
        impactTime,
        9.8,
        true,
        0,
      ),
    ).toBeNull();
  });

  it("does not schedule ground contact without ground or from t = 0 rest", () => {
    const falling = createParticle("falling", { x: 0, y: 10 });
    falling.pauseAtGroundContact = true;
    const resting = createParticle("resting", { x: 0, y: 0 });
    resting.pauseAtGroundContact = true;

    expect(
      getNextGroundContactPauseTime([falling], 0, 9.8, false, 0),
    ).toBeNull();
    expect(
      getNextGroundContactPauseTime([resting], 0, 9.8, true, 0),
    ).toBeNull();
  });
});
