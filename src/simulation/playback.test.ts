import { describe, expect, it } from "vitest";
import { createParticle } from "../model/Particle";
import {
  advancePlayback,
  earliestPauseTime,
  getNextIntegerSecond,
  getNextGroundContactPauseEvent,
  getNextGroundContactPauseTime,
  getNextGreatestHeightPauseEvent,
  getNextGreatestHeightPauseTime,
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

  it("finds the exact greatest-height time for an enabled particle", () => {
    const particle = createParticle("launched", { x: 0, y: 0 });
    particle.initialVelocity.y = 9.8;
    particle.pauseAtGreatestHeight = true;

    expect(getNextGreatestHeightPauseTime([particle], 0, 9.8)).toBe(1);
    expect(advancePlayback(0.99, 0.02, 1)).toEqual({
      time: 1,
      reachedScheduledPause: true,
    });
  });

  it("does not trigger at t = 0 or without negative acceleration", () => {
    const stationary = createParticle("stationary", { x: 0, y: 10 });
    stationary.pauseAtGreatestHeight = true;
    const launched = createParticle("launched", { x: 0, y: 10 });
    launched.initialVelocity.y = 5;
    launched.pauseAtGreatestHeight = true;

    expect(getNextGreatestHeightPauseTime([stationary], 0, 9.8)).toBeNull();
    expect(getNextGreatestHeightPauseTime([launched], 0, 0)).toBeNull();
    expect(getNextGreatestHeightPauseTime([launched], 5 / 9.8, 9.8)).toBeNull();
  });

  it("returns every particle sharing the earliest greatest-height event", () => {
    const first = createParticle("first", { x: 0, y: 2 });
    first.initialVelocity.y = 9.8;
    first.pauseAtGreatestHeight = true;
    const second = createParticle("second", { x: 4, y: 5 });
    second.initialVelocity.y = 9.8;
    second.pauseAtGreatestHeight = true;
    const later = createParticle("later", { x: 8, y: 5 });
    later.initialVelocity.y = 19.6;
    later.pauseAtGreatestHeight = true;

    expect(
      getNextGreatestHeightPauseEvent([later, first, second], 0, 9.8),
    ).toEqual({ time: 1, particleIds: ["first", "second"] });
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

  it("identifies every particle causing the earliest ground-contact pause", () => {
    const first = createParticle("first", { x: 0, y: 4.9 });
    first.pauseAtGroundContact = true;
    const second = createParticle("second", { x: 2, y: 4.9 });
    second.pauseAtGroundContact = true;
    const later = createParticle("later", { x: 4, y: 19.6 });
    later.pauseAtGroundContact = true;

    expect(
      getNextGroundContactPauseEvent([later, first, second], 0, 9.8, true, 0),
    ).toEqual({ time: 1, particleIds: ["first", "second"] });
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
