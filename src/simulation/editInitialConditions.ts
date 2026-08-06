import {
  scalarToWorldHorizontal,
  scalarToWorldVertical,
  type HorizontalPositiveDirection,
  type VerticalPositiveDirection,
} from "../kinematics/signConvention";
import type { Particle } from "../model/Particle";
import type { AngleConvention } from "../kinematics/angleConvention";
import {
  formatMeasuredAngle,
  measureVelocityAngle,
  velocityFromSpeedAndAngle,
} from "../kinematics/angleConvention";
import type { InitialVelocityInputMode } from "../model/Particle";

export function editParticleInitialVerticalVelocity(
  particle: Particle,
  displayedVelocity: number,
  positiveDirection: VerticalPositiveDirection,
  enteredText = String(displayedVelocity),
): Particle {
  return {
    ...particle,
    initialVelocity: {
      x: particle.initialVelocity.x,
      y: scalarToWorldVertical(displayedVelocity, positiveDirection),
    },
    initialVelocityInput: {
      ...particle.initialVelocityInput,
      y: { text: enteredText, positiveDirection },
    },
    initialVelocityEditorMode: "components",
    initialVelocitySource: "components",
    initialVelocityAngleInput: undefined,
  };
}

export function editParticleInitialHorizontalVelocity(
  particle: Particle,
  displayedVelocity: number,
  positiveDirection: HorizontalPositiveDirection,
  enteredText = String(displayedVelocity),
): Particle {
  return {
    ...particle,
    initialVelocity: {
      x: scalarToWorldHorizontal(displayedVelocity, positiveDirection),
      y: particle.initialVelocity.y,
    },
    initialVelocityInput: {
      ...particle.initialVelocityInput,
      x: { text: enteredText, positiveDirection },
    },
    initialVelocityEditorMode: "components",
    initialVelocitySource: "components",
    initialVelocityAngleInput: undefined,
  };
}

export function editParticleInitialVelocityComponents(
  particle: Particle,
  displayedVelocity: { x: number; y: number },
  convention: {
    positiveX: HorizontalPositiveDirection;
    positiveY: VerticalPositiveDirection;
  },
  enteredText: { x: string; y: string },
): Particle {
  return {
    ...particle,
    initialVelocity: {
      x: scalarToWorldHorizontal(displayedVelocity.x, convention.positiveX),
      y: scalarToWorldVertical(displayedVelocity.y, convention.positiveY),
    },
    initialVelocityInput: {
      x: { text: enteredText.x, positiveDirection: convention.positiveX },
      y: { text: enteredText.y, positiveDirection: convention.positiveY },
    },
    initialVelocityEditorMode: "components",
    initialVelocitySource: "components",
    initialVelocityAngleInput: undefined,
  };
}

export function editParticleInitialVelocityAngle(
  particle: Particle,
  speed: number,
  angleDegrees: number,
  convention: AngleConvention,
  enteredText: { speed: string; angle: string },
): Particle {
  if (!(speed > 0)) throw new Error("Initial speed must be greater than zero.");
  if (!(angleDegrees > -180 && angleDegrees <= 180)) {
    throw new Error("Initial velocity angle must be in the interval (-180, 180].");
  }

  return {
    ...particle,
    initialVelocity: velocityFromSpeedAndAngle(speed, angleDegrees, convention),
    initialVelocityEditorMode: "angle",
    initialVelocitySource: "angle",
    initialVelocityAngleInput: {
      speedText: enteredText.speed,
      angleText: enteredText.angle,
      ...convention,
    },
  };
}

export function reexpressParticleInitialVelocityAngle(
  particle: Particle,
  convention: AngleConvention,
): Particle {
  if (
    particle.initialVelocitySource !== "angle" ||
    !particle.initialVelocityAngleInput
  ) {
    return particle;
  }
  const angle = measureVelocityAngle(particle.initialVelocity, convention);
  return {
    ...particle,
    initialVelocityAngleInput: {
      ...particle.initialVelocityAngleInput,
      angleText: formatMeasuredAngle(angle),
      ...convention,
    },
  };
}

export function setParticleInitialVelocityEditorMode(
  particle: Particle,
  mode: InitialVelocityInputMode,
): Particle {
  if (particle.initialVelocityEditorMode === mode) return particle;

  return {
    ...particle,
    initialVelocityEditorMode: mode,
  };
}
