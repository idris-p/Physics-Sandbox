import { describe, expect, it } from "vitest";
import { getInclineGeometry, pointAtInclineCoordinate } from "../geometry/inclineGeometry";
import { createIncline } from "../model/Incline";
import { createParticle } from "../model/Particle";
import { createScene } from "../model/Scene";
import {
  connectParticlesWithString,
  getStringState,
  resizeStringToCurrentSeparation,
  removeStringsForParticle,
  setStringLength,
  validateStringConnection,
} from "./stringConnection";

describe("direct string connection validation", () => {
  it("connects two particles on the same ground and stores path separation", () => {
    const scene = createScene();
    scene.particles.push(
      createParticle("a", { x: -2, y: 0 }),
      createParticle("b", { x: 5, y: 0 }),
    );

    const result = connectParticlesWithString(scene, "string-1", "a", "b");

    expect(result).toMatchObject({ ok: true, string: { length: 7 } });
    expect(result).toMatchObject({ ok: true, string: { lengthInput: "7" } });
    expect(validateStringConnection(scene, "a", "b", "string-1")).toMatchObject({
      valid: true,
      state: "taut",
    });
    expect(scene.strings).toHaveLength(1);
    expect(scene.particles.map((particle) => particle.shape)).toEqual([
      "square",
      "square",
    ]);

    scene.particles[0].shape = "circle";
    expect(scene.particles[0].shape).toBe("circle");
  });

  it("edits length without moving endpoints and derives Slack state", () => {
    const scene = createScene();
    scene.particles.push(
      createParticle("a", { x: 0, y: 0 }),
      createParticle("b", { x: 4, y: 0 }),
    );
    const connection = connectParticlesWithString(scene, "string", "a", "b");
    if (!connection.ok) throw new Error(connection.message);

    expect(setStringLength(scene, "string", 6, "6.0")).toEqual({ ok: true });
    expect(connection.string).toMatchObject({ length: 6, lengthInput: "6.0" });
    expect(getStringState(4, connection.string.length)).toBe("slack");
    expect(scene.particles.map((particle) => particle.initialPosition.x)).toEqual([0, 4]);
  });

  it("rejects a length shorter than current separation", () => {
    const scene = createScene();
    scene.particles.push(
      createParticle("a", { x: 0, y: 0 }),
      createParticle("b", { x: 4, y: 0 }),
    );
    const connection = connectParticlesWithString(scene, "string", "a", "b");
    if (!connection.ok) throw new Error(connection.message);

    expect(setStringLength(scene, "string", 3.999, "3.999")).toMatchObject({
      ok: false,
    });
    expect(connection.string.length).toBe(4);
  });

  it("allows an endpoint to move closer but rejects extension beyond fixed length", () => {
    const scene = createScene();
    const a = createParticle("a", { x: 0, y: 0 });
    const b = createParticle("b", { x: 4, y: 0 });
    scene.particles.push(a, b);
    const connection = connectParticlesWithString(scene, "string", "a", "b");
    if (!connection.ok) throw new Error(connection.message);

    b.initialPosition.x = 3;
    expect(validateStringConnection(scene, "a", "b", "string")).toMatchObject({
      valid: true,
      state: "slack",
    });
    b.initialPosition.x = 4;
    expect(validateStringConnection(scene, "a", "b", "string")).toMatchObject({
      valid: true,
      state: "taut",
    });
    b.initialPosition.x = 4.1;
    expect(validateStringConnection(scene, "a", "b", "string")).toMatchObject({
      valid: false,
      reason: "overextended",
    });
    expect(connection.string.length).toBe(4);
  });

  it("resizes string length to a dragged endpoint in either direction", () => {
    const scene = createScene();
    const a = createParticle("a", { x: 0, y: 0 });
    const b = createParticle("b", { x: 4, y: 0 });
    scene.particles.push(a, b);
    const connection = connectParticlesWithString(scene, "string", "a", "b");
    if (!connection.ok) throw new Error(connection.message);

    b.initialPosition.x = 7;
    expect(resizeStringToCurrentSeparation(scene, "string")).toBe(true);
    expect(connection.string).toMatchObject({ length: 7, lengthInput: "7" });
    expect(validateStringConnection(scene, "a", "b", "string")).toMatchObject({
      valid: true,
      state: "taut",
    });

    b.initialPosition.x = 5;
    expect(resizeStringToCurrentSeparation(scene, "string")).toBe(true);
    expect(connection.string).toMatchObject({ length: 5, lengthInput: "5" });
    expect(validateStringConnection(scene, "a", "b", "string")).toMatchObject({
      valid: true,
      state: "taut",
    });
  });

  it("connects particles on the exact same Incline", () => {
    const scene = createScene();
    const incline = createIncline("incline", { x: 0, y: 0 });
    scene.inclines.push(incline);
    const a = createParticle("a", pointAtInclineCoordinate(incline, 2));
    const b = createParticle("b", pointAtInclineCoordinate(incline, 6));
    a.initialInclineContact = { inclineId: incline.id, q: 2 };
    b.initialInclineContact = { inclineId: incline.id, q: 6 };
    scene.particles.push(a, b);

    expect(validateStringConnection(scene, "a", "b")).toMatchObject({
      valid: true,
      support: { kind: "incline", inclineId: "incline" },
      length: 4,
    });
  });

  it.each([
    ["ground and Incline", "different-supports"],
    ["different Inclines", "different-supports"],
    ["free flight", "free-flight"],
  ])("rejects %s endpoints", (scenario, reason) => {
    const scene = createScene();
    const firstIncline = createIncline("first", { x: 0, y: 0 });
    const secondIncline = createIncline("second", { x: 20, y: 0 });
    scene.inclines.push(firstIncline, secondIncline);
    const a = createParticle("a", { x: -2, y: 0 });
    const b = createParticle("b", { x: 2, y: 0 });
    if (scenario === "ground and Incline") {
      b.initialPosition = pointAtInclineCoordinate(firstIncline, 2);
      b.initialInclineContact = { inclineId: firstIncline.id, q: 2 };
    } else if (scenario === "different Inclines") {
      a.initialPosition = pointAtInclineCoordinate(firstIncline, 2);
      a.initialInclineContact = { inclineId: firstIncline.id, q: 2 };
      b.initialPosition = pointAtInclineCoordinate(secondIncline, 2);
      b.initialInclineContact = { inclineId: secondIncline.id, q: 2 };
    } else {
      b.initialPosition.y = 4;
    }
    scene.particles.push(a, b);

    expect(validateStringConnection(scene, "a", "b")).toMatchObject({
      valid: false,
      reason,
    });
  });

  it("rejects incompatible scalar velocities without altering them", () => {
    const scene = createScene();
    const a = createParticle("a", { x: 0, y: 0 });
    const b = createParticle("b", { x: 4, y: 0 });
    a.initialVelocity.x = 1;
    b.initialVelocity.x = 2;
    scene.particles.push(a, b);

    expect(validateStringConnection(scene, "a", "b")).toMatchObject({
      valid: false,
      reason: "incompatible-velocities",
    });
    expect([a.initialVelocity.x, b.initialVelocity.x]).toEqual([1, 2]);
  });

  it("uses mathematical centres to reject an intervening particle", () => {
    const scene = createScene();
    scene.particles.push(
      createParticle("a", { x: 0, y: 0 }),
      createParticle("obstruction", { x: 2, y: 0 }),
      createParticle("b", { x: 4, y: 0 }),
    );

    expect(validateStringConnection(scene, "a", "b")).toMatchObject({
      valid: false,
      reason: "particle-obstruction",
    });
  });

  it("rejects an Incline whose solid interior blocks a ground string", () => {
    const scene = createScene();
    const blockingIncline = createIncline("block", { x: -1, y: -1 });
    scene.inclines.push(blockingIncline);
    scene.particles.push(
      createParticle("a", { x: -3, y: 0 }),
      createParticle("b", { x: 3, y: 0 }),
    );

    expect(getInclineGeometry(blockingIncline).upperEndpoint.y).toBeGreaterThan(0);
    expect(validateStringConnection(scene, "a", "b")).toMatchObject({
      valid: false,
      reason: "geometry-obstruction",
    });
  });

  it("removes endpoint strings without leaving one-ended connections", () => {
    const scene = createScene();
    scene.particles.push(
      createParticle("a", { x: 0, y: 0 }),
      createParticle("b", { x: 4, y: 0 }),
    );
    connectParticlesWithString(scene, "string-1", "a", "b");

    removeStringsForParticle(scene, "a");

    expect(scene.strings).toEqual([]);
  });
});
