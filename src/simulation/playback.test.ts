import { describe, expect, it } from "vitest";
import { createParticle } from "../model/Particle";
import { createAppliedForce } from "../model/AppliedForce";
import {
  editParticleInitialVelocityAngle,
  reexpressParticleInitialVelocityAngle,
} from "./editInitialConditions";
import {
  advancePlayback,
  earliestPauseTime,
  getAdjacentStepTime,
  getNextIntegerSecond,
  getNextParticleCoincidencePauseEvent,
  getNextVerticalTargetPauseEvent,
  getNextGroundContactPauseEvent,
  getNextGroundContactPauseTime,
  getNextGreatestHeightPauseEvent,
  getNextGreatestHeightPauseTime,
} from "./playback";

describe("playback pausing", () => {
  it("snaps manual stepping to adjacent interval boundaries", () => {
    expect(getAdjacentStepTime(3.72, 1, "previous")).toBe(3);
    expect(getAdjacentStepTime(3.72, 1, "next")).toBe(4);
    expect(getAdjacentStepTime(3.72, 0.1, "previous")).toBe(3.7);
    expect(getAdjacentStepTime(3.72, 0.1, "next")).toBe(3.8);
    expect(getAdjacentStepTime(3.726, 0.01, "previous")).toBe(3.72);
    expect(getAdjacentStepTime(3.726, 0.01, "next")).toBe(3.73);
  });

  it("moves a full interval when already on a step boundary", () => {
    expect(getAdjacentStepTime(3, 1, "previous")).toBe(2);
    expect(getAdjacentStepTime(3, 1, "next")).toBe(4);
    expect(getAdjacentStepTime(3.7, 0.1, "previous")).toBe(3.6);
    expect(getAdjacentStepTime(3.7, 0.1, "next")).toBe(3.8);
    expect(getAdjacentStepTime(3.72, 0.01, "previous")).toBe(3.71);
    expect(getAdjacentStepTime(3.72, 0.01, "next")).toBe(3.73);
  });

  it("does not step below zero", () => {
    expect(getAdjacentStepTime(0, 1, "previous")).toBe(0);
    expect(getAdjacentStepTime(0.004, 0.01, "previous")).toBe(0);
  });

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

  it("does not let horizontal velocity affect greatest-height timing", () => {
    const particle = createParticle("projectile", { x: 0, y: 0 });
    particle.initialVelocity = { x: 37, y: 9.8 };
    particle.pauseAtGreatestHeight = true;

    expect(getNextGreatestHeightPauseTime([particle], 0, 9.8)).toBe(1);
  });

  it("uses force-derived vertical acceleration for greatest height", () => {
    const particle = createParticle("forced-height", { x: 0, y: 0 });
    particle.mass = 2;
    particle.initialVelocity.y = 9.6;
    particle.pauseAtGreatestHeight = true;
    particle.appliedForces = [{
      ...createAppliedForce("upward"),
      vector: { x: 0, y: 10 },
    }];

    expect(getNextGreatestHeightPauseTime([particle], 0, 9.8)).toBeCloseTo(2, 12);
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

  it("uses force-derived acceleration for ground contact", () => {
    const particle = createParticle("forced-ground", { x: 0, y: 9.6 });
    particle.mass = 2;
    particle.pauseAtGroundContact = true;
    particle.appliedForces = [{
      ...createAppliedForce("upward"),
      vector: { x: 0, y: 10 },
    }];

    expect(getNextGroundContactPauseTime([particle], 0, 9.8, true, 0))
      .toBeCloseTo(2, 12);
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

  it("pauses at a requested mathematical height above enabled ground", () => {
    const particle = createParticle("height", { x: 0, y: 10 });
    particle.pauseAtVerticalTarget = true;
    particle.pauseHeightAboveGround = 5;

    expect(
      getNextVerticalTargetPauseEvent([particle], 0, 10, true, 0),
    ).toEqual({ time: 1, particleIds: ["height"] });
  });

  it("uses signed vertical displacement when ground is disabled", () => {
    const particle = createParticle("displacement", { x: 0, y: 3 });
    particle.pauseAtVerticalTarget = true;
    particle.pauseVerticalDisplacement = -5;

    expect(
      getNextVerticalTargetPauseEvent([particle], 0, 10, false, 0),
    ).toEqual({ time: 1, particleIds: ["displacement"] });
  });

  it("finds the next crossing when a target height is crossed twice", () => {
    const particle = createParticle("two-crossings", { x: 0, y: 0 });
    particle.initialVelocity.y = 10;
    particle.pauseAtVerticalTarget = true;
    particle.pauseVerticalDisplacement = 3.75;

    expect(
      getNextVerticalTargetPauseEvent([particle], 0, 10, false, 0)?.time,
    ).toBeCloseTo(0.5, 12);
    expect(
      getNextVerticalTargetPauseEvent([particle], 0.5, 10, false, 0)?.time,
    ).toBeCloseTo(1.5, 12);
  });

  it("does not schedule a target crossing beyond enabled ground contact", () => {
    const particle = createParticle("below-ground", { x: 0, y: 1 });
    particle.pauseAtVerticalTarget = true;
    particle.pauseHeightAboveGround = -1;

    expect(
      getNextVerticalTargetPauseEvent([particle], 0, 10, true, 0),
    ).toBeNull();
  });

  it("finds a point-particle coincidence analytically between frame times", () => {
    const first = createParticle("first", { x: 0, y: 4 });
    first.initialVelocity.x = 2;
    first.pauseAtParticleCoincidence = true;
    const second = createParticle("second", { x: 10, y: 4 });
    second.initialVelocity.x = -2;

    const event = getNextParticleCoincidencePauseEvent(
      [first, second],
      0.97,
      9.8,
      false,
      0,
    );

    expect(event).toEqual({ time: 2.5, particleIds: ["first", "second"] });
    expect(advancePlayback(2.49, 0.02, event?.time ?? null)).toEqual({
      time: 2.5,
      reachedScheduledPause: true,
    });
  });

  it("finds coincidence when particles have different constant accelerations", () => {
    const accelerating = createParticle("accelerating", { x: 0, y: 4 });
    accelerating.pauseAtParticleCoincidence = true;
    accelerating.appliedForces = [{
      ...createAppliedForce("right"),
      vector: { x: 2, y: 0 },
    }];
    const moving = createParticle("moving", { x: 4, y: 4 });
    moving.initialVelocity.x = -3;

    expect(getNextParticleCoincidencePauseEvent(
      [accelerating, moving],
      0,
      9.8,
      false,
      0,
    )).toEqual({
      time: 1,
      particleIds: ["accelerating", "moving"],
    });
  });

  it("excludes coincidence at t = 0", () => {
    const first = createParticle("first", { x: 3, y: 4 });
    first.initialVelocity.x = 1;
    first.pauseAtParticleCoincidence = true;
    const second = createParticle("second", { x: 3, y: 4 });
    second.initialVelocity.x = -1;

    expect(
      getNextParticleCoincidencePauseEvent(
        [first, second],
        0,
        9.8,
        false,
        0,
      ),
    ).toBeNull();
  });

  it("skips t = 0 but still finds the next future reunion", () => {
    const launched = createParticle("launched", { x: 3, y: 0 });
    launched.initialVelocity.y = 10;
    launched.pauseAtParticleCoincidence = true;
    const resting = createParticle("resting", { x: 3, y: 0 });

    expect(
      getNextParticleCoincidencePauseEvent(
        [launched, resting],
        0,
        10,
        true,
        0,
      ),
    ).toEqual({
      time: 2,
      particleIds: ["launched", "resting"],
    });
  });

  it("pauses once when several particles share the earliest coincidence", () => {
    const first = createParticle("first", { x: -2, y: 1 });
    first.initialVelocity.x = 2;
    first.pauseAtParticleCoincidence = true;
    const second = createParticle("second", { x: 2, y: 1 });
    second.initialVelocity.x = -2;
    const third = createParticle("third", { x: 0, y: 3 });
    third.initialVelocity.y = -2;
    const later = createParticle("later", { x: 6, y: 1 });
    later.initialVelocity.x = -2;

    expect(
      getNextParticleCoincidencePauseEvent(
        [first, second, third, later],
        0,
        0,
        false,
        0,
      ),
    ).toEqual({
      time: 1,
      particleIds: ["first", "second", "third"],
    });
  });

  it("requires at least one particle in a coinciding pair to opt in", () => {
    const first = createParticle("first", { x: 0, y: 2 });
    first.initialVelocity.x = 1;
    const second = createParticle("second", { x: 2, y: 2 });
    second.initialVelocity.x = -1;

    expect(
      getNextParticleCoincidencePauseEvent(
        [first, second],
        0,
        9.8,
        false,
        0,
      ),
    ).toBeNull();

    second.pauseAtParticleCoincidence = true;
    expect(
      getNextParticleCoincidencePauseEvent(
        [first, second],
        0,
        9.8,
        false,
        0,
      )?.time,
    ).toBe(1);
  });

  it("triggers only at the start of a coincident interval", () => {
    const incoming = createParticle("incoming", { x: 0, y: 1 });
    incoming.initialVelocity = { x: 2, y: -1 };
    incoming.pauseAtParticleCoincidence = true;
    const resting = createParticle("resting", { x: 2, y: 0 });

    expect(
      getNextParticleCoincidencePauseEvent(
        [incoming, resting],
        0,
        0,
        true,
        0,
      ),
    ).toEqual({
      time: 1,
      particleIds: ["incoming", "resting"],
    });
    expect(
      getNextParticleCoincidencePauseEvent(
        [incoming, resting],
        1,
        0,
        true,
        0,
      ),
    ).toBeNull();
    expect(
      getNextParticleCoincidencePauseEvent(
        [incoming, resting],
        1.5,
        0,
        true,
        0,
      ),
    ).toBeNull();
  });

  it("finds coincidence between horizontally moving grounded particles", () => {
    const first = createParticle("first", { x: 0, y: 0 });
    first.initialVelocity.x = 1;
    first.pauseAtParticleCoincidence = true;
    const second = createParticle("second", { x: 4, y: 0 });
    second.initialVelocity.x = -1;

    expect(
      getNextParticleCoincidencePauseEvent(
        [first, second],
        0,
        9.8,
        true,
        0,
      ),
    ).toEqual({
      time: 2,
      particleIds: ["first", "second"],
    });
  });

  it("does not turn an interval beginning at t = 0 into a later event", () => {
    const first = createParticle("first", { x: 1, y: 2 });
    first.initialVelocity = { x: 3, y: 4 };
    first.pauseAtParticleCoincidence = true;
    const second = createParticle("second", { x: 1, y: 2 });
    second.initialVelocity = { x: 3, y: 4 };

    expect(
      getNextParticleCoincidencePauseEvent(
        [first, second],
        0,
        9.8,
        false,
        0,
      ),
    ).toBeNull();
  });

  it("does not retrigger a continuous coincidence when both particles land", () => {
    const first = createParticle("first", { x: 1, y: 0 });
    first.initialVelocity.y = 9.8;
    first.pauseAtParticleCoincidence = true;
    const second = createParticle("second", { x: 1, y: 0 });
    second.initialVelocity.y = 9.8;

    expect(
      getNextParticleCoincidencePauseEvent(
        [first, second],
        0,
        9.8,
        true,
        0,
      ),
    ).toBeNull();
  });

  it("keeps coincidence timing invariant when polar angles are re-expressed", () => {
    const originalConvention = {
      angleReferenceAxis: "positive-x" as const,
      angleDirection: "anticlockwise" as const,
    };
    const changedConvention = {
      angleReferenceAxis: "positive-y" as const,
      angleDirection: "clockwise" as const,
    };
    const first = editParticleInitialVelocityAngle(
      createParticle("first", { x: -2, y: 3 }),
      2,
      0,
      originalConvention,
      { speed: "2", angle: "0" },
    );
    first.pauseAtParticleCoincidence = true;
    const second = editParticleInitialVelocityAngle(
      createParticle("second", { x: 2, y: 3 }),
      2,
      180,
      originalConvention,
      { speed: "2", angle: "180" },
    );
    const timeBefore = getNextParticleCoincidencePauseEvent(
      [first, second],
      0,
      9.8,
      false,
      0,
    )?.time;

    const timeAfter = getNextParticleCoincidencePauseEvent(
      [
        reexpressParticleInitialVelocityAngle(first, changedConvention),
        reexpressParticleInitialVelocityAngle(second, changedConvention),
      ],
      0,
      9.8,
      false,
      0,
    )?.time;

    expect(timeBefore).toBe(1);
    expect(timeAfter).toBe(timeBefore);
  });
});
