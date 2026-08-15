import type { Vec2 } from "../math/Vec2";

export type InclineDirection = "rises-right" | "rises-left";

export type InclineRoughness =
  | { kind: "smooth" }
  | {
      kind: "rough";
      coefficientOfFriction: number;
      coefficientInput: string;
    };

export interface Incline {
  id: string;
  anchor: Vec2;
  horizontalLength: number;
  horizontalLengthInput: string;
  angleDegrees: number;
  angleInput: string;
  direction: InclineDirection;
  roughness: InclineRoughness;
}

export const DEFAULT_INCLINE_HORIZONTAL_LENGTH = 10;
export const MINIMUM_INCLINE_HORIZONTAL_LENGTH = 10;
export const DEFAULT_INCLINE_ANGLE_DEGREES = 30;
export const DEFAULT_INCLINE_COEFFICIENT_OF_FRICTION = 0.5;

export function setInclineRoughness(incline: Incline, rough: boolean): void {
  if (rough && incline.roughness.kind === "smooth") {
    incline.roughness = {
      kind: "rough",
      coefficientOfFriction: DEFAULT_INCLINE_COEFFICIENT_OF_FRICTION,
      coefficientInput: String(DEFAULT_INCLINE_COEFFICIENT_OF_FRICTION),
    };
  } else if (!rough) {
    incline.roughness = { kind: "smooth" };
  }
}

export function createIncline(
  id: string,
  anchor: Vec2,
  direction: InclineDirection = "rises-right",
  horizontalLength = DEFAULT_INCLINE_HORIZONTAL_LENGTH,
): Incline {
  const safeHorizontalLength = Math.max(
    MINIMUM_INCLINE_HORIZONTAL_LENGTH,
    horizontalLength,
  );
  return {
    id,
    anchor: { ...anchor },
    horizontalLength: safeHorizontalLength,
    horizontalLengthInput: String(safeHorizontalLength),
    angleDegrees: DEFAULT_INCLINE_ANGLE_DEGREES,
    angleInput: String(DEFAULT_INCLINE_ANGLE_DEGREES),
    direction,
    roughness: { kind: "smooth" },
  };
}
