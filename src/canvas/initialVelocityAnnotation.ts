import { convertEnteredScalarText } from "../kinematics/exactDisplay";
import type { CoordinateConvention } from "../kinematics/signConvention";
import type { Vec2 } from "../math/Vec2";
import type { Particle } from "../model/Particle";
import { getAngleReferenceDirection } from "../kinematics/angleConvention";

export const INITIAL_VELOCITY_ARROW_LENGTH_METRES = 2.5;
export const INITIAL_VELOCITY_ANGLE_ARC_RADIUS_METRES = Math.SQRT2;
export const INITIAL_VELOCITY_TEXT_HEIGHT_METRES = 0.5;
export const INITIAL_VELOCITY_COLOUR = "#aaa69d";

export function calculateInitialVelocityTextSize(pixelsPerMetre: number): number {
  return INITIAL_VELOCITY_TEXT_HEIGHT_METRES * pixelsPerMetre;
}

export function isNarrowInitialVelocityAngle(angleDegrees: number): boolean {
  return Math.abs(angleDegrees) < 20;
}

export function isMultipleOfNinetyDegrees(angleDegrees: number): boolean {
  return Math.abs(angleDegrees / 90 - Math.round(angleDegrees / 90)) <= 1e-9;
}

interface InitialVelocityAnnotationBase {
  direction: Vec2;
}

export interface AngleInitialVelocityAnnotation extends InitialVelocityAnnotationBase {
  kind: "angle";
  angleMarker: "arc" | "none";
  speedText: string;
  angleText: string;
  angleDegrees: number;
  referenceDirection: Vec2;
  rotationDirection: 1 | -1;
}

export interface ComponentInitialVelocityAnnotation extends InitialVelocityAnnotationBase {
  kind: "components";
  componentText: { x: string; y: string };
}

export interface SpeedInitialVelocityAnnotation extends InitialVelocityAnnotationBase {
  kind: "speed";
  speedText: string;
}

export type InitialVelocityAnnotation =
  | AngleInitialVelocityAnnotation
  | ComponentInitialVelocityAnnotation
  | SpeedInitialVelocityAnnotation;

export function getInitialVelocityAnnotation(
  particle: Particle,
  convention: CoordinateConvention,
): InitialVelocityAnnotation | null {
  const velocity = particle.initialVelocity;
  const magnitude = Math.hypot(velocity.x, velocity.y);
  if (magnitude === 0) return null;

  const direction = {
    x: velocity.x / magnitude,
    y: velocity.y / magnitude,
  };

  if (particle.initialVelocitySource === "angle" && particle.initialVelocityAngleInput) {
    const angleInput = particle.initialVelocityAngleInput;
    return {
      kind: "angle",
      angleMarker: isMultipleOfNinetyDegrees(Number(angleInput.angleText))
        ? "none"
        : "arc",
      direction,
      speedText: angleInput.speedText,
      angleText: absoluteEnteredValueText(angleInput.angleText),
      angleDegrees: Number(angleInput.angleText),
      referenceDirection: getAngleReferenceDirection(angleInput.angleReferenceAxis),
      rotationDirection: angleInput.angleDirection === "anticlockwise" ? 1 : -1,
    };
  }

  if (velocity.x === 0 || velocity.y === 0) {
    const nonZeroInput = velocity.x === 0
      ? particle.initialVelocityInput.y.text
      : particle.initialVelocityInput.x.text;
    return {
      kind: "speed",
      direction,
      speedText: absoluteEnteredValueText(nonZeroInput),
    };
  }

  return {
    kind: "components",
    direction,
    componentText: {
      x: convertEnteredScalarText(
        particle.initialVelocityInput.x.text,
        particle.initialVelocityInput.x.positiveDirection,
        convention.positiveX,
      ),
      y: convertEnteredScalarText(
        particle.initialVelocityInput.y.text,
        particle.initialVelocityInput.y.positiveDirection,
        convention.positiveY,
      ),
    },
  };
}

function absoluteEnteredValueText(text: string): string {
  const trimmed = text.trim();
  return trimmed.startsWith("-") || trimmed.startsWith("−")
    ? trimmed.slice(1)
    : trimmed;
}
