import { describe, expect, it } from "vitest";
import { createAppliedForce } from "../model/AppliedForce";
import {
  editAppliedForceComponents,
  editAppliedForceMagnitudeDirection,
  reexpressAppliedForceDirection,
  setAppliedForceInputMode,
  setAppliedForcesInputMode,
} from "./editAppliedForce";

describe("applied-force editing", () => {
  it("stores Cartesian input as a convention-independent world vector", () => {
    const force = editAppliedForceComponents(
      createAppliedForce("components"),
      { x: 6, y: -4 },
      { positiveX: "left", positiveY: "down" },
      { x: "6", y: "-4" },
    );
    expect(force.vector).toEqual({ x: -6, y: 4 });
  });

  it("stores magnitude and direction using the current angle convention", () => {
    const force = editAppliedForceMagnitudeDirection(
      createAppliedForce("polar"),
      10,
      30,
      { angleReferenceAxis: "positive-y", angleDirection: "clockwise" },
      { magnitude: "10", angle: "30" },
    );
    expect(force.vector.x).toBeCloseTo(5, 12);
    expect(force.vector.y).toBeCloseTo(5 * Math.sqrt(3), 12);
  });

  it("switches representation without changing the force vector", () => {
    const force = editAppliedForceComponents(
      createAppliedForce("switch"),
      { x: 3, y: 4 },
      { positiveX: "right", positiveY: "up" },
      { x: "3", y: "4" },
    );
    expect(setAppliedForceInputMode(force, "magnitude-direction").vector)
      .toEqual(force.vector);
  });

  it("switches every applied force through one global mode", () => {
    const forces = [
      { ...createAppliedForce("first"), vector: { x: 3, y: 4 } },
      { ...createAppliedForce("second"), vector: { x: -2, y: 7 } },
    ];

    const converted = setAppliedForcesInputMode(forces, "magnitude-direction");

    expect(converted.map((force) => force.inputMode)).toEqual([
      "magnitude-direction",
      "magnitude-direction",
    ]);
    expect(converted.map((force) => force.vector)).toEqual(
      forces.map((force) => force.vector),
    );
  });

  it("re-expresses a Polar direction without rotating its world vector", () => {
    const force = editAppliedForceMagnitudeDirection(
      createAppliedForce("reexpress"),
      10,
      60,
      { angleReferenceAxis: "positive-x", angleDirection: "anticlockwise" },
      { magnitude: "10", angle: "60" },
    );
    const changed = reexpressAppliedForceDirection(force, {
      angleReferenceAxis: "positive-y",
      angleDirection: "clockwise",
    });
    expect(changed.vector).toEqual(force.vector);
    expect(changed.polarInput?.angleText).toBe("30");
  });
});
