import type { Scene } from "../model/Scene";
import type { ParticleState } from "../model/Particle";
import { calculateParticleState } from "./calculateParticleState";

export function calculateSceneState(scene: Scene, time: number): ParticleState[] {
  return scene.particles.map((particle) =>
    calculateParticleState(particle, time, {
      gravity: scene.settings.gravity,
      groundEnabled: scene.groundEnabled,
      groundHeight: scene.groundHeight,
    }),
  );
}
