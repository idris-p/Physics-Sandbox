import { negateEnteredDecimal } from "../kinematics/exactDisplay";
import { worldVerticalToScalar } from "../kinematics/signConvention";
import type { VerticalPositiveDirection } from "../kinematics/signConvention";
import type { Particle } from "../model/Particle";

export const INITIAL_VELOCITY_ARROW_LENGTH_METRES = 2.5;

export interface InitialVelocityAnnotation {
  direction: "up" | "down";
  speedText: string;
}

export function getInitialVelocityAnnotation(
  particle: Particle,
  positiveDirection: VerticalPositiveDirection,
): InitialVelocityAnnotation | null {
  const displayedVelocity = worldVerticalToScalar(
    particle.initialVelocity.y,
    positiveDirection,
  );
  if (displayedVelocity === 0) return null;

  const enteredVelocity = particle.initialVelocityInput;
  const displayedText =
    enteredVelocity.positiveDirection === positiveDirection
      ? enteredVelocity.text
      : negateEnteredDecimal(enteredVelocity.text);
  const speedText = displayedText.startsWith("-")
    ? displayedText.slice(1)
    : displayedText;

  return {
    direction: particle.initialVelocity.y > 0 ? "up" : "down",
    speedText,
  };
}
