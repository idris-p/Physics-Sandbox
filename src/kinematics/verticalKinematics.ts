import type { ParticleState } from "../model/Particle";
import type { VerticalPositiveDirection } from "./signConvention";
import type { KinematicPhase } from "./kinematicPhase";
import { calculateParticleKinematicState2D } from "./particleKinematics2D";

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
  return calculateParticleKinematicState2D(phase, currentState, sceneTime, {
    positiveX: "right",
    positiveY: positiveDirection,
  }).y;
}
