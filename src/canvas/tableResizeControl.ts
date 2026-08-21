import type { ScreenPoint, Vec2 } from "../math/Vec2";
import {
  MINIMUM_TABLE_SIZE,
  type Table,
} from "../model/Table";
import { getTableGeometry } from "../geometry/tableGeometry";
import { worldToScreen, type Camera } from "./camera";

export type TableResizeCorner = "top-left" | "top-right";
export type TableResizeDirection = "up" | "down" | "left" | "right";

export type TableResizeControlTarget =
  | { kind: "handle"; corner: TableResizeCorner }
  | {
      kind: "arrow";
      corner: TableResizeCorner;
      direction: TableResizeDirection;
    };

export interface TableResizeArrowGeometry {
  direction: TableResizeDirection;
  centre: ScreenPoint;
  cellSize: number;
  enabled: boolean;
}

export interface TableResizeHandleGeometry {
  corner: TableResizeCorner;
  centre: ScreenPoint;
  arrows: readonly TableResizeArrowGeometry[];
  outerRadius: number;
  innerRadius: number;
  hitRadius: number;
}

export function calculateTableResizeControlGeometry(
  table: Table,
  camera: Camera,
): readonly [TableResizeHandleGeometry, TableResizeHandleGeometry] {
  const geometry = getTableGeometry(table);
  const topLeft = worldToScreen(geometry.topLeft, camera);
  const topRight = worldToScreen(geometry.topRight, camera);
  const cellSize = camera.pixelsPerMetre;
  const outerRadius = cellSize * 0.28;
  const innerRadius = cellSize * 0.13;
  const hitRadius = cellSize * 0.45;
  const arrowOffset = cellSize;

  const createArrows = (
    centre: ScreenPoint,
  ): readonly TableResizeArrowGeometry[] => [
    {
      direction: "up",
      centre: { x: centre.x, y: centre.y - arrowOffset },
      cellSize,
      enabled: true,
    },
    {
      direction: "down",
      centre: { x: centre.x, y: centre.y + arrowOffset },
      cellSize,
      enabled: table.height > MINIMUM_TABLE_SIZE,
    },
    {
      direction: "left",
      centre: { x: centre.x - arrowOffset, y: centre.y },
      cellSize,
      enabled: true,
    },
    {
      direction: "right",
      centre: { x: centre.x + arrowOffset, y: centre.y },
      cellSize,
      enabled: true,
    },
  ];

  return [
    {
      corner: "top-left",
      centre: topLeft,
      arrows: createArrows(topLeft).map((arrow) =>
        arrow.direction === "right"
          ? { ...arrow, enabled: table.width > MINIMUM_TABLE_SIZE }
          : arrow
      ),
      outerRadius,
      innerRadius,
      hitRadius,
    },
    {
      corner: "top-right",
      centre: topRight,
      arrows: createArrows(topRight).map((arrow) =>
        arrow.direction === "left"
          ? { ...arrow, enabled: table.width > MINIMUM_TABLE_SIZE }
          : arrow
      ),
      outerRadius,
      innerRadius,
      hitRadius,
    },
  ];
}

export function hitTestTableResizeControl(
  point: ScreenPoint,
  handles: readonly TableResizeHandleGeometry[],
): TableResizeControlTarget | null {
  for (const handle of handles) {
    if (
      Math.hypot(
        point.x - handle.centre.x,
        point.y - handle.centre.y,
      ) <= handle.hitRadius
    ) {
      return { kind: "handle", corner: handle.corner };
    }
  }
  for (const handle of handles) {
    for (const arrow of handle.arrows) {
      if (!arrow.enabled) continue;
      if (
        Math.abs(point.x - arrow.centre.x) <= arrow.cellSize / 2 &&
        Math.abs(point.y - arrow.centre.y) <= arrow.cellSize / 2
      ) {
        return {
          kind: "arrow",
          corner: handle.corner,
          direction: arrow.direction,
        };
      }
    }
  }
  return null;
}

export function stepTableResize(
  table: Table,
  corner: TableResizeCorner,
  direction: TableResizeDirection,
): Table {
  const geometry = getTableGeometry(table);
  const cornerPosition = corner === "top-left"
    ? geometry.topLeft
    : geometry.topRight;
  const delta = direction === "up"
    ? { x: 0, y: 1 }
    : direction === "down"
      ? { x: 0, y: -1 }
      : direction === "left"
        ? { x: -1, y: 0 }
        : { x: 1, y: 0 };
  return calculateResizedTable(table, corner, {
    x: cornerPosition.x + delta.x,
    y: cornerPosition.y + delta.y,
  });
}

export function calculateResizedTable(
  table: Table,
  corner: TableResizeCorner,
  pointer: Vec2,
): Table {
  const geometry = getTableGeometry(table);
  const pointerX = Math.round(pointer.x);
  const pointerY = Math.round(pointer.y);
  const height = Math.max(
    MINIMUM_TABLE_SIZE,
    pointerY - geometry.bottomLeft.y,
  );
  const topY = geometry.bottomLeft.y + height;

  if (corner === "top-left") {
    const width = Math.max(
      MINIMUM_TABLE_SIZE,
      geometry.bottomRight.x - pointerX,
    );
    return {
      ...table,
      topLeft: {
        x: geometry.bottomRight.x - width,
        y: topY,
      },
      width,
      widthInput: String(width),
      height,
      heightInput: String(height),
    };
  }

  const width = Math.max(
    MINIMUM_TABLE_SIZE,
    pointerX - geometry.bottomLeft.x,
  );
  return {
    ...table,
    topLeft: {
      x: geometry.bottomLeft.x,
      y: topY,
    },
    width,
    widthInput: String(width),
    height,
    heightInput: String(height),
  };
}
