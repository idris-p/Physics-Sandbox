import { describe, expect, it } from "vitest";
import { createParticle } from "../model/Particle";
import {
  calculateGroundImpactTime,
  calculateParticleState,
} from "../physics/calculateParticleState";
import { determineActiveKinematicPhase } from "./kinematicPhase";
import { calculateVerticalKinematicState } from "./verticalKinematics";

const environment = { gravity: 9.8, groundEnabled: true, groundHeight: 0 };

describe("determineActiveKinematicPhase", () => {
  it("starts free flight at scene time zero before impact", () => {
    const particle = createParticle("falling", { x: 2, y: 10 });
    expect(determineActiveKinematicPhase(particle, 1, environment)).toEqual({
      kind: "free-flight",
      startTime: 0,
      initialPosition: { x: 2, y: 10 },
      initialVelocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: -9.8 },
    });
  });

  it("keeps exact positive-time contact in the free-flight phase", () => {
    const particle = createParticle("impact", { x: 0, y: 10 });
    const impactTime = calculateGroundImpactTime(10, 0, 9.8, 0);
    if (impactTime === null) throw new Error("Expected an impact time.");

    const phase = determineActiveKinematicPhase(
      particle,
      impactTime,
      environment,
    );
    const state = calculateParticleState(particle, impactTime, environment);
    const kinematics = calculateVerticalKinematicState(
      phase,
      state,
      impactTime,
      "up",
    );

    expect(phase).toMatchObject({ kind: "free-flight", startTime: 0 });
    expect(state.position.y).toBe(0);
    expect(kinematics.v).toBeCloseTo(-9.8 * impactTime, 12);
    expect(kinematics.a).toBe(-9.8);
  });

  it("starts a zero-motion grounded phase at impact after contact", () => {
    const particle = createParticle("grounded", { x: 0, y: 10 });
    particle.initialVelocity.x = 3;
    const impactTime = calculateGroundImpactTime(10, 0, 9.8, 0);
    if (impactTime === null) throw new Error("Expected an impact time.");
    const currentTime = 3;
    const phase = determineActiveKinematicPhase(
      particle,
      currentTime,
      environment,
    );
    const state = calculateParticleState(particle, currentTime, environment);

    expect(phase).toEqual({
      kind: "grounded",
      startTime: impactTime,
      initialPosition: { x: 3 * impactTime, y: 0 },
      initialVelocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0 },
    });
    expect(
      calculateVerticalKinematicState(phase, state, currentTime, "up"),
    ).toEqual({ s: 0, u: 0, v: 0, a: 0, t: currentTime - impactTime });
  });

  it("starts initially resting particles in a grounded phase at zero", () => {
    const particle = createParticle("resting", { x: 0, y: 0 });
    expect(determineActiveKinematicPhase(particle, 5, environment)).toEqual({
      kind: "grounded",
      startTime: 0,
      initialPosition: { x: 0, y: 0 },
      initialVelocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0 },
    });
  });

  it("keeps an upward launch from ground in free flight through return contact", () => {
    const particle = createParticle("launched", { x: 0, y: 0 });
    particle.initialVelocity.y = 5;
    const returnTime = 10 / 9.8;

    expect(
      determineActiveKinematicPhase(particle, returnTime, environment).kind,
    ).toBe("free-flight");
    expect(
      determineActiveKinematicPhase(
        particle,
        returnTime + 0.001,
        environment,
      ),
    ).toMatchObject({ kind: "grounded", startTime: returnTime });
  });

  it("changes displayed signs without changing phase selection or world state", () => {
    const particle = createParticle("sign", { x: 0, y: 10 });
    const currentTime = 0.5;
    const phase = determineActiveKinematicPhase(
      particle,
      currentTime,
      environment,
    );
    const state = calculateParticleState(particle, currentTime, environment);
    const snapshot = structuredClone({ phase, state });
    const upward = calculateVerticalKinematicState(
      phase,
      state,
      currentTime,
      "up",
    );
    const downward = calculateVerticalKinematicState(
      phase,
      state,
      currentTime,
      "down",
    );

    expect(downward).toEqual({
      s: -upward.s,
      u: -upward.u,
      v: -upward.v,
      a: -upward.a,
      t: upward.t,
    });
    expect({ phase, state }).toEqual(snapshot);
  });
});
