import { describe, expect, it } from "vitest";
import { createCamera } from "./camera";
import { createIncline } from "../model/Incline";
import {
  calculateDraggedInclineHorizontalLength,
  calculateInclineLengthControlGeometry,
  hitTestInclineLengthControl,
  stepInclineHorizontalLength,
} from "./inclineLengthControl";

describe("incline length control", () => {
  it("places arrows one grid cell either side of the right-angle corner", () => {
    const camera = createCamera(1000, 700);
    const geometry = calculateInclineLengthControlGeometry(
      createIncline("incline", { x: 0, y: 0 }),
      camera,
    );

    expect(geometry.corner.x - geometry.decreaseCentre.x).toBe(40);
    expect(geometry.increaseCentre.x - geometry.corner.x).toBe(40);
    expect(geometry.decreaseCentre.y).toBe(geometry.corner.y);
    expect(geometry.increaseCentre.y).toBe(geometry.corner.y);
  });

  it("hit-tests both arrow cells and the concentric handle", () => {
    const camera = createCamera(1000, 700);
    const incline = createIncline("incline", { x: 0, y: 0 });
    incline.horizontalLength = 12;
    const geometry = calculateInclineLengthControlGeometry(
      incline,
      camera,
    );

    expect(hitTestInclineLengthControl(geometry.decreaseCentre, geometry))
      .toBe("decrease");
    expect(hitTestInclineLengthControl(geometry.corner, geometry)).toBe("handle");
    expect(hitTestInclineLengthControl(geometry.increaseCentre, geometry))
      .toBe("increase");
  });

  it("removes the decrease-arrow target at the minimum length", () => {
    const camera = createCamera(1000, 700);
    const geometry = calculateInclineLengthControlGeometry(
      createIncline("incline", { x: 0, y: 0 }),
      camera,
    );

    expect(geometry.canDecrease).toBe(false);
    expect(hitTestInclineLengthControl(geometry.decreaseCentre, geometry))
      .toBeNull();
  });

  it("steps by one metre without passing the minimum length", () => {
    expect(stepInclineHorizontalLength(12, "decrease")).toBe(11);
    expect(stepInclineHorizontalLength(10, "decrease")).toBe(10);
    expect(stepInclineHorizontalLength(10, "increase")).toBe(11);
  });

  it("snaps handle dragging to metres in the incline's outward direction", () => {
    expect(calculateDraggedInclineHorizontalLength(10, 62, 40, "rises-right"))
      .toBe(12);
    expect(calculateDraggedInclineHorizontalLength(10, -62, 40, "rises-left"))
      .toBe(12);
    expect(calculateDraggedInclineHorizontalLength(10, -200, 40, "rises-right"))
      .toBe(10);
  });
});
