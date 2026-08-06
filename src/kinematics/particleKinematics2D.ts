import type { ParticleState } from "../model/Particle";
import type { KinematicPhase } from "./kinematicPhase";
import {
  worldHorizontalToScalar,
  worldVerticalToScalar,
  type CoordinateConvention,
} from "./signConvention";

export interface OneDimensionalKinematicState {
  s: number;
  u: number;
  v: number;
  a: number;
  t: number;
}

export interface ParticleKinematicState2D {
  x: OneDimensionalKinematicState;
  y: OneDimensionalKinematicState;
}

export function calculateParticleKinematicState2D(
  phase: KinematicPhase,
  currentState: ParticleState,
  sceneTime: number,
  convention: CoordinateConvention,
): ParticleKinematicState2D {
  const phaseTime = Math.max(0, sceneTime - phase.startTime);
  return {
    x: {
      s: worldHorizontalToScalar(
        currentState.position.x - phase.initialPosition.x,
        convention.positiveX,
      ),
      u: worldHorizontalToScalar(
        phase.initialVelocity.x,
        convention.positiveX,
      ),
      v: worldHorizontalToScalar(
        currentState.velocity.x,
        convention.positiveX,
      ),
      a: worldHorizontalToScalar(
        phase.acceleration.x,
        convention.positiveX,
      ),
      t: phaseTime,
    },
    y: {
      s: worldVerticalToScalar(
        currentState.position.y - phase.initialPosition.y,
        convention.positiveY,
      ),
      u: worldVerticalToScalar(
        phase.initialVelocity.y,
        convention.positiveY,
      ),
      v: worldVerticalToScalar(
        currentState.velocity.y,
        convention.positiveY,
      ),
      a: worldVerticalToScalar(
        phase.acceleration.y,
        convention.positiveY,
      ),
      t: phaseTime,
    },
  };
}
