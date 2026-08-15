import type { Vec2 } from "../math/Vec2";
import type { Particle } from "../model/Particle";
import type { PhysicsEnvironment } from "../physics/calculateParticleState";
import { calculateSurfaceTrajectory } from "../physics/surfaceTrajectory";

export type KinematicPhaseKind = "free-flight" | "grounded" | "incline-contact";

export interface KinematicPhase {
  kind: KinematicPhaseKind;
  startTime: number;
  initialPosition: Vec2;
  initialVelocity: Vec2;
  acceleration: Vec2;
  incline?: {
    inclineId: string;
    initialQ: number;
    initialTangentialVelocity: number;
    tangentialAcceleration: number;
    slopeLength: number;
    endpointTime: number | null;
  };
}

export function determineActiveKinematicPhase(
  particle: Particle,
  sceneTime: number,
  environment: PhysicsEnvironment,
): KinematicPhase {
  return calculateSurfaceTrajectory(particle, sceneTime, environment).phase;
}
