import { describe, expect, it } from "vitest";
import { createTable } from "../model/Table";
import {
  getTableGeometry,
  isPointOnTableTop,
  pointAtTableCoordinate,
  projectPointOntoTable,
} from "./tableGeometry";

describe("Table geometry", () => {
  it("exposes a finite horizontal top and rectangular body", () => {
    const table = createTable("table", { x: -2, y: 4 }, 10, 3);
    expect(getTableGeometry(table)).toMatchObject({
      topLeft: { x: -2, y: 4 },
      topRight: { x: 8, y: 4 },
      bottomLeft: { x: -2, y: 1 },
      bottomRight: { x: 8, y: 1 },
      tangent: { x: 1, y: 0 },
      normal: { x: 0, y: 1 },
    });
    expect(pointAtTableCoordinate(table, 3)).toEqual({ x: 1, y: 4 });
  });

  it("does not treat points beyond either endpoint as supported", () => {
    const table = createTable("table", { x: 0, y: 2 }, 6, 2);
    expect(isPointOnTableTop({ x: 3, y: 2 }, table)).toBe(true);
    expect(isPointOnTableTop({ x: -0.1, y: 2 }, table)).toBe(false);
    expect(isPointOnTableTop({ x: 6.1, y: 2 }, table)).toBe(false);
    expect(projectPointOntoTable({ x: 8, y: 2 }, table).unclampedQ).toBe(8);
  });
});
