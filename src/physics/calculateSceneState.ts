import type { Scene } from "../model/Scene";
import type { ParticleState } from "../model/Particle";
import { calculateParticleState } from "./calculateParticleState";
import { calculateConnectedSystemTrajectory } from "./connectedTrajectory";

export function calculateSceneState(scene: Scene, time: number): ParticleState[] {
  const connectedStates = new Map<string, ParticleState>();
  for (const string of scene.strings) {
    const trajectory = calculateConnectedSystemTrajectory(scene, string, time);
    if (!trajectory) continue;
    for (const state of trajectory.states) connectedStates.set(state.id, state);
  }
  return scene.particles.map((particle) =>
    connectedStates.get(particle.id) ?? calculateParticleState(particle, time, {
      gravity: scene.settings.gravity,
      groundEnabled: scene.groundEnabled,
      groundHeight: scene.groundHeight,
      groundRough: scene.groundRough,
      groundFriction: scene.groundFriction,
      inclines: scene.inclines,
    }),
  );
}
