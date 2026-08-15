import { describe, expect, it } from "vitest";
import { createIncline } from "../model/Incline";
import { calculateInclineWeightComponentVectors } from "./inclineWeightComponents";

describe("incline weight component construction", () => {
  it.each(["rises-right", "rises-left"] as const)(
    "closes tip-to-tail onto weight for an incline that %s",
    (direction) => {
      const incline = createIncline("incline", { x: 0, y: 0 });
      incline.angleDegrees = 30;
      incline.angleInput = "30";
      incline.direction = direction;

      const components = calculateInclineWeightComponentVectors(incline);

      expect(components.perpendicular.x + components.parallel.x).toBeCloseTo(0);
      expect(components.perpendicular.y + components.parallel.y).toBeCloseTo(-1);
      expect(components.perpendicular.y).toBeLessThan(0);
    },
  );

  it("resolves the parallel component down the slope", () => {
    const incline = createIncline("incline", { x: 0, y: 0 });
    incline.angleDegrees = 35;
    incline.direction = "rises-right";

    const components = calculateInclineWeightComponentVectors(incline);

    expect(components.parallel.x).toBeLessThan(0);
    expect(components.parallel.y).toBeLessThan(0);
  });
});
