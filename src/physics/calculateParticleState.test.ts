import { describe, expect, it } from "vitest";
import { createParticle } from "../model/Particle";
import { calculateParticleState } from "./calculateParticleState";

const particle = createParticle("particle-1", { x: 4, y: 10 });

describe("calculateParticleState", () => {
  it("uses exact constant-acceleration kinematics before impact", () => {
    const state = calculateParticleState(particle, 1, {
      gravity: 9.8,
      groundEnabled: false,
    });

    expect(state.position.y).toBeCloseTo(5.1, 12);
    expect(state.velocity.y).toBeCloseTo(-9.8, 12);
    expect(state.acceleration.y).toBe(-9.8);
  });

  it("uses positive and negative vertical initial velocity", () => {
    const upward = createParticle("upward", { x: 0, y: 10 });
    const downward = createParticle("downward", { x: 0, y: 10 });
    upward.initialVelocity.y = 5;
    downward.initialVelocity.y = -2.5;

    const upwardState = calculateParticleState(upward, 1, {
      gravity: 9.8,
      groundEnabled: false,
    });
    const downwardState = calculateParticleState(downward, 1, {
      gravity: 9.8,
      groundEnabled: false,
    });

    expect(upwardState.position.y).toBeCloseTo(10.1, 12);
    expect(upwardState.velocity.y).toBeCloseTo(-4.8, 12);
    expect(downwardState.position.y).toBeCloseTo(2.6, 12);
    expect(downwardState.velocity.y).toBeCloseTo(-12.3, 12);
  });

  it("reconstructs horizontal free motion analytically", () => {
    const moving = createParticle("horizontal", { x: 2, y: 10 });
    moving.initialVelocity.x = 3;
    const state = calculateParticleState(moving, 4, {
      gravity: 9.8,
      groundEnabled: false,
    });

    expect(state.position.x).toBe(14);
    expect(state.velocity.x).toBe(3);
    expect(state.acceleration.x).toBe(0);
  });

  it("reconstructs simultaneous horizontal and vertical motion", () => {
    const projectile = createParticle("projectile", { x: 0, y: 10 });
    projectile.initialVelocity = { x: 4, y: 5 };
    const state = calculateParticleState(projectile, 1, {
      gravity: 9.8,
      groundEnabled: false,
    });

    expect(state.position.x).toBe(4);
    expect(state.position.y).toBeCloseTo(10.1, 12);
    expect(state.velocity).toEqual({ x: 4, y: -4.800000000000001 });
    expect(state.acceleration).toEqual({ x: 0, y: -9.8 });
  });

  it("uses the free-fall boundary state at impact, then rests after impact", () => {
    const movingParticle = createParticle("moving-impact", { x: 4, y: 10 });
    movingParticle.initialVelocity.x = 3;
    const impactTime = Math.sqrt((2 * 10) / 9.8);
    const atImpact = calculateParticleState(movingParticle, impactTime, {
      gravity: 9.8,
      groundEnabled: true,
    });
    const afterImpact = calculateParticleState(movingParticle, impactTime + 0.01, {
      gravity: 9.8,
      groundEnabled: true,
    });

    expect(atImpact.position.y).toBe(0);
    expect(atImpact.position.x).toBeCloseTo(4 + 3 * impactTime, 12);
    expect(atImpact.velocity.x).toBe(3);
    expect(atImpact.velocity.y).toBeCloseTo(-9.8 * impactTime, 12);
    expect(atImpact.acceleration.y).toBe(-9.8);
    expect(afterImpact.position.y).toBe(0);
    expect(afterImpact.position.x).toBeCloseTo(4 + 3 * impactTime, 12);
    expect(afterImpact.velocity.x).toBe(0);
    expect(afterImpact.velocity.y).toBe(0);
    expect(afterImpact.acceleration.y).toBe(0);
  });

  it("uses a configured ground height for collision", () => {
    const state = calculateParticleState(particle, 2, {
      gravity: 9.8,
      groundEnabled: true,
      groundHeight: 5,
    });

    expect(state.position.y).toBe(5);
    expect(state.velocity.y).toBe(0);
    expect(state.acceleration.y).toBe(0);
  });

  it("treats the mathematical point as the collision position", () => {
    const oneMetreHigh = createParticle("point-particle", { x: 0, y: 1 });
    const beforePointImpact = calculateParticleState(oneMetreHigh, 0.4, {
      gravity: 9.8,
      groundEnabled: true,
    });

    expect(beforePointImpact.position.y).toBeCloseTo(0.216, 12);
    expect(beforePointImpact.velocity.y).toBeCloseTo(-3.92, 12);
  });

  it("keeps a particle initially on enabled ground at rest", () => {
    const resting = createParticle("resting", { x: 0, y: 0 });
    const state = calculateParticleState(resting, 3, {
      gravity: 9.8,
      groundEnabled: true,
    });

    expect(state.position.y).toBe(0);
    expect(state.velocity.y).toBe(0);
    expect(state.acceleration.y).toBe(0);
  });

  it("allows a particle with upward initial velocity to leave the ground", () => {
    const launched = createParticle("launched", { x: 0, y: 0 });
    launched.initialVelocity.x = 2;
    launched.initialVelocity.y = 5;

    const ascending = calculateParticleState(launched, 0.25, {
      gravity: 9.8,
      groundEnabled: true,
    });
    const returned = calculateParticleState(launched, 2 * 5 / 9.8 + 0.01, {
      gravity: 9.8,
      groundEnabled: true,
    });

    expect(ascending.position.y).toBeCloseTo(0.94375, 12);
    expect(ascending.position.x).toBeCloseTo(0.5, 12);
    expect(ascending.velocity.y).toBeCloseTo(2.55, 12);
    expect(returned.position.y).toBe(0);
    expect(returned.position.x).toBeCloseTo(2 * (2 * 5 / 9.8), 12);
    expect(returned.velocity.y).toBe(0);
  });

  it("allows the same particle to fall below zero when ground is disabled", () => {
    const resting = createParticle("falling", { x: 0, y: 0 });
    const state = calculateParticleState(resting, 1, {
      gravity: 9.8,
      groundEnabled: false,
    });

    expect(state.position.y).toBeCloseTo(-4.9, 12);
    expect(state.velocity.y).toBeCloseTo(-9.8, 12);
  });

  it("uses the supplied global gravity", () => {
    const earthState = calculateParticleState(particle, 1, {
      gravity: 9.8,
      groundEnabled: false,
    });
    const moonState = calculateParticleState(particle, 1, {
      gravity: 1.625,
      groundEnabled: false,
    });

    expect(earthState.position.y).toBeCloseTo(5.1, 12);
    expect(moonState.position.y).toBeCloseTo(9.1875, 12);
  });

  it("produces the same result for stepped and direct time requests", () => {
    const steppedTimes = [1, 2, 3];
    const steppedState = steppedTimes
      .map((time) =>
        calculateParticleState(particle, time, {
          gravity: 9.8,
          groundEnabled: false,
        }),
      )
      .at(-1);
    const directState = calculateParticleState(particle, 3, {
      gravity: 9.8,
      groundEnabled: false,
    });

    expect(steppedState).toEqual(directState);
  });
});
