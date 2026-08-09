import type { SimulationSettings } from "../model/SimulationSettings";
import type { AppliedForce } from "../model/AppliedForce";
import { measureVelocityAngle } from "../kinematics/angleConvention";
import {
  convertEnteredScalarText,
  formatWorkingValue,
  rationalFromDecimal,
} from "../kinematics/exactDisplay";
import { createPolarVectorComponentDisplay } from "../kinematics/polarVelocityExact";
import {
  worldHorizontalToScalar,
  worldVerticalToScalar,
} from "../kinematics/signConvention";
import {
  getExactAngleText,
  getExactSpeedText,
} from "../kinematics/velocityEditorConversion";

export interface AppliedForceEditorConversion {
  componentText: { x: string; y: string };
  componentValues: { x: number; y: number };
  polarText: { magnitude: string; angle: string };
  polarValues: { magnitude: number; angle: number };
}

export function createAppliedForceEditorConversion(
  force: AppliedForce,
  settings: SimulationSettings,
): AppliedForceEditorConversion {
  const componentValues = {
    x: worldHorizontalToScalar(force.vector.x, settings.positiveX),
    y: worldVerticalToScalar(force.vector.y, settings.positiveY),
  };
  const polarValues = {
    magnitude: Math.hypot(force.vector.x, force.vector.y),
    angle: measureVelocityAngle(force.vector, settings),
  };

  return {
    componentText: getComponentText(force, settings),
    componentValues,
    polarText: getPolarText(force, settings, polarValues),
    polarValues,
  };
}

function getComponentText(
  force: AppliedForce,
  settings: SimulationSettings,
): { x: string; y: string } {
  if (force.inputSource === "magnitude-direction" && force.polarInput) {
    const x = createPolarVectorComponentDisplay(
      force.vector,
      force.polarInput,
      "x",
      settings,
    );
    const y = createPolarVectorComponentDisplay(
      force.vector,
      force.polarInput,
      "y",
      settings,
    );
    if (x && y) return { x: formatWorkingValue(x), y: formatWorkingValue(y) };
  }

  return {
    x: convertEnteredScalarText(
      force.componentInput.x.text,
      force.componentInput.x.positiveDirection,
      settings.positiveX,
    ),
    y: convertEnteredScalarText(
      force.componentInput.y.text,
      force.componentInput.y.positiveDirection,
      settings.positiveY,
    ),
  };
}

function getPolarText(
  force: AppliedForce,
  settings: SimulationSettings,
  values: { magnitude: number; angle: number },
): { magnitude: string; angle: string } {
  if (force.inputSource === "magnitude-direction" && force.polarInput) {
    return {
      magnitude: force.polarInput.magnitudeText,
      angle: force.polarInput.angleText,
    };
  }

  const xText = convertEnteredScalarText(
    force.componentInput.x.text,
    force.componentInput.x.positiveDirection,
    "right",
  );
  const yText = convertEnteredScalarText(
    force.componentInput.y.text,
    force.componentInput.y.positiveDirection,
    "up",
  );
  const x = rationalFromDecimal(xText);
  const y = rationalFromDecimal(yText);
  return x && y
    ? {
        magnitude: getExactSpeedText(x, y),
        angle: getExactAngleText(x, y, settings),
      }
    : { magnitude: String(values.magnitude), angle: String(values.angle) };
}
