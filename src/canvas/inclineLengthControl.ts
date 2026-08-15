import { getInclineGeometry } from "../geometry/inclineGeometry";
import type { ScreenPoint } from "../math/Vec2";
import {
  MINIMUM_INCLINE_HORIZONTAL_LENGTH,
  type Incline,
} from "../model/Incline";
import { worldToScreen, type Camera } from "./camera";

export type InclineLengthControlTarget = "decrease" | "handle" | "increase";

export interface InclineLengthControlGeometry {
  corner: ScreenPoint;
  decreaseCentre: ScreenPoint;
  increaseCentre: ScreenPoint;
  cellSize: number;
  outerRadius: number;
  innerRadius: number;
  canDecrease: boolean;
}

export function calculateInclineLengthControlGeometry(
  incline: Incline,
  camera: Camera,
): InclineLengthControlGeometry {
  const corner = worldToScreen(getInclineGeometry(incline).upperEndpoint, camera);
  const cellSize = camera.pixelsPerMetre;
  return {
    corner: { x: corner.x, y: worldToScreen(incline.anchor, camera).y },
    decreaseCentre: {
      x: corner.x - cellSize,
      y: worldToScreen(incline.anchor, camera).y,
    },
    increaseCentre: {
      x: corner.x + cellSize,
      y: worldToScreen(incline.anchor, camera).y,
    },
    cellSize,
    outerRadius: cellSize * 0.28,
    innerRadius: cellSize * 0.13,
    canDecrease: incline.horizontalLength > MINIMUM_INCLINE_HORIZONTAL_LENGTH,
  };
}

export function hitTestInclineLengthControl(
  point: ScreenPoint,
  geometry: InclineLengthControlGeometry,
): InclineLengthControlTarget | null {
  if (distance(point, geometry.corner) <= geometry.cellSize * 0.45) {
    return "handle";
  }
  if (
    geometry.canDecrease &&
    isInCell(point, geometry.decreaseCentre, geometry.cellSize)
  ) {
    return "decrease";
  }
  if (isInCell(point, geometry.increaseCentre, geometry.cellSize)) {
    return "increase";
  }
  return null;
}

export function stepInclineHorizontalLength(
  length: number,
  direction: "decrease" | "increase",
): number {
  const change = direction === "decrease" ? -1 : 1;
  return Math.max(MINIMUM_INCLINE_HORIZONTAL_LENGTH, Math.round(length) + change);
}

export function calculateDraggedInclineHorizontalLength(
  initialLength: number,
  horizontalScreenDelta: number,
  pixelsPerMetre: number,
  inclineDirection: Incline["direction"],
): number {
  const outwardSign = inclineDirection === "rises-right" ? 1 : -1;
  const length = initialLength +
    outwardSign * horizontalScreenDelta / pixelsPerMetre;
  return Math.max(MINIMUM_INCLINE_HORIZONTAL_LENGTH, Math.round(length));
}

function isInCell(
  point: ScreenPoint,
  centre: ScreenPoint,
  cellSize: number,
): boolean {
  const halfCell = cellSize / 2;
  return Math.abs(point.x - centre.x) <= halfCell &&
    Math.abs(point.y - centre.y) <= halfCell;
}

function distance(first: ScreenPoint, second: ScreenPoint): number {
  return Math.hypot(first.x - second.x, first.y - second.y);
}
