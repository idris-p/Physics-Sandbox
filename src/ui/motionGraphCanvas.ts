import {
  getMotionGraphAnnotations,
  getMotionGraphDisplacement,
  getMotionGraphVelocity,
  type MotionGraphAnnotation,
  type MotionGraphData,
  type MotionGraphRange,
} from "../kinematics/motionGraphs";
import { formatWorkingValue } from "../kinematics/exactDisplay";

export type MotionGraphQuantity = "displacement" | "velocity";

export type MotionGraphRenderMode = "compact" | "expanded";

export type MotionGraphAnnotationPlacement =
  | "above"
  | "below"
  | "upper-left"
  | "upper-right"
  | "lower-left"
  | "lower-right"
  | "far-lower-left"
  | "far-lower-right"
  | "left"
  | "right";

export interface RenderedMotionGraphAnnotation {
  annotation: MotionGraphAnnotation;
  leftPercent: number;
  topPercent: number;
}

export const EXPANDED_MOTION_GRAPH_WIDTH = 1200;
export const EXPANDED_MOTION_GRAPH_HEIGHT = 560;

interface MotionGraphLayout {
  width: number;
  height: number;
  plot: { left: number; top: number; right: number; bottom: number };
  tickFontSize: number;
  axisFontSize: number;
  axisLineWidth: number;
  gridLineWidth: number;
  tickLength: number;
  tickGap: number;
  yTitleX: number;
  timeTitleOffset: number;
  curveWidth: number;
  pointRadius: number;
}

const COMPACT_LAYOUT: MotionGraphLayout = {
  width: 620,
  height: 250,
  plot: { left: 82, top: 18, right: 594, bottom: 202 },
  tickFontSize: 23,
  axisFontSize: 25,
  axisLineWidth: 3,
  gridLineWidth: 1.5,
  tickLength: 7,
  tickGap: 12,
  yTitleX: 22,
  timeTitleOffset: 39,
  curveWidth: 5,
  pointRadius: 4,
};

const EXPANDED_LAYOUT: MotionGraphLayout = {
  width: EXPANDED_MOTION_GRAPH_WIDTH,
  height: EXPANDED_MOTION_GRAPH_HEIGHT,
  plot: { left: 142, top: 38, right: 1150, bottom: 454 },
  tickFontSize: 31,
  axisFontSize: 36,
  axisLineWidth: 4,
  gridLineWidth: 2,
  tickLength: 10,
  tickGap: 17,
  yTitleX: 38,
  timeTitleOffset: 56,
  curveWidth: 7,
  pointRadius: 6,
};
const CURVE_COLOUR = "#c83f3f";
const AXIS_COLOUR = "#292d2c";
const TICK_COLOUR = "#777a76";
export const MOTION_GRAPH_GRID_COLOUR = "#deddd7";

export function renderMotionGraph(
  canvas: HTMLCanvasElement,
  graph: MotionGraphData,
  quantity: MotionGraphQuantity,
  mode: MotionGraphRenderMode = "compact",
): RenderedMotionGraphAnnotation[] {
  const layout = mode === "expanded" ? EXPANDED_LAYOUT : COMPACT_LAYOUT;
  canvas.width = layout.width;
  canvas.height = layout.height;
  const context = canvas.getContext("2d");
  if (!context) return [];
  context.setTransform(1, 0, 0, 1, 0, 0);

  const range = quantity === "displacement"
    ? graph.displacementRange
    : graph.velocityRange;
  context.clearRect(0, 0, layout.width, layout.height);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, layout.width, layout.height);
  drawAxes(
    context,
    graph.timeAxisMax,
    graph.timeTickInterval,
    range,
    quantity,
    layout,
  );
  drawCurve(context, graph, range, quantity, layout);
  if (mode === "expanded") {
    return drawGraphAnnotationMarkers(
      context,
      graph,
      range,
      quantity,
      layout,
    );
  }
  return [];
}

export function getMotionGraphDialogTitle(
  axis: "x" | "y",
  quantity: MotionGraphQuantity,
): string {
  const component = axis === "y" ? "Vertical" : "Horizontal";
  const graphName = quantity === "displacement"
    ? "Displacement–time"
    : "Velocity–time";
  return `${component} ${graphName} Graph`;
}

function drawAxes(
  context: CanvasRenderingContext2D,
  timeAxisMax: number,
  timeTickInterval: number,
  range: MotionGraphRange,
  quantity: MotionGraphQuantity,
  layout: MotionGraphLayout,
): void {
  const { plot } = layout;
  const zeroY = valueToY(0, range, plot);
  context.save();
  drawGridlines(
    context,
    timeAxisMax,
    timeTickInterval,
    range,
    layout,
  );
  context.strokeStyle = AXIS_COLOUR;
  context.fillStyle = AXIS_COLOUR;
  context.lineWidth = layout.axisLineWidth;
  context.lineCap = "round";
  context.beginPath();
  context.moveTo(plot.left, plot.top);
  context.lineTo(plot.left, plot.bottom);
  context.moveTo(plot.left, zeroY);
  context.lineTo(plot.right, zeroY);
  context.stroke();

  context.font = `700 ${layout.tickFontSize}px "KG Primary Penmanship Alt", sans-serif`;
  context.textBaseline = "middle";
  context.textAlign = "right";
  for (const value of createTickValues(range)) {
    const y = valueToY(value, range, plot);
    context.strokeStyle = TICK_COLOUR;
    context.lineWidth = layout.gridLineWidth;
    context.beginPath();
    context.moveTo(plot.left - layout.tickLength, y);
    context.lineTo(plot.left, y);
    context.stroke();
    context.fillText(formatGraphNumber(value), plot.left - layout.tickGap, y);
  }

  context.textAlign = "center";
  context.textBaseline = "top";
  for (const time of createTimeTickValues(timeAxisMax, timeTickInterval)) {
    const x = plot.left + (plot.right - plot.left) * time / timeAxisMax;
    context.strokeStyle = TICK_COLOUR;
    context.lineWidth = layout.gridLineWidth;
    context.beginPath();
    context.moveTo(x, zeroY);
    context.lineTo(x, zeroY + layout.tickLength);
    context.stroke();
    if (shouldLabelTimeTick(time)) {
      context.fillText(
        formatGraphNumber(time),
        x,
        zeroY + layout.tickGap,
      );
    }
  }

  context.font = `italic 700 ${layout.axisFontSize}px "KG Primary Penmanship Alt", sans-serif`;
  context.textAlign = "right";
  context.fillText(
    "t / s",
    plot.right,
    Math.min(
      layout.height - layout.axisFontSize - 6,
      zeroY + layout.timeTitleOffset,
    ),
  );
  context.save();
  context.translate(
    layout.yTitleX,
    plot.top + (plot.bottom - plot.top) / 2,
  );
  context.rotate(-Math.PI / 2);
  context.textAlign = "center";
  context.textBaseline = "top";
  context.fillText(
    quantity === "displacement" ? "s / m" : "v / m s⁻¹",
    0,
    0,
  );
  context.restore();
  context.restore();
}

function drawGridlines(
  context: CanvasRenderingContext2D,
  timeAxisMax: number,
  timeTickInterval: number,
  range: MotionGraphRange,
  layout: MotionGraphLayout,
): void {
  const { plot } = layout;
  context.save();
  context.strokeStyle = MOTION_GRAPH_GRID_COLOUR;
  context.lineWidth = layout.gridLineWidth;
  context.setLineDash([]);
  context.beginPath();

  for (const value of createTickValues(range)) {
    const y = valueToY(value, range, plot);
    context.moveTo(plot.left, y);
    context.lineTo(plot.right, y);
  }
  for (const time of createTimeTickValues(timeAxisMax, timeTickInterval)) {
    const x = plot.left + (plot.right - plot.left) * time / timeAxisMax;
    context.moveTo(x, plot.top);
    context.lineTo(x, plot.bottom);
  }
  context.stroke();
  context.restore();
}

function drawCurve(
  context: CanvasRenderingContext2D,
  graph: MotionGraphData,
  range: MotionGraphRange,
  quantity: MotionGraphQuantity,
  layout: MotionGraphLayout,
): void {
  const { plot } = layout;
  const sampleCount = Math.max(
    1,
    Math.ceil(180 * graph.elapsed / graph.duration),
  );
  const valueAt = quantity === "displacement"
    ? getMotionGraphDisplacement
    : getMotionGraphVelocity;

  context.save();
  context.beginPath();
  context.rect(
    plot.left,
    plot.top,
    plot.right - plot.left,
    plot.bottom - plot.top,
  );
  context.clip();
  context.strokeStyle = CURVE_COLOUR;
  context.fillStyle = CURVE_COLOUR;
  context.lineWidth = layout.curveWidth;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  for (let index = 0; index <= sampleCount; index += 1) {
    const time = graph.elapsed * index / sampleCount;
    const x = timeToX(time, graph.timeAxisMax, plot);
    const y = valueToY(valueAt(graph, time), range, plot);
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.stroke();

  if (graph.elapsed === 0) {
    context.beginPath();
    context.arc(
      timeToX(0, graph.timeAxisMax, plot),
      valueToY(valueAt(graph, 0), range, plot),
      layout.pointRadius,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
  context.restore();
}

function drawGraphAnnotationMarkers(
  context: CanvasRenderingContext2D,
  graph: MotionGraphData,
  range: MotionGraphRange,
  quantity: MotionGraphQuantity,
  layout: MotionGraphLayout,
): RenderedMotionGraphAnnotation[] {
  const { plot } = layout;
  const annotations = getMotionGraphAnnotations(graph, quantity).filter(
    (annotation) => annotation.time <= graph.elapsed + 1e-10,
  );

  context.save();
  context.lineWidth = 4;
  const rendered: RenderedMotionGraphAnnotation[] = [];

  for (const annotation of annotations) {
    const x = timeToX(annotation.time, graph.timeAxisMax, plot);
    const y = valueToY(annotation.value, range, plot);
    context.beginPath();
    context.arc(x, y, layout.pointRadius + 2, 0, Math.PI * 2);
    context.fillStyle = "#ffffff";
    context.fill();
    context.strokeStyle = CURVE_COLOUR;
    context.stroke();
    rendered.push({
      annotation,
      leftPercent: x / layout.width * 100,
      topPercent: y / layout.height * 100,
    });
  }
  context.restore();
  return rendered;
}

export function getMotionGraphAnnotationLabel(
  annotation: MotionGraphAnnotation,
): string {
  if (annotation.kind === "turning-point") {
    return `(${formatWorkingValue(annotation.timeDisplay)}, ${formatWorkingValue(annotation.valueDisplay)})`;
  }
  if (Math.abs(annotation.value) < 1e-10) {
    return formatWorkingValue(annotation.timeDisplay);
  }
  return formatWorkingValue(annotation.valueDisplay);
}

export function chooseMotionGraphAnnotationPlacement(
  annotation: MotionGraphAnnotation,
  graph: MotionGraphData,
  quantity: MotionGraphQuantity,
  labelWidth: number,
  labelHeight: number,
): MotionGraphAnnotationPlacement {
  const range = quantity === "displacement"
    ? graph.displacementRange
    : graph.velocityRange;
  const pointX = timeToX(
    annotation.time,
    graph.timeAxisMax,
    EXPANDED_LAYOUT.plot,
  );
  const pointY = valueToY(annotation.value, range, EXPANDED_LAYOUT.plot);
  const candidates = getPreferredAnnotationPlacements(
    annotation,
    graph,
    quantity,
  );
  let best = candidates[0];
  let bestScore = Number.POSITIVE_INFINITY;
  for (const [index, placement] of candidates.entries()) {
    const rectangle = getPlacedLabelRectangle(
      pointX,
      pointY,
      labelWidth,
      labelHeight,
      placement,
    );
    const score = scoreAnnotationRectangle(
      rectangle,
      graph,
      range,
      quantity,
    ) + index;
    if (score < bestScore) {
      best = placement;
      bestScore = score;
    }
  }
  return best;
}

interface GraphRectangle {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function getPreferredAnnotationPlacements(
  annotation: MotionGraphAnnotation,
  graph: MotionGraphData,
  quantity: MotionGraphQuantity,
): MotionGraphAnnotationPlacement[] {
  const slope = quantity === "displacement"
    ? graph.initialVelocity + graph.acceleration * annotation.time
    : graph.acceleration;
  if (annotation.kind === "turning-point") {
    return graph.acceleration < 0
      ? ["above", "upper-right", "upper-left", "right", "left", "below", "lower-right", "lower-left"]
      : ["below", "lower-right", "lower-left", "right", "left", "above", "upper-right", "upper-left"];
  }
  if (Math.abs(annotation.time) < 1e-10) {
    return slope < 0
      ? ["upper-right", "right", "above", "lower-right", "below", "upper-left", "left", "lower-left"]
      : ["lower-right", "right", "below", "upper-right", "above", "lower-left", "left", "upper-left"];
  }
  return slope < 0
    ? ["upper-right", "lower-left", "far-lower-left", "right", "above", "below", "left", "upper-left", "lower-right", "far-lower-right"]
    : ["upper-left", "lower-right", "far-lower-right", "left", "above", "below", "right", "upper-right", "lower-left", "far-lower-left"];
}

function getPlacedLabelRectangle(
  pointX: number,
  pointY: number,
  width: number,
  height: number,
  placement: MotionGraphAnnotationPlacement,
): GraphRectangle {
  const gap = 14;
  switch (placement) {
    case "above":
      return rectangle(pointX - width / 2, pointY - gap - height, width, height);
    case "below":
      return rectangle(pointX - width / 2, pointY + gap, width, height);
    case "upper-left":
      return rectangle(pointX - gap - width, pointY - gap - height, width, height);
    case "upper-right":
      return rectangle(pointX + gap, pointY - gap - height, width, height);
    case "lower-left":
      return rectangle(pointX - gap - width, pointY + gap, width, height);
    case "lower-right":
      return rectangle(pointX + gap, pointY + gap, width, height);
    case "far-lower-left":
      return rectangle(pointX - gap - width, pointY + 58, width, height);
    case "far-lower-right":
      return rectangle(pointX + gap, pointY + 58, width, height);
    case "left":
      return rectangle(pointX - gap - width, pointY - height / 2, width, height);
    case "right":
      return rectangle(pointX + gap, pointY - height / 2, width, height);
  }
}

function scoreAnnotationRectangle(
  label: GraphRectangle,
  graph: MotionGraphData,
  range: MotionGraphRange,
  quantity: MotionGraphQuantity,
): number {
  const inset = 5;
  let score = Math.max(0, inset - label.left) * 1_000_000 +
    Math.max(0, inset - label.top) * 1_000_000 +
    Math.max(0, label.right - EXPANDED_LAYOUT.width + inset) * 1_000_000 +
    Math.max(0, label.bottom - EXPANDED_LAYOUT.height + inset) * 1_000_000;

  for (const forbidden of getAxisLabelRectangles(graph, range)) {
    if (rectanglesOverlap(label, forbidden)) score += 100_000_000;
  }

  const expandedLabel = {
    left: label.left - 7,
    top: label.top - 7,
    right: label.right + 7,
    bottom: label.bottom + 7,
  };
  const valueAt = quantity === "displacement"
    ? getMotionGraphDisplacement
    : getMotionGraphVelocity;
  const sampleCount = Math.max(80, Math.ceil(graph.elapsed * 160));
  let overlapsCurve = false;
  for (let index = 0; index <= sampleCount; index += 1) {
    const time = graph.elapsed * index / sampleCount;
    const x = timeToX(time, graph.timeAxisMax, EXPANDED_LAYOUT.plot);
    const y = valueToY(valueAt(graph, time), range, EXPANDED_LAYOUT.plot);
    if (pointInRectangle(x, y, expandedLabel)) {
      overlapsCurve = true;
      break;
    }
  }
  if (overlapsCurve) score += 100_000_000;
  return score;
}

function getAxisLabelRectangles(
  graph: MotionGraphData,
  range: MotionGraphRange,
): GraphRectangle[] {
  const { plot } = EXPANDED_LAYOUT;
  const zeroY = valueToY(0, range, plot);
  const rectangles: GraphRectangle[] = [
    rectangle(plot.left - 5, plot.top, 10, plot.bottom - plot.top),
    rectangle(plot.left, zeroY - 5, plot.right - plot.left, 10),
  ];
  for (const value of createTickValues(range)) {
    rectangles.push(rectangle(
      0,
      valueToY(value, range, plot) - 19,
      plot.left - 11,
      38,
    ));
  }
  for (const time of createTimeTickValues(
    graph.timeAxisMax,
    graph.timeTickInterval,
  )) {
    if (!shouldLabelTimeTick(time)) continue;
    const x = timeToX(time, graph.timeAxisMax, plot);
    const width = Math.max(32, formatGraphNumber(time).length * 18);
    rectangles.push(rectangle(x - width / 2, zeroY + 9, width, 43));
  }
  return rectangles;
}

function rectangle(
  left: number,
  top: number,
  width: number,
  height: number,
): GraphRectangle {
  return { left, top, right: left + width, bottom: top + height };
}

function rectanglesOverlap(left: GraphRectangle, right: GraphRectangle): boolean {
  return left.left < right.right && left.right > right.left &&
    left.top < right.bottom && left.bottom > right.top;
}

function pointInRectangle(
  x: number,
  y: number,
  target: GraphRectangle,
): boolean {
  return x >= target.left && x <= target.right &&
    y >= target.top && y <= target.bottom;
}

function timeToX(
  time: number,
  duration: number,
  plot: MotionGraphLayout["plot"],
): number {
  return plot.left + (time / duration) * (plot.right - plot.left);
}

function valueToY(
  value: number,
  range: MotionGraphRange,
  plot: MotionGraphLayout["plot"],
): number {
  const proportion = (value - range.min) / (range.max - range.min);
  return plot.bottom - proportion * (plot.bottom - plot.top);
}

export function shouldLabelTimeTick(time: number): boolean {
  return Math.abs(time) >= 1e-12;
}

export function createTickValues(range: MotionGraphRange): number[] {
  const ticks: number[] = [];
  const count = Math.round((range.max - range.min) / range.tickInterval);
  for (let index = 0; index <= count; index += 1) {
    ticks.push(normaliseTick(range.min + index * range.tickInterval));
  }
  return ticks;
}

export function createTimeTickValues(
  timeAxisMax: number,
  tickInterval: number,
): number[] {
  const ticks: number[] = [];
  const count = Math.round(timeAxisMax / tickInterval);
  for (let index = 0; index <= count; index += 1) {
    ticks.push(normaliseTick(index * tickInterval));
  }
  return ticks;
}

function normaliseTick(value: number): number {
  return Math.abs(value) < 1e-12 ? 0 : Number(value.toPrecision(12));
}

export function formatGraphNumber(value: number): string {
  if (Math.abs(value) < 1e-10) return "0";
  const magnitude = Math.abs(value);
  if (magnitude >= 1000 || magnitude < 0.01) return value.toExponential(1);
  return String(Number(value.toPrecision(3)));
}
