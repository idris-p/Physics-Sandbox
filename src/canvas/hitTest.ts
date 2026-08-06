import type { ScreenPoint } from "../math/Vec2";
import type { ParticleState } from "../model/Particle";
import { worldToScreen, type Camera } from "./camera";
import { getRenderedParticleGeometry } from "./particleGeometry";

const HIT_PADDING_PX = 4;

export function hitTestParticles(
  pointer: ScreenPoint,
  particles: ParticleState[],
  camera: Camera,
): string | null {
  for (let index = particles.length - 1; index >= 0; index -= 1) {
    const particle = particles[index];
    const point = worldToScreen(particle.position, camera);
    const { centre, radius } = getRenderedParticleGeometry(point, camera);
    const distance = Math.hypot(pointer.x - centre.x, pointer.y - centre.y);

    if (distance <= radius + HIT_PADDING_PX) {
      return particle.id;
    }
  }

  return null;
}
