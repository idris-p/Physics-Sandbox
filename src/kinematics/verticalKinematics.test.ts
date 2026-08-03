import { describe, expect, it } from "vitest";
import { createParticle } from "../model/Particle";
import { calculateParticleState } from "../physics/calculateParticleState";
import { determineActiveKinematicPhase } from "./kinematicPhase";
import { calculateVerticalKinematicState } from "./verticalKinematics";

const environment = { gravity: 9.8, groundEnabled: false };

describe("calculateVerticalKinematicState", () => {
  it("derives upward-positive s, u, v, a, and t from world state", () => {
    const particle = createParticle("released", { x: 2, y: 10 });
    const worldState = calculateParticleState(particle, 1, {
      gravity: 9.8,
      groundEnabled: false,
    });

    const phase = determineActiveKinematicPhase(particle, 1, environment);
    expect(calculateVerticalKinematicState(phase, worldState, 1, "up")).toEqual({
      s: -4.9,
      u: 0,
      v: -9.8,
      a: -9.8,
      t: 1,
    });
  });

  it("negates signed scalars without changing the stored or calculated world state", () => {
    const particle = createParticle("invariant", { x: 2, y: 10 });
    particle.initialVelocity.y = 5;
    const worldState = calculateParticleState(particle, 1, {
      gravity: 9.8,
      groundEnabled: false,
    });
    const snapshot = structuredClone({ particle, worldState });

    const phase = determineActiveKinematicPhase(particle, 1, environment);
    const upward = calculateVerticalKinematicState(phase, worldState, 1, "up");
    const downward = calculateVerticalKinematicState(phase, worldState, 1, "down");

    expect(upward.s).toBeCloseTo(0.1, 12);
    expect(upward.u).toBe(5);
    expect(upward.v).toBeCloseTo(-4.8, 12);
    expect(upward.a).toBe(-9.8);
    expect(downward).toEqual({
      s: -upward.s,
      u: -upward.u,
      v: -upward.v,
      a: -upward.a,
      t: upward.t,
    });
    expect({ particle, worldState }).toEqual(snapshot);
  });

  it("uses signed displacement rather than distance travelled", () => {
    const particle = createParticle("displacement", { x: 0, y: 10 });
    particle.initialVelocity.y = 5;
    const worldState = calculateParticleState(particle, 2, {
      gravity: 9.8,
      groundEnabled: false,
    });

    const kinematics = calculateVerticalKinematicState(
      determineActiveKinematicPhase(particle, 2, environment),
      worldState,
      2,
      "up",
    );

    expect(kinematics.s).toBeCloseTo(-9.6, 12);
  });
});
