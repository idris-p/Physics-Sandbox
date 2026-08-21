import { describe, expect, it } from "vitest";
import { createTable, MINIMUM_TABLE_SIZE } from "../model/Table";
import { createScene } from "../model/Scene";
import { canPlaceTable } from "../simulation/tableSetup";
import { createCamera } from "./camera";
import {
  calculateResizedTable,
  calculateTableResizeControlGeometry,
  hitTestTableResizeControl,
  stepTableResize,
} from "./tableResizeControl";

describe("Table resize controls", () => {
  it("places a resize handle at each upper corner", () => {
    const camera = createCamera(400, 300);
    camera.centre = { x: 0, y: 0 };
    camera.pixelsPerMetre = 10;
    const table = createTable("table", { x: -5, y: 5 }, 10, 5);

    const [left, right] = calculateTableResizeControlGeometry(table, camera);

    expect(left.corner).toBe("top-left");
    expect(left.centre).toEqual({ x: 150, y: 100 });
    expect(right.corner).toBe("top-right");
    expect(right.centre).toEqual({ x: 250, y: 100 });
    expect(hitTestTableResizeControl(left.centre, [left, right])).toEqual({
      kind: "handle",
      corner: "top-left",
    });
    expect(hitTestTableResizeControl(right.centre, [left, right])).toEqual({
      kind: "handle",
      corner: "top-right",
    });
    expect(left.arrows.map((arrow) => arrow.direction)).toEqual([
      "up",
      "down",
      "left",
      "right",
    ]);
    expect(left.arrows[0].centre).toEqual({ x: 150, y: 90 });
    expect(left.arrows[1].centre).toEqual({ x: 150, y: 110 });
    expect(left.arrows[2].centre).toEqual({ x: 140, y: 100 });
    expect(left.arrows[3].centre).toEqual({ x: 160, y: 100 });
    expect(hitTestTableResizeControl(left.arrows[0].centre, [left, right]))
      .toEqual({
        kind: "arrow",
        corner: "top-left",
        direction: "up",
      });
  });

  it("anchors the opposite bottom corner while resizing", () => {
    const table = createTable("table", { x: 0, y: 5 }, 10, 5);

    const fromRight = calculateResizedTable(
      table,
      "top-right",
      { x: 14, y: 8 },
    );
    expect(fromRight.topLeft).toEqual({ x: 0, y: 8 });
    expect(fromRight.width).toBe(14);
    expect(fromRight.height).toBe(8);

    const fromLeft = calculateResizedTable(
      table,
      "top-left",
      { x: -4, y: 7 },
    );
    expect(fromLeft.topLeft).toEqual({ x: -4, y: 7 });
    expect(fromLeft.width).toBe(14);
    expect(fromLeft.height).toBe(7);
  });

  it("snaps dimensions to metres and enforces the minimum size", () => {
    const table = createTable("table", { x: 0, y: 5 }, 10, 5);
    const resized = calculateResizedTable(
      table,
      "top-right",
      { x: 1.2, y: 0.7 },
    );

    expect(MINIMUM_TABLE_SIZE).toBe(2);
    expect(resized.topLeft).toEqual({ x: 0, y: 2 });
    expect(resized.width).toBe(2);
    expect(resized.height).toBe(2);
    expect(resized.widthInput).toBe("2");
    expect(resized.heightInput).toBe("2");

    const camera = createCamera(400, 300);
    const [left, right] = calculateTableResizeControlGeometry(
      resized,
      camera,
    );
    expect(left.arrows.find((arrow) => arrow.direction === "down")?.enabled)
      .toBe(false);
    expect(left.arrows.find((arrow) => arrow.direction === "right")?.enabled)
      .toBe(false);
    expect(right.arrows.find((arrow) => arrow.direction === "left")?.enabled)
      .toBe(false);
  });

  it("steps a corner one metre with each arrow", () => {
    const table = createTable("table", { x: 0, y: 5 }, 10, 5);

    expect(stepTableResize(table, "top-left", "left").topLeft)
      .toEqual({ x: -1, y: 5 });
    expect(stepTableResize(table, "top-left", "right").width).toBe(9);
    expect(stepTableResize(table, "top-right", "right").width).toBe(11);
    expect(stepTableResize(table, "top-right", "left").width).toBe(9);
    expect(stepTableResize(table, "top-right", "up").height).toBe(6);
    expect(stepTableResize(table, "top-right", "down").height).toBe(4);
  });

  it("can be rejected by the shared Table overlap rules", () => {
    const scene = createScene();
    const source = createTable("source", { x: 0, y: 5 }, 4, 3);
    const blocker = createTable("blocker", { x: 6, y: 5 }, 4, 3);
    scene.tables.push(source, blocker);

    const touching = calculateResizedTable(
      source,
      "top-right",
      { x: 6, y: 5 },
    );
    const overlapping = calculateResizedTable(
      source,
      "top-right",
      { x: 7, y: 5 },
    );

    expect(canPlaceTable(touching, scene, source.id)).toBe(true);
    expect(canPlaceTable(overlapping, scene, source.id)).toBe(false);
  });
});
