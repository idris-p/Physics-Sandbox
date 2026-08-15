import { describe, expect, it } from "vitest";
import { createCamera, worldToScreen } from "./camera";
import { getStringRenderSegment, hitTestStrings } from "./stringGeometry";
import { createParticle } from "../model/Particle";
import { createScene } from "../model/Scene";
import { connectParticlesWithString } from "../dynamics/stringConnection";

describe("string canvas geometry", () => {
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
