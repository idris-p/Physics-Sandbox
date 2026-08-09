import {
  formatMeasuredAngle,
  measureVelocityAngle,
  velocityFromSpeedAndAngle,
  type AngleConvention,
} from "../kinematics/angleConvention";
import {
  scalarToWorldHorizontal,
  scalarToWorldVertical,
  type CoordinateConvention,
} from "../kinematics/signConvention";
import type {
  AppliedForce,
  AppliedForceInputMode,
} from "../model/AppliedForce";

export function editAppliedForceComponents(
  force: AppliedForce,
  displayed: { x: number; y: number },
  convention: CoordinateConvention,
  enteredText: { x: string; y: string },
): AppliedForce {
  return {
    ...force,
    vector: {
      x: scalarToWorldHorizontal(displayed.x, convention.positiveX),
      y: scalarToWorldVertical(displayed.y, convention.positiveY),
    },
    inputMode: "components",
    inputSource: "components",
    componentInput: {
      x: { text: enteredText.x, positiveDirection: convention.positiveX },
      y: { text: enteredText.y, positiveDirection: convention.positiveY },
    },
    polarInput: undefined,
  };
}

export function editAppliedForceMagnitudeDirection(
  force: AppliedForce,
  magnitude: number,
  angle: number,
  convention: AngleConvention,
  enteredText: { magnitude: string; angle: string },
): AppliedForce {
  if (magnitude < 0) throw new Error("Force magnitude cannot be negative.");
  if (!(angle > -180 && angle <= 180)) {
    throw new Error("Force direction must be in the interval (-180, 180].");
  }

  return {
    ...force,
    vector: velocityFromSpeedAndAngle(magnitude, angle, convention),
    inputMode: "magnitude-direction",
    inputSource: "magnitude-direction",
    polarInput: {
      magnitudeText: enteredText.magnitude,
      angleText: enteredText.angle,
      ...convention,
    },
  };
}

export function setAppliedForceInputMode(
  force: AppliedForce,
  mode: AppliedForceInputMode,
): AppliedForce {
  return force.inputMode === mode ? force : { ...force, inputMode: mode };
}

export function setAppliedForcesInputMode(
  forces: AppliedForce[],
  mode: AppliedForceInputMode,
): AppliedForce[] {
  return forces.map((force) => setAppliedForceInputMode(force, mode));
}

export function reexpressAppliedForceDirection(
  force: AppliedForce,
  convention: AngleConvention,
): AppliedForce {
  if (force.inputSource !== "magnitude-direction" || !force.polarInput) {
    return force;
  }
  return {
    ...force,
    polarInput: {
      ...force.polarInput,
      angleText: formatMeasuredAngle(measureVelocityAngle(force.vector, convention)),
      ...convention,
    },
  };
}
