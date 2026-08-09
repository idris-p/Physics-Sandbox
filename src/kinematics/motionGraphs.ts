import type { CoordinateConvention } from "./signConvention";
import {
  worldHorizontalToScalar,
  worldVerticalToScalar,
} from "./signConvention";
import type { KinematicPhase } from "./kinematicPhase";
import type { Particle } from "../model/Particle";
import {
  calculateGroundImpactTimeWithAcceleration,
  type PhysicsEnvironment,
} from "../physics/calculateParticleState";
import { analyseNonContactForces } from "../dynamics/forceAnalysis";
import {
  derivedValue,
  divideRationals,
  exactExpression,
  formatWorkingValue,
  multiplyDisplayValues,
  squareDisplayValue,
  type DisplayValue,
} from "./exactDisplay";

export type MotionGraphAxis = "x" | "y";

export interface MotionGraphRange {
  min: number;
  max: number;
  tickInterval: number;
}

export interface MotionGraphComponentPlan {
  initialVelocity: number;
  acceleration: number;
  initialVelocityDisplay?: DisplayValue;
  accelerationDisplay?: DisplayValue;
  displacementRange: MotionGraphRange;
  velocityRange: MotionGraphRange;
}

export interface MotionGraphPlan {
  phaseKind: KinematicPhase["kind"];
  phaseStartTime: number;
  endTime: number;
  timeAxisMax: number;
  timeTickInterval: number;
  positiveX: CoordinateConvention["positiveX"];
  positiveY: CoordinateConvention["positiveY"];
  components: Record<MotionGraphAxis, MotionGraphComponentPlan>;
}

export interface MotionGraphData extends MotionGraphComponentPlan {
  duration: number;
  elapsed: number;
  timeAxisMax: number;
  timeTickInterval: number;
}

export interface MotionGraphAnnotation {
  kind: "intersection" | "turning-point";
  time: number;
  value: number;
  timeDisplay: DisplayValue;
  valueDisplay: DisplayValue;
}

export type MotionGraphExactComponents = Partial<Record<
  MotionGraphAxis,
  {
    initialVelocity: DisplayValue;
    acceleration: DisplayValue;
  }
>>;

const DEFAULT_GRAPH_INTERVAL_SECONDS = 5;

export function determineMotionGraphEndTime(
  particle: Particle,
  phase: KinematicPhase,
  currentTime: number,
  environment: PhysicsEnvironment,
): number {
  if (phase.kind === "free-flight" && environment.groundEnabled) {
    const impactTime = calculateGroundImpactTimeWithAcceleration(
      particle.initialPosition.y,
      particle.initialVelocity.y,
      analyseNonContactForces(particle, environment.gravity).acceleration.y,
      environment.groundHeight,
    );
    if (impactTime !== null && impactTime > phase.startTime) return impactTime;
  }

  const elapsed = Math.max(0, currentTime - phase.startTime);
  const completeWindows = Math.floor(elapsed / DEFAULT_GRAPH_INTERVAL_SECONDS);
  return phase.startTime +
    (completeWindows + 1) * DEFAULT_GRAPH_INTERVAL_SECONDS;
}

export function createMotionGraphPlan(
  phase: KinematicPhase,
  endTime: number,
  convention: CoordinateConvention,
  exactComponents: MotionGraphExactComponents = {},
): MotionGraphPlan {
  const duration = Math.max(Number.EPSILON, endTime - phase.startTime);
  const timeTickInterval = chooseNiceTickInterval(duration / 5);
  const timeAxisMax = roundTickValue(
    Math.ceil(duration / timeTickInterval) * timeTickInterval,
  );
  return {
    phaseKind: phase.kind,
    phaseStartTime: phase.startTime,
    endTime: phase.startTime + duration,
    timeAxisMax,
    timeTickInterval,
    positiveX: convention.positiveX,
    positiveY: convention.positiveY,
    components: {
      x: createComponentPlan(
        normaliseGraphScalar(
          worldHorizontalToScalar(phase.initialVelocity.x, convention.positiveX),
        ),
        normaliseGraphScalar(
          worldHorizontalToScalar(phase.acceleration.x, convention.positiveX),
        ),
        duration,
        exactComponents.x,
      ),
      y: createComponentPlan(
        normaliseGraphScalar(
          worldVerticalToScalar(phase.initialVelocity.y, convention.positiveY),
        ),
        normaliseGraphScalar(
          worldVerticalToScalar(phase.acceleration.y, convention.positiveY),
        ),
        duration,
        exactComponents.y,
      ),
    },
  };
}

export function createMotionGraphData(
  plan: MotionGraphPlan,
  axis: MotionGraphAxis,
  currentTime: number,
): MotionGraphData {
  const duration = plan.endTime - plan.phaseStartTime;
  return {
    ...plan.components[axis],
    duration,
    elapsed: Math.min(duration, Math.max(0, currentTime - plan.phaseStartTime)),
    timeAxisMax: plan.timeAxisMax,
    timeTickInterval: plan.timeTickInterval,
  };
}

export function getMotionGraphDisplacement(
  graph: Pick<MotionGraphComponentPlan, "initialVelocity" | "acceleration">,
  time: number,
): number {
  return graph.initialVelocity * time + 0.5 * graph.acceleration * time ** 2;
}

export function getMotionGraphVelocity(
  graph: Pick<MotionGraphComponentPlan, "initialVelocity" | "acceleration">,
  time: number,
): number {
  return graph.initialVelocity + graph.acceleration * time;
}

export function getMotionGraphAnnotations(
  graph: MotionGraphData,
  quantity: "displacement" | "velocity",
): MotionGraphAnnotation[] {
  const annotations: MotionGraphAnnotation[] = [];
  const addAnnotation = (annotation: MotionGraphAnnotation): void => {
    if (!isTimeInGraphInterval(annotation.time, graph.duration)) return;
    if (annotations.some((candidate) =>
      approximatelyEqual(candidate.time, annotation.time) &&
      approximatelyEqual(candidate.value, annotation.value)
    )) return;
    annotations.push(annotation);
  };

  if (quantity === "displacement") {
    addAnnotation(createGraphAnnotation("intersection", 0, 0));
    if (graph.acceleration !== 0) {
      const secondIntersection = -2 * graph.initialVelocity / graph.acceleration;
      if (secondIntersection > 1e-12) {
        addAnnotation(createGraphAnnotation(
          "intersection",
          secondIntersection,
          0,
          scaleDisplayValue(getTurningTimeDisplay(graph), 2),
          derivedValue(0, { numerator: 0n, denominator: 1n }),
        ));
      }
      const turningTime = -graph.initialVelocity / graph.acceleration;
      if (turningTime > 1e-12 && turningTime < graph.duration - 1e-12) {
        const turningValue = getMotionGraphDisplacement(graph, turningTime);
        addAnnotation(createGraphAnnotation(
          "turning-point",
          turningTime,
          turningValue,
          getTurningTimeDisplay(graph),
          getTurningDisplacementDisplay(graph, turningValue),
        ));
      }
    }
  } else {
    addAnnotation(createGraphAnnotation(
      "intersection",
      0,
      graph.initialVelocity,
      undefined,
      graph.initialVelocityDisplay,
    ));
    if (graph.acceleration !== 0) {
      const intersectionTime = -graph.initialVelocity / graph.acceleration;
      if (intersectionTime > 1e-12) {
        addAnnotation(createGraphAnnotation(
          "intersection",
          intersectionTime,
          0,
          getTurningTimeDisplay(graph),
        ));
      }
    }
  }

  return annotations.sort((left, right) => left.time - right.time);
}

function createComponentPlan(
  initialVelocity: number,
  acceleration: number,
  duration: number,
  exactValues?: MotionGraphExactComponents[MotionGraphAxis],
): MotionGraphComponentPlan {
  const displacementValues = [
    0,
    getMotionGraphDisplacement({ initialVelocity, acceleration }, duration),
  ];
  if (acceleration !== 0) {
    const turningTime = -initialVelocity / acceleration;
    if (turningTime > 0 && turningTime < duration) {
      displacementValues.push(
        getMotionGraphDisplacement(
          { initialVelocity, acceleration },
          turningTime,
        ),
      );
    }
  }

  const velocityValues = [
    initialVelocity,
    getMotionGraphVelocity({ initialVelocity, acceleration }, duration),
  ];
  return {
    initialVelocity,
    acceleration,
    initialVelocityDisplay: exactValues?.initialVelocity,
    accelerationDisplay: exactValues?.acceleration,
    displacementRange: createPaddedRange(displacementValues),
    velocityRange: createPaddedRange(velocityValues),
  };
}

function createGraphAnnotation(
  kind: MotionGraphAnnotation["kind"],
  time: number,
  value: number,
  timeDisplay = derivedValue(time),
  valueDisplay = derivedValue(value),
): MotionGraphAnnotation {
  return { kind, time, value, timeDisplay, valueDisplay };
}

function getTurningTimeDisplay(graph: MotionGraphData): DisplayValue {
  const value = -graph.initialVelocity / graph.acceleration;
  if (!graph.initialVelocityDisplay || !graph.accelerationDisplay) {
    return derivedValue(value);
  }
  return divideDisplayValues(
    value,
    scaleDisplayValue(graph.initialVelocityDisplay, -1),
    graph.accelerationDisplay,
  );
}

function getTurningDisplacementDisplay(
  graph: MotionGraphData,
  value: number,
): DisplayValue {
  if (!graph.initialVelocityDisplay || !graph.accelerationDisplay) {
    return derivedValue(value);
  }
  return divideDisplayValues(
    value,
    scaleDisplayValue(squareDisplayValue(graph.initialVelocityDisplay), -1),
    scaleDisplayValue(graph.accelerationDisplay, 2),
  );
}

function scaleDisplayValue(value: DisplayValue, scale: number): DisplayValue {
  return multiplyDisplayValues(
    value.value * scale,
    value,
    derivedValue(scale),
  );
}

function divideDisplayValues(
  value: number,
  numerator: DisplayValue,
  denominator: DisplayValue,
): DisplayValue {
  if (denominator.exact?.numerator) {
    return multiplyDisplayValues(
      value,
      numerator,
      derivedValue(1 / denominator.value, divideRationals(
        { numerator: 1n, denominator: 1n },
        denominator.exact,
      )),
    );
  }
  return exactExpression(
    value,
    `(${formatWorkingValue(numerator)})/(${formatWorkingValue(denominator)})`,
  );
}

function normaliseGraphScalar(value: number): number {
  return Math.abs(value) < 1e-12 ? 0 : value;
}

export function createPaddedRange(values: number[]): MotionGraphRange {
  const rawFiniteValues = values.filter(Number.isFinite);
  const zeroTolerance = 1e-10 * Math.max(
    1,
    ...rawFiniteValues.map((value) => Math.abs(value)),
  );
  const finiteValues = rawFiniteValues.map((value) =>
    Math.abs(value) <= zeroTolerance ? 0 : value
  );
  let min = Math.min(0, ...finiteValues);
  let max = Math.max(0, ...finiteValues);

  if (min === 0 && max === 0) {
    return { min: 0, max: 1, tickInterval: 1 };
  }
  if (min < 0) min *= 1.08;
  if (max > 0) max *= 1.08;

  const tickInterval = chooseNiceTickInterval((max - min) / 6);
  return {
    min: min === 0
      ? 0
      : roundTickValue(Math.floor(min / tickInterval) * tickInterval),
    max: max === 0
      ? 0
      : roundTickValue(Math.ceil(max / tickInterval) * tickInterval),
    tickInterval,
  };
}

export function chooseNiceTickInterval(minimumInterval: number): number {
  if (!Number.isFinite(minimumInterval) || minimumInterval <= 0) return 1;
  const exponent = Math.floor(Math.log10(minimumInterval));
  const magnitude = 10 ** exponent;
  const normalised = minimumInterval / magnitude;
  const multiplier = [1, 2, 4, 5, 10].find(
    (candidate) => candidate >= normalised - 1e-12,
  ) ?? 10;
  return multiplier * magnitude;
}

function roundTickValue(value: number): number {
  return Number(value.toPrecision(12));
}

function isTimeInGraphInterval(time: number, duration: number): boolean {
  return time >= -1e-12 && time <= duration + 1e-12;
}

function approximatelyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <=
    1e-10 * Math.max(1, Math.abs(left), Math.abs(right));
}

export function isMotionGraphPlanValid(
  plan: MotionGraphPlan,
  phase: KinematicPhase,
  convention: CoordinateConvention,
): boolean {
  const expectedXVelocity = normaliseGraphScalar(worldHorizontalToScalar(
    phase.initialVelocity.x,
    convention.positiveX,
  ));
  const expectedXAcceleration = normaliseGraphScalar(worldHorizontalToScalar(
    phase.acceleration.x,
    convention.positiveX,
  ));
  const expectedYVelocity = normaliseGraphScalar(worldVerticalToScalar(
    phase.initialVelocity.y,
    convention.positiveY,
  ));
  const expectedYAcceleration = normaliseGraphScalar(worldVerticalToScalar(
    phase.acceleration.y,
    convention.positiveY,
  ));
  return plan.phaseKind === phase.kind &&
    Math.abs(plan.phaseStartTime - phase.startTime) <= Number.EPSILON * 32 &&
    plan.positiveX === convention.positiveX &&
    plan.positiveY === convention.positiveY &&
    plan.components.x.initialVelocity === expectedXVelocity &&
    plan.components.x.acceleration === expectedXAcceleration &&
    plan.components.y.initialVelocity === expectedYVelocity &&
    plan.components.y.acceleration === expectedYAcceleration;
}
