import { describe, expect, it } from "vitest";
import {
  DEFAULT_INCLINE_ANGLE_DEGREES,
  DEFAULT_INCLINE_HORIZONTAL_LENGTH,
  createIncline,
} from "../model/Incline";
import {
  canPlaceIncline,
  dot,
  doInclinesOverlap,
  getInclineGeometry,
  isPointOnInclineSegment,
  pointAtInclineCoordinate,
  projectPointOntoIncline,
} from "./inclineGeometry";

describe("finite incline geometry", () => {
  it("creates the default finite 30 degree, 10 metre incline", () => {
    const incline = createIncline("incline", { x: 2, y: 3 });
    expect(incline).toMatchObject({
      angleDegrees: DEFAULT_INCLINE_ANGLE_DEGREES,
      horizontalLength: DEFAULT_INCLINE_HORIZONTAL_LENGTH,
      direction: "rises-right",
      roughness: { kind: "smooth" },
    });
  });

  it("clamps constructed inclines to the 10 metre minimum", () => {
    expect(createIncline("short", { x: 0, y: 0 }, "rises-right", 2))
      .toMatchObject({
        horizontalLength: 10,
        horizontalLengthInput: "10",
      });
  });

  it("derives rise and slope length from authoritative horizontal length", () => {
    const incline = createIncline("45", { x: 0, y: 0 });
    incline.angleDegrees = 45;
    incline.horizontalLength = 2;
    const geometry = getInclineGeometry(incline);
    expect(geometry.rise).toBeCloseTo(2, 12);
    expect(geometry.slopeLength).toBeCloseTo(2 * Math.sqrt(2), 12);
  });

  it("derives right- and left-rising endpoints", () => {
    const right = createIncline("right", { x: 1, y: -2 });
    right.angleDegrees = 45;
    right.horizontalLength = 2;
    const left = { ...right, id: "left", direction: "rises-left" as const };
    expect(getInclineGeometry(right).upperEndpoint.x).toBe(3);
    expect(getInclineGeometry(right).upperEndpoint.y).toBeCloseTo(0, 12);
    expect(getInclineGeometry(left).upperEndpoint.x).toBe(-1);
    expect(getInclineGeometry(left).upperEndpoint.y).toBeCloseTo(0, 12);
  });

  it("returns unit perpendicular tangent and outward normal vectors", () => {
    for (const direction of ["rises-right", "rises-left"] as const) {
      const geometry = getInclineGeometry(
        createIncline(direction, { x: 0, y: 0 }, direction),
      );
      expect(Math.hypot(geometry.tangent.x, geometry.tangent.y)).toBeCloseTo(1, 12);
      expect(Math.hypot(geometry.normal.x, geometry.normal.y)).toBeCloseTo(1, 12);
      expect(dot(geometry.tangent, geometry.normal)).toBeCloseTo(0, 12);
      expect(geometry.normal.y).toBeGreaterThan(0);
    }
  });

  it("projects onto and clamps to the finite top segment", () => {
    const incline = createIncline("projection", { x: 0, y: 0 });
    incline.angleDegrees = 45;
    incline.horizontalLength = 2;
    const middle = pointAtInclineCoordinate(incline, Math.sqrt(2));
    const projection = projectPointOntoIncline(
      { x: middle.x - 1, y: middle.y + 1 },
      incline,
    );
    expect(projection.point.x).toBeCloseTo(middle.x, 12);
    expect(projection.point.y).toBeCloseTo(middle.y, 12);
    expect(projection.withinSegment).toBe(true);
    expect(isPointOnInclineSegment(middle, incline)).toBe(true);

    const beyond = projectPointOntoIncline({ x: 10, y: 10 }, incline);
    expect(beyond.withinSegment).toBe(false);
    expect(beyond.point.x).toBeCloseTo(
      getInclineGeometry(incline).upperEndpoint.x,
      12,
    );
    expect(beyond.point.y).toBeCloseTo(
      getInclineGeometry(incline).upperEndpoint.y,
      12,
    );
  });

  it("detects overlapping solid incline interiors", () => {
    const first = createIncline("first", { x: 0, y: 0 });
    const partiallyOverlapping = createIncline("second", { x: 5, y: 0 });
    const contained = createIncline("third", { x: 2, y: 1 });

    expect(doInclinesOverlap(first, partiallyOverlapping)).toBe(true);
    expect(doInclinesOverlap(first, contained)).toBe(true);
    expect(canPlaceIncline(partiallyOverlapping, [first])).toBe(false);
  });

  it("allows inclines to touch without overlapping", () => {
    const first = createIncline("first", { x: 0, y: 0 });
    const touching = createIncline("touching", { x: 10, y: 0 });
    const separated = createIncline("separated", { x: 0, y: 6 });

    expect(doInclinesOverlap(first, touching)).toBe(false);
    expect(doInclinesOverlap(first, separated)).toBe(false);
    expect(canPlaceIncline(touching, [first])).toBe(true);
  });

  it("ignores the incline being repositioned", () => {
    const incline = createIncline("incline", { x: 0, y: 0 });
    const movedCandidate = { ...incline, anchor: { x: 4, y: 2 } };

    expect(canPlaceIncline(movedCandidate, [incline])).toBe(true);
  });
});
