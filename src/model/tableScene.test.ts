import { describe, expect, it } from "vitest";
import { addPulleyApparatus } from "./pulleyScene";
import { createScene } from "./Scene";
import { addDefaultTable, removeTable } from "./tableScene";

describe("Table scene operations", () => {
  it("places independent finite Tables", () => {
    const scene = createScene();
    const first = addDefaultTable(scene, "first", { x: 0, y: 5 });
    const second = addDefaultTable(scene, "second", { x: 20, y: 8 });
    expect(scene.tables).toEqual([first, second]);
    expect(first).toMatchObject({ width: 10, height: 5 });
  });

  it("removes a mounted apparatus without leaving stale mount IDs", () => {
    const scene = createScene();
    addDefaultTable(scene, "kept", { x: -20, y: 5 });
    addDefaultTable(scene, "removed", { x: 0, y: 5 });
    const apparatus = addPulleyApparatus(
      scene,
      {
        pulleyId: "pulley",
        stringId: "string",
        particleAId: "table-particle",
        particleBId: "hanging-particle",
      },
      { x: 10, y: 5 },
      { kind: "table-corner", tableId: "removed", side: "right" },
    )!;

    expect(removeTable(scene, "removed")).toBe(true);
    expect(scene.tables.map((table) => table.id)).toEqual(["kept"]);
    expect(scene.pulleys).toEqual([]);
    expect(scene.strings).toEqual([]);
    expect(scene.particles.map((particle) => particle.id)).toEqual([
      apparatus.particleB.id,
    ]);
    expect(removeTable(scene, "missing")).toBe(false);
  });
});
