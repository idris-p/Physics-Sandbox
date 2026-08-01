import {
  DEFAULT_CAMERA_CENTRE,
  MAX_PIXELS_PER_METRE,
  MIN_PIXELS_PER_METRE,
  PIXELS_PER_METRE,
} from "../config";
import type { ScreenPoint, Vec2 } from "../math/Vec2";

export interface Camera {
  viewportWidth: number;
  viewportHeight: number;
  pixelsPerMetre: number;
  centre: Vec2;
  screenPanOffset: ScreenPoint;
}

export function createCamera(viewportWidth: number, viewportHeight: number): Camera {
  return {
    viewportWidth,
    viewportHeight,
    pixelsPerMetre: PIXELS_PER_METRE,
    centre: { ...DEFAULT_CAMERA_CENTRE },
    screenPanOffset: { x: 0, y: 0 },
  };
}

export function worldToScreen(position: Vec2, camera: Camera): ScreenPoint {
  return {
    x: camera.viewportWidth / 2 + (position.x - camera.centre.x) * camera.pixelsPerMetre,
    y: camera.viewportHeight / 2 - (position.y - camera.centre.y) * camera.pixelsPerMetre,
  };
}

export function screenToWorld(position: ScreenPoint, camera: Camera): Vec2 {
  return {
    x: camera.centre.x + (position.x - camera.viewportWidth / 2) / camera.pixelsPerMetre,
    y: camera.centre.y - (position.y - camera.viewportHeight / 2) / camera.pixelsPerMetre,
  };
}

export function resizeCamera(camera: Camera, viewportWidth: number, viewportHeight: number): void {
  camera.viewportWidth = viewportWidth;
  camera.viewportHeight = viewportHeight;
}

export function panCamera(camera: Camera, screenDelta: ScreenPoint): void {
  const previousCentre = { ...camera.centre };
  camera.centre.x -= screenDelta.x / camera.pixelsPerMetre;
  camera.centre.y += screenDelta.y / camera.pixelsPerMetre;
  camera.screenPanOffset.x +=
    (previousCentre.x - camera.centre.x) * camera.pixelsPerMetre;
  camera.screenPanOffset.y +=
    (camera.centre.y - previousCentre.y) * camera.pixelsPerMetre;
}

export function zoomCameraAt(camera: Camera, screenPoint: ScreenPoint, factor: number): void {
  const anchoredWorldPoint = screenToWorld(screenPoint, camera);
  camera.pixelsPerMetre = clamp(
    camera.pixelsPerMetre * factor,
    MIN_PIXELS_PER_METRE,
    MAX_PIXELS_PER_METRE,
  );

  camera.centre.x =
    anchoredWorldPoint.x -
    (screenPoint.x - camera.viewportWidth / 2) / camera.pixelsPerMetre;
  camera.centre.y =
    anchoredWorldPoint.y +
    (screenPoint.y - camera.viewportHeight / 2) / camera.pixelsPerMetre;
}

export function resetCamera(camera: Camera): void {
  camera.pixelsPerMetre = PIXELS_PER_METRE;
  camera.centre = { ...DEFAULT_CAMERA_CENTRE };
  camera.screenPanOffset = { x: 0, y: 0 };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
