import { describe, expect, it } from "vitest";
import { PIXELS_PER_METRE } from "../config";
import {
  createCamera,
  panCamera,
  screenToWorld,
  worldToScreen,
  zoomCameraAt,
} from "./camera";

describe("camera coordinate conversion", () => {
  it("maps one world metre to the configured screen spacing", () => {
    const camera = createCamera(800, 600);
    const origin = worldToScreen({ x: 0, y: 0 }, camera);
    const oneMetre = worldToScreen({ x: 1, y: 1 }, camera);

    expect(oneMetre.x - origin.x).toBe(camera.pixelsPerMetre);
    expect(origin.y - oneMetre.y).toBe(camera.pixelsPerMetre);
  });

  it("round-trips screen and world positions", () => {
    const camera = createCamera(800, 600);
    const worldPosition = { x: -3.25, y: 7.5 };

    expect(screenToWorld(worldToScreen(worldPosition, camera), camera)).toEqual(worldPosition);
  });

  it("keeps the world point under the pointer fixed while zooming", () => {
    const camera = createCamera(800, 600);
    const pointer = { x: 630, y: 180 };
    const anchoredWorldPoint = screenToWorld(pointer, camera);
    const panOffsetBeforeZoom = { ...camera.screenPanOffset };

    zoomCameraAt(camera, pointer, 2);

    expect(camera.pixelsPerMetre).toBe(PIXELS_PER_METRE * 2);
    expect(screenToWorld(pointer, camera).x).toBeCloseTo(anchoredWorldPoint.x, 12);
    expect(screenToWorld(pointer, camera).y).toBeCloseTo(anchoredWorldPoint.y, 12);
    expect(camera.screenPanOffset).toEqual(panOffsetBeforeZoom);
  });

  it("moves world content with a screen-space pan gesture", () => {
    const camera = createCamera(800, 600);
    const beforePan = worldToScreen({ x: 0, y: 0 }, camera);

    panCamera(camera, { x: 40, y: -25 });
    const afterPan = worldToScreen({ x: 0, y: 0 }, camera);

    expect(afterPan.x - beforePan.x).toBeCloseTo(40, 12);
    expect(afterPan.y - beforePan.y).toBeCloseTo(-25, 12);
    expect(camera.screenPanOffset.x).toBeCloseTo(40, 12);
    expect(camera.screenPanOffset.y).toBeCloseTo(-25, 12);
  });
});
