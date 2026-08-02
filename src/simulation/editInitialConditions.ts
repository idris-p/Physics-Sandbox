import {
  scalarToWorldVertical,
  type VerticalPositiveDirection,
} from "../kinematics/signConvention";
import type { Particle } from "../model/Particle";

export function editParticleInitialVerticalVelocity(
  particle: Particle,
  displayedVelocity: number,
  positiveDirection: VerticalPositiveDirection,
  enteredText = String(displayedVelocity),
): Particle {
  return {
    ...particle,
    initialVelocity: {
      x: 0,
      y: scalarToWorldVertical(displayedVelocity, positiveDirection),
    },
    initialVelocityInput: {
      text: enteredText,
      positiveDirection,
    },
  };
}
