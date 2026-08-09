import { describe, expect, it } from "vitest";
import {
  ZERO_RESULTANT_MARKER_RADIUS_RATIO,
  calculateZeroResultantMarkerRadius,
  drawZeroResultantMarker,
  drawCanvasMathValue,
  findCanvasExactValueHoverTarget,
  shouldRenderForceAnnotations,
} from "./renderer";

function createRecordingContext(): {
  context: CanvasRenderingContext2D;
  paintedText: string[];
} {
  const paintedText: string[] = [];
  const context = {
    font: '700 20px "KG Primary Penmanship Alt", sans-serif',
    lineWidth: 2,
    textAlign: "left",
    textBaseline: "middle",
    fillText: (text: string) => paintedText.push(text),
    measureText: (text: string) => ({ width: text.length * 10 }),
    beginPath: () => undefined,
    moveTo: () => undefined,
    lineTo: () => undefined,
    stroke: () => undefined,
  } as unknown as CanvasRenderingContext2D;
  return { context, paintedText };
}

describe("canvas annotation mathematics", () => {
  it("paints a trig coefficient as a stacked fraction without slash text", () => {
    const { context, paintedText } = createRecordingContext();

    drawCanvasMathValue(
      context,
      "250/49 sin²(53°)",
      0,
      0,
      20,
    );

    expect(paintedText).toContain("250");
    expect(paintedText).toContain("49");
    expect(paintedText).not.toContain("/");
    expect(paintedText).not.toContain("250/49");
  });

  it("paints a rational surd with a real fraction bar", () => {
    const { context, paintedText } = createRecordingContext();

    drawCanvasMathValue(context, "25√(3)/49", 0, 0, 20);

    expect(paintedText).toContain("25√(3)");
    expect(paintedText).toContain("49");
    expect(paintedText.every((text) => !text.includes("/"))).toBe(true);
  });
});

describe("force-arrow visibility", () => {
  it("follows the scene presentation toggle", () => {
    expect(shouldRenderForceAnnotations({ showForceArrows: true })).toBe(true);
    expect(shouldRenderForceAnnotations({ showForceArrows: false })).toBe(false);
  });

  it("draws the zero-resultant marker as a red centre dot", () => {
    const arcs: number[][] = [];
    let filled = false;
    const context = {
      fillStyle: "",
      save: () => undefined,
      restore: () => undefined,
      beginPath: () => undefined,
      arc: (...values: number[]) => arcs.push(values),
      fill: () => { filled = true; },
    } as unknown as CanvasRenderingContext2D;

    const markerRadius = calculateZeroResultantMarkerRadius(20);
    drawZeroResultantMarker(context, { x: 40, y: 60 }, markerRadius);

    expect(context.fillStyle).toBe("#c63329");
    expect(arcs[0]?.slice(0, 3)).toEqual([
      40,
      60,
      markerRadius,
    ]);
    expect(filled).toBe(true);
  });

  it("scales the zero-resultant marker with particle zoom size", () => {
    expect(calculateZeroResultantMarkerRadius(10)).toBe(
      10 * ZERO_RESULTANT_MARKER_RADIUS_RATIO,
    );
    expect(calculateZeroResultantMarkerRadius(40)).toBe(
      4 * calculateZeroResultantMarkerRadius(10),
    );
  });
});

describe("canvas exact-value hover targeting", () => {
  const target = {
    left: 10,
    top: 20,
    right: 60,
    bottom: 40,
    tooltip: "1.732 (3 d.p.)",
  };

  it("finds a symbolic annotation under the pointer", () => {
    expect(findCanvasExactValueHoverTarget([target], { x: 30, y: 30 })).toBe(
      target,
    );
  });

  it("ignores points outside the exact value's label", () => {
    expect(findCanvasExactValueHoverTarget([target], { x: 61, y: 30 })).toBeNull();
  });
});
