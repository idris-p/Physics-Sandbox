import type { ScreenPoint } from "../math/Vec2";
import type { ParticleState } from "../model/Particle";
import { worldToScreen, type Camera } from "./camera";
import {
  getRenderedParticleShapeGeometry,
  isPointInRenderedParticle,
  type ParticleRenderAppearance,
} from "./particleGeometry";

const HIT_PADDING_PX = 4;

export function hitTestParticles(
  pointer: ScreenPoint,
  particles: ParticleState[],
  camera: Camera,
  getAppearance: (particleId: string) => ParticleRenderAppearance = () => ({
    shape: "circle",
    incline: null,
  }),
): string | null {
  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const particle = particles[index];
    const point = worldToScreen(particle.position, camera);
    const appearance = getAppearance(particle.id);
    const geometry = getRenderedParticleShapeGeometry(
      point,
      camera,
      appearance.shape,
      appearance.incline,
    );

    if (isPointInRenderedParticle(pointer, geometry, HIT_PADDING_PX)) {
      return particle.id;
    }
  }

  return null;
}
