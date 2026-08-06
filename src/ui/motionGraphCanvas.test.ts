import { describe, expect, it } from "vitest";
import { derivedValue, exactTrigValue } from "../kinematics/exactDisplay";
import {
  chooseMotionGraphAnnotationPlacement,
  createTickValues,
  createTimeTickValues,
  formatGraphNumber,
  getMotionGraphAnnotationLabel,
  getMotionGraphDialogTitle,
  MOTION_GRAPH_GRID_COLOUR,
  shouldLabelTimeTick,
} from "./motionGraphCanvas";
import {
  createMotionGraphData,
  createMotionGraphPlan,
  getMotionGraphAnnotations,
} from "../kinematics/motionGraphs";
import type { KinematicPhase } from "../kinematics/kinematicPhase";

describe("motion graph axes", () => {
  it("keeps non-negative ranges free of negative tick labels", () => {
    expect(createTickValues({ min: 0, max: 12, tickInterval: 2 })).toEqual([
      0,
      2,
      4,
      6,
      8,
      10,
      12,
    ]);
  });

  it("includes zero when an axis spans positive and negative motion", () => {
    expect(
      createTickValues({ min: -8, max: 12, tickInterval: 4 }),
    ).toContain(0);
  });

  it("uses the supplied nice time interval instead of exact subdivisions", () => {
    expect(createTimeTickValues(4, 1)).toEqual([0, 1, 2, 3, 4]);
    expect(createTimeTickValues(0.8, 0.2)).toEqual([0, 0.2, 0.4, 0.6, 0.8]);
  });

  it("uses restrained graph gridlines", () => {
    expect(MOTION_GRAPH_GRID_COLOUR).toBe("#deddd7");
  });

  it("labels enlarged graphs with their component and quantity", () => {
    expect(getMotionGraphDialogTitle("y", "displacement")).toBe(
      "Vertical Displacement–time Graph",
    );
    expect(getMotionGraphDialogTitle("x", "velocity")).toBe(
      "Horizontal Velocity–time Graph",
    );
  });

  it("omits the redundant zero label from the time axis", () => {
    expect(shouldLabelTimeTick(0)).toBe(false);
    expect(shouldLabelTimeTick(0.1)).toBe(true);
  });

  it("formats labels compactly", () => {
    expect(formatGraphNumber(0)).toBe("0");
    expect(formatGraphNumber(12.345)).toBe("12.3");
  });

  it("uses coordinates only for enlarged graph annotations", () => {
    expect(getMotionGraphAnnotationLabel({
      kind: "turning-point",
      time: 1.234,
      value: 4.567,
      timeDisplay: derivedValue(1.234),
      valueDisplay: derivedValue(4.567),
    })).toBe("(1.234, 4.567)");
    expect(getMotionGraphAnnotationLabel({
      kind: "intersection",
      time: 2.345,
      value: 0,
      timeDisplay: derivedValue(2.345),
      valueDisplay: derivedValue(0),
    })).toBe("2.345");
    expect(getMotionGraphAnnotationLabel({
      kind: "intersection",
      time: 0,
      value: 8.765,
      timeDisplay: derivedValue(0),
      valueDisplay: derivedValue(8.765),
    })).toBe("8.765");
  });

  it("uses symbolic exact values in enlarged graph labels", () => {
    const sine = Math.sin(50 * Math.PI / 180);
    expect(getMotionGraphAnnotationLabel({
      kind: "turning-point",
      time: 50 / 49 * sine,
      value: 250 / 49 * sine ** 2,
      timeDisplay: exactTrigValue(
        50 / 49 * sine,
        { numerator: 50n, denominator: 49n },
        "sin",
        "50",
      ),
      valueDisplay: exactTrigValue(
        250 / 49 * sine ** 2,
        { numerator: 250n, denominator: 49n },
        "sin",
        "50",
        2,
      ),
    })).toBe("(50/49 sin(50°), 250/49 sin²(50°))");
  });

  it("places a maximum above the curve and a velocity y-intercept away from it", () => {
    const phase: KinematicPhase = {
      kind: "free-flight",
      startTime: 0,
      initialPosition: { x: 0, y: 0 },
      initialVelocity: { x: 0, y: 10 },
      acceleration: { x: 0, y: -9.8 },
    };
    const plan = createMotionGraphPlan(
      phase,
      20 / 9.8,
      { positiveX: "right", positiveY: "up" },
    );
    const graph = createMotionGraphData(plan, "y", plan.endTime);
    const turning = getMotionGraphAnnotations(graph, "displacement").find(
      ({ kind }) => kind === "turning-point",
    );
    const yIntercept = getMotionGraphAnnotations(graph, "velocity")[0];
    if (!turning || !yIntercept) throw new Error("Expected graph annotations.");

    expect(chooseMotionGraphAnnotationPlacement(
      turning,
      graph,
      "displacement",
      240,
      48,
    )).toBe("above");
    expect(chooseMotionGraphAnnotationPlacement(
      yIntercept,
      graph,
      "velocity",
      120,
      42,
    )).toBe("upper-right");
  });
});
