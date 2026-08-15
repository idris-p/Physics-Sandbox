import { describe, expect, it } from "vitest";
import { createCamera, worldToScreen } from "./camera";
import {
  groupParticlesByPosition,
  getInclineScreenRotation,
  getRenderedParticleGeometry,
  getRenderedParticleShapeGeometry,
  isPointInRenderedParticle,
  PARTICLE_DIAMETER_METRES,
} from "./particleGeometry";
import { createIncline } from "../model/Incline";

describe("particle render geometry", () => {
  it("renders a particle at exactly one metre in diameter at every zoom", () => {
    const camera = createCamera(800, 600);
    const initialGeometry = getRenderedParticleGeometry({ x: 100, y: 100 }, camera);

    expect(PARTICLE_DIAMETER_METRES).toBe(1);
    expect(initialGeometry.radius * 2).toBe(camera.pixelsPerMetre);

    camera.pixelsPerMetre = 80;
    const zoomedGeometry = getRenderedParticleGeometry({ x: 100, y: 100 }, camera);
    expect(zoomedGeometry.radius * 2).toBe(camera.pixelsPerMetre);
  });

  it("centres the visual circle on the mathematical point", () => {
    const camera = createCamera(800, 600);
    const pointPosition = { x: 100, y: 200 };
    const geometry = getRenderedParticleGeometry(pointPosition, camera);

    expect(geometry.centre).toEqual(pointPosition);
  });

  it("renders a square with an exact one-metre side", () => {
    const camera = createCamera(800, 600);
    camera.pixelsPerMetre = 64;

    const geometry = getRenderedParticleShapeGeometry(
      { x: 100, y: 200 },
      camera,
      "square",
    );

    expect(geometry.size).toBe(64);
    expect(geometry.centre).toEqual({ x: 100, y: 200 });
    expect(geometry.rotation).toBe(0);
  });

  it("rotates squares to align with either incline direction", () => {
    const rightRising = createIncline("right", { x: 0, y: 0 });
    const leftRising = createIncline("left", { x: 0, y: 0 });
    leftRising.direction = "rises-left";

    expect(getInclineScreenRotation(rightRising)).toBeCloseTo(-Math.PI / 6, 12);
    expect(getInclineScreenRotation(leftRising)).toBeCloseTo(-5 * Math.PI / 6, 12);
  });

  it("includes the visible corners in a square's hit area", () => {
    const camera = createCamera(800, 600);
    camera.pixelsPerMetre = 40;
    const geometry = getRenderedParticleShapeGeometry(
      { x: 100, y: 100 },
      camera,
      "square",
    );

    expect(isPointInRenderedParticle({ x: 119, y: 119 }, geometry)).toBe(true);
    expect(isPointInRenderedParticle({ x: 121, y: 121 }, geometry)).toBe(false);
  });

  it("keeps the mathematical point as its centre on enabled ground", () => {
    const camera = createCamera(800, 600);
    const groundPoint = worldToScreen({ x: 2, y: 0 }, camera);
    const geometry = getRenderedParticleGeometry(groundPoint, camera);

    expect(geometry.centre).toEqual(groundPoint);
  });

  it("never changes its centre while crossing the former ground-offset boundary", () => {
    const camera = createCamera(800, 600);

    for (const height of [0, 0.1, 0.49, 0.5, 0.51, 1]) {
      const mathematicalPoint = worldToScreen({ x: 3, y: height }, camera);
      expect(
        getRenderedParticleGeometry(mathematicalPoint, camera).centre,
      ).toEqual(mathematicalPoint);
    }
  });

  it("groups particles that occupy the same mathematical position", () => {
    const particleState = {
      position: { x: 2, y: 3 },
      velocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0 },
    };
    const groups = groupParticlesByPosition(
      [
        { ...particleState, id: "first" },
        { ...particleState, id: "second" },
        {
          ...particleState,
          id: "elsewhere",
          position: { x: 4, y: 3 },
        },
      ],
    );

    expect(groups.map((group) => group.map((particle) => particle.id))).toEqual([
      ["first", "second"],
      ["elsewhere"],
    ]);
  });
});
