import type { ParticleState } from "../model/Particle";
import type { Scene } from "../model/Scene";
import { createIncline, type Incline } from "../model/Incline";
import type { ScreenPoint, Vec2 } from "../math/Vec2";
import {
  calculateGreatestHeightHorizontalGeometry,
  type GreatestHeightMeasurement,
} from "./greatestHeightAnnotation";
import { worldToScreen, type Camera } from "./camera";
import { renderGrid } from "./grid";
import {
  getInitialVelocityAnnotation,
  calculateInitialVelocityTextSize,
  isNarrowInitialVelocityAngle,
  INITIAL_VELOCITY_ANGLE_ARC_RADIUS_METRES,
  INITIAL_VELOCITY_ARROW_LENGTH_METRES,
  INITIAL_VELOCITY_COLOUR,
  type AngleInitialVelocityAnnotation,
  type ComponentInitialVelocityAnnotation,
  type SpeedInitialVelocityAnnotation,
} from "./initialVelocityAnnotation";
import {
  groupParticlesByPosition,
  getRenderedParticleGeometry,
  getRenderedParticleShapeGeometry,
} from "./particleGeometry";
import {
  getSelectionWhiteMix,
  MAXIMUM_SELECTION_WHITE_MIX,
  mixColourWithWhite,
} from "./selectionPulse";
import { tokenizeMathText, type MathToken } from "../ui/mathMarkup";
import {
  getExactValueTooltip,
  isSymbolicExactDisplay,
} from "../ui/exactValueTooltip";
import {
  FORCE_ARROW_LENGTH_METRES,
  FORCE_ARROW_LINE_DASH,
  RESULTANT_FORCE_COLOUR,
  calculateForceArrowOrigins,
  calculateForceLabelPosition,
  getForceAnnotations,
  isZeroResultantForce,
  type AngleForceAnnotation,
  type ComponentForceAnnotation,
} from "./forceAnnotation";
import { createInclineNormalReactionDisplay } from "../dynamics/inclineForceDisplay";
import type { NormalReactionDisplayInput } from "../dynamics/forceDisplay";
import type { FrictionDisplayInput } from "../dynamics/forceDisplay";
import { createFrictionDisplay } from "../dynamics/frictionDisplay";
import {
  getInclineGeometry,
  isPointOnInclineSegment,
} from "../geometry/inclineGeometry";
import type { PlacementPreview } from "./placementPreview";
import { getStringRenderSegment } from "./stringGeometry";
import type { TensionDisplayInput } from "../dynamics/forceDisplay";
import { calculateConnectedSystemTrajectory } from "../physics/connectedTrajectory";
import { calculateSurfaceTrajectory } from "../physics/surfaceTrajectory";
import { calculateInclineWeightComponentVectors } from "./inclineWeightComponents";
import {
  calculateInclineLengthControlGeometry,
  type InclineLengthControlGeometry,
} from "./inclineLengthControl";

export interface CanvasExactValueHoverTarget {
  left: number;
  top: number;
  right: number;
  bottom: number;
  tooltip: string;
  segment?: {
    start: Vec2;
    end: Vec2;
    radius: number;
  };
}

export interface CanvasTooltipExclusion {
  centre: Vec2;
  radius: number;
}

interface CanvasAnnotationBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface CanvasMathLabel {
  text: string;
  position: Vec2;
  fontSize: number;
  colour: string;
}

export interface CanvasRenderResult {
  hoverTargets: CanvasExactValueHoverTarget[];
  mathLabels: CanvasMathLabel[];
  tooltipExclusions?: CanvasTooltipExclusion[];
}

export interface StringConnectionPreview {
  sourceParticleId: string;
  pointer: Vec2;
  validTargetIds: readonly string[];
}

export function render(
  context: CanvasRenderingContext2D,
  scene: Scene,
  particleStates: ParticleState[],
  selectedParticleId: string | null,
  groundSelected: boolean,
  selectedInclineId: string | null,
  camera: Camera,
  currentTime: number,
  animationTimestamp: number,
  heightMeasurements: GreatestHeightMeasurement[],
  placementPreview: PlacementPreview | null = null,
  selectedStringId: string | null = null,
  stringConnectionPreview: StringConnectionPreview | null = null,
): CanvasRenderResult {
  context.clearRect(0, 0, camera.viewportWidth, camera.viewportHeight);
  context.fillStyle = "#f8f7f1";
  context.fillRect(0, 0, camera.viewportWidth, camera.viewportHeight);

  renderGrid(context, camera);

  const selectionWhiteMix = getSelectionWhiteMix(animationTimestamp);

  if (scene.groundEnabled) {
    renderGround(
      context,
      camera,
      scene.groundHeight,
      scene.groundRough,
      groundSelected ? selectionWhiteMix : 0,
    );
  }

  const replacedInclineId = placementPreview?.kind === "incline"
    ? placementPreview.sourceInclineId
    : undefined;
  for (const incline of scene.inclines) {
    if (incline.id === replacedInclineId) continue;
    renderIncline(
      context,
      incline,
      camera,
      incline.id === selectedInclineId ? selectionWhiteMix : 0,
    );
  }
  if (placementPreview?.kind === "incline") {
    renderPlacementPreview(context, placementPreview, camera, scene.inclines);
  }

  const displayedParticleStates = translateInclineContactParticleStates(
    scene,
    particleStates,
    placementPreview,
  );
  const particleGroups = groupParticlesByPosition(displayedParticleStates);
  const hoveredStringTargetId = stringConnectionPreview
    ? getHoveredStringTargetId(
        stringConnectionPreview,
        displayedParticleStates,
        camera,
      )
    : null;
  const invalidStringTargetId = hoveredStringTargetId &&
      stringConnectionPreview &&
      !stringConnectionPreview.validTargetIds.includes(hoveredStringTargetId)
    ? hoveredStringTargetId
    : null;

  renderStrings(
    context,
    scene,
    displayedParticleStates,
    camera,
    selectedStringId,
    selectionWhiteMix,
  );
  if (stringConnectionPreview) {
    renderStringConnectionPreview(
      context,
      displayedParticleStates,
      camera,
      stringConnectionPreview,
    );
  }

  const forceAnnotationResult = shouldRenderForceAnnotations(scene)
    ? renderForceAnnotations(
        context,
        scene,
        displayedParticleStates,
        camera,
        currentTime,
        selectedParticleId,
        selectedStringId,
        selectionWhiteMix,
      )
    : { hoverTargets: [], mathLabels: [] };
  const exactValueHoverTargets = forceAnnotationResult.hoverTargets;

  if (currentTime === 0) {
    renderInitialVelocityAnnotations(
      context,
      scene,
      displayedParticleStates,
      camera,
    );
  }

  exactValueHoverTargets.push(...renderHeightMeasurements(
    context,
    heightMeasurements,
    camera,
  ));

  for (const coincidentParticles of particleGroups) {
    const particle = coincidentParticles[coincidentParticles.length - 1];
    const particleModel = scene.particles.find(
      (candidate) => candidate.id === particle.id,
    );
    const activeIncline = particleModel?.shape === "square"
      ? getParticleForceContactDisplay(scene, particleModel, currentTime).incline
      : null;
    const hoveredAsStringTarget = coincidentParticles.some(
      (candidate) => candidate.id === hoveredStringTargetId,
    );
    const invalidAsStringTarget = coincidentParticles.some(
      (candidate) => candidate.id === invalidStringTargetId,
    );
    renderParticle(
      context,
      particle,
      coincidentParticles.length,
      camera,
      hoveredAsStringTarget && !invalidAsStringTarget
        ? MAXIMUM_SELECTION_WHITE_MIX
        : coincidentParticles.some(
            (candidate) => candidate.id === selectedParticleId,
          )
          ? selectionWhiteMix
          : 0,
      particleModel?.shape ?? "circle",
      activeIncline,
      invalidAsStringTarget,
    );
  }
  if (placementPreview?.kind === "particle") {
    renderPlacementPreview(context, placementPreview, camera, scene.inclines);
  }

  if (shouldRenderForceAnnotations(scene)) {
    renderZeroResultantMarkers(
      context,
      scene,
      displayedParticleStates,
      camera,
      currentTime,
    );
  }

  const selectedIncline = scene.inclines.find(
    (incline) => incline.id === selectedInclineId,
  );
  if (selectedIncline) {
    const displayedIncline = placementPreview?.kind === "incline" &&
        placementPreview.sourceInclineId === selectedIncline.id
      ? { ...selectedIncline, anchor: { ...placementPreview.position } }
      : selectedIncline;
    renderInclineLengthControl(context, displayedIncline, camera);
  }

  return {
    hoverTargets: exactValueHoverTargets,
    mathLabels: forceAnnotationResult.mathLabels,
    tooltipExclusions: displayedParticleStates.map((particle) => {
      const geometry = getRenderedParticleGeometry(
        worldToScreen(particle.position, camera),
        camera,
      );
      return { centre: geometry.centre, radius: geometry.radius };
    }),
  };
}

function renderStrings(
  context: CanvasRenderingContext2D,
  scene: Scene,
  particleStates: readonly ParticleState[],
  camera: Camera,
  selectedStringId: string | null,
  selectionWhiteMix: number,
): void {
  for (const string of scene.strings) {
    const segment = getStringRenderSegment(scene, string, particleStates, camera);
    if (!segment) continue;
    context.save();
    context.strokeStyle = getStringStrokeColour(
      string.id,
      selectedStringId,
      selectionWhiteMix,
    );
    context.lineWidth = Math.max(2, Math.min(3.5, camera.pixelsPerMetre * 0.08));
    context.lineCap = "round";
    context.beginPath();
    const [firstPoint, ...remainingPoints] = segment.visualPoints;
    if (!firstPoint) {
      context.restore();
      continue;
    }
    context.moveTo(firstPoint.x, firstPoint.y);
    for (const point of remainingPoints) context.lineTo(point.x, point.y);
    context.stroke();
    context.restore();
  }
}

function renderStringConnectionPreview(
  context: CanvasRenderingContext2D,
  particleStates: readonly ParticleState[],
  camera: Camera,
  preview: StringConnectionPreview,
): void {
  const source = particleStates.find(
    (particle) => particle.id === preview.sourceParticleId,
  );
  if (!source) return;
  const sourcePoint = worldToScreen(source.position, camera);
  const pointer = worldToScreen(preview.pointer, camera);
  context.save();
  context.strokeStyle = STRING_COLOUR;
  context.lineWidth = 2;
  context.setLineDash([7, 6]);
  context.beginPath();
  context.moveTo(sourcePoint.x, sourcePoint.y);
  context.lineTo(pointer.x, pointer.y);
  context.stroke();
  context.restore();
}

export function getHoveredStringTargetId(
  preview: StringConnectionPreview,
  particleStates: readonly ParticleState[],
  camera: Camera,
): string | null {
  const pointer = worldToScreen(preview.pointer, camera);
  for (let index = particleStates.length - 1; index >= 0; index -= 1) {
    const particle = particleStates[index];
    const point = worldToScreen(particle.position, camera);
    const { centre, radius } = getRenderedParticleGeometry(point, camera);
    if (Math.hypot(pointer.x - centre.x, pointer.y - centre.y) <= radius + 4) {
      return particle.id;
    }
  }
  return null;
}

function mixColour(from: string, to: string, amount: number): string {
  const safeAmount = Math.max(0, Math.min(1, amount));
  const parse = (colour: string): [number, number, number] => [
    Number.parseInt(colour.slice(1, 3), 16),
    Number.parseInt(colour.slice(3, 5), 16),
    Number.parseInt(colour.slice(5, 7), 16),
  ];
  const start = parse(from);
  const end = parse(to);
  return `rgb(${start.map((value, index) =>
    Math.round(value + (end[index] - value) * safeAmount)
  ).join(", ")})`;
}

const INCLINE_LENGTH_CONTROL_FILL = "#f2d45c";
const INCLINE_LENGTH_CONTROL_STROKE = "#292d2c";

function renderInclineLengthControl(
  context: CanvasRenderingContext2D,
  incline: Incline,
  camera: Camera,
): void {
  const geometry = calculateInclineLengthControlGeometry(incline, camera);
  context.save();
  context.fillStyle = INCLINE_LENGTH_CONTROL_FILL;
  context.strokeStyle = INCLINE_LENGTH_CONTROL_STROKE;
  context.lineWidth = Math.max(2, geometry.cellSize * 0.07);
  context.lineJoin = "round";

  if (geometry.canDecrease) {
    drawInclineLengthArrow(context, geometry, "decrease");
  }
  drawInclineLengthArrow(context, geometry, "increase");

  context.beginPath();
  context.arc(
    geometry.corner.x,
    geometry.corner.y,
    geometry.outerRadius,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.stroke();
  context.beginPath();
  context.arc(
    geometry.corner.x,
    geometry.corner.y,
    geometry.innerRadius,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.stroke();
  context.restore();
}

function drawInclineLengthArrow(
  context: CanvasRenderingContext2D,
  geometry: InclineLengthControlGeometry,
  direction: "decrease" | "increase",
): void {
  const centre = direction === "decrease"
    ? geometry.decreaseCentre
    : geometry.increaseCentre;
  const sign = direction === "decrease" ? -1 : 1;
  const length = geometry.cellSize * 0.58;
  const tipX = centre.x + sign * length / 2;
  const tailX = centre.x - sign * length / 2;
  const headLength = length * 0.39;
  const headHalfHeight = length * 0.39;
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(tailX, centre.y);
  context.lineTo(tipX, centre.y);
  context.moveTo(tipX - sign * headLength, centre.y - headHalfHeight);
  context.lineTo(tipX, centre.y);
  context.lineTo(tipX - sign * headLength, centre.y + headHalfHeight);
  context.strokeStyle = INCLINE_LENGTH_CONTROL_STROKE;
  context.lineWidth = Math.max(5, geometry.cellSize * 0.24);
  context.stroke();
  context.strokeStyle = INCLINE_LENGTH_CONTROL_FILL;
  context.lineWidth = Math.max(2, geometry.cellSize * 0.1);
  context.stroke();
  context.restore();
}

export function translateInclineContactParticleStates(
  scene: Scene,
  particleStates: readonly ParticleState[],
  placementPreview: PlacementPreview | null,
): ParticleState[] {
  if (
    placementPreview?.kind !== "incline" ||
    !placementPreview.sourceInclineId
  ) {
    return [...particleStates];
  }

  const sourceIncline = scene.inclines.find(
    (incline) => incline.id === placementPreview.sourceInclineId,
  );
  if (!sourceIncline) return [...particleStates];

  const offset = {
    x: placementPreview.position.x - sourceIncline.anchor.x,
    y: placementPreview.position.y - sourceIncline.anchor.y,
  };
  const associatedParticleIds = new Set(
    scene.particles
      .filter(
        (particle) =>
          particle.initialInclineContact?.inclineId === sourceIncline.id,
      )
      .map((particle) => particle.id),
  );

  return particleStates.map((particleState) => {
    const isCurrentlyOnIncline = associatedParticleIds.has(particleState.id) &&
      isPointOnInclineSegment(particleState.position, sourceIncline, 1e-7);
    if (!isCurrentlyOnIncline) return particleState;
    return {
      ...particleState,
      position: {
        x: particleState.position.x + offset.x,
        y: particleState.position.y + offset.y,
      },
    };
  });
}

export const PLACEMENT_PREVIEW_OPACITY = 0.42;

function renderPlacementPreview(
  context: CanvasRenderingContext2D,
  preview: PlacementPreview,
  camera: Camera,
  inclines: readonly Incline[],
): void {
  context.save();
  context.globalAlpha = preview.kind === "incline" && preview.sourceInclineId
    ? 1
    : PLACEMENT_PREVIEW_OPACITY;
  if (preview.kind === "particle") {
    renderParticle(
      context,
      {
        id: "placement-preview",
        position: preview.position,
        velocity: { x: 0, y: 0 },
        acceleration: { x: 0, y: 0 },
      },
      1,
      camera,
      0,
    );
  } else {
    const sourceIncline = preview.sourceInclineId
      ? inclines.find((incline) => incline.id === preview.sourceInclineId)
      : undefined;
    renderIncline(
      context,
      sourceIncline
        ? { ...sourceIncline, anchor: { ...preview.position } }
        : createIncline("placement-preview", preview.position),
      camera,
      0,
      !preview.isValid,
    );
  }
  context.restore();
}

function renderIncline(
  context: CanvasRenderingContext2D,
  incline: Incline,
  camera: Camera,
  whiteMix: number,
  invalidPlacement = false,
): void {
  const geometry = getInclineGeometry(incline);
  const lower = worldToScreen(geometry.lowerEndpoint, camera);
  const upper = worldToScreen(geometry.upperEndpoint, camera);
  const baseUpper = worldToScreen(
    { x: geometry.upperEndpoint.x, y: geometry.lowerEndpoint.y },
    camera,
  );
  context.save();
  const fillColour = invalidPlacement ? "#e5aaa5" : "#cbc8c0";
  const strokeColour = invalidPlacement ? "#a62d26" : "#292d2c";
  context.fillStyle = mixColourWithWhite(fillColour, whiteMix);
  context.strokeStyle = mixColourWithWhite(strokeColour, whiteMix);
  context.lineWidth = 3;
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(lower.x, lower.y);
  context.lineTo(upper.x, upper.y);
  context.lineTo(baseUpper.x, baseUpper.y);
  context.closePath();
  context.fill();

  if (incline.roughness.kind === "rough") {
    context.save();
    context.clip();
    context.strokeStyle = mixColourWithWhite(
      invalidPlacement ? "#c86860" : "#aaa69d",
      whiteMix,
    );
    context.lineWidth = 3;
    context.beginPath();
    for (const segment of calculateInclineRoughLineSegments(
      lower,
      upper,
      baseUpper,
    )) {
      context.moveTo(segment.start.x, segment.start.y);
      context.lineTo(segment.end.x, segment.end.y);
    }
    context.stroke();
    context.restore();
  }

  context.strokeStyle = mixColourWithWhite(strokeColour, whiteMix);
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(lower.x, lower.y);
  context.lineTo(upper.x, upper.y);
  context.lineTo(baseUpper.x, baseUpper.y);
  context.closePath();
  context.stroke();

  const angleText = `${incline.angleInput}°`;
  const fontSize = calculateInitialVelocityTextSize(camera.pixelsPerMetre);
  context.font = `700 ${fontSize}px "KG Primary Penmanship Alt", sans-serif`;
  const annotation = calculateInclineAngleAnnotationGeometry(
    lower,
    incline.direction,
    incline.angleDegrees,
    camera.pixelsPerMetre,
    context.measureText(angleText).width,
    incline.horizontalLength,
  );
  context.strokeStyle = strokeColour;
  context.lineWidth = camera.pixelsPerMetre * 0.055;
  context.beginPath();
  context.arc(
    lower.x,
    lower.y,
    annotation.arcRadius,
    annotation.startAngle,
    annotation.endAngle,
    annotation.anticlockwise,
  );
  context.stroke();
  context.fillStyle = strokeColour;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(
    angleText,
    annotation.labelPosition.x,
    annotation.labelPosition.y,
  );
  context.restore();
}

export interface InclineRoughLineSegment {
  start: Vec2;
  end: Vec2;
}

export function calculateInclineRoughLineSegments(
  lower: Vec2,
  upper: Vec2,
  baseUpper: Vec2,
  preferredSpacing = 32,
  lineLength = 18,
): InclineRoughLineSegment[] {
  const slope = { x: upper.x - lower.x, y: upper.y - lower.y };
  const slopeLength = Math.hypot(slope.x, slope.y);
  if (slopeLength <= 0) return [];

  const lineCount = Math.max(1, Math.floor(slopeLength / preferredSpacing));
  const slopeMidpoint = {
    x: (lower.x + upper.x) / 2,
    y: (lower.y + upper.y) / 2,
  };
  const centroid = {
    x: (lower.x + upper.x + baseUpper.x) / 3,
    y: (lower.y + upper.y + baseUpper.y) / 3,
  };
  const inward = {
    x: centroid.x - slopeMidpoint.x,
    y: centroid.y - slopeMidpoint.y,
  };
  const inwardMagnitude = Math.hypot(inward.x, inward.y);
  if (inwardMagnitude <= 0) return [];
  const inwardUnit = {
    x: inward.x / inwardMagnitude,
    y: inward.y / inwardMagnitude,
  };

  return Array.from({ length: lineCount }, (_, index) => {
    const progress = (index + 1) / (lineCount + 1);
    const start = {
      x: lower.x + slope.x * progress,
      y: lower.y + slope.y * progress,
    };
    return {
      start,
      end: {
        x: start.x + inwardUnit.x * lineLength,
        y: start.y + inwardUnit.y * lineLength,
      },
    };
  });
}

export interface InclineAngleAnnotationGeometry {
  arcRadius: number;
  startAngle: number;
  endAngle: number;
  anticlockwise: boolean;
  labelPosition: Vec2;
}

export const INCLINE_ANGLE_LABEL_RADIUS_RATIO = 0.76;

export function calculateInclineAngleAnnotationGeometry(
  lowerEndpoint: Vec2,
  direction: Incline["direction"],
  angleDegrees: number,
  pixelsPerMetre: number,
  labelWidth = 0,
  horizontalLengthMetres = 10,
): InclineAngleAnnotationGeometry {
  const startAngle = direction === "rises-right" ? 0 : Math.PI;
  const sweep = (direction === "rises-right" ? -1 : 1) *
    angleDegrees * Math.PI / 180;
  const endAngle = startAngle + sweep;
  const baseArcRadius =
    INITIAL_VELOCITY_ANGLE_ARC_RADIUS_METRES * pixelsPerMetre;
  const halfAngle = Math.abs(sweep) / 2;
  const halfLabelWithPadding = labelWidth / 2 + pixelsPerMetre * 0.12;
  const requiredLabelRadius = Math.tan(halfAngle) > 1e-12
    ? halfLabelWithPadding / Math.tan(halfAngle)
    : Number.POSITIVE_INFINITY;
  const requiredArcRadius =
    requiredLabelRadius / INCLINE_ANGLE_LABEL_RADIUS_RATIO;
  const maximumArcRadius = horizontalLengthMetres * pixelsPerMetre;
  const arcRadius = Math.min(
    maximumArcRadius,
    Math.max(baseArcRadius, requiredArcRadius),
  );
  const labelRadius = arcRadius * INCLINE_ANGLE_LABEL_RADIUS_RATIO;
  const labelAngle = startAngle + sweep / 2;
  const labelPosition = {
    x: lowerEndpoint.x + Math.cos(labelAngle) * labelRadius,
    y: lowerEndpoint.y + Math.sin(labelAngle) * labelRadius,
  };
  return {
    arcRadius,
    startAngle,
    endAngle,
    anticlockwise: sweep < 0,
    labelPosition,
  };
}

export function shouldRenderForceAnnotations(
  scene: Pick<Scene, "showForceArrows">,
): boolean {
  return scene.showForceArrows;
}

function renderForceAnnotations(
  context: CanvasRenderingContext2D,
  scene: Scene,
  particleStates: ParticleState[],
  camera: Camera,
  currentTime: number,
  selectedParticleId: string | null,
  selectedStringId: string | null,
  selectionWhiteMix: number,
): CanvasRenderResult {
  const hoverTargets: CanvasExactValueHoverTarget[] = [];
  const mathLabels: CanvasMathLabel[] = [];
  const particlesById = new Map(
    scene.particles.map((particle) => [particle.id, particle]),
  );
  for (const state of particleStates) {
    const particle = particlesById.get(state.id);
    if (!particle) continue;
    const contactDisplay = getParticleForceContactDisplay(
      scene,
      particle,
      currentTime,
    );
    const annotations = getForceAnnotations(
      particle,
      scene.settings,
      contactDisplay.normalReaction,
      contactDisplay.incline,
      contactDisplay.friction,
      contactDisplay.tension,
    );
    const point = worldToScreen(state.position, camera);
    const { centre, radius } = getRenderedParticleGeometry(point, camera);
    const standardAnnotations = annotations.filter(
      (annotation) => annotation.id !== "tension",
    );
    const screenDirections = standardAnnotations.map((annotation) => ({
      x: annotation.direction.x,
      y: -annotation.direction.y,
    }));
    const arrowOrigins = calculateForceArrowOrigins(
      screenDirections,
      centre,
      radius,
    );
    let standardAnnotationIndex = 0;
    annotations.forEach((annotation) => {
      if (annotation.id === "tension") {
        renderTensionArrowHead(
          context,
          scene,
          state.id,
          particleStates,
          camera,
          annotation.kind === "components" ? "" : annotation.magnitudeText,
          formatForceHoverTooltip(
            annotation.label,
            annotation.kind === "components" ? null : annotation.magnitudeText,
            annotation.magnitude,
          ),
          hoverTargets,
          mathLabels,
          selectedStringId,
          selectionWhiteMix,
        );
        return;
      }
      const origin = arrowOrigins[standardAnnotationIndex];
      standardAnnotationIndex += 1;
      const screenDirection = {
        x: annotation.direction.x,
        y: -annotation.direction.y,
      };
      const length = FORCE_ARROW_LENGTH_METRES * camera.pixelsPerMetre;
      const tip = {
        x: origin.x + screenDirection.x * length,
        y: origin.y + screenDirection.y * length,
      };
      const headLength = Math.max(8, Math.min(16, camera.pixelsPerMetre * 0.3));
      const headWidth = headLength * 0.65;
      const perpendicular = { x: -screenDirection.y, y: screenDirection.x };
      const base = {
        x: tip.x - screenDirection.x * headLength,
        y: tip.y - screenDirection.y * headLength,
      };

      if (
        shouldRenderInclineWeightComponents(
          annotation.id,
          particle.id,
          selectedParticleId,
          contactDisplay.incline !== null,
          particle.showResultantForce,
        ) &&
        contactDisplay.incline
      ) {
        renderInclineWeightComponents(
          context,
          origin,
          contactDisplay.incline,
          camera,
        );
      }

      context.save();
      context.strokeStyle = annotation.colour ?? "#292d2c";
      context.fillStyle = annotation.colour ?? "#292d2c";
      context.lineWidth = 3;
      context.lineCap = "round";
      context.setLineDash([...FORCE_ARROW_LINE_DASH]);
      context.beginPath();
      context.moveTo(origin.x, origin.y);
      context.lineTo(tip.x, tip.y);
      context.moveTo(base.x + perpendicular.x * headWidth, base.y + perpendicular.y * headWidth);
      context.lineTo(tip.x, tip.y);
      context.lineTo(base.x - perpendicular.x * headWidth, base.y - perpendicular.y * headWidth);
      context.stroke();

      const magnitudeText = annotation.kind === "components"
        ? null
        : annotation.magnitudeText;
      const forceTooltip = formatForceHoverTooltip(
        annotation.label,
        magnitudeText,
        annotation.magnitude,
      );
      hoverTargets.push(createForceArrowHoverTarget(
        origin,
        tip,
        Math.max(7, headWidth + 3),
        forceTooltip,
      ));

      const fontSize = Math.max(14, Math.min(21, camera.pixelsPerMetre * 0.42));
      context.font = `700 ${fontSize}px "KG Primary Penmanship Alt", sans-serif`;
      context.textBaseline = "middle";
      context.textAlign = "left";
      if (annotation.kind === "components") {
        const labelBounds = renderComponentVelocityNotation(
          context,
          origin,
          tip,
          screenDirection,
          annotation,
          fontSize,
          "N",
          annotation.componentValues,
          undefined,
          "after-tip",
        );
        hoverTargets.push({ ...labelBounds, tooltip: forceTooltip });
        context.restore();
        return;
      }
      if (annotation.kind === "angle") {
        renderAngleVelocityNotation(
          context,
          origin,
          tip,
          screenDirection,
          camera,
          annotation,
          fontSize,
          annotation.magnitudeText,
          "N",
          {
            magnitude: annotation.magnitude,
            angle: Math.abs(annotation.angleDegrees),
            hoverTargets,
          },
          false,
        );
        renderForceMagnitudeAtArrowTip(
          context,
          annotation.magnitudeText,
          tip,
          screenDirection,
          fontSize,
          hoverTargets,
          mathLabels,
          annotation.colour ?? "#292d2c",
          forceTooltip,
        );
        context.restore();
        return;
      }
      renderForceMagnitudeAtArrowTip(
        context,
        annotation.magnitudeText,
        tip,
        screenDirection,
        fontSize,
        hoverTargets,
        mathLabels,
        annotation.colour ?? "#292d2c",
        forceTooltip,
      );
      context.restore();
    });
  }
  return { hoverTargets, mathLabels };
}

function renderTensionArrowHead(
  context: CanvasRenderingContext2D,
  scene: Scene,
  particleId: string,
  particleStates: readonly ParticleState[],
  camera: Camera,
  magnitudeText: string,
  tooltip: string,
  hoverTargets: CanvasExactValueHoverTarget[],
  mathLabels: CanvasMathLabel[],
  selectedStringId: string | null,
  selectionWhiteMix: number,
): void {
  const string = scene.strings.find(
    (candidate) => candidate.particleAId === particleId ||
      candidate.particleBId === particleId,
  );
  if (!string) return;
  const segment = getStringRenderSegment(scene, string, particleStates, camera);
  if (!segment) return;
  const from = string.particleAId === particleId
    ? segment.visualStart
    : segment.visualEnd;
  const toward = string.particleAId === particleId
    ? segment.visualEnd
    : segment.visualStart;
  const geometry = calculateTensionArrowHeadGeometry(
    from,
    toward,
    camera.pixelsPerMetre,
    string.length,
  );
  if (!geometry) return;
  const colour = getStringStrokeColour(
    string.id,
    selectedStringId,
    selectionWhiteMix,
  );

  context.save();
  context.strokeStyle = colour;
  context.lineWidth = 3;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.beginPath();
  context.moveTo(geometry.firstWing.x, geometry.firstWing.y);
  context.lineTo(geometry.tip.x, geometry.tip.y);
  context.lineTo(geometry.secondWing.x, geometry.secondWing.y);
  context.stroke();
  context.restore();

  hoverTargets.push(createForceArrowHoverTarget(
    from,
    geometry.tip,
    Math.max(6, geometry.headWidth * 0.7),
    tooltip,
  ));
  const showMagnitude = !geometry.atMidpoint || string.particleAId === particleId;
  if (!showMagnitude) return;
  const fontSize = Math.max(14, Math.min(21, camera.pixelsPerMetre * 0.42));
  context.save();
  context.font = `700 ${fontSize}px "KG Primary Penmanship Alt", sans-serif`;
  context.textBaseline = "middle";
  context.textAlign = "left";
  const labelText = `${magnitudeText} N`;
  const labelWidth = context.measureText(labelText).width;
  const labelPosition = calculateTensionMagnitudeLabelPosition(
    geometry,
    labelWidth,
    fontSize,
  );
  mathLabels.push({
    text: labelText,
    position: labelPosition,
    fontSize,
    colour,
  });
  hoverTargets.push({
    left: labelPosition.x - 4,
    top: labelPosition.y - fontSize,
    right: labelPosition.x + labelWidth + 4,
    bottom: labelPosition.y + fontSize,
    tooltip,
  });
  context.restore();
}

export interface TensionArrowHeadGeometry {
  tip: ScreenPoint;
  firstWing: ScreenPoint;
  secondWing: ScreenPoint;
  headWidth: number;
  direction: ScreenPoint;
  atMidpoint: boolean;
}

export function calculateTensionArrowHeadGeometry(
  from: ScreenPoint,
  toward: ScreenPoint,
  pixelsPerMetre: number,
  stringLengthMetres: number,
): TensionArrowHeadGeometry | null {
  const difference = { x: toward.x - from.x, y: toward.y - from.y };
  const lineLength = Math.hypot(difference.x, difference.y);
  if (lineLength <= 1e-9) return null;
  const direction = {
    x: difference.x / lineLength,
    y: difference.y / lineLength,
  };
  const headLength = Math.max(8, Math.min(16, pixelsPerMetre * 0.3));
  const headWidth = headLength * 0.65;
  const threeMetresInPixels = 3 * Math.max(0, pixelsPerMetre);
  const atMidpoint = stringLengthMetres <= 6;
  const midpointTipOffset = Math.min(
    TENSION_MIDPOINT_TIP_OFFSET_PX,
    lineLength * 0.1,
  );
  const tipDistance = atMidpoint
    ? Math.max(0, lineLength / 2 - midpointTipOffset)
    : threeMetresInPixels;
  const tip = {
    x: from.x + direction.x * tipDistance,
    y: from.y + direction.y * tipDistance,
  };
  const base = {
    x: tip.x - direction.x * headLength,
    y: tip.y - direction.y * headLength,
  };
  const perpendicular = { x: -direction.y, y: direction.x };
  return {
    tip,
    firstWing: {
      x: base.x + perpendicular.x * headWidth,
      y: base.y + perpendicular.y * headWidth,
    },
    secondWing: {
      x: base.x - perpendicular.x * headWidth,
      y: base.y - perpendicular.y * headWidth,
    },
    headWidth,
    direction,
    atMidpoint,
  };
}

export function calculateTensionMagnitudeLabelPosition(
  geometry: TensionArrowHeadGeometry,
  labelWidth: number,
  fontSize: number,
): ScreenPoint {
  const arrowTop = Math.min(
    geometry.tip.y,
    geometry.firstWing.y,
    geometry.secondWing.y,
  );
  const gap = Math.max(4, fontSize * 0.2);
  return {
    x: geometry.tip.x - Math.max(0, labelWidth) / 2,
    y: arrowTop - gap - Math.max(0, fontSize) / 2,
  };
}

function getStringStrokeColour(
  stringId: string,
  selectedStringId: string | null,
  selectionWhiteMix: number,
): string {
  return stringId === selectedStringId
    ? mixColour(STRING_COLOUR, "#ffffff", selectionWhiteMix)
    : STRING_COLOUR;
}

export const STRING_COLOUR = "#626765";
export const TENSION_MIDPOINT_TIP_OFFSET_PX = 4;

export const ZERO_RESULTANT_MARKER_RADIUS_RATIO = 0.25;

export function shouldRenderInclineWeightComponents(
  forceId: string,
  particleId: string,
  selectedParticleId: string | null,
  hasInclineContact: boolean,
  showResultantForce: boolean,
): boolean {
  return forceId === "weight" &&
    particleId === selectedParticleId &&
    hasInclineContact &&
    !showResultantForce;
}

export function calculateInclineWeightAngleFontSize(
  pixelsPerMetre: number,
): number {
  return Math.max(0, pixelsPerMetre) * 0.42;
}

export function calculateZeroResultantMarkerRadius(
  particleRadius: number,
): number {
  return Math.max(0, particleRadius) * ZERO_RESULTANT_MARKER_RADIUS_RATIO;
}

export function drawZeroResultantMarker(
  context: CanvasRenderingContext2D,
  centre: Vec2,
  radius: number,
): void {
  context.save();
  context.fillStyle = RESULTANT_FORCE_COLOUR;
  context.beginPath();
  context.arc(
    centre.x,
    centre.y,
    radius,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.restore();
}

function renderZeroResultantMarkers(
  context: CanvasRenderingContext2D,
  scene: Scene,
  particleStates: ParticleState[],
  camera: Camera,
  currentTime: number,
): void {
  const particlesById = new Map(
    scene.particles.map((particle) => [particle.id, particle]),
  );
  for (const state of particleStates) {
    const particle = particlesById.get(state.id);
    if (!particle?.showResultantForce) continue;
    const contactDisplay = getParticleForceContactDisplay(
      scene,
      particle,
      currentTime,
    );
    if (!isZeroResultantForce(
      particle,
      scene.settings,
      contactDisplay.normalReaction,
      contactDisplay.friction,
      contactDisplay.tension,
    )) {
      continue;
    }
    const point = worldToScreen(state.position, camera);
    const { centre, radius } = getRenderedParticleGeometry(point, camera);
    drawZeroResultantMarker(
      context,
      centre,
      calculateZeroResultantMarkerRadius(radius),
    );
  }
}

export interface ParticleForceContactDisplay {
  normalReaction: number | NormalReactionDisplayInput;
  friction: FrictionDisplayInput | null;
  incline: Incline | null;
  tension: TensionDisplayInput | null;
}

export function getParticleForceContactDisplay(
  scene: Scene,
  particle: Scene["particles"][number],
  time: number,
): ParticleForceContactDisplay {
  const connectedString = scene.strings.find(
    (string) => string.particleAId === particle.id ||
      string.particleBId === particle.id,
  );
  const connectedTrajectory = connectedString
    ? calculateConnectedSystemTrajectory(scene, connectedString, time)
    : null;
  const connectedAnalysis = connectedTrajectory?.analysis ?? null;
  const connectedEndpoint = connectedAnalysis
    ? connectedAnalysis.endpointA.particleId === particle.id
      ? connectedAnalysis.endpointA
      : connectedAnalysis.endpointB
    : null;
  const connectedConstraintActive = connectedAnalysis?.state === "taut" &&
    connectedAnalysis.commonAcceleration !== null;
  const activeConnectedEndpoint = connectedConstraintActive
    ? connectedEndpoint
    : null;
  const tension = connectedAnalysis?.state === "taut" &&
      connectedEndpoint && connectedAnalysis.tension > 1e-12
    ? {
        magnitude: connectedAnalysis.tension,
        vector: connectedEndpoint.tensionVector,
      }
    : null;
  const trajectory = calculateSurfaceTrajectory(particle, time, {
    gravity: scene.settings.gravity,
    groundEnabled: scene.groundEnabled,
    groundHeight: scene.groundHeight,
    groundRough: scene.groundRough,
    groundFriction: scene.groundFriction,
    inclines: scene.inclines,
  });
  if (
    connectedConstraintActive &&
    connectedAnalysis.support.kind === "incline" &&
    activeConnectedEndpoint
  ) {
    const connectedSupport = connectedAnalysis.support;
    const incline = scene.inclines.find(
      (candidate) => candidate.id === connectedSupport.inclineId,
    );
    if (incline) {
      const normalReaction = createInclineNormalReactionDisplay(
        particle,
        incline,
        scene.settings,
        activeConnectedEndpoint.normalReactionMagnitude,
      ) ?? 0;
      return {
        normalReaction,
        friction: incline.roughness.kind === "rough"
          ? createFrictionDisplay(
              particle,
              scene.settings,
              normalReaction,
              activeConnectedEndpoint.friction,
              incline.roughness.coefficientOfFriction,
              incline.roughness.coefficientInput,
              incline,
            )
          : null,
        incline,
        tension,
      };
    }
  }
  if (
    connectedConstraintActive &&
    connectedAnalysis.support.kind === "ground" &&
    activeConnectedEndpoint
  ) {
    const normalReaction = activeConnectedEndpoint.normalReactionMagnitude;
    return {
      normalReaction,
      friction: scene.groundRough
        ? createFrictionDisplay(
            particle,
            scene.settings,
            normalReaction,
            activeConnectedEndpoint.friction,
            scene.groundFriction,
            String(scene.groundFriction),
            null,
          )
        : null,
      incline: null,
      tension,
    };
  }
  if (trajectory.contact.kind === "incline") {
    const inclineId = trajectory.contact.inclineId;
    const incline = scene.inclines.find(
      (candidate) => candidate.id === inclineId,
    );
    if (incline) {
      const normalReaction = createInclineNormalReactionDisplay(
        particle,
        incline,
        scene.settings,
        trajectory.contact.normalReactionMagnitude,
      ) ?? 0;
      return {
        normalReaction,
        friction: incline.roughness.kind === "rough"
          ? createFrictionDisplay(
              particle,
              scene.settings,
              normalReaction,
              trajectory.contact.friction,
              incline.roughness.coefficientOfFriction,
              incline.roughness.coefficientInput,
              incline,
            )
          : null,
        incline,
        tension,
      };
    }
  }
  const normalReaction = trajectory.contact.kind === "ground"
      ? trajectory.contact.normalReactionMagnitude
      : 0;
  return {
    normalReaction,
    friction: trajectory.contact.kind === "ground" && scene.groundRough
      ? createFrictionDisplay(
          particle,
          scene.settings,
          normalReaction,
          trajectory.contact.friction,
          scene.groundFriction,
          String(scene.groundFriction),
          null,
        )
      : null,
    incline: null,
    tension,
  };
}

function renderInclineWeightComponents(
  context: CanvasRenderingContext2D,
  origin: Vec2,
  incline: Incline,
  camera: Camera,
): void {
  const vectors = calculateInclineWeightComponentVectors(incline);
  const arrowLength = FORCE_ARROW_LENGTH_METRES * camera.pixelsPerMetre;
  const perpendicularDelta = {
    x: vectors.perpendicular.x * arrowLength,
    y: -vectors.perpendicular.y * arrowLength,
  };
  const parallelDelta = {
    x: vectors.parallel.x * arrowLength,
    y: -vectors.parallel.y * arrowLength,
  };
  const perpendicularTip = {
    x: origin.x + perpendicularDelta.x,
    y: origin.y + perpendicularDelta.y,
  };
  const weightTip = {
    x: perpendicularTip.x + parallelDelta.x,
    y: perpendicularTip.y + parallelDelta.y,
  };

  context.save();
  context.strokeStyle = INITIAL_VELOCITY_COLOUR;
  context.fillStyle = INITIAL_VELOCITY_COLOUR;
  context.lineWidth = 3;
  context.lineCap = "round";
  drawDashedTeachingLine(context, origin, perpendicularTip);
  drawDashedTeachingLine(context, perpendicularTip, weightTip);
  renderInclineWeightAngle(context, origin, incline, camera);
  context.restore();
}

function drawDashedTeachingLine(
  context: CanvasRenderingContext2D,
  start: Vec2,
  end: Vec2,
): void {
  context.setLineDash([10, 8]);
  context.beginPath();
  context.moveTo(start.x, start.y);
  context.lineTo(end.x, end.y);
  context.stroke();
}

function renderInclineWeightAngle(
  context: CanvasRenderingContext2D,
  origin: Vec2,
  incline: Incline,
  camera: Camera,
): void {
  const fontSize = calculateInclineWeightAngleFontSize(camera.pixelsPerMetre);
  const arcRadius =
    INITIAL_VELOCITY_ANGLE_ARC_RADIUS_METRES * camera.pixelsPerMetre;
  const startAngle = Math.PI / 2;
  const sweep = (incline.direction === "rises-right" ? -1 : 1) *
    incline.angleDegrees * Math.PI / 180;

  context.setLineDash([]);
  context.lineWidth = camera.pixelsPerMetre * 0.055;
  context.beginPath();
  context.arc(
    origin.x,
    origin.y,
    arcRadius,
    startAngle,
    startAngle + sweep,
    sweep < 0,
  );
  context.stroke();

  context.font = `700 ${fontSize}px "KG Primary Penmanship Alt", sans-serif`;
  const angleText = `${incline.angleInput}°`;
  const labelRadius = arcRadius - fontSize * 0.8;
  const measurementSide = Math.sign(sweep) || 1;
  const narrowLabelOffset = Math.atan(
    (context.measureText(angleText).width / 2 +
      camera.pixelsPerMetre * 0.08) /
      labelRadius,
  );
  const labelAngle = isNarrowInitialVelocityAngle(incline.angleDegrees)
    ? startAngle - measurementSide * narrowLabelOffset
    : startAngle + sweep / 2;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(
    angleText,
    origin.x + Math.cos(labelAngle) * labelRadius,
    origin.y + Math.sin(labelAngle) * labelRadius,
  );
}

function renderForceMagnitudeAtArrowTip(
  context: CanvasRenderingContext2D,
  magnitudeText: string,
  tip: Vec2,
  screenDirection: Vec2,
  fontSize: number,
  hoverTargets: CanvasExactValueHoverTarget[],
  mathLabels: CanvasMathLabel[],
  colour: string,
  forceTooltip: string,
): void {
  const unitText = " N";
  const unitWidth = context.measureText(unitText).width;
  const estimatedLabelWidth =
    context.measureText(magnitudeText).width + unitWidth;
  const labelPosition = calculateForceLabelPosition(
    tip,
    screenDirection,
    estimatedLabelWidth,
    fontSize,
    Math.max(3, fontSize * 0.2),
  );
  mathLabels.push({
    text: `${magnitudeText}${unitText}`,
    position: labelPosition,
    fontSize,
    colour,
  });
  hoverTargets.push({
    left: labelPosition.x - 4,
    top: labelPosition.y - fontSize,
    right: labelPosition.x + estimatedLabelWidth + 4,
    bottom: labelPosition.y + fontSize,
    tooltip: forceTooltip,
  });
}

function renderHeightMeasurements(
  context: CanvasRenderingContext2D,
  measurements: GreatestHeightMeasurement[],
  camera: Camera,
): CanvasExactValueHoverTarget[] {
  const hoverTargets: CanvasExactValueHoverTarget[] = [];
  for (const measurement of measurements) {
    const particlePoint = worldToScreen(measurement.position, camera);
    const referencePoint = worldToScreen(
      { x: measurement.position.x, y: measurement.groundHeight },
      camera,
    );
    const { centre, radius } = getRenderedParticleGeometry(particlePoint, camera);
    const horizontalGeometry = calculateGreatestHeightHorizontalGeometry(
      centre.x,
      radius,
      camera.pixelsPerMetre,
    );
    const dimensionX = horizontalGeometry.arrowX;
    const topY = particlePoint.y;
    const bottomY = referencePoint.y;
    const arrowDirection = Math.sign(bottomY - topY) || 1;
    const bottomCapHalfWidth =
      (horizontalGeometry.perpendicularEndX -
        horizontalGeometry.perpendicularStartX) /
      2;
    const arrowLength = Math.max(6, Math.min(12, camera.pixelsPerMetre * 0.2));
    const arrowHalfWidth = arrowLength * 0.55;

    context.save();
    context.strokeStyle = "#292d2c";
    context.fillStyle = "#292d2c";
    context.lineWidth = 2.5;
    context.lineCap = "round";
    context.lineJoin = "round";

    context.setLineDash([8, 7]);
    context.beginPath();
    context.moveTo(dimensionX, topY);
    context.lineTo(dimensionX, bottomY);
    context.stroke();

    context.setLineDash([]);
    context.beginPath();
    context.moveTo(horizontalGeometry.perpendicularStartX, topY);
    context.lineTo(horizontalGeometry.perpendicularEndX, topY);
    context.moveTo(dimensionX - bottomCapHalfWidth, bottomY);
    context.lineTo(dimensionX + bottomCapHalfWidth, bottomY);
    context.moveTo(
      dimensionX - arrowHalfWidth,
      topY + arrowDirection * arrowLength,
    );
    context.lineTo(dimensionX, topY);
    context.lineTo(
      dimensionX + arrowHalfWidth,
      topY + arrowDirection * arrowLength,
    );
    context.moveTo(
      dimensionX - arrowHalfWidth,
      bottomY - arrowDirection * arrowLength,
    );
    context.lineTo(dimensionX, bottomY);
    context.lineTo(
      dimensionX + arrowHalfWidth,
      bottomY - arrowDirection * arrowLength,
    );
    context.stroke();

    const fontSize = Math.max(15, Math.min(22, camera.pixelsPerMetre * 0.46));
    context.font = `700 ${fontSize}px "KG Primary Penmanship Alt", sans-serif`;
    context.textAlign = "left";
    context.textBaseline = "middle";
    const valueBounds = drawHeightMeasurementLabel(
      context,
      measurement,
      horizontalGeometry.perpendicularEndX + 8,
      (topY + bottomY) / 2,
      fontSize,
    );
    const tooltip = getExactValueTooltip(
      measurement.valueDisplay,
      measurement.height,
    );
    if (tooltip) {
      hoverTargets.push({
        left: valueBounds.left - 4,
        top: valueBounds.top - 4,
        right: valueBounds.right + 4,
        bottom: valueBounds.bottom + 4,
        tooltip,
      });
    }
    context.restore();
  }
  return hoverTargets;
}

function drawHeightMeasurementLabel(
  context: CanvasRenderingContext2D,
  measurement: GreatestHeightMeasurement,
  x: number,
  y: number,
  fontSize: number,
): { left: number; top: number; right: number; bottom: number } {
  const prefix = measurement.labelPrefix;
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.fillText(prefix, x, y);
  let cursorX = x + context.measureText(prefix).width;
  const valueStartX = cursorX;
  const valueWidth = drawCanvasMathValue(
    context,
    measurement.valueDisplay,
    cursorX,
    y,
    fontSize,
  );
  cursorX += valueWidth;
  context.fillText(" m", cursorX, y);
  return {
    left: valueStartX,
    top: y - fontSize * 0.85,
    right: valueStartX + valueWidth,
    bottom: y + fontSize * 0.85,
  };
}

export function findCanvasExactValueHoverTarget(
  targets: CanvasExactValueHoverTarget[],
  point: { x: number; y: number },
  exclusions: readonly CanvasTooltipExclusion[] = [],
): CanvasExactValueHoverTarget | null {
  if (exclusions.some((exclusion) =>
    Math.hypot(
      point.x - exclusion.centre.x,
      point.y - exclusion.centre.y,
    ) <= exclusion.radius
  )) {
    return null;
  }
  return targets.find(
    (target) =>
      point.x >= target.left &&
      point.x <= target.right &&
      point.y >= target.top &&
      point.y <= target.bottom &&
      (!target.segment ||
        distanceFromPointToSegment(
          point,
          target.segment.start,
          target.segment.end,
        ) <= target.segment.radius),
  ) ?? null;
}

export function formatForceHoverTooltip(
  forceName: string,
  displayText: string | null,
  magnitude: number,
): string {
  const isExact = Boolean(displayText && isSymbolicExactDisplay(displayText));
  const valueText = isExact
    ? `${magnitude.toFixed(3)} N (3 d.p.)`
    : `${displayText ?? formatCompactThreeDecimalValue(magnitude)} N`;
  return `${forceName}\n${valueText}`;
}

export function createForceArrowHoverTarget(
  start: Vec2,
  end: Vec2,
  radius: number,
  tooltip: string,
): CanvasExactValueHoverTarget {
  const safeRadius = Math.max(0, radius);
  return {
    left: Math.min(start.x, end.x) - safeRadius,
    top: Math.min(start.y, end.y) - safeRadius,
    right: Math.max(start.x, end.x) + safeRadius,
    bottom: Math.max(start.y, end.y) + safeRadius,
    tooltip,
    segment: { start: { ...start }, end: { ...end }, radius: safeRadius },
  };
}

function formatCompactThreeDecimalValue(value: number): string {
  const rounded = Number(value.toFixed(3));
  return String(Object.is(rounded, -0) ? 0 : rounded);
}

function distanceFromPointToSegment(
  point: Vec2,
  start: Vec2,
  end: Vec2,
): number {
  const x = end.x - start.x;
  const y = end.y - start.y;
  const lengthSquared = x * x + y * y;
  if (lengthSquared === 0) return Math.hypot(point.x - start.x, point.y - start.y);
  const projection = Math.max(0, Math.min(1,
    ((point.x - start.x) * x + (point.y - start.y) * y) / lengthSquared,
  ));
  return Math.hypot(
    point.x - (start.x + projection * x),
    point.y - (start.y + projection * y),
  );
}

export function drawCanvasMathValue(
  context: CanvasRenderingContext2D,
  value: GreatestHeightMeasurement["valueDisplay"],
  x: number,
  y: number,
  fontSize: number,
): number {
  if (typeof value === "string") {
    return drawCanvasMathText(context, value, x, y, fontSize);
  }

  let cursorX = x;
  if (value.negative) {
    context.fillText("−", cursorX, y);
    cursorX += context.measureText("−").width;
  }

  const radical = "√";
  context.fillText(radical, cursorX, y);
  cursorX += context.measureText(radical).width - 1;
  const radicandStartX = cursorX;
  const radicandFraction = parseFraction(value.radicand);
  const radicandWidth = radicandFraction
    ? drawStackedFraction(
        context,
        radicandFraction.numerator,
        radicandFraction.denominator,
        radicandStartX,
        y,
        fontSize,
      )
    : drawPlainCanvasMath(context, value.radicand, radicandStartX, y);
  const originalLineWidth = context.lineWidth;
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(radicandStartX - 1, y - fontSize * 0.55);
  context.lineTo(radicandStartX + radicandWidth + 2, y - fontSize * 0.55);
  context.stroke();
  context.lineWidth = originalLineWidth;
  return cursorX - x + radicandWidth + 2;
}

function drawCanvasMathText(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  fontSize: number,
): number {
  let cursorX = x;
  for (const token of tokenizeMathText(value)) {
    const tokenWidth = drawCanvasMathToken(
      context,
      token,
      cursorX,
      y,
      fontSize,
    );
    cursorX += tokenWidth;
  }
  return cursorX - x;
}

function drawCanvasMathToken(
  context: CanvasRenderingContext2D,
  token: MathToken,
  x: number,
  y: number,
  fontSize: number,
): number {
  let baseWidth: number;
  switch (token.kind) {
    case "fraction":
      baseWidth = drawStackedFraction(
        context,
        token.numerator,
        token.denominator,
        x,
        y,
        fontSize,
      );
      break;
    case "rational-surd": {
      const sign = token.numeratorCoefficient.startsWith("−") ? "−" : "";
      const magnitude = token.numeratorCoefficient.replace(/^[−-]/, "");
      const coefficient = magnitude === "1" ? "" : magnitude;
      baseWidth = drawStackedFraction(
        context,
        `${sign}${coefficient}√(${token.radicand})`,
        token.denominator,
        x,
        y,
        fontSize,
      );
      break;
    }
    case "square-root":
      baseWidth = drawCanvasSquareRoot(
        context,
        token.radicand,
        x,
        y,
        fontSize,
      );
      break;
    case "space":
      return context.measureText(" ").width;
    default:
      context.fillText(token.value, x, y);
      baseWidth = context.measureText(token.value).width;
      break;
  }

  return baseWidth + drawCanvasExponent(
    context,
    token.exponent,
    x + baseWidth,
    y,
    fontSize,
  );
}

function drawCanvasSquareRoot(
  context: CanvasRenderingContext2D,
  radicand: string,
  x: number,
  y: number,
  fontSize: number,
): number {
  const radical = "√";
  context.fillText(radical, x, y);
  const radicalWidth = context.measureText(radical).width - 1;
  const radicandX = x + radicalWidth;
  const radicandWidth = drawCanvasMathText(
    context,
    radicand,
    radicandX,
    y,
    fontSize,
  );
  const originalLineWidth = context.lineWidth;
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(radicandX - 1, y - fontSize * 0.55);
  context.lineTo(radicandX + radicandWidth + 2, y - fontSize * 0.55);
  context.stroke();
  context.lineWidth = originalLineWidth;
  return radicalWidth + radicandWidth + 2;
}

function drawCanvasExponent(
  context: CanvasRenderingContext2D,
  exponent: string | undefined,
  x: number,
  y: number,
  fontSize: number,
): number {
  if (!exponent) return 0;
  const originalFont = context.font;
  const originalBaseline = context.textBaseline;
  const exponentFontSize = fontSize * 0.62;
  context.font = `700 ${exponentFontSize}px "KG Primary Penmanship Alt", sans-serif`;
  context.textBaseline = "middle";
  context.fillText(exponent, x, y - fontSize * 0.38);
  const width = context.measureText(exponent).width;
  context.font = originalFont;
  context.textBaseline = originalBaseline;
  return width;
}

function drawStackedFraction(
  context: CanvasRenderingContext2D,
  numerator: string,
  denominator: string,
  x: number,
  y: number,
  fontSize: number,
): number {
  const originalFont = context.font;
  const fractionFontSize = fontSize * 0.72;
  context.font = `700 ${fractionFontSize}px "KG Primary Penmanship Alt", sans-serif`;
  const numeratorWidth = context.measureText(numerator).width;
  const denominatorWidth = context.measureText(denominator).width;
  const width = Math.max(numeratorWidth, denominatorWidth) + 8;
  const centreX = x + width / 2;
  const originalLineWidth = context.lineWidth;

  context.textAlign = "center";
  context.textBaseline = "bottom";
  context.fillText(numerator, centreX, y - 2);
  context.textBaseline = "top";
  context.fillText(denominator, centreX, y + 2);
  context.lineWidth = 1.5;
  context.beginPath();
  context.moveTo(x + 2, y);
  context.lineTo(x + width - 2, y);
  context.stroke();
  context.lineWidth = originalLineWidth;
  context.font = originalFont;
  context.textAlign = "left";
  context.textBaseline = "middle";
  return width;
}

function drawPlainCanvasMath(
  context: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
): number {
  context.fillText(value, x, y);
  return context.measureText(value).width;
}

function parseFraction(
  value: string,
): { numerator: string; denominator: string } | null {
  const match = /^(-?\d+)\/(\d+)$/.exec(value);
  return match ? { numerator: match[1], denominator: match[2] } : null;
}

function renderInitialVelocityAnnotations(
  context: CanvasRenderingContext2D,
  scene: Scene,
  particleStates: ParticleState[],
  camera: Camera,
): void {
  const particlesById = new Map(
    scene.particles.map((particle) => [particle.id, particle]),
  );

  for (const particleState of particleStates) {
    const particle = particlesById.get(particleState.id);
    if (!particle) continue;

    const annotation = getInitialVelocityAnnotation(
      particle,
      scene.settings,
    );
    if (!annotation) continue;

    const point = worldToScreen(particleState.position, camera);
    const { centre } = getRenderedParticleGeometry(point, camera);
    const arrowLength =
      INITIAL_VELOCITY_ARROW_LENGTH_METRES * camera.pixelsPerMetre;
    const screenDirection = {
      x: annotation.direction.x,
      y: -annotation.direction.y,
    };
    const tip = {
      x: centre.x + screenDirection.x * arrowLength,
      y: centre.y + screenDirection.y * arrowLength,
    };
    const arrowHeadLength = Math.max(
      8,
      Math.min(16, camera.pixelsPerMetre * 0.3),
    );
    const arrowHeadWidth = arrowHeadLength * 0.7;

    context.save();
    context.strokeStyle = INITIAL_VELOCITY_COLOUR;
    context.fillStyle = INITIAL_VELOCITY_COLOUR;
    context.lineWidth = 3;
    context.lineCap = "round";
    context.setLineDash([10, 8]);
    context.beginPath();
    context.moveTo(centre.x, centre.y);
    context.lineTo(tip.x, tip.y);
    context.stroke();

    context.setLineDash([]);
    const base = {
      x: tip.x - screenDirection.x * arrowHeadLength,
      y: tip.y - screenDirection.y * arrowHeadLength,
    };
    const perpendicular = {
      x: -screenDirection.y * arrowHeadWidth,
      y: screenDirection.x * arrowHeadWidth,
    };
    context.beginPath();
    context.moveTo(base.x + perpendicular.x, base.y + perpendicular.y);
    context.lineTo(tip.x, tip.y);
    context.lineTo(base.x - perpendicular.x, base.y - perpendicular.y);
    context.stroke();

    const fontSize = calculateInitialVelocityTextSize(camera.pixelsPerMetre);
    context.font = `700 ${fontSize}px "KG Primary Penmanship Alt", sans-serif`;
    if (annotation.kind === "angle") {
      renderAngleVelocityNotation(
        context,
        centre,
        tip,
        screenDirection,
        camera,
        annotation,
        fontSize,
        annotation.speedText,
        "m s⁻¹",
      );
    } else if (annotation.kind === "components") {
      renderComponentVelocityNotation(
        context,
        centre,
        tip,
        screenDirection,
        annotation,
        fontSize,
      );
    } else {
      renderSpeedVelocityNotation(
        context,
        centre,
        tip,
        screenDirection,
        annotation,
        camera,
      );
    }
    context.restore();
  }
}

function renderSpeedVelocityNotation(
  context: CanvasRenderingContext2D,
  centre: { x: number; y: number },
  tip: { x: number; y: number },
  screenDirection: Vec2,
  annotation: SpeedInitialVelocityAnnotation,
  camera: Camera,
): void {
  let labelNormal = {
    x: screenDirection.y,
    y: -screenDirection.x,
  };
  if (
    labelNormal.y > 0 ||
    (Math.abs(labelNormal.y) < 0.2 && labelNormal.x < 0)
  ) {
    labelNormal = { x: -labelNormal.x, y: -labelNormal.y };
  }
  const anchor = {
    x:
      centre.x +
      (tip.x - centre.x) * 0.58 +
      labelNormal.x * camera.pixelsPerMetre * 0.45,
    y:
      centre.y +
      (tip.y - centre.y) * 0.58 +
      labelNormal.y * camera.pixelsPerMetre * 0.45,
  };
  context.textAlign = labelNormal.x < -0.2
    ? "right"
    : labelNormal.x > 0.2
      ? "left"
      : "center";
  context.textBaseline = "middle";
  context.fillText(`${annotation.speedText} m s⁻¹`, anchor.x, anchor.y);
}

function renderAngleVelocityNotation(
  context: CanvasRenderingContext2D,
  centre: { x: number; y: number },
  tip: { x: number; y: number },
  screenDirection: Vec2,
  camera: Camera,
  annotation: AngleInitialVelocityAnnotation | AngleForceAnnotation,
  fontSize: number,
  magnitudeText: string,
  unit: string,
  exactValues?: {
    magnitude: number;
    angle: number;
    hoverTargets: CanvasExactValueHoverTarget[];
  },
  renderMagnitude = true,
): void {
  const referenceDirection = {
    x: annotation.referenceDirection.x,
    y: -annotation.referenceDirection.y,
  };
  const referenceAngle = Math.atan2(referenceDirection.y, referenceDirection.x);
  const rawSweep =
    -annotation.rotationDirection * annotation.angleDegrees * Math.PI / 180;
  const sweep = normaliseDiagramArcSweep(rawSweep);
  const arcRadius =
    INITIAL_VELOCITY_ANGLE_ARC_RADIUS_METRES * camera.pixelsPerMetre;

  context.save();
  context.lineWidth = camera.pixelsPerMetre * 0.055;
  if (annotation.angleMarker === "arc") {
    context.setLineDash([
      camera.pixelsPerMetre * 0.15,
      camera.pixelsPerMetre * 0.15,
    ]);
    context.beginPath();
    context.moveTo(centre.x, centre.y);
    context.lineTo(
      centre.x + referenceDirection.x * arcRadius,
      centre.y + referenceDirection.y * arcRadius,
    );
    context.stroke();

    context.setLineDash([]);
    if (Math.abs(sweep) > 1e-9) {
      context.beginPath();
      context.arc(
        centre.x,
        centre.y,
        arcRadius,
        referenceAngle,
        referenceAngle + sweep,
        sweep < 0,
      );
      context.stroke();
    }

    const angleLabelRadius = arcRadius - fontSize * 0.8;
    const angleText = `${annotation.angleText}°`;
    const measurementSide = Math.sign(sweep) || -annotation.rotationDirection;
    const narrowLabelOffset = Math.atan(
      (context.measureText(angleText).width / 2 +
        camera.pixelsPerMetre * 0.08) /
        angleLabelRadius,
    );
    const angleLabelDirection = isNarrowInitialVelocityAngle(
      annotation.angleDegrees,
    )
      ? referenceAngle - measurementSide * narrowLabelOffset
      : referenceAngle + sweep / 2;
    context.textAlign = "left";
    context.textBaseline = "middle";
    const angleCentreX =
      centre.x + Math.cos(angleLabelDirection) * angleLabelRadius;
    const angleY = centre.y + Math.sin(angleLabelDirection) * angleLabelRadius;
    const angleX = angleCentreX - context.measureText(angleText).width / 2;
    const drawnAngleWidth = drawCanvasMathValue(
      context,
      annotation.angleText,
      angleX,
      angleY,
      fontSize,
    );
    context.fillText("°", angleX + drawnAngleWidth, angleY);
    const angleTooltip = exactValues
      ? getExactValueTooltip(annotation.angleText, exactValues.angle)
      : null;
    if (angleTooltip && exactValues) {
      exactValues.hoverTargets.push({
        left: angleX - 4,
        top: angleY - fontSize,
        right: angleX + drawnAngleWidth + context.measureText("°").width + 4,
        bottom: angleY + fontSize,
        tooltip: angleTooltip,
      });
    }
  }

  if (!renderMagnitude) {
    context.restore();
    return;
  }

  const arcSectorDirection = referenceAngle + sweep / 2;
  const arcMidpointDirection = {
    x: Math.cos(arcSectorDirection),
    y: Math.sin(arcSectorDirection),
  };
  const arcSide = Math.sign(
    screenDirection.x * arcMidpointDirection.y -
      screenDirection.y * arcMidpointDirection.x,
  ) || 1;
  const oppositeNormal = {
    x: screenDirection.y * arcSide,
    y: -screenDirection.x * arcSide,
  };
  const speedAnchor = {
    x:
      centre.x +
      (tip.x - centre.x) * 0.58 +
      oppositeNormal.x * camera.pixelsPerMetre * 0.45,
    y:
      centre.y +
      (tip.y - centre.y) * 0.58 +
      oppositeNormal.y * camera.pixelsPerMetre * 0.45,
  };
  const magnitudeAlignment = oppositeNormal.x < -0.2
    ? "right"
    : oppositeNormal.x > 0.2
      ? "left"
      : "center";
  const unitText = ` ${unit}`;
  const estimatedMagnitudeWidth =
    context.measureText(magnitudeText).width + context.measureText(unitText).width;
  const magnitudeX = magnitudeAlignment === "right"
    ? speedAnchor.x - estimatedMagnitudeWidth
    : magnitudeAlignment === "center"
      ? speedAnchor.x - estimatedMagnitudeWidth / 2
      : speedAnchor.x;
  context.textAlign = "left";
  const drawnMagnitudeWidth = drawCanvasMathValue(
    context,
    magnitudeText,
    magnitudeX,
    speedAnchor.y,
    fontSize,
  );
  context.fillText(unitText, magnitudeX + drawnMagnitudeWidth, speedAnchor.y);
  const magnitudeTooltip = exactValues
    ? getExactValueTooltip(magnitudeText, exactValues.magnitude)
    : null;
  if (magnitudeTooltip && exactValues) {
    exactValues.hoverTargets.push({
      left: magnitudeX - 4,
      top: speedAnchor.y - fontSize,
      right:
        magnitudeX + drawnMagnitudeWidth + context.measureText(unitText).width + 4,
      bottom: speedAnchor.y + fontSize,
      tooltip: magnitudeTooltip,
    });
  }
  context.restore();
}

function renderComponentVelocityNotation(
  context: CanvasRenderingContext2D,
  centre: { x: number; y: number },
  tip: { x: number; y: number },
  screenDirection: Vec2,
  annotation: ComponentInitialVelocityAnnotation | ComponentForceAnnotation,
  fontSize: number,
  unit = "m s⁻¹",
  componentValues?: { x: number; y: number },
  hoverTargets?: CanvasExactValueHoverTarget[],
  placement: "along-arrow" | "after-tip" = "along-arrow",
): CanvasAnnotationBounds {
  const rowOffset = fontSize * 0.52;
  const numberWidth = Math.max(
    context.measureText(annotation.componentText.x).width,
    context.measureText(annotation.componentText.y).width,
  );
  const innerPadding = fontSize * 0.32;
  const bracketHeight = fontSize * 2.05;
  const unitWidth = context.measureText(unit).width;
  const midpoint = {
    x: centre.x + (tip.x - centre.x) * 0.55,
    y: centre.y + (tip.y - centre.y) * 0.55,
  };
  const vectorWidth = numberWidth + innerPadding * 2;
  const unitGap = fontSize * 0.32;
  const labelClearance = fontSize * 0.65;
  const fullLabelWidth = vectorWidth + unitGap + unitWidth;
  const arrowCrossesLabelHeight = Math.abs(screenDirection.y) > 0.12;
  const horizontalAvoidance = arrowCrossesLabelHeight
    ? (screenDirection.x >= 0 ? -1 : 1) *
      (fullLabelWidth / 2 + labelClearance)
    : 0;
  const tipLabelPosition = placement === "after-tip"
    ? calculateForceLabelPosition(
        tip,
        screenDirection,
        fullLabelWidth,
        bracketHeight,
        Math.max(3, fontSize * 0.2),
      )
    : null;
  const anchor = tipLabelPosition
    ? {
        x: tipLabelPosition.x + vectorWidth / 2,
        y: tipLabelPosition.y,
      }
    : {
        x: midpoint.x + horizontalAvoidance - unitWidth / 2,
        y: midpoint.y - bracketHeight / 2 - labelClearance,
      };
  const bracketTop = anchor.y - bracketHeight / 2;
  const bracketBottom = anchor.y + bracketHeight / 2;
  const left = anchor.x - numberWidth / 2 - innerPadding;
  const right = anchor.x + numberWidth / 2 + innerPadding;
  const curveInset = fontSize * 0.32;

  context.textAlign = "left";
  context.textBaseline = "middle";
  const xValueX =
    anchor.x - context.measureText(annotation.componentText.x).width / 2;
  const yValueX =
    anchor.x - context.measureText(annotation.componentText.y).width / 2;
  const xValueY = anchor.y - rowOffset;
  const yValueY = anchor.y + rowOffset;
  const xValueWidth = drawCanvasMathValue(
    context,
    annotation.componentText.x,
    xValueX,
    xValueY,
    fontSize,
  );
  const yValueWidth = drawCanvasMathValue(
    context,
    annotation.componentText.y,
    yValueX,
    yValueY,
    fontSize,
  );
  if (componentValues && hoverTargets) {
    const xTooltip = getExactValueTooltip(
      annotation.componentText.x,
      componentValues.x,
    );
    if (xTooltip) {
      hoverTargets.push({
        left: xValueX - 4,
        top: xValueY - fontSize,
        right: xValueX + xValueWidth + 4,
        bottom: xValueY + fontSize,
        tooltip: xTooltip,
      });
    }
    const yTooltip = getExactValueTooltip(
      annotation.componentText.y,
      componentValues.y,
    );
    if (yTooltip) {
      hoverTargets.push({
        left: yValueX - 4,
        top: yValueY - fontSize,
        right: yValueX + yValueWidth + 4,
        bottom: yValueY + fontSize,
        tooltip: yTooltip,
      });
    }
  }

  context.lineWidth = fontSize * 0.11;
  context.setLineDash([]);
  context.beginPath();
  context.moveTo(left + curveInset, bracketTop);
  context.bezierCurveTo(
    left,
    bracketTop + bracketHeight * 0.16,
    left,
    bracketBottom - bracketHeight * 0.16,
    left + curveInset,
    bracketBottom,
  );
  context.moveTo(right - curveInset, bracketTop);
  context.bezierCurveTo(
    right,
    bracketTop + bracketHeight * 0.16,
    right,
    bracketBottom - bracketHeight * 0.16,
    right - curveInset,
    bracketBottom,
  );
  context.stroke();

  context.textAlign = "left";
  context.fillText(unit, right + unitGap, anchor.y);
  return {
    left: left - 4,
    top: bracketTop - 4,
    right: right + unitGap + unitWidth + 4,
    bottom: bracketBottom + 4,
  };
}

function normaliseDiagramArcSweep(sweep: number): number {
  const fullTurn = Math.PI * 2;
  if (Math.abs(sweep) <= fullTurn) return sweep;
  const remainder = sweep % fullTurn;
  return Math.abs(remainder) < 1e-9 ? Math.sign(sweep) * fullTurn : remainder;
}

function renderGround(
  context: CanvasRenderingContext2D,
  camera: Camera,
  groundHeight: number,
  rough: boolean,
  whiteMix: number,
): void {
  const groundY = worldToScreen({ x: 0, y: groundHeight }, camera).y;
  const fillStartY = Math.max(0, Math.min(camera.viewportHeight, groundY));

  context.save();
  context.fillStyle = mixColourWithWhite("#cbc8c0", whiteMix);
  context.fillRect(
    0,
    fillStartY,
    camera.viewportWidth,
    camera.viewportHeight - fillStartY,
  );
  if (rough) {
    const roughLineSpacing = 32;
    const firstRoughLineX =
      positiveModulo(camera.screenPanOffset.x, roughLineSpacing) - roughLineSpacing;
    context.strokeStyle = mixColourWithWhite("#aaa69d", whiteMix);
    context.lineWidth = 3;
    context.beginPath();
    for (
      let x = firstRoughLineX;
      x <= camera.viewportWidth + roughLineSpacing;
      x += roughLineSpacing
    ) {
      context.moveTo(x, groundY + 0.5);
      context.lineTo(x - 17, groundY + 18);
    }
    context.stroke();
  }

  context.strokeStyle = mixColourWithWhite("#292d2c", whiteMix);
  context.lineWidth = 3;
  context.beginPath();
  context.moveTo(0, groundY + 0.5);
  context.lineTo(camera.viewportWidth, groundY + 0.5);
  context.stroke();
  context.restore();
}

function renderParticle(
  context: CanvasRenderingContext2D,
  particle: ParticleState,
  particleCount: number,
  camera: Camera,
  whiteMix: number,
  shape: Scene["particles"][number]["shape"] = "circle",
  incline: Incline | null = null,
  invalid = false,
): void {
  const point = worldToScreen(particle.position, camera);
  const geometry = getRenderedParticleShapeGeometry(
    point,
    camera,
    shape,
    incline,
  );
  const { centre, radius } = geometry;

  context.save();
  const outlineWidth = 3;
  const colours = getParticleRenderColours(whiteMix, invalid);
  context.fillStyle = colours.fill;
  context.strokeStyle = colours.stroke;
  context.lineWidth = outlineWidth;
  if (geometry.shape === "square") {
    const outlinedSize = Math.max(0, geometry.size - outlineWidth);
    context.save();
    context.translate(centre.x, centre.y);
    context.rotate(geometry.rotation);
    context.beginPath();
    context.rect(
      -outlinedSize / 2,
      -outlinedSize / 2,
      outlinedSize,
      outlinedSize,
    );
    context.fill();
    context.stroke();
    context.restore();
  } else {
    context.beginPath();
    context.arc(
      centre.x,
      centre.y,
      Math.max(0, radius - outlineWidth / 2),
      0,
      Math.PI * 2,
    );
    context.fill();
    context.stroke();
  }

  if (particleCount > 1) {
    const countText = String(particleCount);
    const fontSize = Math.max(
      10,
      Math.min(radius * 1.05, (radius * 1.7) / countText.length),
    );
    context.fillStyle = "#292d2c";
    context.font = `700 ${fontSize}px "KG Primary Penmanship Alt", sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(countText, centre.x, centre.y + fontSize * 0.05);
  }

  context.restore();
}

export function getParticleRenderColours(
  whiteMix: number,
  invalid: boolean,
): { fill: string; stroke: string } {
  return invalid
    ? { fill: "#e89a8f", stroke: "#a62d26" }
    : {
        fill: mixColourWithWhite("#dedbd3", whiteMix),
        stroke: mixColourWithWhite("#292d2c", whiteMix),
      };
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
