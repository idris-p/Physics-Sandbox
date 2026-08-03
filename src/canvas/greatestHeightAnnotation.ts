import {
  derivedValue,
  formatSquareRootValue,
  formatWorkingValue,
  type SquareRootValueDisplay,
} from "../kinematics/exactDisplay";
import type { ParticleState } from "../model/Particle";
import {
  sameTime,
  type GreatestHeightPauseEvent,
} from "../simulation/playback";

export interface GreatestHeightMeasurement {
  particleId: string;
  position: { x: number; y: number };
  groundHeight: number;
  height: number;
  valueDisplay: string | SquareRootValueDisplay;
}

export interface GreatestHeightHorizontalGeometry {
  arrowX: number;
  particleVisualEdgeX: number;
  perpendicularStartX: number;
  perpendicularEndX: number;
}

export const GREATEST_HEIGHT_ARROW_OFFSET_METRES = 0.75;

export function calculateGreatestHeightHorizontalGeometry(
  particleCentreX: number,
  particleRadius: number,
  pixelsPerMetre: number,
): GreatestHeightHorizontalGeometry {
  const arrowX =
    particleCentreX + GREATEST_HEIGHT_ARROW_OFFSET_METRES * pixelsPerMetre;
  const particleVisualEdgeX = particleCentreX + particleRadius;
  const visualToArrowLength = Math.max(0, arrowX - particleVisualEdgeX);
  return {
    arrowX,
    particleVisualEdgeX,
    perpendicularStartX: particleVisualEdgeX,
    perpendicularEndX: arrowX + visualToArrowLength,
  };
}

export function calculateGreatestHeightAboveGround(
  particlePositionY: number,
  groundHeight: number,
): number {
  return particlePositionY - groundHeight;
}

export function getGreatestHeightMeasurements(
  event: GreatestHeightPauseEvent | null,
  currentTime: number,
  groundEnabled: boolean,
  groundHeight: number,
  particleStates: ParticleState[],
): GreatestHeightMeasurement[] {
  if (!event || !groundEnabled || !sameTime(currentTime, event.time)) return [];

  const triggeringIds = new Set(event.particleIds);
  return particleStates.flatMap((particle) => {
    if (!triggeringIds.has(particle.id)) return [];

    const height = calculateGreatestHeightAboveGround(
      particle.position.y,
      groundHeight,
    );
    const displayValue = derivedValue(height);
    return [
      {
        particleId: particle.id,
        position: { ...particle.position },
        groundHeight,
        height,
        valueDisplay:
          formatSquareRootValue(displayValue) ?? formatWorkingValue(displayValue),
      },
    ];
  });
}
