import { describe, expect, it } from "vitest";
import { getInclineGeometry } from "../geometry/inclineGeometry";
import { getPulleyRouteGeometry } from "../geometry/pulleyGeometry";
import { createIncline } from "./Incline";
import { createScene } from "./Scene";
import { createTable } from "./Table";
import {
  addPulleyApparatus,
  getPulleyApparatusPlacementPreview,
  movePulleyApparatus,
  rebuildMountedPulleyApparatus,
  removePulley,
} from "./pulleyScene";

describe("Pulley apparatus scene operations", () => {
  it("creates one Pulley, one taut routed String, and two ordinary Particles", () => {
    const scene = createScene();
    const apparatus = addPulleyApparatus(
      scene,
      ids(),
      { x: 0, y: 8 },
    )!;

    expect(scene.pulleys).toEqual([apparatus.pulley]);
    expect(scene.strings).toHaveLength(1);
    expect(scene.particles).toEqual([apparatus.particleA, apparatus.particleB]);
    expect(scene.strings[0].route).toMatchObject({
      kind: "pulley",
      pulleyId: apparatus.pulley.id,
      leftLength: 4,
      leftLengthInput: "4",
      rightLength: 4,
      rightLengthInput: "4",
    });
    expect(scene.particles.map((particle) => particle.shape)).toEqual([
      "square",
      "square",
    ]);
    const route = getPulleyRouteGeometry(scene, apparatus.pulley)!;
    const routedLength = Math.hypot(
      apparatus.particleA.initialPosition.x - route.endpointATangent.x,
      apparatus.particleA.initialPosition.y - route.endpointATangent.y,
    ) + Math.hypot(
      apparatus.particleB.initialPosition.x - route.endpointBTangent.x,
      apparatus.particleB.initialPosition.y - route.endpointBTangent.y,
    ) + route.fixedLength;
    expect(scene.strings[0].length).toBeCloseTo(routedLength, 12);
  });

  it("creates deterministic Table and Incline endpoint support", () => {
    const tableScene = createScene();
    tableScene.tables.push(createTable("table", { x: 0, y: 5 }));
    const tableApparatus = addPulleyApparatus(
      tableScene,
      ids(),
      { x: 10, y: 5 },
      { kind: "table-corner", tableId: "table", side: "right" },
    )!;
    expect(tableApparatus.particleA.initialTableContact).toEqual({
      tableId: "table",
      q: 6,
    });
    expect(tableApparatus.particleB.initialTableContact).toBeUndefined();
    expect(tableApparatus.pulley.centre).toEqual({
      x: 10,
      y: 5,
    });

    const inclineScene = createScene();
    const incline = createIncline("incline", { x: 0, y: 0 });
    inclineScene.inclines.push(incline);
    const inclineApparatus = addPulleyApparatus(
      inclineScene,
      { ...ids(), pulleyId: "incline-pulley" },
      getInclineGeometry(incline).upperEndpoint,
      { kind: "incline-end", inclineId: incline.id },
    )!;
    expect(inclineApparatus.particleA.initialInclineContact?.inclineId).toBe(
      incline.id,
    );
  });

  it("deletes the complete generated Pulley apparatus", () => {
    const scene = createScene();
    addPulleyApparatus(scene, ids(), { x: 0, y: 8 });
    expect(removePulley(scene, "pulley")).toBe(true);
    expect(scene.pulleys).toEqual([]);
    expect(scene.strings).toEqual([]);
    expect(scene.particles).toEqual([]);
  });

  it("rebuilds a mounted route deterministically after its support changes", () => {
    const scene = createScene();
    const table = createTable("table", { x: 0, y: 5 });
    scene.tables.push(table);
    const apparatus = addPulleyApparatus(
      scene,
      ids(),
      { x: 10, y: 5 },
      { kind: "table-corner", tableId: table.id, side: "right" },
    )!;
    const originalLength = scene.strings[0].length;
    table.width = 12;
    apparatus.particleA.initialTableContact!.q = 8;
    apparatus.particleA.initialPosition = { x: 8, y: 5 };

    expect(rebuildMountedPulleyApparatus(scene, apparatus.pulley.id)).toBe(true);
    const route = getPulleyRouteGeometry(scene, apparatus.pulley)!;
    expect(apparatus.pulley.centre.x).toBe(12);
    expect(apparatus.particleB.initialPosition.x).toBeCloseTo(
      route.endpointBTangent.x,
      12,
    );
    expect(scene.strings[0].length).toBeCloseTo(originalLength, 12);
  });

  it("moves a placed free Pulley and its hanging paths without changing endpoint segment lengths", () => {
    const scene = createScene();
    const apparatus = addPulleyApparatus(scene, ids(), { x: 0, y: 8 })!;
    const routeBefore = getPulleyRouteGeometry(scene, apparatus.pulley)!;
    const stringLengthBefore = scene.strings[0].length;
    const segmentABefore = Math.hypot(
      apparatus.particleA.initialPosition.x - routeBefore.endpointATangent.x,
      apparatus.particleA.initialPosition.y - routeBefore.endpointATangent.y,
    );

    expect(movePulleyApparatus(
      scene,
      apparatus.pulley.id,
      { x: 7.25, y: 11.5 },
      { kind: "free" },
    )).toBe(true);

    const routeAfter = getPulleyRouteGeometry(scene, apparatus.pulley)!;
    expect(apparatus.pulley.centre).toEqual({ x: 7.25, y: 11.5 });
    expect(apparatus.particleA.initialPosition.x).toBe(
      routeAfter.endpointATangent.x,
    );
    expect(apparatus.particleB.initialPosition.x).toBe(
      routeAfter.endpointBTangent.x,
    );
    expect(Math.hypot(
      apparatus.particleA.initialPosition.x - routeAfter.endpointATangent.x,
      apparatus.particleA.initialPosition.y - routeAfter.endpointATangent.y,
    )).toBeCloseTo(segmentABefore, 12);
    expect(scene.strings[0].length).toBeCloseTo(stringLengthBefore, 12);
  });

  it("snaps an existing Pulley apparatus onto a Table corner", () => {
    const scene = createScene();
    const table = createTable("table", { x: 2, y: 6 });
    scene.tables.push(table);
    const apparatus = addPulleyApparatus(scene, ids(), { x: -5, y: 10 })!;

    expect(movePulleyApparatus(
      scene,
      apparatus.pulley.id,
      { x: 12, y: 6 },
      { kind: "table-corner", tableId: table.id, side: "right" },
    )).toBe(true);

    expect(apparatus.pulley.centre).toEqual({ x: 12, y: 6 });
    expect(apparatus.particleA.initialTableContact?.tableId).toBe(table.id);
    expect(apparatus.particleB.initialTableContact).toBeUndefined();
    const route = getPulleyRouteGeometry(scene, apparatus.pulley)!;
    expect(apparatus.particleB.initialPosition.x).toBeCloseTo(
      route.endpointBTangent.x,
      12,
    );
  });

  it("previews the exact endpoint geometry of an Incline-mounted placement", () => {
    const scene = createScene();
    const incline = createIncline("incline", { x: 0, y: 0 });
    scene.inclines.push(incline);
    const mount = { kind: "incline-end", inclineId: incline.id } as const;
    const centre = getInclineGeometry(incline).upperEndpoint;
    const preview = getPulleyApparatusPlacementPreview(
      scene,
      centre,
      mount,
    )!;
    const previewLength = routedLength(preview);

    const apparatus = addPulleyApparatus(
      scene,
      ids(),
      centre,
      mount,
    )!;

    expect(apparatus.particleA.initialPosition).toEqual(
      preview.particleA.initialPosition,
    );
    expect(apparatus.particleB.initialPosition).toEqual(
      preview.particleB.initialPosition,
    );
    expect(scene.strings[0].length).toBeCloseTo(previewLength, 12);
  });

  it("previews preserved endpoint lengths while an existing Pulley moves", () => {
    const scene = createScene();
    const apparatus = addPulleyApparatus(scene, ids(), { x: 0, y: 8 })!;
    apparatus.particleA.initialPosition.y = 2;
    apparatus.particleB.initialPosition.y = 5;
    const destination = { x: 5, y: 11 };
    const preview = getPulleyApparatusPlacementPreview(
      scene,
      destination,
      { kind: "free" },
      apparatus.pulley.id,
    )!;
    const previewLength = routedLength(preview);

    expect(movePulleyApparatus(
      scene,
      apparatus.pulley.id,
      destination,
      { kind: "free" },
    )).toBe(true);

    expect(apparatus.particleA.initialPosition).toEqual(
      preview.particleA.initialPosition,
    );
    expect(apparatus.particleB.initialPosition).toEqual(
      preview.particleB.initialPosition,
    );
    expect(scene.strings[0].length).toBeCloseTo(previewLength, 12);
  });
});

function routedLength(
  placement: NonNullable<
    ReturnType<typeof getPulleyApparatusPlacementPreview>
  >,
): number {
  return placement.route.fixedLength + Math.hypot(
    placement.particleA.initialPosition.x -
      placement.route.endpointATangent.x,
    placement.particleA.initialPosition.y -
      placement.route.endpointATangent.y,
  ) + Math.hypot(
    placement.particleB.initialPosition.x -
      placement.route.endpointBTangent.x,
    placement.particleB.initialPosition.y -
      placement.route.endpointBTangent.y,
  );
}

function ids() {
  return {
    pulleyId: "pulley",
    stringId: "string",
    particleAId: "a",
    particleBId: "b",
  };
}
