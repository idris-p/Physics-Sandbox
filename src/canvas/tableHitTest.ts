import { getTableGeometry } from "../geometry/tableGeometry";
import type { ScreenPoint } from "../math/Vec2";
import type { Table } from "../model/Table";
import { worldToScreen, type Camera } from "./camera";

export function hitTestTables(
  pointer: ScreenPoint,
  tables: readonly Table[],
  camera: Camera,
): string | null {
  for (let index = tables.length - 1; index >= 0; index -= 1) {
    const geometry = getTableGeometry(tables[index]);
    const topLeft = worldToScreen(geometry.topLeft, camera);
    const bottomRight = worldToScreen(geometry.bottomRight, camera);
    if (
      pointer.x >= topLeft.x - HIT_PADDING_PX &&
      pointer.x <= bottomRight.x + HIT_PADDING_PX &&
      pointer.y >= topLeft.y - HIT_PADDING_PX &&
      pointer.y <= bottomRight.y + HIT_PADDING_PX
    ) {
      return tables[index].id;
    }
  }
  return null;
}

const HIT_PADDING_PX = 3;
