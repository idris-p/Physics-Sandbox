import { describe, expect, it } from "vitest";
import { createCamera, worldToScreen } from "./camera";
import { getStringRenderSegment, hitTestStrings } from "./stringGeometry";
import { createParticle } from "../model/Particle";
import { createScene } from "../model/Scene";
import { addPulleyApparatus } from "../model/pulleyScene";
import { getPulleyRouteGeometry } from "../geometry/pulleyGeometry";
import { connectParticlesWithString } from "../dynamics/stringConnection";
import { createTable } from "../model/Table";
import { createIncline } from "../model/Incline";
import { getInclineGeometry } from "../geometry/inclineGeometry";

describe("string canvas geometry", () => {
  it("routes a free Pulley String through west/east tangencies", () => {
    const scene = createScene();
    const apparatus = addPulleyApparatus(scene, {
      pulleyId: "pulley",
      stringId: "pulley-string",
      particleAId: "pulley-a",
      particleBId: "pulley-b",
    }, { x: 0, y: 10 })!;
    const camera = createCamera(800, 600);
    const states = scene.particles.map((particle) => ({
      id: particle.id,
      position: { ...particle.initialPosition },
      velocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0 },
    }));
    const segment = getStringRenderSegment(
      scene,
      scene.strings[0],
      states,
      camera,
    )!;
    const route = getPulleyRouteGeometry(scene, apparatus.pulley)!;
    expect(segment.visualPoints[1]).toEqual(
      worldToScreen(route.endpointATangent, camera),
    );
    expect(segment.visualPoints.at(-2)).toEqual(
      worldToScreen(route.endpointBTangent, camera),
    );
    expect(segment.state).toBe("taut");
  });

  it("renders the straight legs of a slack Pulley String as waves", () => {
    const scene = createScene();
    const apparatus = addPulleyApparatus(scene, {
      pulleyId: "pulley",
      stringId: "pulley-string",
      particleAId: "pulley-a",
      particleBId: "pulley-b",
    }, { x: 0, y: 10 })!;
    const camera = createCamera(800, 600);
    const states = scene.particles.map((particle) => ({
      id: particle.id,
      position: {
        x: particle.initialPosition.x,
        y: particle.initialPosition.y + 1,
      },
      velocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0 },
    }));

    const segment = getStringRenderSegment(
      scene,
      scene.strings[0],
      states,
      camera,
    )!;
    const route = getPulleyRouteGeometry(scene, apparatus.pulley)!;
    const tangentA = worldToScreen(route.endpointATangent, camera);
    const tangentIndex = segment.visualPoints.findIndex((point) =>
      Math.abs(point.x - tangentA.x) < 1e-9 &&
      Math.abs(point.y - tangentA.y) < 1e-9
    );

    expect(segment.state).toBe("slack");
    expect(tangentIndex).toBeGreaterThan(2);
    expect(
      segment.visualPoints.slice(1, tangentIndex).some((point) =>
        Math.abs(point.x - segment.visualStart.x) > 0.1
      ),
    ).toBe(true);
    expect(segment.visualPoints[0]).toEqual(segment.visualStart);
    expect(segment.visualPoints.at(-1)).toEqual(segment.physicalEnd);
  });

  it("smoothly compresses a Pulley String wave without changing its cycles", () => {
    const scene = createScene();
    addPulleyApparatus(scene, {
      pulleyId: "pulley",
      stringId: "pulley-string",
      particleAId: "pulley-a",
      particleBId: "pulley-b",
    }, { x: 0, y: 10 });
    const camera = createCamera(800, 600);
    const statesAt = (verticalOffset: number) =>
      scene.particles.map((particle) => ({
        id: particle.id,
        position: {
          x: particle.initialPosition.x,
          y: particle.initialPosition.y + verticalOffset,
        },
        velocity: { x: 0, y: 0 },
        acceleration: { x: 0, y: 0 },
      }));

    const earlier = getStringRenderSegment(
      scene,
      scene.strings[0],
      statesAt(1),
      camera,
    )!;
    const moreSlack = getStringRenderSegment(
      scene,
      scene.strings[0],
      statesAt(2),
      camera,
    )!;

    expect(earlier.state).toBe("slack");
    expect(moreSlack.state).toBe("slack");
    expect(moreSlack.visualPoints).toHaveLength(earlier.visualPoints.length);
    const route = getPulleyRouteGeometry(scene, scene.pulleys[0])!;
    const tangentA = worldToScreen(route.endpointATangent, camera);
    const tangentIndex = earlier.visualPoints.findIndex((point) =>
      Math.abs(point.x - tangentA.x) < 1e-9 &&
      Math.abs(point.y - tangentA.y) < 1e-9
    );
    expect(tangentIndex).toBeGreaterThan(2);
    earlier.visualPoints.slice(0, tangentIndex + 1).forEach((point, index) => {
      expect(
        moreSlack.visualPoints[index].x - moreSlack.visualStart.x,
      ).toBeCloseTo(point.x - earlier.visualStart.x, 12);
    });
  });

  it("offsets a Table-mounted Pulley segment above the Table surface", () => {
    const scene = createScene();
    const table = createTable("table", { x: 0, y: 5 });
    scene.tables.push(table);
    addPulleyApparatus(scene, {
      pulleyId: "pulley",
      stringId: "pulley-string",
      particleAId: "pulley-a",
      particleBId: "pulley-b",
    }, { x: 10, y: 5 }, {
      kind: "table-corner",
      tableId: table.id,
      side: "right",
    });
    const camera = createCamera(800, 600);
    const states = scene.particles.map((particle) => ({
      id: particle.id,
      position: { ...particle.initialPosition },
      velocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0 },
    }));

    const segment = getStringRenderSegment(
      scene,
      scene.strings[0],
      states,
      camera,
    )!;

    expect(segment.visualStart.y).toBeLessThan(segment.physicalStart.y);
    expect(segment.visualPoints[1].y).toBe(segment.visualStart.y);
    expect(segment.visualPoints[1].x).toBeGreaterThan(segment.visualStart.x);
  });

  it("offsets an Incline-mounted Pulley segment normal to the Incline", () => {
    const scene = createScene();
    const incline = createIncline("incline", { x: 0, y: 0 });
    scene.inclines.push(incline);
    addPulleyApparatus(scene, {
      pulleyId: "pulley",
      stringId: "pulley-string",
      particleAId: "pulley-a",
      particleBId: "pulley-b",
    }, getInclineGeometry(incline).upperEndpoint, {
      kind: "incline-end",
      inclineId: incline.id,
    });
    const camera = createCamera(800, 600);
    const states = scene.particles.map((particle) => ({
      id: particle.id,
      position: { ...particle.initialPosition },
      velocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0 },
    }));

    const segment = getStringRenderSegment(
      scene,
      scene.strings[0],
      states,
      camera,
    )!;
    const surfaceDirection = {
      x: segment.visualPoints[1].x - segment.visualStart.x,
      y: segment.visualPoints[1].y - segment.visualStart.y,
    };
    const physicalDirection = getInclineGeometry(incline).tangent;

    expect(segment.visualOffset).not.toEqual({ x: 0, y: 0 });
    expect(surfaceDirection.x * -physicalDirection.y +
      surfaceDirection.y * -physicalDirection.x).toBeCloseTo(0, 12);
  });
  it("offsets a ground string upward without changing physical endpoints", () => {
    const scene = createScene();
    scene.particles.push(
      createParticle("a", { x: -2, y: 0 }),
      createParticle("b", { x: 2, y: 0 }),
    );
    const result = connectParticlesWithString(scene, "string", "a", "b");
    if (!result.ok) throw new Error(result.message);
    const camera = createCamera(800, 600);
    const states = scene.particles.map((particle) => ({
      id: particle.id,
      position: particle.initialPosition,
      velocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0 },
    }));

    const segment = getStringRenderSegment(scene, result.string, states, camera)!;

    expect(segment.physicalStart.y).toBe(segment.physicalEnd.y);
    expect(segment.visualStart.y).toBeLessThan(segment.physicalStart.y);
    expect(segment.visualEnd.x - segment.visualStart.x).toBe(
      segment.physicalEnd.x - segment.physicalStart.x,
    );
  });

  it("renders a slack string as a presentation-only wave", () => {
    const scene = createScene();
    const a = createParticle("a", { x: 0, y: 0 });
    const b = createParticle("b", { x: 4, y: 0 });
    scene.particles.push(a, b);
    const result = connectParticlesWithString(scene, "string", "a", "b");
    if (!result.ok) throw new Error(result.message);
    result.string.length = 6;
    result.string.lengthInput = "6";
    const camera = createCamera(800, 600);
    const states = [
      { id: "a", position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 } },
      { id: "b", position: { x: 4, y: 0 }, velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 } },
    ];

    const segment = getStringRenderSegment(scene, result.string, states, camera)!;

    expect(segment.state).toBe("slack");
    expect(segment.visualPoints).toHaveLength(37);
    expect(segment.physicalStart).toEqual(worldToScreen(states[0].position, camera));
    expect(segment.physicalEnd).toEqual(worldToScreen(states[1].position, camera));
    expect(result.string.length).toBe(6);
  });

  it("preserves the slack waveform when zoom changes", () => {
    const scene = createScene();
    scene.particles.push(
      createParticle("a", { x: 0, y: 0 }),
      createParticle("b", { x: 4, y: 0 }),
    );
    const result = connectParticlesWithString(scene, "string", "a", "b");
    if (!result.ok) throw new Error(result.message);
    result.string.length = 6;
    result.string.lengthInput = "6";
    const states = scene.particles.map((particle) => ({
      id: particle.id,
      position: particle.initialPosition,
      velocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0 },
    }));
    const normalCamera = createCamera(800, 600);
    const zoomedOutCamera = createCamera(800, 600);
    zoomedOutCamera.pixelsPerMetre = normalCamera.pixelsPerMetre / 2;

    const normal = getStringRenderSegment(
      scene,
      result.string,
      states,
      normalCamera,
    )!;
    const zoomedOut = getStringRenderSegment(
      scene,
      result.string,
      states,
      zoomedOutCamera,
    )!;

    expect(zoomedOut.visualPoints).toHaveLength(normal.visualPoints.length);
    normal.visualPoints.forEach((point, index) => {
      const zoomedPoint = zoomedOut.visualPoints[index];
      expect(
        (point.x - normal.visualStart.x) / normalCamera.pixelsPerMetre,
      ).toBeCloseTo(
        (zoomedPoint.x - zoomedOut.visualStart.x) /
          zoomedOutCamera.pixelsPerMetre,
        12,
      );
      expect(
        (point.y - normal.visualStart.y) / normalCamera.pixelsPerMetre,
      ).toBeCloseTo(
        (zoomedPoint.y - zoomedOut.visualStart.y) /
          zoomedOutCamera.pixelsPerMetre,
        12,
      );
    });
  });

  it("compresses one slack waveform as runtime separation decreases", () => {
    const scene = createScene();
    scene.particles.push(
      createParticle("a", { x: 0, y: 0 }),
      createParticle("b", { x: 5, y: 0 }),
    );
    const result = connectParticlesWithString(scene, "string", "a", "b");
    if (!result.ok) throw new Error(result.message);
    result.string.length = 6;
    result.string.lengthInput = "6";
    const camera = createCamera(800, 600);
    const stateAt = (separation: number) => [
      { id: "a", position: { x: 0, y: 0 }, velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 } },
      { id: "b", position: { x: separation, y: 0 }, velocity: { x: 0, y: 0 }, acceleration: { x: 0, y: 0 } },
    ];

    const earlier = getStringRenderSegment(
      scene,
      result.string,
      stateAt(5),
      camera,
    )!;
    const moreSlack = getStringRenderSegment(
      scene,
      result.string,
      stateAt(3),
      camera,
    )!;

    expect(moreSlack.visualPoints).toHaveLength(earlier.visualPoints.length);
    earlier.visualPoints.forEach((point, index) => {
      const earlierProgress =
        (point.x - earlier.visualStart.x) /
        (earlier.visualEnd.x - earlier.visualStart.x);
      const compressedProgress =
        (moreSlack.visualPoints[index].x - moreSlack.visualStart.x) /
        (moreSlack.visualEnd.x - moreSlack.visualStart.x);
      expect(compressedProgress).toBeCloseTo(earlierProgress, 12);
      expect(
        moreSlack.visualPoints[index].y - moreSlack.visualStart.y,
      ).toBeCloseTo(point.y - earlier.visualStart.y, 12);
    });
  });

  it("selects near the visual line", () => {
    const scene = createScene();
    scene.particles.push(
      createParticle("a", { x: -2, y: 0 }),
      createParticle("b", { x: 2, y: 0 }),
    );
    const result = connectParticlesWithString(scene, "string", "a", "b");
    if (!result.ok) throw new Error(result.message);
    const camera = createCamera(800, 600);
    const states = scene.particles.map((particle) => ({
      id: particle.id,
      position: particle.initialPosition,
      velocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0 },
    }));
    const segment = getStringRenderSegment(scene, result.string, states, camera)!;
    const middle = {
      x: (segment.visualStart.x + segment.visualEnd.x) / 2,
      y: (segment.visualStart.y + segment.visualEnd.y) / 2,
    };

    expect(hitTestStrings(middle, scene, states, camera)).toBe("string");
  });
});
