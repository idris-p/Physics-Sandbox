import type { Vec2 } from "../math/Vec2";

export type AngleReferenceAxis =
  | "positive-x"
  | "negative-x"
  | "positive-y"
  | "negative-y";
export type AngleDirection = "anticlockwise" | "clockwise";

export interface AngleConvention {
  angleReferenceAxis: AngleReferenceAxis;
  angleDirection: AngleDirection;
}

export function getAngleReferenceDirection(axis: AngleReferenceAxis): Vec2 {
  switch (axis) {
    case "positive-x":
      return { x: 1, y: 0 };
    case "negative-x":
      return { x: -1, y: 0 };
    case "positive-y":
      return { x: 0, y: 1 };
    case "negative-y":
      return { x: 0, y: -1 };
  }
}

export function velocityFromSpeedAndAngle(
  speed: number,
  angleDegrees: number,
  convention: AngleConvention,
): Vec2 {
  const referenceAngle = getReferenceAngleRadians(convention.angleReferenceAxis);
  const direction = convention.angleDirection === "anticlockwise" ? 1 : -1;
  const worldAngle = referenceAngle + direction * degreesToRadians(angleDegrees);

  return {
    x: cleanTrigValue(speed * Math.cos(worldAngle)),
    y: cleanTrigValue(speed * Math.sin(worldAngle)),
  };
}

export function measureVelocityAngle(
  velocity: Vec2,
  convention: AngleConvention,
): number {
  if (velocity.x === 0 && velocity.y === 0) return 0;
  const worldAngle = Math.atan2(velocity.y, velocity.x);
  const referenceAngle = getReferenceAngleRadians(convention.angleReferenceAxis);
  const direction = convention.angleDirection === "anticlockwise" ? 1 : -1;
  return normaliseMeasuredAngle(
    direction * radiansToDegrees(worldAngle - referenceAngle),
  );
}

export function formatMeasuredAngle(angleDegrees: number): string {
  const rounded = Number(angleDegrees.toFixed(3));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

function getReferenceAngleRadians(axis: AngleReferenceAxis): number {
  switch (axis) {
    case "positive-x":
      return 0;
    case "positive-y":
      return Math.PI / 2;
    case "negative-x":
      return Math.PI;
    case "negative-y":
      return -Math.PI / 2;
  }
}

function degreesToRadians(degrees: number): number {
  return degrees * Math.PI / 180;
}

function radiansToDegrees(radians: number): number {
  return radians * 180 / Math.PI;
}

function normaliseMeasuredAngle(angleDegrees: number): number {
  let normalised = ((angleDegrees + 180) % 360 + 360) % 360 - 180;
  if (Math.abs(normalised + 180) < 1e-10) normalised = 180;
  if (Math.abs(normalised) < 1e-10) normalised = 0;
  return Number(normalised.toFixed(12));
}

function cleanTrigValue(value: number): number {
  return Math.abs(value) < 1e-12 ? 0 : value;
}
