import type { Vec2 } from "../math/Vec2";
import { createIncline, type Incline } from "./Incline";
import type { Scene } from "./Scene";
import { removePulleysForStringIds } from "./pulleyScene";

export function addDefaultIncline(
  scene: Scene,
  id: string,
  lowerEndpoint: Vec2,
): Incline {
  const incline = createIncline(id, lowerEndpoint);
  scene.inclines.push(incline);
  return incline;
}

export function removeIncline(scene: Scene, inclineId: string): boolean {
  const originalLength = scene.inclines.length;
  scene.inclines = scene.inclines.filter((incline) => incline.id !== inclineId);
  if (scene.inclines.length === originalLength) return false;

  const removedParticleIds = new Set(
    scene.particles
      .filter((particle) => particle.initialInclineContact?.inclineId === inclineId)
      .map((particle) => particle.id),
  );
  const removedStringIds = new Set(
    scene.strings
      .filter((string) =>
        removedParticleIds.has(string.particleAId) ||
        removedParticleIds.has(string.particleBId)
      )
      .map((string) => string.id),
  );
  for (const pulley of scene.pulleys) {
    if (
      pulley.mount.kind === "incline-end" &&
      pulley.mount.inclineId === inclineId
    ) {
      removedStringIds.add(pulley.stringId);
    }
  }
  scene.particles = scene.particles.filter(
    (particle) => !removedParticleIds.has(particle.id),
  );
  scene.strings = scene.strings.filter(
    (string) => !removedStringIds.has(string.id),
  );
  removePulleysForStringIds(scene, removedStringIds);
  return true;
}
