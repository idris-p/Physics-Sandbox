import {
  calculateGroundImpactTime,
  calculateGroundImpactTimeWithAcceleration,
  isAfterGroundImpact,
  isAtPositiveGroundImpact,
} from "../dynamics/groundContact";
import type { Particle, ParticleState } from "../model/Particle";
import {
  calculateSurfaceTrajectory,
  type SurfaceTrajectoryEnvironment,
} from "./surfaceTrajectory";

export interface PhysicsEnvironment extends SurfaceTrajectoryEnvironment {}

export {
  calculateGroundImpactTime,
  calculateGroundImpactTimeWithAcceleration,
  isAfterGroundImpact,
  isAtPositiveGroundImpact,
};

export function calculateParticleState(
  particle: Particle,
  time: number,
  environment: PhysicsEnvironment,
): ParticleState {
  return calculateSurfaceTrajectory(particle, time, environment).state;
}
