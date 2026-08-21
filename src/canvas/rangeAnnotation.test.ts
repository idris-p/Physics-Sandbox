import { describe, expect, it } from "vitest";
import { createParticle, type ParticleState } from "../model/Particle";
import { createDefaultSettings } from "../model/SimulationSettings";
import { editParticleInitialVelocityAngle } from "../simulation/editInitialConditions";
import {
  calculateRangeVerticalGeometry,
  getGroundContactRangeMeasurements,
} from "./rangeAnnotation";

describe("ground-contact range annotation", () => {
  const settings = createDefaultSettings();

  it("measures horizontal displacement from launch to ground contact", () => {
    const particle = createParticle("projectile", { x: -2, y: 12.6 });
    particle.initialVelocity = { x: 3, y: 4 };
    particle.initialVelocityInput.x.text = "3";
    particle.initialVelocityInput.y.text = "4";
    const state: ParticleState = {
      id: particle.id,
      position: { x: 4, y: 1 },
      velocity: { x: 3, y: -15.6 },
      acceleration: { x: 0, y: -9.8 },
    };

    expect(getGroundContactRangeMeasurements(
      { time: 2, particleIds: [particle.id] },
      2,
      1,
      settings,
      [particle],
      [state],
    )).toEqual([{
      particleId: particle.id,
      initialX: -2,
      finalX: 4,
      groundHeight: 1,
      range: 6,
      valueDisplay: "6",
      labelPrefix: "Range = ",
    }]);
  });

  it("supports a polar launch angle strictly between 0 and 180 degrees", () => {
    const particle = editParticleInitialVelocityAngle(
      createParticle("polar", { x: 4, y: 8 }),
      10,
      53,
      { angleReferenceAxis: "positive-x", angleDirection: "anticlockwise" },
      { speed: "10", angle: "53" },
    );
    const state: ParticleState = {
      id: particle.id,
      position: { x: 16, y: 0 },
      velocity: { x: particle.initialVelocity.x, y: -10 },
      acceleration: { x: 0, y: -9.8 },
    };

    expect(getGroundContactRangeMeasurements(
      { time: 2, particleIds: [particle.id] },
      2,
      0,
      settings,
      [particle],
      [state],
    )[0]).toMatchObject({ initialX: 4, finalX: 16, range: 12 });

    const verticalParticle = editParticleInitialVelocityAngle(
      createParticle("vertical-polar", { x: 4, y: 8 }),
      10,
      90,
      { angleReferenceAxis: "positive-x", angleDirection: "anticlockwise" },
      { speed: "10", angle: "90" },
    );
    expect(getGroundContactRangeMeasurements(
      { time: 2, particleIds: [verticalParticle.id] },
      2,
      0,
      settings,
      [verticalParticle],
      [{ ...state, id: verticalParticle.id, position: { x: 4, y: 0 } }],
    )[0]).toMatchObject({ range: 0, valueDisplay: "0" });

    const outsideAngleParticle = editParticleInitialVelocityAngle(
      createParticle("outside-angle", { x: 0, y: 8 }),
      10,
      -20,
      { angleReferenceAxis: "positive-x", angleDirection: "anticlockwise" },
      { speed: "10", angle: "-20" },
    );
    expect(getGroundContactRangeMeasurements(
      { time: 2, particleIds: [outsideAngleParticle.id] },
      2,
      0,
      settings,
      [outsideAngleParticle],
      [{ ...state, id: outsideAngleParticle.id }],
    )).toEqual([]);
  });

  it("requires both horizontal and vertical launch components", () => {
    const horizontalOnly = createParticle("horizontal", { x: 0, y: 5 });
    horizontalOnly.initialVelocity = { x: 3, y: 0 };
    const verticalOnly = createParticle("vertical", { x: 0, y: 5 });
    verticalOnly.initialVelocity = { x: 0, y: 3 };
    const states = [horizontalOnly, verticalOnly].map((particle) => ({
      id: particle.id,
      position: { x: 4, y: 0 },
      velocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: -9.8 },
    }));

    expect(getGroundContactRangeMeasurements(
      { time: 1, particleIds: [horizontalOnly.id, verticalOnly.id] },
      1,
      0,
      settings,
      [horizontalOnly, verticalOnly],
      states,
    )).toEqual([]);
  });

  it("appears only for the matching automatic pause event", () => {
    const particle = createParticle("projectile", { x: 0, y: 5 });
    particle.initialVelocity = { x: 3, y: 4 };
    const state = {
      id: particle.id,
      position: { x: 6, y: 0 },
      velocity: { x: 3, y: -4 },
      acceleration: { x: 0, y: -9.8 },
    };

    expect(getGroundContactRangeMeasurements(
      null,
      2,
      0,
      settings,
      [particle],
      [state],
    ))
      .toEqual([]);
    expect(getGroundContactRangeMeasurements(
      { time: 2, particleIds: [particle.id] },
      2.01,
      0,
      settings,
      [particle],
      [state],
    )).toEqual([]);
  });

  it("places the range dimension 0.75 m below the ground", () => {
    expect(calculateRangeVerticalGeometry(100, 40)).toEqual({
      dimensionY: 130,
      capStartY: 115,
      capEndY: 145,
    });
  });

  it("uses exact range values instead of exposing floating-point decimals", () => {
    const exactSettings = { ...createDefaultSettings(), gravity: 1, gravityInput: "1" };
    const particle = createParticle("exact", { x: 0, y: 3 });
    particle.initialVelocity = { x: 2, y: 1 };
    particle.initialVelocityInput.x.text = "2";
    particle.initialVelocityInput.y.text = "1";
    const impactTime = 1 + Math.sqrt(7);
    const range = 2 * impactTime;
    const measurement = getGroundContactRangeMeasurements(
      { time: impactTime, particleIds: [particle.id] },
      impactTime,
      0,
      exactSettings,
      [particle],
      [{
        id: particle.id,
        position: { x: range, y: 0 },
        velocity: { x: 2, y: 1 - impactTime },
        acceleration: { x: 0, y: -1 },
      }],
    )[0];

    expect(measurement?.valueDisplay).toContain("√(7)");
    expect(measurement?.valueDisplay).not.toContain(String(range));
  });

  it("preserves exact trigonometric range for a polar launch", () => {
    const particle = editParticleInitialVelocityAngle(
      createParticle("exact-polar", { x: 0, y: 0 }),
      10,
      53,
      { angleReferenceAxis: "positive-x", angleDirection: "anticlockwise" },
      { speed: "10", angle: "53" },
    );
    const angle = 53 * Math.PI / 180;
    const impactTime = 20 * Math.sin(angle) / 9.8;
    const range = 10 * Math.cos(angle) * impactTime;
    const measurement = getGroundContactRangeMeasurements(
      { time: impactTime, particleIds: [particle.id] },
      impactTime,
      0,
      settings,
      [particle],
      [{
        id: particle.id,
        position: { x: range, y: 0 },
        velocity: {
          x: particle.initialVelocity.x,
          y: particle.initialVelocity.y - 9.8 * impactTime,
        },
        acceleration: { x: 0, y: -9.8 },
      }],
    )[0];

    expect(measurement?.valueDisplay).toContain("sin(53°)");
    expect(measurement?.valueDisplay).toContain("cos(53°)");
    expect(measurement?.valueDisplay).not.toContain(String(range));
  });
});
