import { describe, expect, it } from "vitest";
import { createTable } from "../model/Table";
import { createCamera, worldToScreen } from "./camera";
import { hitTestTables } from "./tableHitTest";

describe("Table hit testing", () => {
  it("selects inside the finite rendered rectangle only", () => {
    const table = createTable("table", { x: 0, y: 5 }, 10, 4);
    const camera = createCamera(800, 600);
    expect(hitTestTables(worldToScreen({ x: 5, y: 3 }, camera), [table], camera))
      .toBe(table.id);
    expect(hitTestTables(worldToScreen({ x: 12, y: 3 }, camera), [table], camera))
      .toBeNull();
  });
});
