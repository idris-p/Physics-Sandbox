import { describe, expect, it } from "vitest";
import {
  ZERO_RESULTANT_MARKER_RADIUS_RATIO,
  INCLINE_ANGLE_LABEL_RADIUS_RATIO,
  PLACEMENT_PREVIEW_OPACITY,
  calculateInclineAngleAnnotationGeometry,
  calculateInclineDistanceLabelPosition,
  calculateInclineWeightAngleFontSize,
  calculateInclineRoughLineSegments,
  calculateDiagramOutlineWidth,
  calculateStringStrokeWidth,
  calculatePulleyPreviewStringOffset,
  calculatePulleyMountMarkerGeometry,
  calculatePulleyTensionLabelOffset,
  calculateTensionArrowHeadGeometry,
  calculateTensionMagnitudeLabelPosition,
  calculateZeroResultantMarkerRadius,
  createMountedSupportDragPreviewScene,
  createForceArrowHoverTarget,
  drawZeroResultantMarker,
  drawCanvasMathValue,
  measureCanvasMathValue,
  findCanvasExactValueHoverTarget,
  formatForceHoverTooltip,
  getParticleForceContactDisplay,
  getParticleRenderColours,
  getHoveredStringTargetId,
  shouldRenderForceAnnotations,
  shouldShowTensionMagnitude,
  shouldRenderInclineWeightComponents,
  translateInclineContactParticleStates,
  translateTableContactParticleStates,
} from "./renderer";
import { INITIAL_VELOCITY_ANGLE_ARC_RADIUS_METRES } from "./initialVelocityAnnotation";
import { createIncline } from "../model/Incline";
import { createParticle, type ParticleState } from "../model/Particle";
import { createScene } from "../model/Scene";
import { createTable } from "../model/Table";
import { addPulleyApparatus } from "../model/pulleyScene";
import { createCamera, worldToScreen } from "./camera";
import { createAppliedForce } from "../model/AppliedForce";
import {
  connectParticlesWithString,
  setPulleyStringLegLength,
} from "../dynamics/stringConnection";
import { getInclineGeometry, pointAtInclineCoordinate } from "../geometry/inclineGeometry";
import { calculateSurfaceTrajectory } from "../physics/surfaceTrajectory";
import { getPulleyTrajectoryBoundaryEvent } from "../physics/pulleyTrajectory";

describe("incline distance annotation", () => {
  it("places the whole label on the side of the arrow away from a particle to the right", () => {
    const position = calculateInclineDistanceLabelPosition(
      { x: 20, y: 80 },
      { x: 120, y: 30 },
      { x: -0.4472135955, y: -0.894427191 },
      160,
      20,
    );

    expect(position.x + 160).toBeCloseTo(70 - 0.4472135955 * 18 - 8, 10);
    expect(position.y).toBeCloseTo(55 - 0.894427191 * 18, 10);
  });

  it("places the whole label on the side of the arrow away from a particle to the left", () => {
    const position = calculateInclineDistanceLabelPosition(
      { x: 120, y: 80 },
      { x: 20, y: 30 },
      { x: 0.4472135955, y: -0.894427191 },
      160,
      20,
    );

    expect(position.x).toBeCloseTo(70 + 0.4472135955 * 18 + 8, 10);
    expect(position.y).toBeCloseTo(55 - 0.894427191 * 18, 10);
  });
});

function createRecordingContext(): {
  context: CanvasRenderingContext2D;
  paintedText: string[];
  paintedTextPositions: Array<{ text: string; x: number; y: number }>;
  lineSegments: Array<{ start: { x: number; y: number }; end: { x: number; y: number } }>;
} {
  const paintedText: string[] = [];
  const paintedTextPositions: Array<{ text: string; x: number; y: number }> = [];
  const lineSegments: Array<{
    start: { x: number; y: number };
    end: { x: number; y: number };
  }> = [];
  let pathPoint = { x: 0, y: 0 };
  const context = {
    font: '700 20px "KG Primary Penmanship Alt", sans-serif',
    lineWidth: 2,
    textAlign: "left",
    textBaseline: "middle",
    fillText: (text: string, x: number, y: number) => {
      paintedText.push(text);
      paintedTextPositions.push({ text, x, y });
    },
    measureText: (text: string) => ({ width: text.length * 10 }),
    beginPath: () => undefined,
    moveTo: (x: number, y: number) => {
      pathPoint = { x, y };
    },
    lineTo: (x: number, y: number) => {
      lineSegments.push({ start: pathPoint, end: { x, y } });
      pathPoint = { x, y };
    },
    stroke: () => undefined,
  } as unknown as CanvasRenderingContext2D;
  return { context, paintedText, paintedTextPositions, lineSegments };
}

describe("diagram outline zoom", () => {
  it("thins object outlines with zoom using the Pulley scale", () => {
    expect(calculateDiagramOutlineWidth(40)).toBe(3);
    expect(calculateDiagramOutlineWidth(30)).toBe(2.25);
    expect(calculateDiagramOutlineWidth(20)).toBe(2);
  });

  it("keeps the placement marker centred on mounted Pulleys", () => {
    const scene = createScene();
    const table = createTable("table", { x: 0, y: 5 });
    scene.tables.push(table);
    const mounted = addPulleyApparatus(scene, {
      pulleyId: "mounted-pulley",
      stringId: "mounted-string",
      particleAId: "mounted-a",
      particleBId: "mounted-b",
    }, { x: 10, y: 5 }, {
      kind: "table-corner",
      tableId: table.id,
      side: "right",
    })!;
    const free = addPulleyApparatus(scene, {
      pulleyId: "free-pulley",
      stringId: "free-string",
      particleAId: "free-a",
      particleBId: "free-b",
    }, { x: 20, y: 12 })!;
    const incline = createIncline("incline", { x: 30, y: 0 });
    scene.inclines.push(incline);
    const inclineMounted = addPulleyApparatus(scene, {
      pulleyId: "incline-pulley",
      stringId: "incline-string",
      particleAId: "incline-a",
      particleBId: "incline-b",
    }, getInclineGeometry(incline).upperEndpoint, {
      kind: "incline-end",
      inclineId: incline.id,
    })!;
    const camera = createCamera(800, 600);

    expect(calculatePulleyMountMarkerGeometry(
      scene,
      mounted.pulley,
      camera,
    )).toEqual({
      centre: worldToScreen(mounted.pulley.centre, camera),
      radius: camera.pixelsPerMetre * 0.16,
    });
    expect(calculatePulleyMountMarkerGeometry(
      scene,
      free.pulley,
      camera,
    )).toBeNull();
    expect(calculatePulleyMountMarkerGeometry(
      scene,
      inclineMounted.pulley,
      camera,
    )?.centre).toEqual(worldToScreen(inclineMounted.pulley.centre, camera));

    camera.pixelsPerMetre = 20;
    expect(calculatePulleyMountMarkerGeometry(
      scene,
      mounted.pulley,
      camera,
    )?.radius).toBe(3.2);
  });

  it("thins strings and force arrows together when zooming out", () => {
    expect(calculateStringStrokeWidth(40)).toBe(3.2);
    expect(calculateStringStrokeWidth(30)).toBe(2.4);
    expect(calculateStringStrokeWidth(20)).toBe(2);
    expect(calculateStringStrokeWidth(100)).toBe(3.5);
  });
});

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
    const { context, paintedText, lineSegments } = createRecordingContext();

    drawCanvasMathValue(context, "25√(3)/49", 0, 0, 20);

    expect(paintedText).toContain("25");
    expect(paintedText).toContain("3");
    expect(paintedText).toContain("49");
    expect(paintedText).not.toContain("√");
    expect(paintedText.every((text) => !text.includes("/"))).toBe(true);
    expect(paintedText.every((text) => !text.includes("("))).toBe(true);
    expect(lineSegments.length).toBeGreaterThanOrEqual(5);
  });

  it("recursively paints radicals inside algebraic fraction numerators", () => {
    const { context, paintedText, lineSegments } = createRecordingContext();
    const value = "(2 + 2√(7))/3";

    const measuredWidth = measureCanvasMathValue(context, value, 20);
    const drawnWidth = drawCanvasMathValue(context, value, 0, 0, 20);

    expect(drawnWidth).toBe(measuredWidth);
    expect(paintedText).toContain("7");
    expect(paintedText).toContain("3");
    expect(paintedText).not.toContain("√");
    expect(paintedText.every((text) => !text.includes("√("))).toBe(true);
    expect(paintedText.every((text) => !text.includes("/"))).toBe(true);
    expect(lineSegments.filter((segment) =>
      segment.start.y === segment.end.y && segment.end.x > segment.start.x
    ).length).toBeGreaterThanOrEqual(2);
  });

  it("uses the same radical renderer for structured square-root values", () => {
    const { context, paintedText, lineSegments } = createRecordingContext();

    drawCanvasMathValue(
      context,
      { kind: "square-root", radicand: "2/3", negative: false },
      0,
      0,
      20,
    );

    expect(paintedText).toContain("2");
    expect(paintedText).toContain("3");
    expect(paintedText).not.toContain("√");
    expect(paintedText.every((text) => !text.includes("/"))).toBe(true);
    expect(lineSegments.length).toBeGreaterThanOrEqual(5);
  });

  it("uses the surrounding text baseline for a radicand", () => {
    const { context, paintedTextPositions } = createRecordingContext();

    drawCanvasMathValue(context, "2 + √(7)", 0, 40, 20);

    const adjacentNumber = paintedTextPositions.find(({ text }) => text === "2");
    const radicand = paintedTextPositions.find(({ text }) => text === "7");
    expect(adjacentNumber).toBeDefined();
    expect(radicand).toBeDefined();
    expect(radicand!.y).toBe(adjacentNumber!.y);
  });
});

describe("Tension arrowhead geometry", () => {
  it("places the arrow tip on the visually offset string toward the other endpoint", () => {
    const geometry = calculateTensionArrowHeadGeometry(
      { x: 20, y: 74 },
      { x: 420, y: 74 },
      40,
      10,
    );

    expect(geometry).not.toBeNull();
    expect(geometry!.tip.y).toBe(74);
    expect(geometry!.tip.x).toBeGreaterThan(20);
    expect(geometry!.tip.x).toBeLessThan(420);
    expect(geometry!.firstWing.x).toBeLessThan(geometry!.tip.x);
    expect(geometry!.secondWing.x).toBeLessThan(geometry!.tip.x);
    expect(geometry!.tip.x - 20).toBe(120);
    expect(geometry!.atMidpoint).toBe(false);
  });

  it("separates inward-facing arrow tips slightly around the midpoint", () => {
    const fromLeft = calculateTensionArrowHeadGeometry(
      { x: 0, y: 20 },
      { x: 200, y: 20 },
      40,
      5,
    );
    const fromRight = calculateTensionArrowHeadGeometry(
      { x: 200, y: 20 },
      { x: 0, y: 20 },
      40,
      5,
    );

    expect(fromLeft!.tip.y).toBe(20);
    expect(fromRight!.tip.y).toBe(20);
    expect(fromLeft!.tip.x).toBeLessThan(100);
    expect(fromRight!.tip.x).toBeGreaterThan(100);
    expect(100 - fromLeft!.tip.x).toBeCloseTo(
      fromRight!.tip.x - 100,
      12,
    );
    expect(fromLeft!.atMidpoint).toBe(true);
    expect(fromRight!.atMidpoint).toBe(true);
  });

  it("keeps the midpoint offset stable across screen-space translation", () => {
    const beforePan = calculateTensionArrowHeadGeometry(
      { x: 0, y: 20 },
      { x: 240.000000001, y: 20 },
      40,
      6,
    )!;
    const afterPan = calculateTensionArrowHeadGeometry(
      { x: -10000.125, y: 8472.75 },
      { x: -9760.125000001, y: 8472.75 },
      40,
      6,
    )!;

    expect(beforePan.atMidpoint).toBe(true);
    expect(afterPan.atMidpoint).toBe(true);
    expect(beforePan.tip.x).toBeLessThan(120);
    expect(afterPan.tip.x).toBeLessThan(
      (-10000.125 + -9760.125000001) / 2,
    );
  });

  it("centres the value above the arrowhead", () => {
    const geometry = calculateTensionArrowHeadGeometry(
      { x: 20, y: 100 },
      { x: 420, y: 100 },
      40,
      10,
    )!;
    const label = calculateTensionMagnitudeLabelPosition(
      geometry,
      60,
      20,
    );

    expect(label.x + 30).toBe(geometry.tip.x);
    expect(label.y).toBeLessThan(
      Math.min(
        geometry.tip.y,
        geometry.firstWing.y,
        geometry.secondWing.y,
      ),
    );
  });

  it("shows and offsets a value on both sides of a Pulley", () => {
    expect(shouldShowTensionMagnitude(true, true, true)).toBe(true);
    expect(shouldShowTensionMagnitude(true, true, false)).toBe(true);
    const leftOffset = calculatePulleyTensionLabelOffset(
      { x: 0, y: -1 },
      true,
      20,
    );
    const rightOffset = calculatePulleyTensionLabelOffset(
      { x: 0, y: -1 },
      false,
      20,
    );
    expect(leftOffset.x).toBeLessThan(0);
    expect(rightOffset.x).toBeGreaterThan(0);
  });

  it("shows Tension on both particles at an initially slack Pulley's tautening pause", () => {
    const scene = createScene();
    scene.tables.push(createTable("table", { x: -2, y: 4 }, 2, 2));
    const apparatus = addPulleyApparatus(scene, {
      pulleyId: "pulley",
      stringId: "string",
      particleAId: "a",
      particleBId: "b",
    }, { x: 0, y: 10 })!;
    expect(setPulleyStringLegLength(
      scene,
      apparatus.stringId,
      "left",
      8,
      "8",
    )).toEqual({ ok: true });
    const boundary = getPulleyTrajectoryBoundaryEvent(
      scene,
      scene.strings[0],
    )!;

    const leftDisplay = getParticleForceContactDisplay(
      scene,
      apparatus.particleA,
      boundary.time,
    );
    const rightDisplay = getParticleForceContactDisplay(
      scene,
      apparatus.particleB,
      boundary.time,
    );

    expect(boundary.kind).toBe("impulsive-tautening");
    expect(leftDisplay.tension?.magnitude).toBeGreaterThan(0);
    expect(rightDisplay.tension?.magnitude).toBeGreaterThan(0);
  });
});

describe("string connection target hover", () => {
  it("returns any candidate particle so invalid targets can be highlighted", () => {
    const camera = createCamera(800, 600);
    const particles: ParticleState[] = [
      {
        id: "source",
        position: { x: 0, y: 0 },
        velocity: { x: 0, y: 0 },
        acceleration: { x: 0, y: 0 },
      },
      {
        id: "valid",
        position: { x: 4, y: 0 },
        velocity: { x: 0, y: 0 },
        acceleration: { x: 0, y: 0 },
      },
      {
        id: "invalid",
        position: { x: 8, y: 0 },
        velocity: { x: 0, y: 0 },
        acceleration: { x: 0, y: 0 },
      },
    ];

    expect(getHoveredStringTargetId({
      sourceParticleId: "source",
      pointer: { x: 4, y: 0 },
      validTargetIds: ["valid"],
    }, particles, camera)).toBe("valid");
    expect(getHoveredStringTargetId({
      sourceParticleId: "source",
      pointer: { x: 8, y: 0 },
      validTargetIds: ["valid"],
    }, particles, camera)).toBe("invalid");
  });

  it("uses a red shade for an invalid target", () => {
    expect(getParticleRenderColours(0, true)).toEqual({
      fill: "#e89a8f",
      stroke: "#a62d26",
    });
  });
});

describe("incline weight angle annotation", () => {
  it("shrinks continuously when the scene is zoomed out", () => {
    expect(calculateInclineWeightAngleFontSize(20)).toBeLessThan(
      calculateInclineWeightAngleFontSize(40),
    );
    expect(calculateInclineWeightAngleFontSize(8)).toBeCloseTo(3.36);
  });
});

describe("incline weight resolution visibility", () => {
  it("shows details only for the selected particle on an incline", () => {
    expect(shouldRenderInclineWeightComponents(
      "weight",
      "particle-a",
      "particle-a",
      true,
      false,
    )).toBe(true);
    expect(shouldRenderInclineWeightComponents(
      "weight",
      "particle-a",
      "particle-b",
      true,
      false,
    )).toBe(false);
    expect(shouldRenderInclineWeightComponents(
      "weight",
      "particle-a",
      null,
      true,
      false,
    )).toBe(false);
  });
});

describe("persistent incline angle annotation", () => {
  it("uses the initial-velocity arc scale and places the value inside it", () => {
    const lowerEndpoint = { x: 100, y: 200 };
    const geometry = calculateInclineAngleAnnotationGeometry(
      lowerEndpoint,
      "rises-right",
      30,
      40,
    );
    const labelDistance = Math.hypot(
      geometry.labelPosition.x - lowerEndpoint.x,
      geometry.labelPosition.y - lowerEndpoint.y,
    );

    expect(geometry.arcRadius).toBe(
      INITIAL_VELOCITY_ANGLE_ARC_RADIUS_METRES * 40,
    );
    expect(labelDistance).toBeLessThan(geometry.arcRadius);
    expect(labelDistance).toBeCloseTo(
      geometry.arcRadius * INCLINE_ANGLE_LABEL_RADIUS_RATIO,
      12,
    );
    expect(geometry.anticlockwise).toBe(true);
  });

  it("mirrors the arc for a left-rising incline", () => {
    const right = calculateInclineAngleAnnotationGeometry(
      { x: 0, y: 0 },
      "rises-right",
      30,
      40,
    );
    const left = calculateInclineAngleAnnotationGeometry(
      { x: 0, y: 0 },
      "rises-left",
      30,
      40,
    );

    expect(left.labelPosition.x).toBeCloseTo(-right.labelPosition.x, 12);
    expect(left.labelPosition.y).toBeCloseTo(right.labelPosition.y, 12);
    expect(left.anticlockwise).toBe(false);
  });

  it("expands narrow arcs radially until their value fits inside", () => {
    const narrow = calculateInclineAngleAnnotationGeometry(
      { x: 0, y: 0 },
      "rises-right",
      10,
      40,
      35,
      10,
    );
    const roomy = calculateInclineAngleAnnotationGeometry(
      { x: 0, y: 0 },
      "rises-right",
      45,
      40,
      35,
      10,
    );

    expect(narrow.arcRadius).toBeGreaterThan(roomy.arcRadius);
    expect(narrow.labelPosition.x).toBeLessThan(narrow.arcRadius);
    expect(narrow.labelPosition.y).toBeLessThan(0);
  });

  it("never expands the arc beyond the incline's horizontal length", () => {
    const extremelyNarrow = calculateInclineAngleAnnotationGeometry(
      { x: 0, y: 0 },
      "rises-right",
      0.001,
      40,
      100,
      10,
    );

    expect(extremelyNarrow.arcRadius).toBe(10 * 40);
    expect(extremelyNarrow.labelPosition.x).toBeLessThanOrEqual(10 * 40);
  });
});

describe("rough incline rendering", () => {
  it("spaces rough marks along the slope and points them into the solid", () => {
    const lines = calculateInclineRoughLineSegments(
      { x: 0, y: 100 },
      { x: 160, y: 20 },
      { x: 160, y: 100 },
      32,
      18,
    );

    expect(lines.length).toBeGreaterThan(1);
    expect(lines.every((line) => line.end.y > line.start.y)).toBe(true);
    expect(lines.every((line) => line.end.x > line.start.x)).toBe(true);
    expect(lines[0].start.x).toBeLessThan(lines.at(-1)!.start.x);
  });

  it("mirrors inward marks for a left-rising incline", () => {
    const lines = calculateInclineRoughLineSegments(
      { x: 160, y: 100 },
      { x: 0, y: 20 },
      { x: 0, y: 100 },
    );

    expect(lines.every((line) => line.end.y > line.start.y)).toBe(true);
    expect(lines.every((line) => line.end.x < line.start.x)).toBe(true);
  });
});

describe("tool placement preview", () => {
  it("uses a visible translucent opacity", () => {
    expect(PLACEMENT_PREVIEW_OPACITY).toBeGreaterThan(0);
    expect(PLACEMENT_PREVIEW_OPACITY).toBeLessThan(1);
  });

  it("moves only particles currently on an incline with its drag preview", () => {
    const scene = createScene();
    const incline = createIncline("incline", { x: 0, y: 0 });
    const contactingParticle = createParticle("contacting", { x: 5, y: 5 * Math.tan(Math.PI / 6) });
    contactingParticle.initialInclineContact = { inclineId: incline.id, q: 5 };
    const departedParticle = createParticle("departed", { x: 3, y: 10 });
    departedParticle.initialInclineContact = { inclineId: incline.id, q: 3 };
    const unrelatedParticle = createParticle("unrelated", { x: 2, y: 2 * Math.tan(Math.PI / 6) });
    scene.inclines.push(incline);
    scene.particles.push(
      contactingParticle,
      departedParticle,
      unrelatedParticle,
    );
    const states: ParticleState[] = scene.particles.map((particle) => ({
      id: particle.id,
      position: { ...particle.initialPosition },
      velocity: { x: 0, y: 0 },
      acceleration: { x: 0, y: 0 },
    }));

    const displayed = translateInclineContactParticleStates(scene, states, {
      kind: "incline",
      position: { x: 4, y: -2 },
      isValid: true,
      sourceInclineId: incline.id,
    });

    expect(displayed[0].position.x).toBeCloseTo(states[0].position.x + 4, 12);
    expect(displayed[0].position.y).toBeCloseTo(states[0].position.y - 2, 12);
    expect(displayed[1]).toBe(states[1]);
    expect(displayed[2]).toBe(states[2]);
    expect(states[0].position).toEqual(contactingParticle.initialPosition);
  });

  it("moves particles currently supported by a Table with its drag preview", () => {
    const scene = createScene();
    const table = createTable("table", { x: 0, y: 5 });
    const supported = createParticle("supported", { x: 3, y: 5 });
    supported.initialTableContact = { tableId: table.id, q: 3 };
    const departed = createParticle("departed", { x: 6, y: 5 });
    departed.initialTableContact = { tableId: table.id, q: 6 };
    scene.tables.push(table);
    scene.particles.push(supported, departed);
    const states: ParticleState[] = [
      {
        id: supported.id,
        position: { ...supported.initialPosition },
        velocity: { x: 0, y: 0 },
        acceleration: { x: 0, y: 0 },
      },
      {
        id: departed.id,
        position: { x: 6, y: 9 },
        velocity: { x: 0, y: 1 },
        acceleration: { x: 0, y: -9.8 },
      },
    ];

    const displayed = translateTableContactParticleStates(scene, states, {
      kind: "table",
      position: { x: 4, y: 7 },
      isValid: true,
      sourceTableId: table.id,
      width: table.width,
      height: table.height,
    });

    expect(displayed[0].position).toEqual({ x: 7, y: 7 });
    expect(displayed[1]).toBe(states[1]);
    expect(states[0].position).toEqual({ x: 3, y: 5 });
  });

  it("keeps supported particles on a Table when a resize passes them", () => {
    const scene = createScene();
    const table = createTable("table", { x: 0, y: 5 }, 10, 5);
    const particle = createParticle("particle", { x: 8, y: 5 });
    particle.initialTableContact = { tableId: table.id, q: 8 };
    scene.tables.push(table);
    scene.particles.push(particle);

    const [displayed] = translateTableContactParticleStates(
      scene,
      [{
        id: particle.id,
        position: { x: 8, y: 5 },
        velocity: { x: 0, y: 0 },
        acceleration: { x: 0, y: 0 },
      }],
      {
        kind: "table",
        position: { x: 0, y: 7 },
        isValid: true,
        sourceTableId: table.id,
        width: 5,
        height: 7,
      },
    );

    expect(displayed.position).toEqual({ x: 5, y: 7 });
  });

  it("offsets a corner-mounted Pulley preview string above its surface", () => {
    const scene = createScene();
    const incline = createIncline("incline", { x: 0, y: 0 });
    scene.inclines.push(incline);

    expect(calculatePulleyPreviewStringOffset(
      { kind: "table-corner", tableId: "table", side: "right" },
      scene.inclines,
    )).toEqual({ x: 0, y: 0.3 });

    const inclineOffset = calculatePulleyPreviewStringOffset(
      { kind: "incline-end", inclineId: incline.id },
      scene.inclines,
    );
    const geometry = getInclineGeometry(incline);
    expect(
      inclineOffset.x * geometry.tangent.x +
        inclineOffset.y * geometry.tangent.y,
    ).toBeCloseTo(0, 12);
    expect(Math.hypot(inclineOffset.x, inclineOffset.y)).toBeCloseTo(0.3, 12);
  });

  it("moves mounted Pulley apparatus with Table and Incline drag previews", () => {
    const tableScene = createScene();
    const table = createTable("table", { x: 0, y: 5 });
    tableScene.tables.push(table);
    const tableApparatus = addPulleyApparatus(
      tableScene,
      {
        pulleyId: "table-pulley",
        stringId: "table-string",
        particleAId: "table-a",
        particleBId: "table-b",
      },
      { x: 10, y: 5 },
      { kind: "table-corner", tableId: table.id, side: "right" },
    )!;
    const tableStringLength = tableScene.strings[0].length;
    const tablePreview = createMountedSupportDragPreviewScene(tableScene, {
      kind: "table",
      position: { x: 3, y: 8 },
      isValid: true,
      sourceTableId: table.id,
      width: table.width,
      height: table.height,
    })!;

    expect(tablePreview.pulleys[0].centre).toEqual({ x: 13, y: 8 });
    expect(tablePreview.particles.map((particle) => particle.initialPosition))
      .toEqual([
        {
          x: tableApparatus.particleA.initialPosition.x + 3,
          y: tableApparatus.particleA.initialPosition.y + 3,
        },
        {
          x: tableApparatus.particleB.initialPosition.x + 3,
          y: tableApparatus.particleB.initialPosition.y + 3,
        },
      ]);
    expect(tablePreview.strings[0].length).toBeCloseTo(tableStringLength, 12);
    expect(tableScene.pulleys[0].centre).toEqual({ x: 10, y: 5 });

    const inclineScene = createScene();
    const incline = createIncline("incline", { x: 0, y: 0 });
    inclineScene.inclines.push(incline);
    const upper = getInclineGeometry(incline).upperEndpoint;
    const inclineApparatus = addPulleyApparatus(
      inclineScene,
      {
        pulleyId: "incline-pulley",
        stringId: "incline-string",
        particleAId: "incline-a",
        particleBId: "incline-b",
      },
      upper,
      { kind: "incline-end", inclineId: incline.id },
    )!;
    const inclinePreview = createMountedSupportDragPreviewScene(inclineScene, {
      kind: "incline",
      position: { x: 4, y: -2 },
      isValid: true,
      sourceInclineId: incline.id,
    })!;

    expect(inclinePreview.pulleys[0].centre).toEqual({
      x: inclineApparatus.pulley.centre.x + 4,
      y: inclineApparatus.pulley.centre.y - 2,
    });
    const expectedInclinePositions = [
      inclineApparatus.particleA.initialPosition,
      inclineApparatus.particleB.initialPosition,
    ];
    inclinePreview.particles.forEach((particle, index) => {
      expect(particle.initialPosition.x).toBeCloseTo(
        expectedInclinePositions[index].x + 4,
        12,
      );
      expect(particle.initialPosition.y).toBeCloseTo(
        expectedInclinePositions[index].y - 2,
        12,
      );
    });
    expect(inclineScene.inclines[0].anchor).toEqual({ x: 0, y: 0 });
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

describe("connected Incline force contact", () => {
  it("uses the shared trajectory after the independent particle would leave the Incline", () => {
    const scene = createScene();
    const incline = createIncline("incline", { x: 0, y: 0 });
    const geometry = getInclineGeometry(incline);
    const lower = createParticle("lower", pointAtInclineCoordinate(incline, 2));
    const upper = createParticle("upper", pointAtInclineCoordinate(incline, 6));
    lower.initialInclineContact = { inclineId: incline.id, q: 2 };
    upper.initialInclineContact = { inclineId: incline.id, q: 6 };
    const force = createAppliedForce("up-slope");
    force.vector = {
      x: geometry.tangent.x * 20,
      y: geometry.tangent.y * 20,
    };
    upper.appliedForces.push(force);
    scene.inclines.push(incline);
    scene.particles.push(lower, upper);
    const connection = connectParticlesWithString(
      scene,
      "string",
      lower.id,
      upper.id,
    );
    if (!connection.ok) throw new Error(connection.message);

    const independent = calculateSurfaceTrajectory(upper, 1, {
      gravity: scene.settings.gravity,
      groundEnabled: scene.groundEnabled,
      groundHeight: scene.groundHeight,
      groundRough: scene.groundRough,
      groundFriction: scene.groundFriction,
      inclines: scene.inclines,
    });
    expect(independent.contact.kind).not.toBe("incline");

    const display = getParticleForceContactDisplay(scene, upper, 1);

    expect(display.incline?.id).toBe(incline.id);
    expect(typeof display.normalReaction).not.toBe("number");
    if (typeof display.normalReaction === "number") return;
    expect(display.normalReaction.vector.x).toBeCloseTo(
      geometry.normal.x * display.normalReaction.magnitude,
      12,
    );
    expect(display.normalReaction.vector.y).toBeCloseTo(
      geometry.normal.y * display.normalReaction.magnitude,
      12,
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

  it("shows a force name with its value beneath", () => {
    expect(formatForceHoverTooltip("Weight", "9.8", 9.8))
      .toBe("Weight\n9.8 N");
  });

  it("shows exact force magnitudes as three-decimal approximations", () => {
    expect(formatForceHoverTooltip("Resultant Force", "5√(2)", 5 * Math.sqrt(2)))
      .toBe("Resultant Force\n7.071 N (3 d.p.)");
  });

  it("suppresses cards while the pointer is over a particle", () => {
    expect(findCanvasExactValueHoverTarget(
      [target],
      { x: 30, y: 30 },
      [{ centre: { x: 30, y: 30 }, radius: 12 }],
    )).toBeNull();
    expect(findCanvasExactValueHoverTarget(
      [target],
      { x: 30, y: 30 },
      [{ centre: { x: 80, y: 80 }, radius: 12 }],
    )).toBe(target);
  });

  it("hit-tests the arrow shaft rather than its whole bounding rectangle", () => {
    const arrow = createForceArrowHoverTarget(
      { x: 0, y: 0 },
      { x: 100, y: 100 },
      6,
      "Weight\n9.8 N",
    );

    expect(findCanvasExactValueHoverTarget([arrow], { x: 50, y: 53 }))
      .toBe(arrow);
    expect(findCanvasExactValueHoverTarget([arrow], { x: 5, y: 95 }))
      .toBeNull();
  });
});
