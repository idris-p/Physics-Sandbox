import { convertEnteredScalarText } from "../kinematics/exactDisplay";
import type { VerticalPositiveDirection } from "../kinematics/signConvention";
import type { Particle, ParticleState } from "../model/Particle";
import {
  sameTime,
  type VerticalTargetPauseEvent,
} from "../simulation/playback";
import type { GreatestHeightMeasurement } from "./greatestHeightAnnotation";

export function getVerticalTargetMeasurements(
  event: VerticalTargetPauseEvent | null,
  currentTime: number,
  groundEnabled: boolean,
  groundHeight: number,
  positiveY: VerticalPositiveDirection,
  particles: Particle[],
  particleStates: ParticleState[],
): GreatestHeightMeasurement[] {
  if (!event || !sameTime(currentTime, event.time)) return [];

  const particlesById = new Map(
    particles.map((particle) => [particle.id, particle]),
  );
  const triggeringIds = new Set(event.particleIds);

  return particleStates.flatMap((state) => {
    if (!triggeringIds.has(state.id)) return [];
    const particle = particlesById.get(state.id);
    if (!particle) return [];

    const referenceHeight = groundEnabled
      ? groundHeight
      : particle.initialPosition.y;
    const valueDisplay = groundEnabled
      ? particle.pauseHeightAboveGroundText
      : convertEnteredScalarText(
          particle.pauseVerticalDisplacementInput.text,
          particle.pauseVerticalDisplacementInput.positiveDirection,
          positiveY,
        );

    return [
      {
        particleId: state.id,
        position: { ...state.position },
        groundHeight: referenceHeight,
        height: state.position.y - referenceHeight,
        valueDisplay,
        labelPrefix: "",
      },
    ];
  });
}
