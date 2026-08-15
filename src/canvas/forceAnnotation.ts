import { createAppliedForceEditorConversion } from "../dynamics/appliedForceEditorConversion";
import { analyseParticleForces } from "../dynamics/forceAnalysis";
import {
  createParticleForceDisplay,
  type FrictionDisplayInput,
  type NormalReactionDisplayInput,
  type TensionDisplayInput,
} from "../dynamics/forceDisplay";
import type { Vec2 } from "../math/Vec2";
import type { Particle } from "../model/Particle";
import type { Incline } from "../model/Incline";
import type { SimulationSettings } from "../model/SimulationSettings";
import {
  absoluteDisplayValue,
  derivedValue,
  formatWorkingValue,
  type Rational,
} from "../kinematics/exactDisplay";
import {
  formatMeasuredAngle,
  getAngleReferenceDirection,
  measureVelocityAngle,
} from "../kinematics/angleConvention";
import {
  getExactAngleText,
  getExactSpeedText,
} from "../kinematics/velocityEditorConversion";
import { isMultipleOfNinetyDegrees } from "./initialVelocityAnnotation";
import { getInclineGeometry } from "../geometry/inclineGeometry";

export const FORCE_ARROW_LENGTH_METRES = 3;
export const FORCE_ARROW_LINE_DASH: readonly number[] = [];
export const RESULTANT_FORCE_COLOUR = "#c63329";

interface ForceAnnotationBase {
  id: string;
  label: string;
  direction: Vec2;
  magnitude: number;
  colour?: string;
}

export interface MagnitudeForceAnnotation extends ForceAnnotationBase {
  kind: "magnitude";
  magnitudeText: string;
}

export interface ComponentForceAnnotation extends ForceAnnotationBase {
  kind: "components";
  componentText: { x: string; y: string };
  componentValues: { x: number; y: number };
}

export interface AngleForceAnnotation extends ForceAnnotationBase {
  kind: "angle";
  angleMarker: "arc" | "none";
  magnitudeText: string;
  angleText: string;
  angleDegrees: number;
  referenceDirection: Vec2;
  rotationDirection: 1 | -1;
}

export type ForceAnnotation =
  | MagnitudeForceAnnotation
  | ComponentForceAnnotation
  | AngleForceAnnotation;

export function calculateForceLabelPosition(
  arrowTip: Vec2,
  arrowDirection: Vec2,
  labelWidth: number,
  labelHeight: number,
  gap: number,
): Vec2 {
  const halfExtentAlongDirection =
    Math.abs(arrowDirection.x) * labelWidth / 2 +
    Math.abs(arrowDirection.y) * labelHeight / 2;
  const centreOffset = halfExtentAlongDirection + gap;
  const labelCentre = {
    x: arrowTip.x + arrowDirection.x * centreOffset,
    y: arrowTip.y + arrowDirection.y * centreOffset,
  };
  return {
    x: labelCentre.x - labelWidth / 2,
    y: labelCentre.y,
  };
}

export function calculateForceArrowOrigins(
  directions: readonly Vec2[],
  centre: Vec2,
  particleRadius: number,
): Vec2[] {
  const origins = directions.map(() => ({ ...centre }));
  const assigned = new Set<number>();
  const maximumOffset = Math.max(0, particleRadius) * 0.65;

  directions.forEach((direction, index) => {
    if (assigned.has(index)) return;
    const group = directions
      .map((candidate, candidateIndex) => ({ candidate, candidateIndex }))
      .filter(({ candidate, candidateIndex }) =>
        !assigned.has(candidateIndex) && sameDirection(direction, candidate)
      )
      .map(({ candidateIndex }) => candidateIndex);
    group.forEach((candidateIndex) => assigned.add(candidateIndex));
    if (group.length < 2) return;

    const magnitude = Math.hypot(direction.x, direction.y);
    if (magnitude === 0) return;
    const perpendicular = {
      x: -direction.y / magnitude,
      y: direction.x / magnitude,
    };
    const halfSpan = maximumOffset;
    group.forEach((annotationIndex, groupIndex) => {
      const offset = group.length === 1
        ? 0
        : -halfSpan + (2 * halfSpan * groupIndex) / (group.length - 1);
      origins[annotationIndex] = {
        x: centre.x + perpendicular.x * offset,
        y: centre.y + perpendicular.y * offset,
      };
    });
  });

  return origins;
}

function sameDirection(first: Vec2, second: Vec2): boolean {
  const firstMagnitude = Math.hypot(first.x, first.y);
  const secondMagnitude = Math.hypot(second.x, second.y);
  if (firstMagnitude === 0 || secondMagnitude === 0) return false;
  const dot =
    (first.x * second.x + first.y * second.y) /
    (firstMagnitude * secondMagnitude);
  return dot >= 1 - 1e-10;
}

export function getForceAnnotations(
  particle: Particle,
  settings: SimulationSettings,
  normalReaction: number | NormalReactionDisplayInput = 0,
  incline: Incline | null = null,
  friction: FrictionDisplayInput | null = null,
  tension: TensionDisplayInput | null = null,
): ForceAnnotation[] {
  const normalReactionMagnitude = typeof normalReaction === "number"
    ? normalReaction
    : normalReaction.magnitude;
  const display = createParticleForceDisplay(
    particle,
    settings,
    normalReaction,
    friction,
    tension,
  );
  if (particle.showResultantForce) {
    return getResultantForceAnnotations(
      particle,
      settings,
      display,
      normalReaction,
      incline,
      friction,
      tension,
    );
  }
  const weightMagnitude = particle.mass * settings.gravity;
  const annotations: ForceAnnotation[] = weightMagnitude === 0
    ? []
    : [{
        id: "weight",
        label: "Weight",
        kind: "magnitude",
        direction: { x: 0, y: -1 },
        magnitudeText: formatWorkingValue(display.weightMagnitude),
        magnitude: weightMagnitude,
      }];

  if (normalReactionMagnitude > 0 && display.normalReaction) {
    annotations.push({
      id: "normal-reaction",
      label: "Normal Reaction",
      kind: "magnitude",
      direction: typeof normalReaction === "number"
        ? { x: 0, y: 1 }
        : {
            x: normalReaction.vector.x / normalReactionMagnitude,
            y: normalReaction.vector.y / normalReactionMagnitude,
          },
      magnitudeText: formatWorkingValue(display.normalReaction),
      magnitude: normalReactionMagnitude,
    });
  }

  if (friction && friction.magnitude > 0 && display.friction) {
    annotations.push({
      id: "friction",
      label: "Friction",
      kind: "magnitude",
      direction: {
        x: friction.vector.x / friction.magnitude,
        y: friction.vector.y / friction.magnitude,
      },
      magnitudeText: formatWorkingValue(display.friction),
      magnitude: friction.magnitude,
    });
  }

  if (tension && tension.magnitude > 0 && display.tension) {
    annotations.push({
      id: "tension",
      label: "Tension",
      kind: "magnitude",
      direction: {
        x: tension.vector.x / tension.magnitude,
        y: tension.vector.y / tension.magnitude,
      },
      magnitudeText: formatWorkingValue(display.tension),
      magnitude: tension.magnitude,
    });
  }

  particle.appliedForces.forEach((force, forceIndex) => {
    const magnitude = Math.hypot(force.vector.x, force.vector.y);
    if (magnitude === 0) return;
    const editor = createAppliedForceEditorConversion(force, settings);
    const base = {
      id: force.id,
      label: `Applied Force ${forceIndex + 1}`,
      direction: {
        x: force.vector.x / magnitude,
        y: force.vector.y / magnitude,
      },
      magnitude,
    };
    if (force.inputSource === "components") {
      if (force.vector.x === 0 || force.vector.y === 0) {
        const nonZeroText = force.vector.x === 0
          ? editor.componentText.y
          : editor.componentText.x;
        annotations.push({
          ...base,
          kind: "magnitude",
          magnitudeText: absoluteValueText(nonZeroText),
        });
        return;
      }
      annotations.push({
        ...base,
        kind: "components",
        componentText: editor.componentText,
        componentValues: editor.componentValues,
      });
      return;
    }
    if (isAlignedWithInclineAxis(force.vector, incline)) {
      annotations.push({
        ...base,
        kind: "magnitude",
        magnitudeText: editor.polarText.magnitude,
      });
      return;
    }
    annotations.push({
      ...base,
      kind: "angle",
      angleMarker: isMultipleOfNinetyDegrees(editor.polarValues.angle)
        ? "none"
        : "arc",
      magnitudeText: editor.polarText.magnitude,
      angleText: absoluteValueText(editor.polarText.angle),
      angleDegrees: editor.polarValues.angle,
      referenceDirection: getAngleReferenceDirection(settings.angleReferenceAxis),
      rotationDirection: settings.angleDirection === "anticlockwise" ? 1 : -1,
    });
  });

  return annotations;
}

export function isZeroResultantForce(
  particle: Particle,
  settings: SimulationSettings,
  normalReaction: number | NormalReactionDisplayInput = 0,
  friction: FrictionDisplayInput | null = null,
  tension: TensionDisplayInput | null = null,
): boolean {
  const resultant = analyseParticleForces(
    particle,
    settings.gravity,
    typeof normalReaction === "number"
      ? normalReaction
      : {
          magnitude: normalReaction.magnitude,
          vector: normalReaction.vector,
        },
    friction?.vector,
    tension && tension.magnitude > 1e-12
      ? [{
          id: "tension",
          kind: "tension",
          label: "Tension",
          vector: tension.vector,
        }]
      : [],
  ).resultant;
  return Math.hypot(resultant.x, resultant.y) < 1e-12;
}

function getResultantForceAnnotations(
  particle: Particle,
  settings: SimulationSettings,
  display: ReturnType<typeof createParticleForceDisplay>,
  normalReaction: number | NormalReactionDisplayInput,
  incline: Incline | null,
  friction: FrictionDisplayInput | null,
  tension: TensionDisplayInput | null,
): ForceAnnotation[] {
  const resultant = analyseParticleForces(
    particle,
    settings.gravity,
    typeof normalReaction === "number"
      ? normalReaction
      : {
          magnitude: normalReaction.magnitude,
          vector: normalReaction.vector,
        },
    friction?.vector,
    tension && tension.magnitude > 1e-12
      ? [{
          id: "tension",
          kind: "tension",
          label: "Tension",
          vector: tension.vector,
        }]
      : [],
  ).resultant;
  const magnitude = Math.hypot(resultant.x, resultant.y);
  if (magnitude < 1e-12) return [];

  const base = {
    id: "resultant",
    label: "Resultant Force",
    direction: {
      x: resultant.x / magnitude,
      y: resultant.y / magnitude,
    },
    magnitude,
    colour: RESULTANT_FORCE_COLOUR,
  };

  const useCartesianNotation = particle.appliedForces.length > 0 &&
    particle.appliedForceEditorMode === "components";
  if (useCartesianNotation) {
    if (Math.abs(resultant.x) < 1e-12 || Math.abs(resultant.y) < 1e-12) {
      const nonZeroDisplay = Math.abs(resultant.x) < 1e-12
        ? display.resultant.y
        : display.resultant.x;
      return [{
        ...base,
        kind: "magnitude",
        magnitudeText: formatWorkingValue(absoluteDisplayValue(nonZeroDisplay)),
      }];
    }
    return [{
      ...base,
      kind: "components",
      componentText: {
        x: formatWorkingValue(display.resultant.x),
        y: formatWorkingValue(display.resultant.y),
      },
      componentValues: {
        x: display.resultant.x.value,
        y: display.resultant.y.value,
      },
    }];
  }

  const angle = measureVelocityAngle(resultant, settings);
  const exactWorldComponents = getExactWorldResultantComponents(display, settings);
  const magnitudeText = exactWorldComponents
    ? getExactSpeedText(exactWorldComponents.x, exactWorldComponents.y)
    : formatWorkingValue(derivedValue(magnitude));
  if (isAlignedWithInclineAxis(resultant, incline)) {
    return [{
      ...base,
      kind: "magnitude",
      magnitudeText,
    }];
  }
  const angleText = exactWorldComponents
    ? getExactAngleText(exactWorldComponents.x, exactWorldComponents.y, settings)
    : formatMeasuredAngle(angle);
  return [{
    ...base,
    kind: "angle",
    angleMarker: isMultipleOfNinetyDegrees(angle) ? "none" : "arc",
    magnitudeText,
    angleText: absoluteValueText(angleText),
    angleDegrees: angle,
    referenceDirection: getAngleReferenceDirection(settings.angleReferenceAxis),
    rotationDirection: settings.angleDirection === "anticlockwise" ? 1 : -1,
  }];
}

function isAlignedWithInclineAxis(
  vector: Vec2,
  incline: Incline | null,
): boolean {
  if (!incline) return false;
  const magnitude = Math.hypot(vector.x, vector.y);
  if (magnitude < 1e-12) return false;
  const direction = { x: vector.x / magnitude, y: vector.y / magnitude };
  const geometry = getInclineGeometry(incline);
  const tangentAlignment = Math.abs(
    direction.x * geometry.tangent.x + direction.y * geometry.tangent.y,
  );
  const normalAlignment = Math.abs(
    direction.x * geometry.normal.x + direction.y * geometry.normal.y,
  );
  return tangentAlignment >= 1 - 1e-10 || normalAlignment >= 1 - 1e-10;
}

function getExactWorldResultantComponents(
  display: ReturnType<typeof createParticleForceDisplay>,
  settings: SimulationSettings,
): { x: Rational; y: Rational } | null {
  if (!display.resultant.x.exact || !display.resultant.y.exact) return null;
  return {
    x: settings.positiveX === "right"
      ? display.resultant.x.exact
      : negateRational(display.resultant.x.exact),
    y: settings.positiveY === "up"
      ? display.resultant.y.exact
      : negateRational(display.resultant.y.exact),
  };
}

function negateRational(value: Rational): Rational {
  return { numerator: -value.numerator, denominator: value.denominator };
}

function absoluteValueText(text: string): string {
  const trimmed = text.trim();
  return trimmed.startsWith("-") || trimmed.startsWith("−")
    ? trimmed.slice(1)
    : trimmed;
}
