import { describe, expect, it } from "vitest";
import { createIncline } from "../model/Incline";
import { createParticle } from "../model/Particle";
import { createPulley } from "../model/Pulley";
import { createScene } from "../model/Scene";
import { createTable } from "../model/Table";
import { addPulleyApparatus } from "../model/pulleyScene";
import {
  canPlaceTable,
  findTableGridSnap,
  placeParticlesOnTableSurface,
  resolveParticlePlacementAgainstTables,
  snapParticleToTable,
} from "./tableSetup";

describe("Table setup", () => {
  it("snaps particles to whole-metre coordinates on the finite top", () => {
    const table = createTable("table", { x: 2, y: 5 }, 8, 3);
    const snap = findTableGridSnap({ x: 5.2, y: 5.2 }, [table])!;
    expect(snap.q).toBe(3);
    expect(snap.position).toEqual({ x: 5, y: 5 });
    expect(findTableGridSnap({ x: 11, y: 5 }, [table])).toBeNull();
  });

  it("stores explicit support and prevents placement inside the visual body", () => {
    const table = createTable("table", { x: 0, y: 5 }, 10, 4);
    const particle = createParticle("particle", { x: 4, y: 4.8 });
    expect(resolveParticlePlacementAgainstTables(particle.initialPosition, [table]))
      .toEqual({ x: 4, y: 5 });
    expect(snapParticleToTable(particle, { x: 4, y: 5.1 }, [table]))
      .not.toBeNull();
    expect(particle.initialTableContact).toEqual({ tableId: table.id, q: 4 });
  });

  it("lifts covered particles vertically onto the new Table surface", () => {
    const candidate = createTable("candidate", { x: 0, y: 5 }, 10, 5);
    const particleScene = createScene();
    const particle = createParticle("particle", { x: 5, y: 2 });
    particleScene.particles.push(particle);

    expect(canPlaceTable(candidate, particleScene)).toBe(true);
    expect(placeParticlesOnTableSurface(particleScene.particles, candidate))
      .toEqual([particle.id]);
    expect(particle.initialPosition).toEqual({ x: 5, y: 5 });
    expect(particle.initialTableContact).toEqual({
      tableId: candidate.id,
      q: 5,
    });
  });

  it("rejects overlap with Inclines, Pulleys, Strings, and Tables", () => {
    const candidate = createTable("candidate", { x: 0, y: 5 }, 10, 5);

    const inclineScene = createScene();
    inclineScene.inclines.push(createIncline("incline", { x: 4, y: 1 }));
    expect(canPlaceTable(candidate, inclineScene)).toBe(false);

    const pulleyScene = createScene();
    pulleyScene.pulleys.push(createPulley(
      "pulley",
      { x: 5, y: 2 },
      { kind: "free" },
      "string",
      ["a", "b"],
    ));
    expect(canPlaceTable(candidate, pulleyScene)).toBe(false);

    const stringScene = createScene();
    stringScene.particles.push(
      createParticle("a", { x: -1, y: 2 }),
      createParticle("b", { x: 11, y: 2 }),
    );
    stringScene.strings.push({
      id: "string",
      particleAId: "a",
      particleBId: "b",
      length: 12,
      lengthInput: "12",
    });
    expect(canPlaceTable(candidate, stringScene)).toBe(false);

    const tableScene = createScene();
    tableScene.tables.push(createTable("existing", { x: 8, y: 6 }, 4, 4));
    expect(canPlaceTable(candidate, tableScene)).toBe(false);

    const pulleyParticleScene = createScene();
    pulleyParticleScene.pulleys.push(createPulley(
      "outside-pulley",
      { x: 20, y: 20 },
      { kind: "free" },
      "pulley-string",
      ["pulley-a", "pulley-b"],
    ));
    const pulleyParticle = createParticle("pulley-a", { x: 10.25, y: 2 });
    pulleyParticle.shape = "square";
    pulleyParticleScene.particles.push(
      pulleyParticle,
      createParticle("pulley-b", { x: 20, y: 15 }),
    );
    expect(canPlaceTable(candidate, pulleyParticleScene)).toBe(false);
  });

  it("allows solid surfaces and Strings to touch the Table boundary", () => {
    const scene = createScene();
    const candidate = createTable("candidate", { x: 0, y: 5 }, 10, 5);
    scene.tables.push(createTable("touching", { x: 10, y: 5 }, 3, 3));
    scene.particles.push(
      createParticle("a", { x: -1, y: 5 }),
      createParticle("b", { x: 11, y: 5 }),
    );
    scene.strings.push({
      id: "string",
      particleAId: "a",
      particleBId: "b",
      length: 12,
      lengthInput: "12",
    });

    expect(canPlaceTable(candidate, scene)).toBe(true);
  });

  it("ignores a Table's own mounted Pulley particles", () => {
    const scene = createScene();
    const table = createTable("table", { x: 0, y: 5 }, 10, 5);
    scene.tables.push(table);
    expect(addPulleyApparatus(
      scene,
      {
        pulleyId: "pulley",
        stringId: "string",
        particleAId: "a",
        particleBId: "b",
      },
      { x: 10, y: 5 },
      { kind: "table-corner", tableId: table.id, side: "right" },
    )).not.toBeNull();

    expect(canPlaceTable(table, scene, table.id)).toBe(true);
  });

  it("allows a Table to grow upward with its directly connected particles", () => {
    const scene = createScene();
    const table = createTable("table", { x: 0, y: 5 }, 10, 5);
    const particleA = createParticle("a", { x: 2, y: 5 });
    const particleB = createParticle("b", { x: 7, y: 5 });
    particleA.initialTableContact = { tableId: table.id, q: 2 };
    particleB.initialTableContact = { tableId: table.id, q: 7 };
    scene.tables.push(table);
    scene.particles.push(particleA, particleB);
    scene.strings.push({
      id: "string",
      particleAId: particleA.id,
      particleBId: particleB.id,
      length: 5,
      lengthInput: "5",
    });

    const tallerTable = createTable("table", { x: 0, y: 7 }, 10, 7);

    expect(canPlaceTable(tallerTable, scene, table.id)).toBe(true);
  });
});
