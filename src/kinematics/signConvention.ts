export type HorizontalPositiveDirection = "left" | "right";
export type VerticalPositiveDirection = "up" | "down";

export interface CoordinateConvention {
  positiveX: HorizontalPositiveDirection;
  positiveY: VerticalPositiveDirection;
}

export function worldHorizontalToScalar(
  worldX: number,
  positiveDirection: HorizontalPositiveDirection,
): number {
  return positiveDirection === "right" ? worldX : -worldX;
}

export function scalarToWorldHorizontal(
  value: number,
  positiveDirection: HorizontalPositiveDirection,
): number {
  return positiveDirection === "right" ? value : -value;
}

export function worldVerticalToScalar(
  worldY: number,
  positiveDirection: VerticalPositiveDirection,
): number {
  return positiveDirection === "up" ? worldY : -worldY;
}

export function scalarToWorldVertical(
  value: number,
  positiveDirection: VerticalPositiveDirection,
): number {
  return positiveDirection === "up" ? value : -value;
}
