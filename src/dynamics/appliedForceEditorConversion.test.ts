import { describe, expect, it } from "vitest";
import { createDefaultSettings } from "../model/SimulationSettings";
import { createAppliedForce } from "../model/AppliedForce";
import {
  editAppliedForceComponents,
  editAppliedForceMagnitudeDirection,
} from "./editAppliedForce";
import { createAppliedForceEditorConversion } from "./appliedForceEditorConversion";

describe("exact applied-force editor conversion", () => {
  it("resolves a 10 N force at 30 degrees exactly", () => {
    const settings = createDefaultSettings();
    const force = editAppliedForceMagnitudeDirection(
      createAppliedForce("special"),
      10,
      30,
      settings,
      { magnitude: "10", angle: "30" },
    );

    expect(createAppliedForceEditorConversion(force, settings).componentText)
      .toEqual({ x: "5√(3)", y: "5" });
  });

  it("preserves arbitrary-angle trig components", () => {
    const settings = createDefaultSettings();
    const force = editAppliedForceMagnitudeDirection(
      createAppliedForce("trig"),
      10,
      53,
      settings,
      { magnitude: "10", angle: "53" },
    );

    expect(createAppliedForceEditorConversion(force, settings).componentText)
      .toEqual({ x: "10 cos(53°)", y: "10 sin(53°)" });
  });

  it("derives an exact magnitude and arctan direction from components", () => {
    const settings = createDefaultSettings();
    const force = editAppliedForceComponents(
      createAppliedForce("components"),
      { x: 3, y: 4 },
      settings,
      { x: "3", y: "4" },
    );

    expect(createAppliedForceEditorConversion(force, settings).polarText)
      .toEqual({ magnitude: "5", angle: "arctan(4/3)" });
  });
});
