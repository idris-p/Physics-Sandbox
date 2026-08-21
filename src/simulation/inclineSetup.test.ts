import { describe, expect, it } from "vitest";
import {
  getInclineGeometry,
  isPointOnInclineSegment,
} from "../geometry/inclineGeometry";
import { createIncline } from "../model/Incline";
import { createParticle } from "../model/Particle";
import { createPulley } from "../model/Pulley";
import { createScene } from "../model/Scene";
import { createTable } from "../model/Table";
import { addPulleyApparatus } from "../model/pulleyScene";
import {
  canPlaceInclineInScene,
  findInclineGridSnap,
  findInclineSnap,
  placeParticlesOnInclineSurface,
  resolveParticlePlacementAgainstInclines,
  snapParticleToIncline,
} from "./inclineSetup";

describe("deliberate incline particle setup", () => {
  it("snaps in one-metre increments measured along a right-rising incline", () => {
    const incline = createIncline("incline", { x: 0, y: 0 });
    const snap = findInclineGridSnap(
      { x: 3.2, y: 2.1 },
      [incline],
      1,
    );

    expect(snap).not.toBeNull();
    expect(snap!.q).toBe(4);
    expect(snap!.position.x).toBeCloseTo(4 * Math.cos(Math.PI / 6), 12);
    expect(snap!.position.y).toBeCloseTo(4 * Math.sin(Math.PI / 6), 12);
  });

  it("measures incline grid increments from the lower endpoint when rising left", () => {
    const incline = createIncline("incline", { x: 5, y: 2 }, "rises-left");
    const snap = findInclineGridSnap(
      { x: 1.8, y: 4.1 },
      [incline],
      1,
    );

    expect(snap).not.toBeNull();
    expect(snap!.q).toBe(4);
    expect(snap!.position.x).toBeCloseTo(5 - 4 * Math.cos(Math.PI / 6), 12);
    expect(snap!.position.y).toBeCloseTo(2 + 4 * Math.sin(Math.PI / 6), 12);
  });

  it("keeps the final grid point within a non-integer incline length", () => {
    const incline = createIncline("incline", { x: 0, y: 0 });
    const snap = findInclineGridSnap(
      { x: 9.9, y: 5.7 },
      [incline],
      1,
    );

    expect(snap).not.toBeNull();
    expect(snap!.q).toBe(Math.floor(
      Math.hypot(incline.horizontalLength, incline.horizontalLength * Math.tan(Math.PI / 6)),
    ));
  });

  it("snaps the mathematical point exactly onto the finite surface", () => {
    const incline = createIncline("incline", { x: 0, y: 0 });
    const particle = createParticle("particle", { x: 4, y: 2.5 });
    const snap = snapParticleToIncline(
      particle,
      particle.initialPosition,
      [incline],
      1,
    );

    expect(snap).not.toBeNull();
    expect(particle.initialInclineContact?.inclineId).toBe(incline.id);
    expect(isPointOnInclineSegment(particle.initialPosition, incline)).toBe(true);
  });

  it("does not use rendered particle radius in setup contact", () => {
    const incline = createIncline("incline", { x: 0, y: 0 });
    expect(findInclineSnap({ x: 4, y: 4 }, [incline], 0.5)).toBeNull();
    expect(findInclineSnap({ x: 4, y: 4 }, [incline], 3)).not.toBeNull();
  });

  it("suppresses an ambiguous equal-distance choice between two inclines", () => {
    const first = createIncline("first", { x: 0, y: 0 });
    const second = createIncline("second", { x: 0, y: 0 });
    expect(findInclineSnap({ x: 3, y: Math.sqrt(3) }, [first, second], 0.1))
      .toBeNull();
  });

  it("clears a stale association when moved away", () => {
    const incline = createIncline("incline", { x: 0, y: 0 });
    const particle = createParticle("particle", { x: 3, y: Math.sqrt(3) });
    snapParticleToIncline(particle, particle.initialPosition, [incline]);
    snapParticleToIncline(particle, { x: 100, y: 100 }, [incline]);
    expect(particle.initialInclineContact).toBeUndefined();
  });

  it("moves a point inside a right-rising incline onto its top surface", () => {
    const incline = createIncline("incline", { x: 0, y: 0 });
    const resolved = resolveParticlePlacementAgainstInclines(
      { x: 6, y: 1 },
      [incline],
    );

    expect(resolved.x).toBe(6);
    expect(resolved.y).toBeCloseTo(6 * Math.tan(Math.PI / 6), 12);
    expect(isPointOnInclineSegment(resolved, incline)).toBe(true);
  });

  it("handles left-rising solids and leaves exterior points unchanged", () => {
    const incline = createIncline(
      "incline",
      { x: 0, y: 2 },
      "rises-left",
    );
    expect(resolveParticlePlacementAgainstInclines(
      { x: -4, y: 2.5 },
      [incline],
    ).y).toBeCloseTo(2 + 4 * Math.tan(Math.PI / 6), 12);
    expect(resolveParticlePlacementAgainstInclines(
      { x: -4, y: 1 },
      [incline],
    )).toEqual({ x: -4, y: 1 });
    expect(resolveParticlePlacementAgainstInclines(
      { x: 2, y: 3 },
      [incline],
    )).toEqual({ x: 2, y: 3 });
  });

  it("does not offset points already on or above the mathematical surface", () => {
    const incline = createIncline("incline", { x: 0, y: 0 });
    const surface = { x: 5, y: 5 * Math.tan(Math.PI / 6) };
    expect(resolveParticlePlacementAgainstInclines(surface, [incline]))
      .toEqual(surface);
    expect(resolveParticlePlacementAgainstInclines(
      { x: surface.x, y: surface.y + 1 },
      [incline],
    )).toEqual({ x: surface.x, y: surface.y + 1 });
  });

  it("places particles enclosed by a newly placed incline onto its surface", () => {
    const incline = createIncline("incline", { x: 0, y: 0 });
    const enclosed = createParticle("enclosed", { x: 6, y: 1 });
    const above = createParticle("above", { x: 6, y: 8 });

    expect(placeParticlesOnInclineSurface([enclosed, above], incline))
      .toEqual([enclosed.id]);
    expect(enclosed.initialPosition.x).toBe(6);
    expect(enclosed.initialPosition.y).toBeCloseTo(
      6 * Math.tan(Math.PI / 6),
      12,
    );
    expect(enclosed.initialInclineContact?.inclineId).toBe(incline.id);
    expect(isPointOnInclineSegment(enclosed.initialPosition, incline)).toBe(true);
    expect(above.initialPosition).toEqual({ x: 6, y: 8 });
    expect(above.initialInclineContact).toBeUndefined();
  });

  it("associates exact surface points without stealing other incline contacts", () => {
    const incline = createIncline("incline", { x: 0, y: 0 });
    const surface = createParticle("surface", {
      x: 4,
      y: 4 * Math.tan(Math.PI / 6),
    });
    const otherContact = createParticle("other", { x: 5, y: 1 });
    otherContact.initialInclineContact = { inclineId: "other-incline", q: 2 };

    expect(placeParticlesOnInclineSurface(
      [surface, otherContact],
      incline,
    )).toEqual([surface.id]);
    expect(surface.initialInclineContact?.inclineId).toBe(incline.id);
    expect(otherContact.initialPosition).toEqual({ x: 5, y: 1 });
    expect(otherContact.initialInclineContact?.inclineId).toBe("other-incline");
  });

  it("rejects Incline overlap with Tables, Pulleys, Strings, and Inclines", () => {
    const candidate = createIncline("candidate", { x: 0, y: 0 });

    const tableScene = createScene();
    tableScene.tables.push(createTable("table", { x: 4, y: 4 }, 4, 4));
    expect(canPlaceInclineInScene(candidate, tableScene)).toBe(false);

    const pulleyScene = createScene();
    pulleyScene.pulleys.push(createPulley(
      "pulley",
      { x: 5, y: 1 },
      { kind: "free" },
      "string",
      ["a", "b"],
    ));
    expect(canPlaceInclineInScene(candidate, pulleyScene)).toBe(false);

    const stringScene = createScene();
    stringScene.particles.push(
      createParticle("a", { x: -1, y: 1 }),
      createParticle("b", { x: 11, y: 1 }),
    );
    stringScene.strings.push({
      id: "string",
      particleAId: "a",
      particleBId: "b",
      length: 12,
      lengthInput: "12",
    });
    expect(canPlaceInclineInScene(candidate, stringScene)).toBe(false);

    const inclineScene = createScene();
    inclineScene.inclines.push(createIncline("other", { x: 2, y: 1 }));
    expect(canPlaceInclineInScene(candidate, inclineScene)).toBe(false);

    const pulleyParticleScene = createScene();
    pulleyParticleScene.pulleys.push(createPulley(
      "outside-pulley",
      { x: 20, y: 20 },
      { kind: "free" },
      "pulley-string",
      ["pulley-a", "pulley-b"],
    ));
    const pulleyParticle = createParticle("pulley-a", { x: 5, y: 3.1 });
    pulleyParticle.shape = "square";
    pulleyParticleScene.particles.push(
      pulleyParticle,
      createParticle("pulley-b", { x: 20, y: 15 }),
    );
    expect(canPlaceInclineInScene(candidate, pulleyParticleScene)).toBe(false);
  });

  it("allows particles and solid boundaries to touch an Incline", () => {
    const candidate = createIncline("candidate", { x: 0, y: 0 });
    const scene = createScene();
    scene.particles.push(createParticle("particle", { x: 5, y: 1 }));
    scene.tables.push(createTable("touching", { x: 10, y: 4 }, 3, 4));

    expect(canPlaceInclineInScene(candidate, scene)).toBe(true);
  });

  it("ignores an Incline's own mounted Pulley apparatus", () => {
    const scene = createScene();
    const incline = createIncline("incline", { x: 0, y: 0 });
    scene.inclines.push(incline);
    expect(addPulleyApparatus(
      scene,
      {
        pulleyId: "pulley",
        stringId: "string",
        particleAId: "a",
        particleBId: "b",
      },
      getInclineGeometry(incline).upperEndpoint,
      { kind: "incline-end", inclineId: incline.id },
    )).not.toBeNull();

    expect(canPlaceInclineInScene(incline, scene)).toBe(true);
  });
});
