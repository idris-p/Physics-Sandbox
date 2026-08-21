import type { Vec2 } from "../math/Vec2";
import { createTable, type Table } from "./Table";
import type { Scene } from "./Scene";
import { removePulleysForStringIds } from "./pulleyScene";

export function addDefaultTable(
  scene: Scene,
  id: string,
  topLeft: Vec2,
): Table {
  const table = createTable(id, topLeft);
  scene.tables.push(table);
  return table;
}

export function removeTable(scene: Scene, tableId: string): boolean {
  const originalLength = scene.tables.length;
  scene.tables = scene.tables.filter((table) => table.id !== tableId);
  if (scene.tables.length === originalLength) return false;

  const removedParticleIds = new Set(
    scene.particles
      .filter((particle) => particle.initialTableContact?.tableId === tableId)
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
      pulley.mount.kind === "table-corner" &&
      pulley.mount.tableId === tableId
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
