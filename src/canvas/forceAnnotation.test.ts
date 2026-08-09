import { describe, expect, it } from "vitest";
import {
  editAppliedForceComponents,
  editAppliedForceMagnitudeDirection,
  setAppliedForceInputMode,
} from "../dynamics/editAppliedForce";
import { createAppliedForce } from "../model/AppliedForce";
import { createParticle } from "../model/Particle";
import { createDefaultSettings } from "../model/SimulationSettings";
import {
  FORCE_ARROW_LENGTH_METRES,
  FORCE_ARROW_LINE_DASH,
  RESULTANT_FORCE_COLOUR,
  calculateForceArrowOrigins,
  calculateForceLabelPosition,
  getForceAnnotations,
  isZeroResultantForce,
} from "./forceAnnotation";
import { INITIAL_VELOCITY_ARROW_LENGTH_METRES } from "./initialVelocityAnnotation";

describe("force-arrow annotations", () => {
  it("uses solid arrows longer than initial-velocity arrows", () => {
    expect(FORCE_ARROW_LINE_DASH).toEqual([]);
    expect(FORCE_ARROW_LENGTH_METRES).toBe(3);
    expect(FORCE_ARROW_LENGTH_METRES).toBeGreaterThan(
      INITIAL_VELOCITY_ARROW_LENGTH_METRES,
    );
  });

  it("places each label just beyond the arrowhead tip", () => {
    const arrowTip = { x: 100, y: 80 };
    const leftLabel = calculateForceLabelPosition(
      arrowTip,
      { x: -1, y: 0 },
      60,
      20,
      4,
    );
    const belowLabel = calculateForceLabelPosition(
      arrowTip,
      { x: 0, y: 1 },
      60,
      20,
      4,
    );

    expect(leftLabel.x + 60).toBe(96);
    expect(leftLabel.y).toBe(80);
    expect(belowLabel.x).toBe(70);
    expect(belowLabel.y - 10).toBe(84);
  });

  it("spreads two same-direction arrows symmetrically inside the particle", () => {
    const origins = calculateForceArrowOrigins(
      [{ x: 0, y: 1 }, { x: 0, y: 1 }],
      { x: 100, y: 100 },
      20,
    );

    expect(Math.min(...origins.map((origin) => origin.x))).toBeLessThan(100);
    expect(Math.max(...origins.map((origin) => origin.x))).toBeGreaterThan(100);
    expect(origins[0].x + origins[1].x).toBe(200);
    expect(origins.every((origin) => Math.hypot(
      origin.x - 100,
      origin.y - 100,
    ) < 20)).toBe(true);
  });

  it("spreads three or more coincident arrows without leaving the radius", () => {
    const directions = Array.from({ length: 6 }, () => ({ x: 1, y: 0 }));
    const origins = calculateForceArrowOrigins(
      directions,
      { x: 40, y: 60 },
      12,
    );

    expect(new Set(origins.map((origin) => origin.y)).size).toBe(6);
    expect(origins.every((origin) => Math.hypot(
      origin.x - 40,
      origin.y - 60,
    ) < 12)).toBe(true);
  });

  it("gives two arrows more adjacent spacing than a five-arrow group", () => {
    const centre = { x: 0, y: 0 };
    const radius = 20;
    const two = calculateForceArrowOrigins(
      Array.from({ length: 2 }, () => ({ x: 0, y: 1 })),
      centre,
      radius,
    );
    const five = calculateForceArrowOrigins(
      Array.from({ length: 5 }, () => ({ x: 0, y: 1 })),
      centre,
      radius,
    );
    const twoArrowSpacing = Math.hypot(
      two[1].x - two[0].x,
      two[1].y - two[0].y,
    );
    const fiveArrowSpacing = Math.hypot(
      five[1].x - five[0].x,
      five[1].y - five[0].y,
    );

    expect(twoArrowSpacing).toBeGreaterThan(fiveArrowSpacing);
  });

  it("does not offset arrows which point in opposite directions", () => {
    expect(calculateForceArrowOrigins(
      [{ x: 0, y: 1 }, { x: 0, y: -1 }],
      { x: 10, y: 20 },
      8,
    )).toEqual([{ x: 10, y: 20 }, { x: 10, y: 20 }]);
  });

  it("uses world-vector directions independently of display conventions", () => {
    const settings = createDefaultSettings();
    const particle = createParticle("arrow", { x: 0, y: 0 });
    particle.appliedForces = [editAppliedForceMagnitudeDirection(
      createAppliedForce("push"),
      10,
      30,
      settings,
      { magnitude: "10", angle: "30" },
    )];
    const before = getForceAnnotations(particle, settings);
    const after = getForceAnnotations(particle, {
      ...settings,
      positiveX: "left",
      positiveY: "down",
      angleReferenceAxis: "negative-y",
      angleDirection: "clockwise",
    });

    expect(before[0].direction).toEqual({ x: 0, y: -1 });
    expect(before[0]).toMatchObject({
      kind: "magnitude",
      magnitudeText: "9.8",
    });
    expect(before[1]).toMatchObject({
      kind: "angle",
      magnitudeText: "10",
      angleText: "30",
      angleMarker: "arc",
    });
    expect(Object.hasOwn(before[0], "labelPrefix")).toBe(false);
    expect(after.map((annotation) => annotation.direction))
      .toEqual(before.map((annotation) => annotation.direction));
  });

  it("uses a component column vector for Cartesian applied forces", () => {
    const settings = createDefaultSettings();
    const particle = createParticle("components", { x: 0, y: 0 });
    particle.appliedForces = [editAppliedForceComponents(
      createAppliedForce("push"),
      { x: 3, y: -4 },
      settings,
      { x: "3", y: "-4" },
    )];

    expect(getForceAnnotations(particle, settings)[1]).toMatchObject({
      kind: "components",
      componentText: { x: "3", y: "-4" },
      componentValues: { x: 3, y: -4 },
    });
  });

  it("uses only the non-zero component for an axis-aligned Cartesian force", () => {
    const settings = createDefaultSettings();
    const particle = createParticle("axis", { x: 0, y: 0 });
    particle.appliedForces = [editAppliedForceComponents(
      createAppliedForce("push"),
      { x: 0, y: -6 },
      settings,
      { x: "0", y: "-6" },
    )];

    expect(getForceAnnotations(particle, settings)[1]).toMatchObject({
      kind: "magnitude",
      magnitudeText: "6",
      magnitude: 6,
    });
  });

  it("does not change scene notation until a value is entered in the new mode", () => {
    const settings = createDefaultSettings();
    const polarForce = editAppliedForceMagnitudeDirection(
      createAppliedForce("push"),
      10,
      30,
      settings,
      { magnitude: "10", angle: "30" },
    );
    const particle = createParticle("source", { x: 0, y: 0 });
    particle.appliedForces = [setAppliedForceInputMode(
      polarForce,
      "components",
    )];

    expect(getForceAnnotations(particle, settings)[1]).toMatchObject({
      kind: "angle",
      magnitudeText: "10",
      angleText: "30",
    });

    particle.appliedForces = [editAppliedForceComponents(
      particle.appliedForces[0],
      { x: 5, y: 5 },
      settings,
      { x: "5", y: "5" },
    )];
    expect(getForceAnnotations(particle, settings)[1]).toMatchObject({
      kind: "components",
      componentText: { x: "5", y: "5" },
    });
  });

  it("replaces every individual arrow with one red Cartesian resultant", () => {
    const settings = createDefaultSettings();
    settings.gravity = 10;
    settings.gravityInput = "10";
    const particle = createParticle("resultant", { x: 0, y: 0 });
    particle.appliedForces = [editAppliedForceComponents(
      createAppliedForce("push"),
      { x: 6, y: 18 },
      settings,
      { x: "6", y: "18" },
    )];
    particle.showResultantForce = true;

    expect(getForceAnnotations(particle, settings)).toEqual([
      expect.objectContaining({
        id: "resultant",
        kind: "components",
        colour: RESULTANT_FORCE_COLOUR,
        direction: { x: 0.6, y: 0.8 },
        magnitude: 10,
        componentText: { x: "6", y: "8" },
        componentValues: { x: 6, y: 8 },
      }),
    ]);
  });

  it("uses the current Applied forces selector for resultant notation", () => {
    const settings = createDefaultSettings();
    settings.gravity = 0;
    settings.gravityInput = "0";
    const particle = createParticle("polar-resultant", { x: 0, y: 0 });
    particle.appliedForces = [editAppliedForceComponents(
      createAppliedForce("push"),
      { x: 3, y: 4 },
      settings,
      { x: "3", y: "4" },
    )];
    particle.appliedForceEditorMode = "magnitude-direction";
    particle.showResultantForce = true;

    expect(getForceAnnotations(particle, settings)).toEqual([
      expect.objectContaining({
        id: "resultant",
        kind: "angle",
        colour: RESULTANT_FORCE_COLOUR,
        magnitudeText: "5",
        angleText: "arctan(4/3)",
      }),
    ]);
  });

  it("keeps axis-aligned Cartesian resultant labels scalar", () => {
    const settings = createDefaultSettings();
    const particle = createParticle("weight-resultant", { x: 0, y: 0 });
    particle.showResultantForce = true;

    expect(getForceAnnotations(particle, settings)).toEqual([
      expect.objectContaining({
        id: "resultant",
        kind: "magnitude",
        colour: RESULTANT_FORCE_COLOUR,
        magnitudeText: "9.8",
      }),
    ]);
  });

  it("identifies final equilibrium after including normal reaction", () => {
    const settings = createDefaultSettings();
    const particle = createParticle("equilibrium", { x: 0, y: 0 });

    expect(isZeroResultantForce(particle, settings, 9.8)).toBe(true);
    expect(isZeroResultantForce(particle, settings)).toBe(false);
  });
});
