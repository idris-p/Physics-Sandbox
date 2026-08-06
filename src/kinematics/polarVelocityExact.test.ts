import { describe, expect, it } from "vitest";
import { createParticle } from "../model/Particle";
import { editParticleInitialVelocityAngle } from "../simulation/editInitialConditions";
import { formatWorkingValue } from "./exactDisplay";
import { createPolarVelocityComponentDisplay } from "./polarVelocityExact";

const displayConvention = { positiveX: "right", positiveY: "up" } as const;

function polarParticle(speed: string, angle: string) {
  return editParticleInitialVelocityAngle(
    createParticle("polar", { x: 0, y: 0 }),
    Number(speed),
    Number(angle),
    { angleReferenceAxis: "positive-x", angleDirection: "anticlockwise" },
    { speed, angle },
  );
}

describe("exact Polar velocity components", () => {
  it("uses a true rational for an exact special-angle component", () => {
    const component = createPolarVelocityComponentDisplay(
      polarParticle("10", "30"),
      "y",
      displayConvention,
    );
    expect(component?.exact).toEqual({ numerator: 5n, denominator: 1n });
    expect(formatWorkingValue(component!)).toBe("5");
  });

  it("uses a simplified surd for an exact special-angle component", () => {
    const component = createPolarVelocityComponentDisplay(
      polarParticle("10", "30"),
      "x",
      displayConvention,
    );
    expect(component?.exact).toBeUndefined();
    expect(component?.exactText).toBe("5√(3)");
  });

  it("retains an unresolved trig function instead of inferring a fraction", () => {
    const component = createPolarVelocityComponentDisplay(
      polarParticle("10", "53"),
      "y",
      displayConvention,
    );
    expect(component?.exact).toBeUndefined();
    expect(component?.exactText).toBe("10 sin(53°)");
  });

  it("maps reference-axis, rotation, and educational signs without changing motion", () => {
    const particle = editParticleInitialVelocityAngle(
      createParticle("mapped", { x: 0, y: 0 }),
      4,
      30,
      { angleReferenceAxis: "positive-y", angleDirection: "clockwise" },
      { speed: "4", angle: "30" },
    );

    expect(
      formatWorkingValue(
        createPolarVelocityComponentDisplay(
          particle,
          "x",
          { positiveX: "left", positiveY: "down" },
        )!,
      ),
    ).toBe("-2");
    expect(
      createPolarVelocityComponentDisplay(
        particle,
        "y",
        { positiveX: "left", positiveY: "down" },
      )?.exactText,
    ).toBe("−2√(3)");
  });
});
