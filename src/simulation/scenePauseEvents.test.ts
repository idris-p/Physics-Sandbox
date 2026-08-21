import { describe, expect, it } from "vitest";
import { getInclineGeometry } from "../geometry/inclineGeometry";
import { getPulleyRouteGeometry } from "../geometry/pulleyGeometry";
import { createIncline } from "../model/Incline";
import { createParticle } from "../model/Particle";
import { addPulleyApparatus } from "../model/pulleyScene";
import { createScene } from "../model/Scene";
import { createTable } from "../model/Table";
import {
  getNextPulleyGreatestHeightPauseEvent,
  getNextPulleyParticleCoincidencePauseEvent,
  getNextPulleyVerticalTargetPauseEvent,
  getNextSceneContactPauseEvent,
} from "./scenePauseEvents";

describe("scene-aware automatic pause events", () => {
  it("treats landing on a Table as ground contact", () => {
    const scene = createScene();
    scene.groundEnabled = false;
    scene.tables.push(createTable("table", { x: -1, y: 2 }, 2, 2));
    const particle = createParticle("particle", { x: 0, y: 5 });
    particle.pauseAtGroundContact = true;
    scene.particles.push(particle);

    const event = getNextSceneContactPauseEvent(scene, 0)!;
    expect(event.time).toBeCloseTo(Math.sqrt(6 / 9.8), 10);
    expect(event.particleIds).toEqual([particle.id]);
    expect(event.contacts).toEqual({ [particle.id]: "table" });
  });

  it("detects a Pulley endpoint landing on the ground", () => {
    const scene = createScene();
    const apparatus = addPulleyApparatus(scene, ids(), { x: 0, y: 12 })!;
    setFreeEndpointHeights(scene, apparatus.particleA.id, 1, apparatus.particleB.id, 6);
    apparatus.particleA.mass = 2;
    apparatus.particleB.mass = 1;
    apparatus.particleA.pauseAtGroundContact = true;

    const event = getNextSceneContactPauseEvent(scene, 0)!;
    expect(event.time).toBeGreaterThan(0);
    expect(event.particleIds).toContain(apparatus.particleA.id);
    expect(event.contacts?.[apparatus.particleA.id]).toBe("ground");
  });

  it("finds a height-above-ground event for a taut Pulley endpoint", () => {
    const scene = createScene();
    const apparatus = addPulleyApparatus(scene, ids(), { x: 0, y: 12 })!;
    apparatus.particleA.mass = 2;
    apparatus.particleB.mass = 1;
    apparatus.particleA.pauseAtVerticalTarget = true;
    apparatus.particleA.pauseHeightAboveGround = 6;

    const event = getNextPulleyVerticalTargetPauseEvent(scene, 0)!;
    expect(event.time).toBeGreaterThan(0);
    expect(event.particleIds).toEqual([apparatus.particleA.id]);
  });

  it("finds the apex of a Pulley endpoint projected upward while slack", () => {
    const scene = createScene();
    const apparatus = addPulleyApparatus(scene, ids(), { x: 0, y: 12 })!;
    setFreeEndpointHeights(scene, apparatus.particleA.id, 1, apparatus.particleB.id, 6);
    apparatus.particleA.mass = 2;
    apparatus.particleB.mass = 1;
    apparatus.particleB.pauseAtGreatestHeight = true;

    const event = getNextPulleyGreatestHeightPauseEvent(scene, 0)!;
    expect(event.time).toBeGreaterThan(0);
    expect(event.particleIds).toEqual([apparatus.particleB.id]);
  });

  it("reports greatest distance up an Incline for a slack Pulley endpoint", () => {
    const scene = createScene();
    scene.groundEnabled = false;
    const incline = createIncline("incline", { x: 0, y: 0 });
    scene.inclines.push(incline);
    const geometry = getInclineGeometry(incline);
    const apparatus = addPulleyApparatus(
      scene,
      ids(),
      geometry.upperEndpoint,
      { kind: "incline-end", inclineId: incline.id },
    )!;
    apparatus.particleA.initialVelocity = {
      x: geometry.tangent.x * 3,
      y: geometry.tangent.y * 3,
    };
    apparatus.particleA.pauseAtGreatestHeight = true;
    scene.strings[0].length += 100;

    const event = getNextPulleyGreatestHeightPauseEvent(scene, 0)!;
    expect(event.particleIds).toEqual([apparatus.particleA.id]);
    expect(event.inclineDistances?.[apparatus.particleA.id].distance)
      .toBeCloseTo(9 / 9.8, 10);
  });

  it("detects coincidence involving a Pulley endpoint", () => {
    const scene = createScene();
    scene.settings.gravity = 0;
    scene.groundEnabled = false;
    const apparatus = addPulleyApparatus(scene, ids(), { x: 0, y: 12 })!;
    apparatus.particleA.initialVelocity.y = -1;
    apparatus.particleB.initialVelocity.y = 1;
    const target = createParticle("target", {
      x: apparatus.particleA.initialPosition.x,
      y: apparatus.particleA.initialPosition.y - 2,
    });
    target.pauseAtParticleCoincidence = true;
    scene.particles.push(target);

    const event = getNextPulleyParticleCoincidencePauseEvent(scene, 0)!;
    expect(event.time).toBeCloseTo(2, 12);
    expect(event.particleIds).toEqual([apparatus.particleA.id, target.id]);
  });
});

function setFreeEndpointHeights(
  scene: ReturnType<typeof createScene>,
  particleAId: string,
  heightA: number,
  particleBId: string,
  heightB: number,
): void {
  const particleA = scene.particles.find(({ id }) => id === particleAId)!;
  const particleB = scene.particles.find(({ id }) => id === particleBId)!;
  particleA.initialPosition.y = heightA;
  particleB.initialPosition.y = heightB;
  const route = getPulleyRouteGeometry(scene, scene.pulleys[0])!;
  const string = scene.strings[0];
  string.length = route.fixedLength +
    Math.hypot(
      particleA.initialPosition.x - route.endpointATangent.x,
      particleA.initialPosition.y - route.endpointATangent.y,
    ) +
    Math.hypot(
      particleB.initialPosition.x - route.endpointBTangent.x,
      particleB.initialPosition.y - route.endpointBTangent.y,
    );
  string.lengthInput = String(string.length);
}

function ids() {
  return {
    pulleyId: "pulley",
    stringId: "string",
    particleAId: "a",
    particleBId: "b",
  };
}
