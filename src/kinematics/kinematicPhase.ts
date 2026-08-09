import { GROUND_HEIGHT } from "../config";
import type { Vec2 } from "../math/Vec2";
import type { Particle } from "../model/Particle";
import {
  type PhysicsEnvironment,
} from "../physics/calculateParticleState";
import { analyseGroundContactForces } from "../dynamics/groundContact";

export type KinematicPhaseKind = "free-flight" | "grounded";

export interface KinematicPhase {
  kind: KinematicPhaseKind;
  startTime: number;
  initialPosition: Vec2;
  initialVelocity: Vec2;
  acceleration: Vec2;
}

export function determineActiveKinematicPhase(
  particle: Particle,
  sceneTime: number,
  environment: PhysicsEnvironment,
): KinematicPhase {
  const analysis = analyseGroundContactForces(particle, sceneTime, environment);
  const acceleration = analysis.nonContact.acceleration;
  const groundHeight = environment.groundHeight ?? GROUND_HEIGHT;
  const freeFlightPhase: KinematicPhase = {
    kind: "free-flight",
    startTime: 0,
    initialPosition: { ...particle.initialPosition },
    initialVelocity: { ...particle.initialVelocity },
    acceleration,
  };

  const impactTime = analysis.contact.impactTime;
  if (
    impactTime === null ||
    analysis.contact.kind === "airborne" ||
    analysis.contact.kind === "impact"
  ) {
    return freeFlightPhase;
  }

  return {
    kind:
      analysis.contact.kind === "grounded" ? "grounded" : "free-flight",
    startTime: impactTime,
    initialPosition: {
      x:
        particle.initialPosition.x +
        particle.initialVelocity.x * impactTime +
        0.5 * acceleration.x * impactTime ** 2,
      y: groundHeight,
    },
    initialVelocity: {
      x: particle.initialVelocity.x + acceleration.x * impactTime,
      y: 0,
    },
    acceleration: analysis.acceleration,
  };
}
