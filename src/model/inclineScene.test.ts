import { describe, expect, it } from "vitest";
import { createParticle } from "./Particle";
import { createIncline, setInclineRoughness } from "./Incline";
import { createScene } from "./Scene";
import { addDefaultIncline, removeIncline } from "./inclineScene";

describe("incline scene operations", () => {
  it("provides an active default coefficient when an incline becomes rough", () => {
    const incline = createIncline("rough", { x: 0, y: 0 });
    setInclineRoughness(incline, true);

    expect(incline.roughness).toEqual({
      kind: "rough",
      coefficientOfFriction: 0.5,
      coefficientInput: "0.5",
    });
  });

  it("creates multiple independent default inclines", () => {
    const scene = createScene();
    addDefaultIncline(scene, "first", { x: 1, y: 2 });
    addDefaultIncline(scene, "second", { x: -3, y: 4 });

    expect(scene.inclines).toHaveLength(2);
    expect(scene.inclines.map((incline) => incline.id)).toEqual([
      "first",
      "second",
    ]);
    expect(scene.inclines[0]).toMatchObject({
      anchor: { x: 1, y: 2 },
      angleDegrees: 30,
      horizontalLength: 10,
    });
  });

  it("deletes the requested incline, its particles, and their strings", () => {
    const scene = createScene();
    addDefaultIncline(scene, "kept", { x: 0, y: 0 });
    addDefaultIncline(scene, "removed", { x: 20, y: 0 });
    const firstRemovedParticle = createParticle("removed-a", { x: 20, y: 0 });
    const secondRemovedParticle = createParticle("removed-b", { x: 22, y: 1 });
    const keptParticle = createParticle("kept-particle", { x: 0, y: 0 });
    firstRemovedParticle.initialInclineContact = { inclineId: "removed", q: 0 };
    secondRemovedParticle.initialInclineContact = { inclineId: "removed", q: 2 };
    keptParticle.initialInclineContact = { inclineId: "kept", q: 0 };
    scene.particles.push(firstRemovedParticle, secondRemovedParticle, keptParticle);
    scene.strings.push(
      {
        id: "removed-string",
        particleAId: firstRemovedParticle.id,
        particleBId: secondRemovedParticle.id,
        length: 2,
        lengthInput: "2",
      },
      {
        id: "kept-string",
        particleAId: keptParticle.id,
        particleBId: "another-kept-particle",
        length: 1,
        lengthInput: "1",
      },
    );

    expect(removeIncline(scene, "removed")).toBe(true);
    expect(scene.inclines.map((incline) => incline.id)).toEqual(["kept"]);
    expect(scene.particles).toEqual([keptParticle]);
    expect(scene.strings.map((string) => string.id)).toEqual(["kept-string"]);
    expect(removeIncline(scene, "missing")).toBe(false);
  });
});
