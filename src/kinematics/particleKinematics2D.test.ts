import { describe, expect, it } from "vitest";
import { createParticle } from "../model/Particle";
import { calculateParticleState } from "../physics/calculateParticleState";
import { determineActiveKinematicPhase } from "./kinematicPhase";
import { calculateParticleKinematicState2D } from "./particleKinematics2D";

const environment = { gravity: 9.8, groundEnabled: false, groundHeight: 0 };

describe("particle 2D kinematics", () => {
  it("derives horizontal and vertical components from one world state", () => {
    const particle = createParticle("projectile", { x: 0, y: 10 });
    particle.initialVelocity = { x: 4, y: 5 };
    const state = calculateParticleState(particle, 1, environment);
    const phase = determineActiveKinematicPhase(particle, 1, environment);

    expect(
      calculateParticleKinematicState2D(phase, state, 1, {
        positiveX: "right",
        positiveY: "up",
      }),
    ).toEqual({
      x: { s: 4, u: 4, v: 4, a: 0, t: 1 },
      y: { s: 0.09999999999999964, u: 5, v: -4.800000000000001, a: -9.8, t: 1 },
    });
  });

  it("changes displayed signs on either axis without changing physical motion", () => {
    const particle = createParticle("signs", { x: 1, y: 10 });
    particle.initialVelocity = { x: 4, y: -3 };
    const state = calculateParticleState(particle, 0.5, environment);
    const phase = determineActiveKinematicPhase(particle, 0.5, environment);
    const snapshot = structuredClone({ particle, state, phase });

    const standard = calculateParticleKinematicState2D(phase, state, 0.5, {
      positiveX: "right",
      positiveY: "up",
    });
    const reversed = calculateParticleKinematicState2D(phase, state, 0.5, {
      positiveX: "left",
      positiveY: "down",
    });

    expect(reversed.x).toEqual({
      s: -standard.x.s,
      u: -standard.x.u,
      v: -standard.x.v,
      a: -standard.x.a,
      t: standard.x.t,
    });
    expect(reversed.y).toEqual({
      s: -standard.y.s,
      u: -standard.y.u,
      v: -standard.y.v,
      a: -standard.y.a,
      t: standard.y.t,
    });
    expect({ particle, state, phase }).toEqual(snapshot);
  });

  it("keeps phase and world state invariant across every axis convention", () => {
    const particle = createParticle("all-conventions", { x: 2, y: 8 });
    particle.initialVelocity = { x: -3, y: 4 };
    const sceneTime = 0.75;
    const state = calculateParticleState(particle, sceneTime, environment);
    const phase = determineActiveKinematicPhase(particle, sceneTime, environment);
    const snapshot = structuredClone({ state, phase });

    for (const positiveX of ["left", "right"] as const) {
      for (const positiveY of ["up", "down"] as const) {
        const displayed = calculateParticleKinematicState2D(
          phase,
          state,
          sceneTime,
          { positiveX, positiveY },
        );
        expect(Math.abs(displayed.x.u)).toBe(3);
        expect(Math.abs(displayed.y.u)).toBe(4);
        expect({ state, phase }).toEqual(snapshot);
      }
    }
  });
});
