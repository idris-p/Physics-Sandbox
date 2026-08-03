import { GROUND_HEIGHT } from "../config";
import type { Vec2 } from "../math/Vec2";
import type { Particle } from "../model/Particle";
import {
  calculateGroundImpactTime,
  isAfterGroundImpact,
  type PhysicsEnvironment,
} from "../physics/calculateParticleState";

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
  const gravity = Math.max(0, environment.gravity);
  const groundHeight = environment.groundHeight ?? GROUND_HEIGHT;
  const freeFlightPhase: KinematicPhase = {
    kind: "free-flight",
    startTime: 0,
    initialPosition: { ...particle.initialPosition },
    initialVelocity: { ...particle.initialVelocity },
    acceleration: { x: 0, y: -gravity },
  };

  if (!environment.groundEnabled) return freeFlightPhase;

  const impactTime = calculateGroundImpactTime(
    particle.initialPosition.y,
    particle.initialVelocity.y,
    gravity,
    groundHeight,
  );
  if (impactTime === null || !isAfterGroundImpact(sceneTime, impactTime)) {
    return freeFlightPhase;
  }

  return {
    kind: "grounded",
    startTime: impactTime,
    initialPosition: { x: particle.initialPosition.x, y: groundHeight },
    initialVelocity: { x: 0, y: 0 },
    acceleration: { x: 0, y: 0 },
  };
}
