import { describe, expect, it } from "vitest";
import {
  calculateInclineDragPreviewGeometry,
  getParticleDragPreviewClassName,
} from "./interaction";

describe("particle drag preview", () => {
  it("preserves the particle's selected shape", () => {
    expect(getParticleDragPreviewClassName("circle")).toBe(
      "particle-drag-preview",
    );
    expect(getParticleDragPreviewClassName("square")).toBe(
      "particle-drag-preview is-square",
    );
  });
});

describe("incline hotbar drag preview", () => {
  it("uses the default incline's true world size at the current zoom", () => {
    const preview = calculateInclineDragPreviewGeometry(
      { x: 100, y: 300 },
      40,
    );

    expect(preview.left).toBe(100);
    expect(preview.width).toBe(400);
    expect(preview.height).toBeCloseTo(400 * Math.tan(Math.PI / 6), 12);
    expect(preview.top + preview.height).toBeCloseTo(300, 12);
  });

  it("scales both dimensions proportionally with zoom", () => {
    const normal = calculateInclineDragPreviewGeometry({ x: 0, y: 0 }, 25);
    const zoomed = calculateInclineDragPreviewGeometry({ x: 0, y: 0 }, 50);

    expect(zoomed.width).toBe(normal.width * 2);
    expect(zoomed.height).toBe(normal.height * 2);
  });
});
