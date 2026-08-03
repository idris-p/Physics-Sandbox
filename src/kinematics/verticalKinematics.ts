import type { ParticleState } from "../model/Particle";
import {
  worldVerticalToScalar,
  type VerticalPositiveDirection,
} from "./signConvention";
import type { KinematicPhase } from "./kinematicPhase";

export interface VerticalKinematicState {
  s: number;
  u: number;
  v: number;
  a: number;
  t: number;
}

export function calculateVerticalKinematicState(
  phase: KinematicPhase,
  currentState: ParticleState,
  sceneTime: number,
  positiveDirection: VerticalPositiveDirection,
): VerticalKinematicState {
  return {
    s: worldVerticalToScalar(
      currentState.position.y - phase.initialPosition.y,
      positiveDirection,
    ),
    u: worldVerticalToScalar(phase.initialVelocity.y, positiveDirection),
    v: worldVerticalToScalar(currentState.velocity.y, positiveDirection),
    a: worldVerticalToScalar(phase.acceleration.y, positiveDirection),
    t: Math.max(0, sceneTime - phase.startTime),
  };
}
