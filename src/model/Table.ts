import type { Vec2 } from "../math/Vec2";

export type TableRoughness =
  | { kind: "smooth" }
  | {
      kind: "rough";
      coefficientOfFriction: number;
      coefficientInput: string;
    };

export interface Table {
  id: string;
  /** Left endpoint of the finite supporting top surface. */
  topLeft: Vec2;
  width: number;
  widthInput: string;
  height: number;
  heightInput: string;
  roughness: TableRoughness;
}

export const DEFAULT_TABLE_WIDTH = 10;
export const DEFAULT_TABLE_HEIGHT = 5;
export const MINIMUM_TABLE_SIZE = 2;
export const DEFAULT_TABLE_COEFFICIENT_OF_FRICTION = 0.5;

export function createTable(
  id: string,
  topLeft: Vec2,
  width = DEFAULT_TABLE_WIDTH,
  height = DEFAULT_TABLE_HEIGHT,
): Table {
  const safeWidth = Math.max(MINIMUM_TABLE_SIZE, width);
  const safeHeight = Math.max(MINIMUM_TABLE_SIZE, height);
  return {
    id,
    topLeft: { ...topLeft },
    width: safeWidth,
    widthInput: String(safeWidth),
    height: safeHeight,
    heightInput: String(safeHeight),
    roughness: { kind: "smooth" },
  };
}

export function setTableRoughness(table: Table, rough: boolean): void {
  if (rough && table.roughness.kind === "smooth") {
    table.roughness = {
      kind: "rough",
      coefficientOfFriction: DEFAULT_TABLE_COEFFICIENT_OF_FRICTION,
      coefficientInput: String(DEFAULT_TABLE_COEFFICIENT_OF_FRICTION),
    };
  } else if (!rough) {
    table.roughness = { kind: "smooth" };
  }
}
