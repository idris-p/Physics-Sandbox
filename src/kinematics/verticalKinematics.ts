import type { Particle, ParticleState } from "../model/Particle";
import {
  worldVerticalToScalar,
  type VerticalPositiveDirection,
} from "./signConvention";

export interface VerticalKinematicState {
  s: number;
  u: number;
  v: number;
  a: number;
  t: number;
}

export function calculateVerticalKinematicState(
  particle: Particle,
  currentState: ParticleState,
  time: number,
  positiveDirection: VerticalPositiveDirection,
): VerticalKinematicState {
  return {
    s: worldVerticalToScalar(
      currentState.position.y - particle.initialPosition.y,
      positiveDirection,
    ),
    u: worldVerticalToScalar(particle.initialVelocity.y, positiveDirection),
    v: worldVerticalToScalar(currentState.velocity.y, positiveDirection),
    a: worldVerticalToScalar(currentState.acceleration.y, positiveDirection),
    t: Math.max(0, time),
  };
}
