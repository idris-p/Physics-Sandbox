import {
  absoluteDisplayValue,
  addDisplayValues,
  convertEnteredScalarText,
  derivedValue,
  divideDisplayValues,
  enteredDecimal,
  formatWorkingValue,
  multiplyDisplayValues,
  type DisplayValue,
} from "../kinematics/exactDisplay";
import { createPolarVectorComponentDisplay } from "../kinematics/polarVelocityExact";
import {
  worldHorizontalToScalar,
  worldVerticalToScalar,
} from "../kinematics/signConvention";
import type { AppliedForce } from "../model/AppliedForce";
import type { Particle } from "../model/Particle";
import type { SimulationSettings } from "../model/SimulationSettings";
import type { Vec2 } from "../math/Vec2";
import { analyseParticleForces } from "./forceAnalysis";
import type { FrictionRegime } from "./friction";

export interface NormalReactionDisplayInput {
  magnitude: number;
  vector: { x: number; y: number };
  magnitudeDisplay: DisplayValue;
  xDisplay: DisplayValue;
  yDisplay: DisplayValue;
}

export interface FrictionDisplayInput {
  magnitude: number;
  vector: Vec2;
  magnitudeDisplay: DisplayValue;
  limitingMagnitudeDisplay: DisplayValue;
  xDisplay: DisplayValue;
  yDisplay: DisplayValue;
  regime: FrictionRegime;
}

export interface TensionDisplayInput {
  magnitude: number;
  vector: Vec2;
}

export interface ForceContributionDisplay {
  id: string;
  label: string;
  x: DisplayValue;
  y: DisplayValue;
}

export interface ParticleForceDisplay {
  weightWorking: string;
  weightMagnitude: DisplayValue;
  weightDirection: Vec2;
  normalReaction: DisplayValue | null;
  normalReactionDirection: Vec2 | null;
  friction: DisplayValue | null;
  frictionLimit: DisplayValue | null;
  frictionDirection: Vec2 | null;
  frictionRegime: FrictionRegime | null;
  tension: DisplayValue | null;
  tensionDirection: Vec2 | null;
  forces: ForceContributionDisplay[];
  resultant: { x: DisplayValue; y: DisplayValue };
  acceleration: { x: DisplayValue; y: DisplayValue };
}

export function createParticleForceDisplay(
  particle: Particle,
  settings: SimulationSettings,
  normalReaction: number | NormalReactionDisplayInput = 0,
  friction: FrictionDisplayInput | null = null,
  tension: TensionDisplayInput | null = null,
): ParticleForceDisplay {
  const normalReactionMagnitude = typeof normalReaction === "number"
    ? normalReaction
    : normalReaction.magnitude;
  const analysis = analyseParticleForces(
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
  );
  const mass = enteredDecimal(particle.massInput, particle.mass);
  const gravity = enteredDecimal(settings.gravityInput, settings.gravity);
  const weightMagnitude = multiplyDisplayValues(
    particle.mass * settings.gravity,
    mass,
    gravity,
  );
  const weightYWorld = multiplyDisplayValues(
    -particle.mass * settings.gravity,
    derivedValue(-1, { numerator: -1n, denominator: 1n }),
    mass,
    gravity,
  );
  const weight = {
    id: "weight",
    label: "Weight",
    x: derivedValue(0, { numerator: 0n, denominator: 1n }),
    y: settings.positiveY === "up"
      ? weightYWorld
      : multiplyDisplayValues(
          particle.mass * settings.gravity,
          derivedValue(-1, { numerator: -1n, denominator: 1n }),
          weightYWorld,
        ),
  };
  const applied = particle.appliedForces.map((force, index) => ({
    id: force.id,
    label: `Applied Force ${index + 1}`,
    x: getAppliedComponentDisplay(force, "x", settings),
    y: getAppliedComponentDisplay(force, "y", settings),
  }));
  const nonContactResultantY = sumDisplays([
    weight.y,
    ...applied.map((force) => force.y),
  ]);
  const normalReactionY = normalReactionMagnitude > 0
    ? typeof normalReaction === "number"
      ? multiplyDisplayValues(
          worldVerticalToScalar(normalReactionMagnitude, settings.positiveY),
          derivedValue(-1, { numerator: -1n, denominator: 1n }),
          nonContactResultantY,
        )
      : normalReaction.yDisplay
    : null;
  const normalReactionContribution = normalReactionY === null
    ? null
    : {
        id: "normal-reaction",
        label: "Normal Reaction",
        x: typeof normalReaction === "number"
          ? derivedValue(0, { numerator: 0n, denominator: 1n })
          : normalReaction.xDisplay,
        y: normalReactionY,
      };
  const frictionContribution = friction && friction.magnitude > 1e-12
    ? {
        id: "friction",
        label: "Friction",
        x: friction.xDisplay,
        y: friction.yDisplay,
      }
    : null;
  const tensionContribution = tension && tension.magnitude > 1e-12
    ? {
        id: "tension",
        label: "Tension",
        x: derivedValue(
          worldHorizontalToScalar(tension.vector.x, settings.positiveX),
        ),
        y: derivedValue(
          worldVerticalToScalar(tension.vector.y, settings.positiveY),
        ),
      }
    : null;
  const forces = [
    weight,
    ...(normalReactionContribution ? [normalReactionContribution] : []),
    ...(frictionContribution ? [frictionContribution] : []),
    ...(tensionContribution ? [tensionContribution] : []),
    ...applied,
  ];
  const resultant = {
    x: sumDisplays(forces.map((force) => force.x)),
    y: sumDisplays(forces.map((force) => force.y)),
  };
  const normalReactionDirection = analysis.forces.find(
    (force) => force.kind === "normal-reaction",
  )?.vector ?? null;
  const frictionVector = analysis.forces.find(
    (force) => force.kind === "friction",
  )?.vector ?? null;
  return {
    weightWorking: `${particle.massInput} × ${settings.gravityInput}`,
    weightMagnitude,
    weightDirection: { x: 0, y: -1 },
    normalReaction: normalReactionY === null
      ? null
      : typeof normalReaction === "number"
        ? absoluteDisplayValue(normalReactionY)
        : normalReaction.magnitudeDisplay,
    normalReactionDirection,
    friction: frictionContribution ? friction!.magnitudeDisplay : null,
    frictionLimit: frictionContribution
      ? friction!.limitingMagnitudeDisplay
      : null,
    frictionDirection: frictionVector,
    frictionRegime: frictionContribution ? friction!.regime : null,
    tension: tensionContribution ? derivedValue(tension!.magnitude) : null,
    tensionDirection: tensionContribution
      ? {
          x: tension!.vector.x / tension!.magnitude,
          y: tension!.vector.y / tension!.magnitude,
        }
      : null,
    forces,
    resultant,
    acceleration: {
      x: divideDisplayValues(
        worldHorizontalToScalar(analysis.acceleration.x, settings.positiveX),
        resultant.x,
        mass,
      ),
      y: divideDisplayValues(
        worldVerticalToScalar(analysis.acceleration.y, settings.positiveY),
        resultant.y,
        mass,
      ),
    },
  };
}

function getAppliedComponentDisplay(
  force: AppliedForce,
  axis: "x" | "y",
  settings: SimulationSettings,
): DisplayValue {
  const value = axis === "x"
    ? worldHorizontalToScalar(force.vector.x, settings.positiveX)
    : worldVerticalToScalar(force.vector.y, settings.positiveY);
  if (force.inputSource === "magnitude-direction" && force.polarInput) {
    return createPolarVectorComponentDisplay(
      force.vector,
      force.polarInput,
      axis,
      settings,
    ) ?? derivedValue(value);
  }
  const input = force.componentInput[axis];
  const displayedDirection = axis === "x" ? settings.positiveX : settings.positiveY;
  return enteredDecimal(
    convertEnteredScalarText(
      input.text,
      input.positiveDirection,
      displayedDirection,
    ),
    value,
  );
}

function sumDisplays(values: DisplayValue[]): DisplayValue {
  return values.reduce(
    (sum, value) => addDisplayValues(sum.value + value.value, sum, value),
    derivedValue(0, { numerator: 0n, denominator: 1n }),
  );
}

export function formatForceDisplay(value: DisplayValue): string {
  return formatWorkingValue(value);
}
