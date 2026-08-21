import type { ScreenPoint } from "../math/Vec2";
import type { Scene } from "../model/Scene";
import { PULLEY_RADIUS_METRES } from "../model/Pulley";
import { getMountedPulleyCentre } from "../geometry/pulleyGeometry";
import { worldToScreen, type Camera } from "./camera";

export function hitTestPulleys(
  pointer: ScreenPoint,
  scene: Scene,
  camera: Camera,
): string | null {
  for (let index = scene.pulleys.length - 1; index >= 0; index -= 1) {
    const pulley = scene.pulleys[index];
    const centre = getMountedPulleyCentre(scene, pulley.mount, pulley.centre);
    if (!centre) continue;
    const screenCentre = worldToScreen(centre, camera);
    const radius = PULLEY_RADIUS_METRES * camera.pixelsPerMetre;
    if (
      Math.hypot(pointer.x - screenCentre.x, pointer.y - screenCentre.y) <=
      radius + HIT_PADDING_PX
    ) {
      return pulley.stringId;
    }
  }
  return null;
}

const HIT_PADDING_PX = 4;
