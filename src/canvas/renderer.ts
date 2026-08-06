import type { ParticleState } from "../model/Particle";
import type { Scene } from "../model/Scene";
import type { Vec2 } from "../math/Vec2";
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
  type AngleInitialVelocityAnnotation,
  type ComponentInitialVelocityAnnotation,
  type SpeedInitialVelocityAnnotation,
} from "./initialVelocityAnnotation";
import {
  groupParticlesByPosition,
  getRenderedParticleGeometry,
} from "./particleGeometry";
import {
  getSelectionWhiteMix,
  mixColourWithWhite,
} from "./selectionPulse";
import { tokenizeMathText, type MathToken } from "../ui/mathMarkup";
import { getExactValueTooltip } from "../ui/exactValueTooltip";

export interface CanvasExactValueHoverTarget {
  left: number;
  top: number;
  right: number;
  bottom: number;
  tooltip: string;
}

export function render(
  context: CanvasRenderingContext2D,
  scene: Scene,
  particleStates: ParticleState[],
  selectedParticleId: string | null,
  groundSelected: boolean,
  camera: Camera,
  currentTime: number,
  animationTimestamp: number,
  heightMeasurements: GreatestHeightMeasurement[],
): CanvasExactValueHoverTarget[] {
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

  const particleGroups = groupParticlesByPosition(particleStates);

  if (currentTime === 0) {
    renderInitialVelocityAnnotations(
      context,
      scene,
      particleStates,
      camera,
    );
  }

  const exactValueHoverTargets = renderHeightMeasurements(
    context,
    heightMeasurements,
    camera,
  );

  for (const coincidentParticles of particleGroups) {
    const particle = coincidentParticles[coincidentParticles.length - 1];
    renderParticle(
      context,
      particle,
      coincidentParticles.length,
      camera,
      coincidentParticles.some((candidate) => candidate.id === selectedParticleId)
        ? selectionWhiteMix
        : 0,
    );
  }

  return exactValueHoverTargets;
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
): CanvasExactValueHoverTarget | null {
  return targets.find(
    (target) =>
      point.x >= target.left &&
      point.x <= target.right &&
      point.y >= target.top &&
      point.y <= target.bottom,
  ) ?? null;
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
    context.strokeStyle = "#292d2c";
    context.fillStyle = "#292d2c";
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
  annotation: AngleInitialVelocityAnnotation,
  fontSize: number,
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
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(
      angleText,
      centre.x + Math.cos(angleLabelDirection) * angleLabelRadius,
      centre.y + Math.sin(angleLabelDirection) * angleLabelRadius,
    );
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
  context.textAlign = oppositeNormal.x < -0.2 ? "right" : oppositeNormal.x > 0.2 ? "left" : "center";
  context.fillText(`${annotation.speedText} m s⁻¹`, speedAnchor.x, speedAnchor.y);
  context.restore();
}

function renderComponentVelocityNotation(
  context: CanvasRenderingContext2D,
  centre: { x: number; y: number },
  tip: { x: number; y: number },
  screenDirection: Vec2,
  annotation: ComponentInitialVelocityAnnotation,
  fontSize: number,
): void {
  const rowOffset = fontSize * 0.52;
  const numberWidth = Math.max(
    context.measureText(annotation.componentText.x).width,
    context.measureText(annotation.componentText.y).width,
  );
  const innerPadding = fontSize * 0.32;
  const bracketHeight = fontSize * 2.05;
  const unitWidth = context.measureText("m s⁻¹").width;
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
  const anchor = {
    x: midpoint.x + horizontalAvoidance - unitWidth / 2,
    y: midpoint.y - bracketHeight / 2 - labelClearance,
  };
  const bracketTop = anchor.y - bracketHeight / 2;
  const bracketBottom = anchor.y + bracketHeight / 2;
  const left = anchor.x - numberWidth / 2 - innerPadding;
  const right = anchor.x + numberWidth / 2 + innerPadding;
  const curveInset = fontSize * 0.32;

  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(annotation.componentText.x, anchor.x, anchor.y - rowOffset);
  context.fillText(annotation.componentText.y, anchor.x, anchor.y + rowOffset);

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
  context.fillText("m s⁻¹", right + unitGap, anchor.y);
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
): void {
  const point = worldToScreen(particle.position, camera);
  const { centre, radius } = getRenderedParticleGeometry(point, camera);

  context.save();
  const outlineWidth = 3;
  context.fillStyle = mixColourWithWhite("#dedbd3", whiteMix);
  context.strokeStyle = mixColourWithWhite("#292d2c", whiteMix);
  context.lineWidth = outlineWidth;
  context.beginPath();
  context.arc(centre.x, centre.y, Math.max(0, radius - outlineWidth / 2), 0, Math.PI * 2);
  context.fill();
  context.stroke();

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

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}
