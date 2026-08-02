export type VerticalPositiveDirection = "up" | "down";

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
