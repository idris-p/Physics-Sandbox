import { describe, expect, it } from "vitest";
import { createIncline } from "../model/Incline";
import { createPulley, PULLEY_RADIUS_METRES } from "../model/Pulley";
import { createScene } from "../model/Scene";
import { createTable } from "../model/Table";
import { getInclineGeometry } from "./inclineGeometry";
import {
  findPulleyMountSnap,
  getMountedPulleyCentre,
  getPulleyRouteGeometry,
} from "./pulleyGeometry";

describe("Pulley geometry", () => {
  it("uses the central fixed radius and free west/east tangencies", () => {
    const scene = createScene();
    const pulley = createPulley(
      "pulley",
      { x: 2, y: 8 },
      { kind: "free" },
      "string",
      ["a", "b"],
    );
    const route = getPulleyRouteGeometry(scene, pulley)!;
    expect(route.endpointATangent).toEqual({ x: 2 - PULLEY_RADIUS_METRES, y: 8 });
    expect(route.endpointBTangent.x).toBeCloseTo(2 + PULLEY_RADIUS_METRES, 12);
    expect(route.endpointBTangent.y).toBeCloseTo(8, 12);
    expect(route.fixedLength).toBeCloseTo(Math.PI * PULLEY_RADIUS_METRES, 12);
  });

  it("exposes deterministic Table-corner and Incline-end snaps", () => {
    const scene = createScene();
    scene.tables.push(createTable("table", { x: 0, y: 5 }, 10, 4));
    scene.inclines.push(createIncline("incline", { x: 20, y: 0 }));

    const tableSnap = findPulleyMountSnap({ x: 10.2, y: 5.1 }, scene)!;
    expect(tableSnap.mount).toEqual({
      kind: "table-corner",
      tableId: "table",
      side: "right",
    });
    expect(tableSnap.centre).toEqual({ x: 10, y: 5 });

    const incline = scene.inclines[0];
    const mounted = createPulley(
      "pulley",
      { x: 0, y: 0 },
      { kind: "incline-end", inclineId: incline.id },
      "string",
      ["a", "b"],
    );
    expect(getMountedPulleyCentre(scene, mounted.mount, mounted.centre)).not.toBeNull();
    const route = getPulleyRouteGeometry(scene, mounted)!;
    expect(route.fixedLength).toBeGreaterThan(0);
  });

  it("centres on a Table corner and routes to opposite circumference points", () => {
    const scene = createScene();
    scene.tables.push(createTable("table", { x: 0, y: 5 }, 10, 4));
    const pulley = createPulley(
      "pulley",
      { x: 10, y: 5 },
      { kind: "table-corner", tableId: "table", side: "right" },
      "string",
      ["a", "b"],
    );
    const route = getPulleyRouteGeometry(scene, pulley)!;
    expect(getMountedPulleyCentre(scene, pulley.mount, pulley.centre)).toEqual({
      x: 10,
      y: 5,
    });
    expect(route.endpointATangent).toEqual({
      x: 10 - PULLEY_RADIUS_METRES,
      y: 5,
    });
    expect(route.endpointBTangent.x).toBeCloseTo(
      10 + PULLEY_RADIUS_METRES,
      12,
    );
    expect(route.endpointBTangent.y).toBeCloseTo(5, 12);
    expect(route.fixedLength).toBeCloseTo(
      Math.PI * PULLEY_RADIUS_METRES,
      12,
    );
  });

  it("centres on the Incline endpoint with its surface-side radius parallel to the Incline", () => {
    const scene = createScene();
    const incline = createIncline("incline", { x: 0, y: 0 });
    scene.inclines.push(incline);
    const pulley = createPulley(
      "pulley",
      { x: 0, y: 0 },
      { kind: "incline-end", inclineId: incline.id },
      "string",
      ["a", "b"],
    );
    const route = getPulleyRouteGeometry(scene, pulley)!;
    const geometry = getInclineGeometry(incline);
    expect(getMountedPulleyCentre(scene, pulley.mount, pulley.centre)).toEqual(
      geometry.upperEndpoint,
    );
    const radius = {
      x: route.endpointATangent.x -
        getMountedPulleyCentre(scene, pulley.mount, pulley.centre)!.x,
      y: route.endpointATangent.y -
        getMountedPulleyCentre(scene, pulley.mount, pulley.centre)!.y,
    };
    expect(radius.x * geometry.normal.x + radius.y * geometry.normal.y)
      .toBeCloseTo(0, 12);
    expect(radius.x * geometry.tangent.x + radius.y * geometry.tangent.y)
      .toBeCloseTo(-PULLEY_RADIUS_METRES, 12);
  });
});
