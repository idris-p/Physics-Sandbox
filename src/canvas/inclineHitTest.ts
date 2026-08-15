import { getInclineGeometry } from "../geometry/inclineGeometry";
import type { ScreenPoint } from "../math/Vec2";
import type { Incline } from "../model/Incline";
import { screenToWorld, type Camera } from "./camera";

export function hitTestInclines(
  pointer: ScreenPoint,
  inclines: readonly Incline[],
  camera: Camera,
): string | null {
  const point = screenToWorld(pointer, camera);
  const tolerance = 5 / camera.pixelsPerMetre;
  for (let index = inclines.length - 1; index >= 0; index -= 1) {
    const incline = inclines[index];
    const geometry = getInclineGeometry(incline);
    const minX = Math.min(geometry.lowerEndpoint.x, geometry.upperEndpoint.x);
    const maxX = Math.max(geometry.lowerEndpoint.x, geometry.upperEndpoint.x);
    if (point.x < minX - tolerance || point.x > maxX + tolerance) continue;
    const horizontalProgress = geometry.horizontalLength === 0
      ? 0
      : Math.abs(point.x - geometry.lowerEndpoint.x) /
        geometry.horizontalLength;
    const surfaceY = geometry.lowerEndpoint.y + geometry.rise * horizontalProgress;
    if (
      point.y >= geometry.lowerEndpoint.y - tolerance &&
      point.y <= surfaceY + tolerance
    ) {
      return incline.id;
    }
  }
  return null;
}
