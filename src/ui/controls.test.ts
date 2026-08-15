import { describe, expect, it } from "vitest";
import {
  clearSoleZeroInputValue,
  defaultBlankInputValue,
  formatPlaybackTime,
  formatTime,
  getForceDirectionArrowRotation,
  getExactInitialVelocityFields,
  getMotionGraphAnnotationTooltip,
  normalizeParticleName,
  parseAngle,
  parseGravity,
  parseInclineAngle,
  parseInclineHorizontalLength,
  parseNonNegativeProperty,
  parsePositiveProperty,
  parseSignedValue,
  parseTime,
  parseWorldCoordinate,
  replaceInitialVelocityFieldText,
  usesCompactKinematicText,
} from "./controls";
import { derivedValue, exactTrigValue } from "../kinematics/exactDisplay";

describe("numeric input zero editing", () => {
  it("clears only an input whose complete value is zero", () => {
    expect(clearSoleZeroInputValue("0")).toBe("");
    expect(clearSoleZeroInputValue(" 0 ")).toBe("");
    expect(clearSoleZeroInputValue("0.0")).toBe("0.0");
    expect(clearSoleZeroInputValue("10")).toBe("10");
  });

  it("defaults blank input text to zero without changing other values", () => {
    expect(defaultBlankInputValue("")).toBe("0");
    expect(defaultBlankInputValue("   ")).toBe("0");
    expect(defaultBlankInputValue("-2.5")).toBe("-2.5");
  });
});

describe("particle names", () => {
  it("trims a non-empty name", () => {
    expect(normalizeParticleName("  Cart  ")).toBe("Cart");
  });

  it("rejects blank names and names longer than 40 characters", () => {
    expect(normalizeParticleName("   ")).toBeNull();
    expect(normalizeParticleName("a".repeat(41))).toBeNull();
  });
});

describe("force direction arrows", () => {
  it("converts world directions to screen rotations", () => {
    expect(getForceDirectionArrowRotation({ x: 1, y: 0 })).toBeCloseTo(0);
    expect(getForceDirectionArrowRotation({ x: 0, y: 1 })).toBeCloseTo(-90);
    expect(getForceDirectionArrowRotation({ x: 0, y: -1 })).toBeCloseTo(90);
    expect(getForceDirectionArrowRotation({ x: -0.5, y: Math.sqrt(3) / 2 })).toBeCloseTo(-120);
  });
});

describe("parseGravity", () => {
  it.each(["9.8", "9.81", "1.625", "0", ".125"])("accepts %s", (value) => {
    expect(parseGravity(value)).toBe(Number(value));
  });

  it.each(["9.8001", "-9.8", "", "gravity", "1."])("rejects %s", (value) => {
    expect(parseGravity(value)).toBeNull();
  });
});

describe("parsePositiveProperty", () => {
  it.each(["1", "0.5", ".001"])("accepts positive value %s", (value) => {
    expect(parsePositiveProperty(value)).toBe(Number(value));
  });

  it.each(["0", "-0.1", "1.0001", ""])("rejects %s", (value) => {
    expect(parsePositiveProperty(value)).toBeNull();
  });
});

describe("parseNonNegativeProperty", () => {
  it.each(["0", "0.0", "1", ".125"])("accepts %s", (value) => {
    expect(parseNonNegativeProperty(value)).toBe(Number(value));
  });

  it.each(["-0.1", "1.0001", ""])("rejects %s", (value) => {
    expect(parseNonNegativeProperty(value)).toBeNull();
  });
});

describe("parseInclineAngle", () => {
  it.each(["0.001", "30", "45.125", "89.999"])("accepts %s", (value) => {
    expect(parseInclineAngle(value)).toBe(Number(value));
  });

  it.each(["0", "90", "-30", "30.0001", ""])("rejects %s", (value) => {
    expect(parseInclineAngle(value)).toBeNull();
  });
});

describe("parseInclineHorizontalLength", () => {
  it.each(["10", "10.001", "25.5"])("accepts %s", (value) => {
    expect(parseInclineHorizontalLength(value)).toBe(Number(value));
  });

  it.each(["9.999", "0", "10.0001", ""])("rejects %s", (value) => {
    expect(parseInclineHorizontalLength(value)).toBeNull();
  });
});

describe("parseTime", () => {
  it.each(["0", "1", "2.5", "12.12"])("accepts %s", (value) => {
    expect(parseTime(value)).toBe(Number(value));
  });

  it("accepts arbitrary decimal precision for direct scene inspection", () => {
    expect(parseTime("1.001")).toBe(1.001);
    expect(parseTime("0.123456789123")).toBe(0.123456789123);
    expect(parseTime(".0000001")).toBe(0.0000001);
  });

  it.each(["-1", "1.", "", "later"])("rejects %s", (value) => {
    expect(parseTime(value)).toBeNull();
  });

  it("shows the available numeric precision without padding or rounding", () => {
    expect(formatTime(0)).toBe("0");
    expect(formatTime(3.126)).toBe("3.126");
    expect(formatTime(0.123456789123)).toBe("0.123456789123");
  });

  it("limits the live playback display to exactly two decimal places", () => {
    expect(formatPlaybackTime(0)).toBe("0.00");
    expect(formatPlaybackTime(1.23456789)).toBe("1.23");
    expect(formatPlaybackTime(3.126)).toBe("3.13");
  });
});

describe("parseWorldCoordinate", () => {
  it.each(["-1000000", "-32.001", "0", "12.5", "1000000"])("accepts %s", (value) => {
    expect(parseWorldCoordinate(value)).toBe(Number(value));
  });

  it.each(["1.0001", "", "high", "Infinity", "1e3"])(
    "rejects %s",
    (value) => {
      expect(parseWorldCoordinate(value)).toBeNull();
    },
  );
});

describe("parseSignedValue", () => {
  it.each(["4", "-2.5", "0", "3.125", "-.25"])("accepts %s", (value) => {
    expect(parseSignedValue(value)).toBe(Number(value));
  });

  it.each(["3.1251", "1.", "", "fast", "1e3"])("rejects %s", (value) => {
    expect(parseSignedValue(value)).toBeNull();
  });
});

describe("parseAngle", () => {
  it.each(["-179.999", "-90", "0", "90.5", "180"])(
    "accepts an angle in (-180, 180]: %s",
    (value) => {
      expect(parseAngle(value)).toBe(Number(value));
    },
  );

  it.each(["-180", "180.001", "181", "-181", "45.0001", ""])(
    "rejects an angle outside (-180, 180] or the precision limit: %s",
    (value) => {
      expect(parseAngle(value)).toBeNull();
    },
  );
});

describe("initial velocity exact-field persistence", () => {
  it("changes only the edited Polar field and preserves the other exact text", () => {
    const values = { speed: "5", angle: "arctan(4/3)" };

    expect(replaceInitialVelocityFieldText(values, "speed", "10")).toEqual({
      speed: "10",
      angle: "arctan(4/3)",
    });
  });

  it("recognises symbolic fields independently within a velocity pair", () => {
    expect(Array.from(getExactInitialVelocityFields({
      x: "6",
      y: "8",
      speed: "10",
      angle: "arctan(4/3)",
    }))).toEqual(["angle"]);
  });
});

describe("kinematics value text sizing", () => {
  it("keeps exact trigonometric and surd values at the normal text size", () => {
    expect(usesCompactKinematicText("10 sin(53°)")).toBe(false);
    expect(usesCompactKinematicText("5√(3)")).toBe(false);
    expect(
      usesCompactKinematicText({
        kind: "square-root",
        radicand: "3",
        negative: false,
      }),
    ).toBe(false);
  });

  it("uses compact text only when a fraction is present", () => {
    expect(usesCompactKinematicText("250/49 sin²(53°)")).toBe(true);
    expect(
      usesCompactKinematicText({
        kind: "square-root",
        radicand: "2/3",
        negative: false,
      }),
    ).toBe(true);
  });
});

describe("exact motion graph coordinate tooltips", () => {
  it("shows both turning-point coordinates to three decimal places", () => {
    const sine = Math.sin(50 * Math.PI / 180);
    const time = 50 / 49 * sine;
    const displacement = 250 / 49 * sine ** 2;
    expect(getMotionGraphAnnotationTooltip({
      kind: "turning-point",
      time,
      value: displacement,
      timeDisplay: exactTrigValue(
        time,
        { numerator: 50n, denominator: 49n },
        "sin",
        "50",
      ),
      valueDisplay: exactTrigValue(
        displacement,
        { numerator: 250n, denominator: 49n },
        "sin",
        "50",
        2,
      ),
    })).toBe("(0.782, 2.994) (3 d.p.)");
  });

  it("shows only the relevant intercept coordinate approximation", () => {
    const sine = Math.sin(50 * Math.PI / 180);
    const time = 100 / 49 * sine;
    expect(getMotionGraphAnnotationTooltip({
      kind: "intersection",
      time,
      value: 0,
      timeDisplay: exactTrigValue(
        time,
        { numerator: 100n, denominator: 49n },
        "sin",
        "50",
      ),
      valueDisplay: derivedValue(0),
    })).toBe("1.563 (3 d.p.)");
  });

  it("uses the vertical-axis value for a y-intercept tooltip", () => {
    const sine = Math.sin(50 * Math.PI / 180);
    const velocity = 10 * sine;
    expect(getMotionGraphAnnotationTooltip({
      kind: "intersection",
      time: 0,
      value: velocity,
      timeDisplay: derivedValue(0),
      valueDisplay: exactTrigValue(
        velocity,
        { numerator: 10n, denominator: 1n },
        "sin",
        "50",
      ),
    })).toBe("7.660 (3 d.p.)");
  });
});
