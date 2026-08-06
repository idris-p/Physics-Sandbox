import { describe, expect, it } from "vitest";
import {
  formatExactValueTooltip,
  getExactValueTooltip,
  isSymbolicExactDisplay,
} from "./exactValueTooltip";

describe("exact-value hover text", () => {
  it("recognises exact arctan expressions", () => {
    expect(getExactValueTooltip("arctan(4/3)", 53.130102354156)).toBe(
      "53.130 (3 d.p.)",
    );
  });
  it.each(["1/3", "5√(3)", "10 sin(53°)", "4 cos²(20°)"])(
    "recognises the symbolic exact form %s",
    (display) => expect(isSymbolicExactDisplay(display)).toBe(true),
  );

  it("does not treat integers or finite decimals within three places as symbolic", () => {
    for (const display of ["5", "-5", "1.25", "-0.125"]) {
      expect(isSymbolicExactDisplay(display)).toBe(false);
      expect(getExactValueTooltip(display, Number(display))).toBeNull();
    }
  });

  it("rounds to exactly three decimal places and labels the precision", () => {
    expect(formatExactValueTooltip(Math.sqrt(3))).toBe("1.732 (3 d.p.)");
    expect(formatExactValueTooltip(0.5)).toBe("0.500 (3 d.p.)");
    expect(formatExactValueTooltip(-0.0001)).toBe("0.000 (3 d.p.)");
  });

  it("recognises structured square-root and surd displays", () => {
    expect(getExactValueTooltip({ kind: "square-root" }, Math.sqrt(2))).toBe(
      "1.414 (3 d.p.)",
    );
  });
});
