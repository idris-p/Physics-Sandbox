import "./styles/main.css";

import {
  createCamera,
  panCamera,
  resetCamera,
  resizeCamera,
  zoomCameraAt,
} from "./canvas/camera";
import { attachCanvasInteraction, type Tool } from "./canvas/interaction";
import type { PlacementPreview } from "./canvas/placementPreview";
import { getGreatestHeightMeasurements } from "./canvas/greatestHeightAnnotation";
import { getVerticalTargetMeasurements } from "./canvas/verticalTargetAnnotation";
import {
  findCanvasExactValueHoverTarget,
  render,
  type CanvasExactValueHoverTarget,
  type CanvasTooltipExclusion,
} from "./canvas/renderer";
import { renderCanvasMathLabels } from "./ui/canvasMathOverlay";
import {
  calculateKinematicDisplayValues,
  calculateSuvatEquationResults,
} from "./kinematics/suvat";
import {
  addRationals,
  absoluteDisplayValue,
  convertEnteredScalarText,
  derivedValue,
  enteredDecimal,
  formatWorkingValue,
  rationalFromDecimal,
  subtractRationals,
  type DisplayValue,
  type Rational,
} from "./kinematics/exactDisplay";
import type { KinematicPhase } from "./kinematics/kinematicPhase";
import { calculateHorizontalAnalysisEquationResults } from "./kinematics/horizontalKinematics";
import { calculateParticleKinematicState2D } from "./kinematics/particleKinematics2D";
import {
  createInclineGraphPhase,
  createInclineInitialTangentialVelocityDisplay,
  determineInclineGraphEndTime,
} from "./kinematics/inclineKinematics";
import { createPolarVelocityComponentDisplay } from "./kinematics/polarVelocityExact";
import {
  createMotionGraphData,
  createMotionGraphPlan,
  determineMotionGraphEndTime,
  isMotionGraphPlanValid,
  type MotionGraphExactComponents,
  type MotionGraphPlan,
} from "./kinematics/motionGraphs";
import { scalarToWorldVertical } from "./kinematics/signConvention";
import { createVelocityEditorConversion } from "./kinematics/velocityEditorConversion";
import {
  analyseNonContactForces,
} from "./dynamics/forceAnalysis";
import {
  createInclineForceResolutionDisplay,
  createInclineNormalReactionDisplay,
} from "./dynamics/inclineForceDisplay";
import { createParticleForceDisplay } from "./dynamics/forceDisplay";
import { createFrictionDisplay } from "./dynamics/frictionDisplay";
import { createAppliedForceEditorConversion } from "./dynamics/appliedForceEditorConversion";
import {
  editAppliedForceComponents,
  editAppliedForceMagnitudeDirection,
  reexpressAppliedForceDirection,
  setAppliedForcesInputMode,
} from "./dynamics/editAppliedForce";
import { createAppliedForce, type AppliedForce } from "./model/AppliedForce";
import { createParticle } from "./model/Particle";
import type { Vec2 } from "./math/Vec2";
import {
  createIncline,
  setInclineRoughness,
  type Incline,
} from "./model/Incline";
import { addDefaultIncline, removeIncline } from "./model/inclineScene";
import {
  canPlaceIncline,
  getInclineGeometry,
  pointAtInclineCoordinate,
} from "./geometry/inclineGeometry";
import {
  placeParticlesOnInclineSurface,
  snapParticleToIncline as snapParticleOntoIncline,
} from "./simulation/inclineSetup";
import type { ParticleState } from "./model/Particle";
import { createScene } from "./model/Scene";
import { calculateSceneState } from "./physics/calculateSceneState";
import {
  calculateConnectedSystemTrajectory,
  getConnectedTrajectoryBoundaryEvent,
  type ConnectedBoundaryEvent,
} from "./physics/connectedTrajectory";
import { analyseConnectedSystem } from "./dynamics/connectedSystem";
import { createConnectedSystemDisplay } from "./dynamics/connectedSystemDisplay";
import {
  connectParticlesWithString,
  resizeStringToCurrentSeparation,
  getStringEndpointCoordinates,
  removeString,
  removeStringsForParticle,
  setStringLength,
  validateStringConnection,
} from "./dynamics/stringConnection";
import {
  calculateGroundImpactTimeWithAcceleration,
  isAtPositiveGroundImpact,
} from "./physics/calculateParticleState";
import { calculateSurfaceTrajectory } from "./physics/surfaceTrajectory";
import {
  editParticleInitialVelocityAngle,
  editParticleInitialVelocityComponents,
  reexpressParticleInitialVelocityAngle,
  setParticleInitialVelocityEditorMode,
} from "./simulation/editInitialConditions";
import {
  getGreatestHeightPauseTimeDisplay,
  getGroundContactPauseTimeDisplay,
  getVerticalTargetPauseTimeDisplay,
  createAutoPauseTimeDisplayValue,
  type AutoPauseTimeDisplay,
} from "./simulation/autoPauseTimeDisplay";
import { createPhaseIntervalNote } from "./simulation/phaseIntervalNote";
import {
  advancePlayback,
  earliestPauseTime,
  getNextGroundContactPauseEvent,
  getNextGreatestHeightPauseEvent,
  getNextIntegerSecond,
  getNextParticleCoincidencePauseEvent,
  getNextVerticalTargetPauseEvent,
  getAdjacentStepTime,
  sameTime,
  type GreatestHeightPauseEvent,
  type GroundContactPauseEvent,
  type VerticalTargetPauseEvent,
} from "./simulation/playback";
import {
  createControls,
  formatPlaybackTime,
  type PlaybackButtonState,
} from "./ui/controls";
import {
  getConnectedBoundaryPlayReason,
  getConnectedBoundaryTimeDisplay,
} from "./ui/connectedBoundaryPresentation";

const scene = createScene();
const camera = createCamera(1, 1);
let activeTool: Tool = "select";
let selectedParticleId: string | null = null;
let groundSelected = false;
let selectedInclineId: string | null = null;
let selectedStringId: string | null = null;
let stringConnectionSourceId: string | null = null;
let stringConnectionPointer: Vec2 | null = null;
let stringConnectionMessage: string | null = null;
let draggedParticleId: string | null = null;
let placementPreview: PlacementPreview | null = null;
let currentTime = 0;
let currentTimeEnteredText: string | undefined = "0";
let isPlaying = false;
let pendingPauseTime: number | null = null;
let previousFrameTimestamp: number | null = null;
let greatestHeightPauseEvent: GreatestHeightPauseEvent | null = null;
let verticalTargetPauseEvent: VerticalTargetPauseEvent | null = null;
let autoPauseTimeDisplay: AutoPauseTimeDisplay | null = null;
let nextParticleId = 1;
let nextAppliedForceId = 1;
let nextInclineId = 1;
let nextStringId = 1;
let canvasExactValueHoverTargets: CanvasExactValueHoverTarget[] = [];
let canvasTooltipExclusions: CanvasTooltipExclusion[] = [];
let motionGraphPlanLock: { particleId: string; plan: MotionGraphPlan } | null = null;
let connectedBoundaryEvent: ConnectedBoundaryEvent | null = null;

const controls = createControls({
  onToolChange: (tool) => {
    cancelStringConnection(false);
    activeTool = tool;
    placementPreview = null;
  },
  onRemove: removeSelectedParticle,
  onConnectWithString: beginStringConnection,
  onStringLengthChange: (length, enteredText) => {
    if (!selectedStringId) return false;
    const result = setStringLength(scene, selectedStringId, length, enteredText);
    if (!result.ok) return false;
    resetTime();
    return true;
  },
  onGroundChange: (enabled) => {
    scene.groundEnabled = enabled;
    if (!enabled) groundSelected = false;

    if (enabled) {
      for (const particle of scene.particles) {
        if (particle.initialPosition.y < scene.groundHeight) {
          particle.initialPosition.y = scene.groundHeight;
        }
      }
    }

    resetTime();
    updateUi();
  },
  onShowForceArrowsChange: (visible) => {
    scene.showForceArrows = visible;
  },
  onGravityChange: (gravity, enteredText) => {
    scene.settings.gravity = gravity;
    scene.settings.gravityInput = enteredText;
    resetTime();
  },
  onParticleNameChange: (name) => {
    const particle = getSelectedParticle();
    if (!particle) return;
    particle.name = name;
    updateUi();
  },
  onParticleShapeChange: (shape) => {
    const particle = getSelectedParticle();
    if (!particle) return;
    particle.shape = shape;
    updateUi();
  },
  onParticleMassChange: (mass, enteredText) => {
    const particle = getSelectedParticle();
    if (particle) {
      const previousMass = particle.mass;
      const previousMassInput = particle.massInput;
      particle.mass = mass;
      particle.massInput = enteredText;
      if (!areAllStringsValid()) {
        particle.mass = previousMass;
        particle.massInput = previousMassInput;
        stringConnectionMessage =
          "That mass would make the existing direct connection unsupported.";
      } else {
        stringConnectionMessage = null;
      }
    }
    invalidateParticleAnalysisEvents();
    updateUi();
  },
  onAddAppliedForce: () => {
    const particle = getSelectedParticle();
    if (!particle) return;
    particle.appliedForces.push(createAppliedForce(
      `force-${nextAppliedForceId}`,
      particle.appliedForceEditorMode,
    ));
    nextAppliedForceId += 1;
    invalidateParticleAnalysisEvents();
    updateUi();
  },
  onShowResultantForceChange: (enabled) => {
    const particle = getSelectedParticle();
    if (!particle) return;
    particle.showResultantForce = enabled;
    updateUi();
  },
  onRemoveAppliedForce: (forceId) => {
    const particle = getSelectedParticle();
    if (!particle) return;
    particle.appliedForces = particle.appliedForces.filter(
      (force) => force.id !== forceId,
    );
    invalidateParticleAnalysisEvents();
    updateUi();
  },
  onAppliedForceModeChange: (mode) => {
    const particle = getSelectedParticle();
    if (!particle || particle.appliedForceEditorMode === mode) return;
    particle.appliedForceEditorMode = mode;
    particle.appliedForces = setAppliedForcesInputMode(
      particle.appliedForces,
      mode,
    );
    updateUi();
  },
  onAppliedForceComponentsChange: (forceId, vector, enteredText) => {
    updateSelectedAppliedForce(forceId, (force) =>
      editAppliedForceComponents(force, vector, scene.settings, enteredText)
    );
  },
  onAppliedForceMagnitudeDirectionChange: (
    forceId,
    magnitude,
    angle,
    enteredText,
  ) => {
    updateSelectedAppliedForce(forceId, (force) =>
      editAppliedForceMagnitudeDirection(
        force,
        magnitude,
        angle,
        scene.settings,
        enteredText,
      )
    );
  },
  onParticleInitialVelocityComponentsChange: (velocity, enteredText) => {
    const particleIndex = scene.particles.findIndex(
      (particle) => particle.id === selectedParticleId,
    );
    if (particleIndex < 0) return;

    const candidate = editParticleInitialVelocityComponents(
      scene.particles[particleIndex],
      velocity,
      scene.settings,
      enteredText,
    );
    replaceParticlePreservingStrings(particleIndex, candidate);
    greatestHeightPauseEvent = null;
    verticalTargetPauseEvent = null;
    autoPauseTimeDisplay = null;
    updateUi();
  },
  onParticleInitialVelocityAngleChange: (speed, angle, enteredText) => {
    const particleIndex = scene.particles.findIndex(
      (particle) => particle.id === selectedParticleId,
    );
    if (particleIndex < 0) return;

    const candidate = editParticleInitialVelocityAngle(
      scene.particles[particleIndex],
      speed,
      angle,
      scene.settings,
      enteredText,
    );
    replaceParticlePreservingStrings(particleIndex, candidate);
    greatestHeightPauseEvent = null;
    verticalTargetPauseEvent = null;
    autoPauseTimeDisplay = null;
    updateUi();
  },
  onParticleInitialVelocityModeChange: (mode) => {
    const particleIndex = scene.particles.findIndex(
      (particle) => particle.id === selectedParticleId,
    );
    if (particleIndex < 0) return;
    scene.particles[particleIndex] = setParticleInitialVelocityEditorMode(
      scene.particles[particleIndex],
      mode,
    );
    greatestHeightPauseEvent = null;
    verticalTargetPauseEvent = null;
    autoPauseTimeDisplay = null;
    updateUi();
  },
  onParticlePauseAtGreatestHeightChange: (enabled) => {
    const particle = scene.particles.find(
      (candidate) => candidate.id === selectedParticleId,
    );
    if (!particle) return;

    particle.pauseAtGreatestHeight = enabled;
    greatestHeightPauseEvent = null;
    verticalTargetPauseEvent = null;
    autoPauseTimeDisplay = null;
    updateUi();
  },
  onParticlePauseAtGroundContactChange: (enabled) => {
    const particle = scene.particles.find(
      (candidate) => candidate.id === selectedParticleId,
    );
    if (!particle) return;

    particle.pauseAtGroundContact = enabled;
    autoPauseTimeDisplay = null;
    updateUi();
  },
  onParticlePauseAtCoincidenceChange: (enabled) => {
    const particle = scene.particles.find(
      (candidate) => candidate.id === selectedParticleId,
    );
    if (!particle) return;

    particle.pauseAtParticleCoincidence = enabled;
  },
  onParticlePauseAtVerticalTargetChange: (enabled) => {
    const particle = scene.particles.find(
      (candidate) => candidate.id === selectedParticleId,
    );
    if (!particle) return;

    particle.pauseAtVerticalTarget = enabled;
    verticalTargetPauseEvent = null;
    autoPauseTimeDisplay = null;
    updateUi();
  },
  onParticleVerticalPauseTargetValueChange: (value, enteredText) => {
    const particle = scene.particles.find(
      (candidate) => candidate.id === selectedParticleId,
    );
    if (!particle) return;

    if (scene.groundEnabled) {
      particle.pauseHeightAboveGround = value;
      particle.pauseHeightAboveGroundText = enteredText;
    } else {
      particle.pauseVerticalDisplacement = scalarToWorldVertical(
        value,
        scene.settings.positiveY,
      );
      particle.pauseVerticalDisplacementInput = {
        text: enteredText,
        positiveDirection: scene.settings.positiveY,
      };
    }
    verticalTargetPauseEvent = null;
    autoPauseTimeDisplay = null;
    updateUi();
  },
  onPositiveXChange: (direction) => {
    scene.settings.positiveX = direction;
    updateUi();
  },
  onPositiveYChange: (direction) => {
    scene.settings.positiveY = direction;
    updateUi();
  },
  onAngleConventionChange: (referenceAxis, direction) => {
    const convention = {
      angleReferenceAxis: referenceAxis,
      angleDirection: direction,
    };
    scene.particles = scene.particles.map((particle) => ({
      ...reexpressParticleInitialVelocityAngle(particle, convention),
      appliedForces: particle.appliedForces.map((force) =>
        reexpressAppliedForceDirection(force, convention)
      ),
    }));
    scene.settings.angleReferenceAxis = referenceAxis;
    scene.settings.angleDirection = direction;
    motionGraphPlanLock = null;
    refreshCurrentAutoPauseTimeDisplay();
    updateUi();
  },
  onGroundFrictionChange: (coefficient) => {
    scene.groundFriction = coefficient;
    resetTime();
  },
  onGroundRoughChange: (rough) => {
    scene.groundRough = rough;
    resetTime();
  },
  onInclineLengthChange: (length, enteredText) => {
    const incline = getSelectedIncline();
    if (!incline) return;
    resizeIncline(incline.id, length, enteredText);
  },
  onInclineAngleChange: (angle, enteredText) => {
    const incline = getSelectedIncline();
    if (!incline) return;
    const candidate = {
      ...incline,
      angleDegrees: angle,
      angleInput: enteredText,
    };
    if (!canPlaceIncline(candidate, scene.inclines)) {
      updateUi();
      return;
    }
    incline.angleDegrees = angle;
    incline.angleInput = enteredText;
    reconstructInclineSetup(incline);
  },
  onInclineDirectionChange: (direction) => {
    const incline = getSelectedIncline();
    if (!incline || incline.direction === direction) return;
    const candidate = { ...incline, direction };
    if (!canPlaceIncline(candidate, scene.inclines)) {
      updateUi();
      return;
    }
    incline.direction = direction;
    reconstructInclineSetup(incline);
  },
  onInclineRoughChange: (rough) => {
    const incline = getSelectedIncline();
    if (!incline) return;
    setInclineRoughness(incline, rough);
    resetTime();
  },
  onInclineFrictionChange: (coefficient, enteredText) => {
    const incline = getSelectedIncline();
    if (!incline || incline.roughness.kind !== "rough") return;
    incline.roughness.coefficientOfFriction = coefficient;
    incline.roughness.coefficientInput = enteredText;
    resetTime();
  },
  onClearScene: clearScene,
  onTimeChange: (time, enteredText) => {
    setPlaying(false);
    greatestHeightPauseEvent = null;
    verticalTargetPauseEvent = null;
    autoPauseTimeDisplay = null;
    currentTime = clampToConnectedBoundary(time);
    currentTimeEnteredText = enteredText;
    updateUi();
  },
  onPrevious: (interval) => stepTime(interval, "previous"),
  onNext: (interval) => stepTime(interval, "next"),
  onPlayToggle: togglePlayback,
  onReset: resetTime,
  onZoom: (factor) => {
    zoomCameraAt(
      camera,
      { x: camera.viewportWidth / 2, y: camera.viewportHeight / 2 },
      factor,
    );
    controls.setZoom(camera.pixelsPerMetre);
  },
  onResetView: () => {
    resetCamera(camera);
    controls.setZoom(camera.pixelsPerMetre);
  },
});

function getSelectedParticle() {
  return scene.particles.find(
    (particle) => particle.id === selectedParticleId,
  );
}

function getSelectedIncline(): Incline | undefined {
  return scene.inclines.find((incline) => incline.id === selectedInclineId);
}

function beginStringConnection(): void {
  const particle = getSelectedParticle();
  if (!particle) return;
  activeTool = "select";
  controls.setTool("select");
  stringConnectionSourceId = particle.id;
  stringConnectionPointer = null;
  stringConnectionMessage = "Select a particle to connect to";
  updateUi();
}

function completeStringConnection(particleId: string | null): void {
  const sourceId = stringConnectionSourceId;
  if (!sourceId) return;
  if (particleId === null) {
    cancelStringConnection();
    return;
  }
  const result = connectParticlesWithString(
    scene,
    `string-${nextStringId}`,
    sourceId,
    particleId,
  );
  if (!result.ok) {
    stringConnectionMessage = result.message;
    updateUi();
    return;
  }
  nextStringId += 1;
  selectedParticleId = null;
  groundSelected = false;
  selectedInclineId = null;
  selectedStringId = result.string.id;
  stringConnectionSourceId = null;
  stringConnectionPointer = null;
  stringConnectionMessage = null;
  resetTime();
  updateUi();
}

function cancelStringConnection(update = true): void {
  stringConnectionSourceId = null;
  stringConnectionPointer = null;
  stringConnectionMessage = null;
  if (update) updateUi();
}

function getValidStringTargetIds(sourceParticleId: string): string[] {
  return scene.particles.flatMap((particle) =>
    particle.id !== sourceParticleId &&
      validateStringConnection(scene, sourceParticleId, particle.id).valid
      ? [particle.id]
      : []
  );
}

function getEarliestConnectedBoundaryEvent(): ConnectedBoundaryEvent | null {
  return scene.strings
    .flatMap((string) => {
      const event = getConnectedTrajectoryBoundaryEvent(scene, string);
      return event ? [event] : [];
    })
    .sort((left, right) => left.time - right.time)[0] ?? null;
}

function clampToConnectedBoundary(requestedTime: number): number {
  const boundary = getEarliestConnectedBoundaryEvent();
  if (boundary && requestedTime >= boundary.time - 1e-10) {
    connectedBoundaryEvent = boundary;
    autoPauseTimeDisplay = getConnectedBoundaryTimeDisplay(boundary);
    return boundary.time;
  }
  connectedBoundaryEvent = null;
  return requestedTime;
}

function resizeIncline(
  inclineId: string,
  horizontalLength: number,
  enteredText = String(horizontalLength),
): void {
  const incline = scene.inclines.find((candidate) => candidate.id === inclineId);
  if (!incline || incline.horizontalLength === horizontalLength) return;
  const candidate = {
    ...incline,
    horizontalLength,
    horizontalLengthInput: enteredText,
  };
  if (!canPlaceIncline(candidate, scene.inclines)) {
    updateUi();
    return;
  }
  incline.horizontalLength = horizontalLength;
  incline.horizontalLengthInput = enteredText;
  reconstructInclineSetup(incline);
}

function reconstructInclineSetup(incline: Incline): void {
  const slopeLength = getInclineGeometry(incline).slopeLength;
  for (const particle of scene.particles) {
    if (particle.initialInclineContact?.inclineId !== incline.id) continue;
    particle.initialInclineContact.q = Math.min(
      slopeLength,
      Math.max(0, particle.initialInclineContact.q),
    );
    particle.initialPosition = pointAtInclineCoordinate(
      incline,
      particle.initialInclineContact.q,
    );
  }
  placeParticlesOnInclineSurface(scene.particles, incline);
  resetTime();
}

const INCLINE_SNAP_DISTANCE_METRES = 0.5;

function snapParticleToIncline(
  particle: (typeof scene.particles)[number],
  position: { x: number; y: number },
): void {
  snapParticleOntoIncline(
    particle,
    position,
    scene.inclines,
    INCLINE_SNAP_DISTANCE_METRES,
  );
}

function invalidateParticleAnalysisEvents(): void {
  greatestHeightPauseEvent = null;
  verticalTargetPauseEvent = null;
  autoPauseTimeDisplay = null;
  motionGraphPlanLock = null;
}

function updateSelectedAppliedForce(
  forceId: string,
  update: (force: AppliedForce) => AppliedForce,
): void {
  const particle = getSelectedParticle();
  if (!particle) return;
  const previousForces = particle.appliedForces;
  particle.appliedForces = particle.appliedForces.map((force) =>
    force.id === forceId ? update(force) : force
  );
  if (!areAllStringsValid()) {
    particle.appliedForces = previousForces;
    stringConnectionMessage =
      "That force would make the existing direct connection unsupported.";
  } else {
    stringConnectionMessage = null;
  }
  invalidateParticleAnalysisEvents();
  updateUi();
}

function replaceParticlePreservingStrings(
  particleIndex: number,
  candidate: (typeof scene.particles)[number],
): boolean {
  const previous = scene.particles[particleIndex];
  scene.particles[particleIndex] = candidate;
  if (areAllStringsValid()) {
    stringConnectionMessage = null;
    return true;
  }
  scene.particles[particleIndex] = previous;
  stringConnectionMessage =
    "Connected particles must keep compatible velocities on the shared path.";
  return false;
}

function areAllStringsValid(): boolean {
  return scene.strings.every((string) =>
    validateStringConnection(
      scene,
      string.particleAId,
      string.particleBId,
      string.id,
    ).valid
  );
}

function isParticleMoveValid(
  particleId: string,
  position: Vec2,
): boolean {
  const particle = scene.particles.find((candidate) => candidate.id === particleId);
  if (!particle) return false;

  const previousPosition = { ...particle.initialPosition };
  const previousContact = particle.initialInclineContact
    ? { ...particle.initialInclineContact }
    : undefined;
  const previousStringLengths = scene.strings.map((string) => ({
    string,
    length: string.length,
    lengthInput: string.lengthInput,
  }));
  particle.initialPosition = { ...position };
  snapParticleToIncline(particle, position);
  resizeStringsForParticle(particleId);
  const valid = areAllStringsValid();
  particle.initialPosition = previousPosition;
  particle.initialInclineContact = previousContact;
  for (const snapshot of previousStringLengths) {
    snapshot.string.length = snapshot.length;
    snapshot.string.lengthInput = snapshot.lengthInput;
  }
  return valid;
}

function resizeStringsForParticle(particleId: string): void {
  for (const string of scene.strings) {
    if (
      string.particleAId === particleId ||
      string.particleBId === particleId
    ) {
      resizeStringToCurrentSeparation(scene, string.id);
    }
  }
}

const STRING_LIMIT_SNAP_DISTANCE_METRES = 0.25;

function resolveParticleMove(
  particleId: string,
  pointerPosition: Vec2,
  defaultPosition: Vec2,
): Vec2 {
  const string = scene.strings.find(
    (candidate) => candidate.particleAId === particleId ||
      candidate.particleBId === particleId,
  );
  if (!string) return defaultPosition;
  const endpoints = getStringEndpointCoordinates(scene, string);
  if (!endpoints) return defaultPosition;

  const otherQ = string.particleAId === particleId
    ? endpoints.qB
    : endpoints.qA;
  const support = endpoints.support;
  const limitPositions = [otherQ - string.length, otherQ + string.length]
    .flatMap((q): Vec2[] => {
      if (support.kind === "ground") {
        return [{ x: q, y: scene.groundHeight }];
      }
      if (q < -1e-9 || q > support.slopeLength + 1e-9) return [];
      const incline = scene.inclines.find(
        (candidate) => candidate.id === support.inclineId,
      );
      return incline
        ? [pointAtInclineCoordinate(
            incline,
            Math.max(0, Math.min(q, support.slopeLength)),
          )]
        : [];
    })
    .sort((left, right) =>
      Math.hypot(
        left.x - pointerPosition.x,
        left.y - pointerPosition.y,
      ) - Math.hypot(
        right.x - pointerPosition.x,
        right.y - pointerPosition.y,
      )
    );
  const nearestLimit = limitPositions[0];
  if (
    nearestLimit &&
    Math.hypot(
      nearestLimit.x - pointerPosition.x,
      nearestLimit.y - pointerPosition.y,
    ) <= STRING_LIMIT_SNAP_DISTANCE_METRES
  ) {
    return nearestLimit;
  }
  return defaultPosition;
}

const canvasExactTooltipElement = document.getElementById("canvas-exact-tooltip");
if (!canvasExactTooltipElement) {
  throw new Error("Missing required canvas exact-value tooltip.");
}
const canvasExactTooltip: HTMLElement = canvasExactTooltipElement;

controls.canvas.addEventListener("pointermove", (event) => {
  const bounds = controls.canvas.getBoundingClientRect();
  const point = { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
  const target = findCanvasExactValueHoverTarget(
    canvasExactValueHoverTargets,
    point,
    canvasTooltipExclusions,
  );
  if (!target) {
    canvasExactTooltip.hidden = true;
    return;
  }
  showExactValueTooltip(target.tooltip, event.clientX, event.clientY);
});
controls.canvas.addEventListener("pointerleave", () => {
  canvasExactTooltip.hidden = true;
});

document.addEventListener("pointermove", (event) => {
  if (event.target === controls.canvas || !(event.target instanceof Element)) {
    return;
  }
  const exactValue = event.target.closest<HTMLElement>(
    "[data-exact-approximation]",
  );
  if (!exactValue) {
    canvasExactTooltip.hidden = true;
    return;
  }
  if (exactValue.closest("#motion-graph-dialog")) {
    canvasExactTooltip.hidden = true;
    return;
  }
  showExactValueTooltip(
    exactValue.dataset.exactApproximation ?? "",
    event.clientX,
    event.clientY,
  );
});

document.addEventListener("focusin", (event) => {
  if (!(event.target instanceof HTMLElement)) return;
  if (event.target.closest("#motion-graph-dialog")) {
    canvasExactTooltip.hidden = true;
    return;
  }
  const tooltip = event.target.dataset.exactApproximation;
  if (!tooltip) return;
  const bounds = event.target.getBoundingClientRect();
  showExactValueTooltip(tooltip, bounds.right, bounds.bottom);
});
document.addEventListener("focusout", () => {
  canvasExactTooltip.hidden = true;
});

function showExactValueTooltip(
  text: string,
  clientX: number,
  clientY: number,
): void {
  canvasExactTooltip.textContent = text;
  canvasExactTooltip.hidden = false;
  const bounds = controls.canvas.getBoundingClientRect();
  const point = { x: clientX - bounds.left, y: clientY - bounds.top };
  const gap = 12;
  const proposedLeft = point.x + gap;
  const proposedTop = point.y + gap;
  canvasExactTooltip.style.left = `${Math.min(
    proposedLeft,
    Math.max(gap, camera.viewportWidth - canvasExactTooltip.offsetWidth - gap),
  )}px`;
  canvasExactTooltip.style.top = `${Math.min(
    proposedTop,
    Math.max(gap, camera.viewportHeight - canvasExactTooltip.offsetHeight - gap),
  )}px`;
}

const context = getCanvasContext(controls.canvas);

attachCanvasInteraction({
  canvas: controls.canvas,
  deleteTarget: controls.deleteTarget,
  particleSource: controls.particleSource,
  inclineSource: controls.inclineSource,
  getCamera: () => camera,
  getTool: () => activeTool,
  getCurrentTime: () => currentTime,
  getParticleStates: calculateActiveParticleStates,
  getScene: () => scene,
  getInclines: () => scene.inclines,
  getSelectedInclineId: () => selectedInclineId,
  isGroundEnabled: () => scene.groundEnabled,
  getGroundHeight: () => scene.groundHeight,
  onSelect: (particleId) => {
    selectedParticleId = particleId;
    selectedStringId = null;
    stringConnectionMessage = null;
    groundSelected = false;
    selectedInclineId = null;
    updateUi();
  },
  onSelectGround: () => {
    selectedParticleId = null;
    groundSelected = true;
    selectedInclineId = null;
    selectedStringId = null;
    updateUi();
  },
  onSelectIncline: (inclineId) => {
    selectedParticleId = null;
    groundSelected = false;
    selectedInclineId = inclineId;
    selectedStringId = null;
    updateUi();
  },
  onSelectString: (stringId) => {
    selectedParticleId = null;
    groundSelected = false;
    selectedInclineId = null;
    selectedStringId = stringId;
    cancelStringConnection(false);
    updateUi();
  },
  getStringConnectionSourceId: () => stringConnectionSourceId,
  onStringConnectionPointerMove: (position) => {
    stringConnectionPointer = position;
  },
  onStringConnectionTarget: completeStringConnection,
  onPlace: (position) => {
    const particle = createParticle(
      `particle-${nextParticleId}`,
      position,
      `Particle ${nextParticleId}`,
    );
    nextParticleId += 1;
    scene.particles.push(particle);
    snapParticleToIncline(particle, position);
    selectedParticleId = particle.id;
    groundSelected = false;
    selectedInclineId = null;
    selectedStringId = null;
    resetTime();
    updateUi();
  },
  onPlaceIncline: (position) => {
    const inclineId = `incline-${nextInclineId}`;
    const candidate = createIncline(inclineId, position);
    if (!canPlaceIncline(candidate, scene.inclines)) return;
    const incline = addDefaultIncline(
      scene,
      inclineId,
      position,
    );
    nextInclineId += 1;
    placeParticlesOnInclineSurface(scene.particles, incline);
    selectedParticleId = null;
    groundSelected = false;
    selectedInclineId = incline.id;
    selectedStringId = null;
    resetTime();
    updateUi();
  },
  resolveParticleMove,
  isParticleMoveValid,
  onMoveParticle: (particleId, position) => {
    const particle = scene.particles.find((candidate) => candidate.id === particleId);
    if (!particle) return position;
    if (
      particle.initialPosition.x === position.x &&
      particle.initialPosition.y === position.y
    ) {
      return { ...particle.initialPosition };
    }

    const previousPosition = { ...particle.initialPosition };
    const previousContact = particle.initialInclineContact
      ? { ...particle.initialInclineContact }
      : undefined;
    const previousStringLengths = scene.strings.map((string) => ({
      string,
      length: string.length,
      lengthInput: string.lengthInput,
    }));
    particle.initialPosition = { ...position };
    snapParticleToIncline(particle, position);
    resizeStringsForParticle(particleId);
    const invalidString = scene.strings.find((string) =>
      !validateStringConnection(
        scene,
        string.particleAId,
        string.particleBId,
        string.id,
      ).valid
    );
    if (invalidString) {
      particle.initialPosition = previousPosition;
      particle.initialInclineContact = previousContact;
      for (const snapshot of previousStringLengths) {
        snapshot.string.length = snapshot.length;
        snapshot.string.lengthInput = snapshot.lengthInput;
      }
      stringConnectionMessage = "That move would invalidate the direct string.";
      updateUi();
      return previousPosition;
    }
    selectedParticleId = particleId;
    groundSelected = false;
    selectedInclineId = null;
    selectedStringId = null;
    resetTime();
    updateUi();
    return { ...particle.initialPosition };
  },
  onMoveIncline: (inclineId, lowerEndpoint) => {
    const incline = scene.inclines.find(
      (candidate) => candidate.id === inclineId,
    );
    if (!incline) return;
    const candidate = { ...incline, anchor: { ...lowerEndpoint } };
    if (!canPlaceIncline(candidate, scene.inclines)) return;
    if (
      incline.anchor.x === lowerEndpoint.x &&
      incline.anchor.y === lowerEndpoint.y
    ) {
      return;
    }
    incline.anchor = { ...lowerEndpoint };
    selectedParticleId = null;
    groundSelected = false;
    selectedInclineId = incline.id;
    reconstructInclineSetup(incline);
  },
  onResizeIncline: (inclineId, horizontalLength) => {
    resizeIncline(inclineId, horizontalLength);
  },
  onParticleDragChange: (particleId) => {
    draggedParticleId = particleId;
    if (particleId) {
      greatestHeightPauseEvent = null;
      verticalTargetPauseEvent = null;
    }
  },
  onDeleteParticle: removeParticle,
  onDeleteIncline: removeInclineById,
  onPlacementPreviewChange: (preview) => {
    placementPreview = preview;
  },
  onPan: (screenDelta) => panCamera(camera, screenDelta),
  onZoom: (screenPoint, factor) => {
    zoomCameraAt(camera, screenPoint, factor);
    controls.setZoom(camera.pixelsPerMetre);
  },
});

window.addEventListener("keydown", (event) => {
  const target = event.target;
  const isTyping =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement;

  if (isTyping) return;

  if (
    (selectedParticleId || selectedInclineId || selectedStringId) &&
    (event.key === "Delete" || event.key === "Backspace")
  ) {
    event.preventDefault();
    removeSelectedParticle();
  } else if (event.key === "Escape") {
    cancelStringConnection();
    activeTool = "select";
    placementPreview = null;
    controls.setTool("select");
  } else if (event.key === "1") {
    activeTool = "particle";
    placementPreview = null;
    controls.setTool("particle");
  } else if (event.key === "2") {
    activeTool = "incline";
    placementPreview = null;
    controls.setTool("incline");
  }
});

const resizeObserver = new ResizeObserver(resizeCanvas);
resizeObserver.observe(controls.canvas.parentElement ?? controls.canvas);
resizeCanvas();
updateUi();
requestAnimationFrame(renderFrame);

function resizeCanvas(): void {
  const bounds = controls.canvas.getBoundingClientRect();
  const width = Math.max(1, Math.round(bounds.width));
  const height = Math.max(1, Math.round(bounds.height));
  const pixelRatio = window.devicePixelRatio || 1;

  controls.canvas.width = Math.round(width * pixelRatio);
  controls.canvas.height = Math.round(height * pixelRatio);
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  resizeCamera(camera, width, height);
}

function renderFrame(timestamp: number): void {
  let playbackAdvanced = false;

  if (isPlaying) {
    if (previousFrameTimestamp !== null) {
      // The legacy pause-event solvers describe initial Cartesian flight and
      // horizontal-ground phases. Incline trajectories are piecewise in q and
      // must not be fed into those solvers as though they were free flight.
      const legacyEventParticles = scene.particles.filter(
        (particle) => !particle.initialInclineContact,
      );
      const nextGreatestHeightEvent = getNextGreatestHeightPauseEvent(
        legacyEventParticles,
        currentTime,
        scene.settings.gravity,
      );
      const nextGroundContactEvent = getNextGroundContactPauseEvent(
        legacyEventParticles,
        currentTime,
        scene.settings.gravity,
        scene.groundEnabled,
        scene.groundHeight,
      );
      const nextVerticalTargetEvent = getNextVerticalTargetPauseEvent(
        legacyEventParticles,
        currentTime,
        scene.settings.gravity,
        scene.groundEnabled,
        scene.groundHeight,
      );
      const nextParticleCoincidenceEvent =
        getNextParticleCoincidencePauseEvent(
          legacyEventParticles,
          currentTime,
          scene.settings.gravity,
          scene.groundEnabled,
          scene.groundHeight,
        );
      const nextConnectedBoundaryEvent = getEarliestConnectedBoundaryEvent();
      const advance = advancePlayback(
        currentTime,
        (timestamp - previousFrameTimestamp) / 1000,
        earliestPauseTime(
          earliestPauseTime(
            earliestPauseTime(
              pendingPauseTime,
              nextGreatestHeightEvent?.time ?? null,
            ),
            nextGroundContactEvent?.time ?? null,
          ),
          earliestPauseTime(
            nextVerticalTargetEvent?.time ?? null,
            earliestPauseTime(
              nextParticleCoincidenceEvent?.time ?? null,
              nextConnectedBoundaryEvent?.time ?? null,
            ),
          ),
        ),
      );
      currentTime = advance.time;
      currentTimeEnteredText = undefined;
      playbackAdvanced = true;

      if (advance.reachedScheduledPause) {
        setPlaying(false);
        greatestHeightPauseEvent =
          nextGreatestHeightEvent &&
          sameTime(advance.time, nextGreatestHeightEvent.time)
            ? nextGreatestHeightEvent
            : null;
        verticalTargetPauseEvent =
          nextVerticalTargetEvent &&
          sameTime(advance.time, nextVerticalTargetEvent.time)
            ? nextVerticalTargetEvent
            : null;
        autoPauseTimeDisplay = getTriggeredAutoPauseTimeDisplay(
          advance.time,
          nextGreatestHeightEvent,
          nextGroundContactEvent,
          nextVerticalTargetEvent,
        );
        connectedBoundaryEvent = nextConnectedBoundaryEvent &&
            sameTime(advance.time, nextConnectedBoundaryEvent.time)
          ? nextConnectedBoundaryEvent
          : null;
        if (connectedBoundaryEvent) {
          autoPauseTimeDisplay = getConnectedBoundaryTimeDisplay(
            connectedBoundaryEvent,
          );
        }
      }
      controls.setTime(
        currentTime,
        isPlaying ? formatPlaybackTime(currentTime) : undefined,
        isPlaying ? null : autoPauseTimeDisplay,
      );
      updatePlaybackControl();
    }

    if (isPlaying) previousFrameTimestamp = timestamp;
  } else {
    previousFrameTimestamp = null;
  }

  const activeParticleStates = calculateActiveParticleStates();
  if ((isPlaying || playbackAdvanced) && (selectedParticleId || selectedStringId)) {
    updateSelectionUi(activeParticleStates);
  }
  const canvasRenderResult = render(
    context,
    scene,
    activeParticleStates.filter(
      (particle) => particle.id !== draggedParticleId,
    ),
    selectedParticleId,
    groundSelected,
    selectedInclineId,
    camera,
    currentTime,
    timestamp,
    [
      ...getGreatestHeightMeasurements(
        greatestHeightPauseEvent,
        currentTime,
        scene.groundEnabled,
        scene.groundHeight,
        scene.particles,
        activeParticleStates,
        getDownwardAccelerationText,
      ),
      ...getVerticalTargetMeasurements(
        verticalTargetPauseEvent,
        currentTime,
        scene.groundEnabled,
        scene.groundHeight,
        scene.settings.positiveY,
        scene.particles,
        activeParticleStates,
      ),
    ],
    placementPreview,
    selectedStringId,
    stringConnectionSourceId && stringConnectionPointer
      ? {
          sourceParticleId: stringConnectionSourceId,
          pointer: stringConnectionPointer,
          validTargetIds: getValidStringTargetIds(stringConnectionSourceId),
        }
      : null,
  );
  canvasExactValueHoverTargets = canvasRenderResult.hoverTargets;
  canvasTooltipExclusions = canvasRenderResult.tooltipExclusions ?? [];
  renderCanvasMathLabels(
    controls.canvasMathOverlay,
    canvasRenderResult.mathLabels,
  );
  requestAnimationFrame(renderFrame);
}

function stepTime(interval: number, direction: "previous" | "next"): void {
  setPlaying(false);
  greatestHeightPauseEvent = null;
  verticalTargetPauseEvent = null;
  autoPauseTimeDisplay = null;
  currentTime = clampToConnectedBoundary(
    getAdjacentStepTime(currentTime, interval, direction),
  );
  currentTimeEnteredText = undefined;
  updateUi();
}

function resetTime(): void {
  setPlaying(false);
  greatestHeightPauseEvent = null;
  verticalTargetPauseEvent = null;
  autoPauseTimeDisplay = null;
  connectedBoundaryEvent = null;
  currentTime = 0;
  currentTimeEnteredText = "0";
  updateUi();
}

function setPlaying(playing: boolean): void {
  if (playing) {
    greatestHeightPauseEvent = null;
    verticalTargetPauseEvent = null;
    autoPauseTimeDisplay = null;
  }
  isPlaying = playing;
  pendingPauseTime = null;
  previousFrameTimestamp = null;
  updatePlaybackControl();
}

function togglePlayback(): void {
  if (!isPlaying) {
    const boundary = getEarliestConnectedBoundaryEvent();
    if (boundary && currentTime >= boundary.time - 1e-10) {
      connectedBoundaryEvent = boundary;
      autoPauseTimeDisplay = getConnectedBoundaryTimeDisplay(boundary);
      updateUi();
      return;
    }
    activeTool = "select";
    placementPreview = null;
    controls.setTool("select");
    setPlaying(true);
    currentTimeEnteredText = undefined;
    updateUi();
    return;
  }

  if (pendingPauseTime === null) {
    pendingPauseTime = getNextIntegerSecond(currentTime);
    updatePlaybackControl();
  }
}

function removeSelectedParticle(): void {
  if (selectedStringId) {
    removeString(scene, selectedStringId);
    selectedStringId = null;
    resetTime();
    updateUi();
    return;
  }
  if (selectedParticleId) {
    removeParticle(selectedParticleId);
    return;
  }
  if (!selectedInclineId) return;
  removeInclineById(selectedInclineId);
}

function removeInclineById(inclineId: string): void {
  if (!removeIncline(scene, inclineId)) return;
  selectedInclineId = null;
  selectedStringId = null;
  selectedParticleId = null;
  groundSelected = false;
  resetTime();
}

function removeParticle(particleId: string): void {
  const index = scene.particles.findIndex((particle) => particle.id === particleId);
  if (index < 0) return;

  removeStringsForParticle(scene, particleId);
  scene.particles.splice(index, 1);
  selectedParticleId = null;
  groundSelected = false;
  selectedInclineId = null;
  selectedStringId = null;
  resetTime();
  updateUi();
}

function clearScene(): void {
  scene.particles.length = 0;
  scene.inclines.length = 0;
  scene.strings.length = 0;
  selectedParticleId = null;
  groundSelected = false;
  selectedInclineId = null;
  selectedStringId = null;
  cancelStringConnection(false);
  draggedParticleId = null;
  resetTime();
}

function updateUi(): void {
  const activeParticleStates = calculateActiveParticleStates();
  updateSelectionUi(activeParticleStates);
  controls.setCoordinateConvention(scene.settings);
  controls.setTime(
    currentTime,
    isPlaying ? formatPlaybackTime(currentTime) : currentTimeEnteredText,
    isPlaying ? null : autoPauseTimeDisplay,
  );
  updatePlaybackControl();
  controls.setZoom(camera.pixelsPerMetre);
}

function getTriggeredAutoPauseTimeDisplay(
  pauseTime: number,
  greatestHeightEvent: GreatestHeightPauseEvent | null,
  groundContactEvent: GroundContactPauseEvent | null,
  verticalTargetEvent: VerticalTargetPauseEvent | null,
): AutoPauseTimeDisplay | null {
  if (greatestHeightEvent && sameTime(pauseTime, greatestHeightEvent.time)) {
    const particle = scene.particles.find(
      (candidate) => candidate.id === greatestHeightEvent.particleIds[0],
    );
    return particle
      ? getGreatestHeightPauseTimeDisplay(
          particle,
          getDownwardAccelerationText(particle),
        )
      : null;
  }

  if (groundContactEvent && sameTime(pauseTime, groundContactEvent.time)) {
    const particle = scene.particles.find(
      (candidate) => candidate.id === groundContactEvent.particleIds[0],
    );
    return particle
      ? getGroundContactPauseTimeDisplay(
          particle,
          getDownwardAccelerationText(particle),
          scene.groundHeight,
        )
      : null;
  }

  if (verticalTargetEvent && sameTime(pauseTime, verticalTargetEvent.time)) {
    const particle = scene.particles.find(
      (candidate) => candidate.id === verticalTargetEvent.particleIds[0],
    );
    return particle
      ? getVerticalTargetPauseTimeDisplay(
          particle,
          getDownwardAccelerationText(particle),
          scene.groundEnabled,
          scene.groundHeight,
          pauseTime,
        )
      : null;
  }

  return null;
}

function refreshCurrentAutoPauseTimeDisplay(): void {
  if (autoPauseTimeDisplay === null) return;
  const groundContactIds = scene.groundEnabled
    ? scene.particles.flatMap((particle) => {
        if (!particle.pauseAtGroundContact || particle.initialInclineContact) {
          return [];
        }
        const impactTime = calculateGroundImpactTimeWithAcceleration(
          particle.initialPosition.y,
          particle.initialVelocity.y,
          analyseNonContactForces(particle, scene.settings.gravity).acceleration.y,
          scene.groundHeight,
        );
        return impactTime !== null && sameTime(currentTime, impactTime)
          ? [particle.id]
          : [];
      })
    : [];
  const groundContactEvent: GroundContactPauseEvent | null =
    groundContactIds.length > 0
      ? { time: currentTime, particleIds: groundContactIds }
      : null;
  const refreshed = getTriggeredAutoPauseTimeDisplay(
    currentTime,
    greatestHeightPauseEvent,
    groundContactEvent,
    verticalTargetPauseEvent,
  );
  if (refreshed !== null) autoPauseTimeDisplay = refreshed;
}

function updateSelectionUi(activeParticleStates: ParticleState[]): void {
  const selectedParticleState = selectedParticleId
    ? activeParticleStates.find(
        (particle) => particle.id === selectedParticleId,
      ) ?? null
    : null;
  const selectedParticle = selectedParticleState
    ? scene.particles.find((particle) => particle.id === selectedParticleState.id) ?? null
    : null;
  const selectedIncline = selectedInclineId
    ? scene.inclines.find((incline) => incline.id === selectedInclineId) ?? null
    : null;
  const selectedString = selectedStringId
    ? scene.strings.find((string) => string.id === selectedStringId) ?? null
    : null;
  const selectedConnectedTrajectory = selectedString
    ? calculateConnectedSystemTrajectory(scene, selectedString, currentTime)
    : null;
  const connectedAnalysis = selectedConnectedTrajectory?.analysis ??
    (selectedString ? analyseConnectedSystem(scene, selectedString) : null);
  const connectedDisplay = connectedAnalysis
    ? createConnectedSystemDisplay(scene, connectedAnalysis)
    : null;
  controls.setSelected(
    selectedParticleState !== null || selectedIncline !== null || selectedString !== null,
  );
  controls.setSelectionProperties(
    selectedString && connectedAnalysis && connectedDisplay
      ? {
          type: "string",
          particleA: {
            id: connectedAnalysis.particleAId,
            name: scene.particles.find(
              (particle) => particle.id === connectedAnalysis.particleAId,
            )?.name ?? connectedAnalysis.particleAId,
            mass: scene.particles.find(
              (particle) => particle.id === connectedAnalysis.particleAId,
            )?.mass ?? 0,
          },
          particleB: {
            id: connectedAnalysis.particleBId,
            name: scene.particles.find(
              (particle) => particle.id === connectedAnalysis.particleBId,
            )?.name ?? connectedAnalysis.particleBId,
            mass: scene.particles.find(
              (particle) => particle.id === connectedAnalysis.particleBId,
            )?.mass ?? 0,
          },
          state:
            connectedBoundaryEvent?.kind === "impulsive-tautening" &&
              sameTime(connectedBoundaryEvent.time, currentTime)
              ? "taut"
              : connectedAnalysis.state,
          length: selectedString.length,
          lengthText: selectedString.lengthInput,
          display: connectedDisplay,
          boundaryMessage:
            connectedBoundaryEvent?.time === currentTime
              ? connectedBoundaryEvent.kind === "impulsive-tautening"
                ? connectedBoundaryEvent.message
                : `Connected-system limit reached. ${connectedBoundaryEvent.message} Further direct-string motion is not supported.`
              : null,
        }
      : selectedParticleState && selectedParticle
      ? createParticleSelectionProperties(selectedParticle, selectedParticleState)
      : selectedIncline
        ? {
            type: "incline",
            position: selectedIncline.anchor,
            horizontalLengthInput: selectedIncline.horizontalLengthInput,
            angleInput: selectedIncline.angleInput,
            direction: selectedIncline.direction,
            rough: selectedIncline.roughness.kind === "rough",
            friction: selectedIncline.roughness.kind === "rough"
              ? selectedIncline.roughness.coefficientOfFriction
              : 0,
            frictionInput: selectedIncline.roughness.kind === "rough"
              ? selectedIncline.roughness.coefficientInput
              : "0",
          }
        : groundSelected && scene.groundEnabled
        ? {
            type: "ground",
            rough: scene.groundRough,
            friction: scene.groundFriction,
          }
        : null,
  );
}

function createParticleSelectionProperties(
  particle: (typeof scene.particles)[number],
  particleState: ParticleState,
) {
  const velocityEditor = createVelocityEditorConversion(
    particle,
    scene.settings,
  );
  const physicsEnvironment = {
    gravity: scene.settings.gravity,
    groundEnabled: scene.groundEnabled,
    groundHeight: scene.groundHeight,
    groundRough: scene.groundRough,
    groundFriction: scene.groundFriction,
    inclines: scene.inclines,
  };
  const trajectory = calculateSurfaceTrajectory(
    particle,
    currentTime,
    physicsEnvironment,
  );
  const connectedString = scene.strings.find(
    (string) => string.particleAId === particle.id ||
      string.particleBId === particle.id,
  );
  const connectedTrajectory = connectedString
    ? calculateConnectedSystemTrajectory(scene, connectedString, currentTime)
    : null;
  const connectedAnalysis = connectedTrajectory?.analysis ??
    (connectedString ? analyseConnectedSystem(scene, connectedString) : null);
  const connectedEndpoint = connectedAnalysis
    ? connectedAnalysis.endpointA.particleId === particle.id
      ? connectedAnalysis.endpointA
      : connectedAnalysis.endpointB
    : null;
  const connectedConstraintActive = connectedAnalysis?.state === "taut" &&
    connectedAnalysis.commonAcceleration !== null;
  const constrainedConnectedTrajectory = connectedTrajectory &&
      connectedConstraintActive
    ? connectedTrajectory
    : null;
  const activeConnectedEndpoint = connectedConstraintActive
    ? connectedEndpoint
    : null;
  let phase: KinematicPhase = trajectory.phase;
  if (
    connectedTrajectory &&
    connectedTrajectory.analysis.commonAcceleration !== null
  ) {
    const activeConnectedAnalysis = connectedTrajectory.analysis;
    const tangent = activeConnectedAnalysis.support.tangent;
    const commonAcceleration = activeConnectedAnalysis.commonAcceleration ?? 0;
    const connectedPhaseStart = connectedTrajectory.tauteningEvent?.time ?? 0;
    const connectedPhaseState = connectedTrajectory.tauteningEvent?.states.find(
      (state) => state.id === particle.id,
    );
    phase = {
      kind: activeConnectedAnalysis.support.kind === "ground"
        ? "grounded"
        : "incline-contact",
      startTime: connectedPhaseStart,
      initialPosition: {
        ...(connectedPhaseState?.position ?? particle.initialPosition),
      },
      initialVelocity: {
        x: tangent.x * activeConnectedAnalysis.scalarVelocity,
        y: tangent.y * activeConnectedAnalysis.scalarVelocity,
      },
      acceleration: {
        x: tangent.x * commonAcceleration,
        y: tangent.y * commonAcceleration,
      },
      ...(activeConnectedAnalysis.support.kind === "incline"
        ? {
            incline: {
              inclineId: activeConnectedAnalysis.support.inclineId,
              initialQ: connectedEndpoint?.q ?? 0,
              initialTangentialVelocity: activeConnectedAnalysis.scalarVelocity,
              tangentialAcceleration: commonAcceleration,
              slopeLength: activeConnectedAnalysis.support.slopeLength,
              endpointTime: connectedTrajectory.boundaryEvent?.time ?? null,
            },
          }
        : {}),
    };
  }
  const connectedInclineId = connectedConstraintActive &&
      connectedAnalysis.support.kind === "incline"
    ? connectedAnalysis.support.inclineId
    : null;
  const activeInclineId = connectedInclineId ??
    (trajectory.contact.kind === "incline" ? trajectory.contact.inclineId : null);
  const activeIncline = activeInclineId
    ? scene.inclines.find((incline) => incline.id === activeInclineId)
    : undefined;
  const inclineContactActive = activeIncline !== undefined &&
    (connectedInclineId !== null || trajectory.contact.kind === "incline");
  const groundContactActive = (
    connectedConstraintActive && connectedAnalysis.support.kind === "ground"
  ) || trajectory.contact.kind === "ground";
  const activeContactFriction = activeConnectedEndpoint?.friction ??
    (trajectory.contact.kind === "incline" || trajectory.contact.kind === "ground"
      ? trajectory.contact.friction
      : null);
  const normalReaction = activeIncline && inclineContactActive
    ? createInclineNormalReactionDisplay(
        particle,
        activeIncline,
        scene.settings,
        activeConnectedEndpoint?.normalReactionMagnitude ??
          (trajectory.contact.kind === "incline"
            ? trajectory.contact.normalReactionMagnitude
            : 0),
      ) ?? 0
    : groundContactActive
      ? activeConnectedEndpoint?.normalReactionMagnitude ??
        (trajectory.contact.kind === "ground"
          ? trajectory.contact.normalReactionMagnitude
          : 0)
      : 0;
  const friction = inclineContactActive && activeIncline &&
      activeContactFriction &&
      activeIncline.roughness.kind === "rough"
    ? createFrictionDisplay(
        particle,
        scene.settings,
        normalReaction,
        activeContactFriction,
        activeIncline.roughness.coefficientOfFriction,
        activeIncline.roughness.coefficientInput,
        activeIncline,
      )
    : groundContactActive && scene.groundRough && activeContactFriction
      ? createFrictionDisplay(
          particle,
          scene.settings,
          normalReaction,
          activeContactFriction,
          scene.groundFriction,
          String(scene.groundFriction),
          null,
        )
      : null;
  const forceDisplay = createParticleForceDisplay(
    particle,
    scene.settings,
    normalReaction,
    friction,
    connectedAnalysis?.state === "taut" && connectedEndpoint &&
        connectedAnalysis.tension > 1e-12
      ? {
          magnitude: connectedAnalysis.tension,
          vector: connectedEndpoint.tensionVector,
        }
      : null,
  );
  const inclineForceResolution = activeIncline && inclineContactActive
    ? createInclineForceResolutionDisplay(
        particle,
        activeIncline,
        scene.settings,
        typeof normalReaction === "number" ? null : normalReaction,
        friction,
      )
    : null;
  const kinematics = calculateParticleKinematicState2D(
    phase,
    particleState,
    currentTime,
    scene.settings,
  );
  const sharedEnteredTime = phase.startTime === 0 ? currentTimeEnteredText : undefined;
  const sharedExactTime =
    phase.startTime === 0 &&
    sharedEnteredTime === undefined &&
    autoPauseTimeDisplay !== null
      ? createAutoPauseTimeDisplayValue(currentTime, autoPauseTimeDisplay)
      : undefined;
  const horizontalPolarVelocity =
    phase.kind === "free-flight" && phase.startTime === 0
    ? createPolarVelocityComponentDisplay(particle, "x", scene.settings)
    : undefined;
  const verticalPolarVelocity =
    phase.kind === "free-flight" && phase.startTime === 0
    ? createPolarVelocityComponentDisplay(particle, "y", scene.settings)
    : undefined;
  const verticalEnteredValues = {
    sDisplay: getKnownVerticalDisplacementDisplay(
      particle,
      kinematics.y.s,
    ),
    u:
      phase.kind === "free-flight" &&
        phase.startTime === 0 &&
        particle.initialVelocitySource === "components"
        ? getInitialVelocityEnteredText(particle, "y")
        : undefined,
    uDisplay: verticalPolarVelocity,
    aDisplay: phase.kind === "free-flight"
      ? forceDisplay.acceleration.y
      : undefined,
    t: sharedEnteredTime,
    tDisplay: sharedExactTime,
  };
  const horizontalEnteredValues = {
    u:
      phase.kind === "free-flight" &&
        phase.startTime === 0 &&
        particle.initialVelocitySource === "components"
        ? getInitialVelocityEnteredText(particle, "x")
        : undefined,
    uDisplay: horizontalPolarVelocity,
    aDisplay: phase.kind === "free-flight"
      ? forceDisplay.acceleration.x
      : undefined,
    t: sharedEnteredTime,
    tDisplay: sharedExactTime,
  };
  const horizontalDisplayValues = calculateKinematicDisplayValues(
    kinematics.x,
    horizontalEnteredValues,
  );
  if (phase.kind === "free-flight" && Math.abs(kinematics.x.a) < 1e-12) {
    if (horizontalEnteredValues.uDisplay !== undefined) {
      horizontalDisplayValues.v = formatWorkingValue(horizontalEnteredValues.uDisplay);
    } else if (horizontalEnteredValues.u !== undefined) {
      horizontalDisplayValues.v = horizontalEnteredValues.u;
    }
  }
  const motionGraphExactComponents: MotionGraphExactComponents = {
    x: {
      initialVelocity: horizontalEnteredValues.uDisplay ??
        createGraphInputDisplay(kinematics.x.u, horizontalEnteredValues.u),
      acceleration: horizontalEnteredValues.aDisplay ??
        createGraphInputDisplay(kinematics.x.a),
    },
    y: {
      initialVelocity: verticalEnteredValues.uDisplay ??
        createGraphInputDisplay(kinematics.y.u, verticalEnteredValues.u),
      acceleration: verticalEnteredValues.aDisplay ??
        createGraphInputDisplay(kinematics.y.a),
    },
  };
  const motionGraphPlan = getMotionGraphPlan(
    particle,
    phase,
    motionGraphExactComponents,
  );
  const verticalDisplayValues = calculateKinematicDisplayValues(
    kinematics.y,
    verticalEnteredValues,
  );
  let selectedKinematics = {
    x: horizontalDisplayValues,
    y: verticalDisplayValues,
  };
  let selectedKinematicValues = kinematics;
  let selectedMotionGraphs = {
    x: createMotionGraphData(motionGraphPlan, "x", currentTime),
    y: createMotionGraphData(motionGraphPlan, "y", currentTime),
  };
  let selectedEquations = {
    x: calculateHorizontalAnalysisEquationResults(
      kinematics.x,
      horizontalEnteredValues,
    ),
    y: calculateSuvatEquationResults(kinematics.y, verticalEnteredValues),
  };
  const independentInclineContact = trajectory.contact.kind === "incline"
    ? trajectory.contact
    : null;
  if (
    activeIncline &&
    inclineContactActive &&
    inclineForceResolution &&
    phase.incline &&
    (constrainedConnectedTrajectory || independentInclineContact)
  ) {
    const connectedElapsed = constrainedConnectedTrajectory
      ? Math.max(
          0,
          constrainedConnectedTrajectory.evaluatedTime - phase.startTime,
        )
      : 0;
    const alongValues = {
      s: constrainedConnectedTrajectory
        ? constrainedConnectedTrajectory.analysis.scalarVelocity *
            connectedElapsed +
          0.5 * constrainedConnectedTrajectory.analysis.commonAcceleration! *
            connectedElapsed ** 2
        : independentInclineContact!.q - phase.incline.initialQ,
      u: phase.incline.initialTangentialVelocity,
      v: constrainedConnectedTrajectory
        ? constrainedConnectedTrajectory.analysis.scalarVelocity +
          constrainedConnectedTrajectory.analysis.commonAcceleration! *
            connectedElapsed
        : independentInclineContact!.tangentialVelocity,
      a: phase.incline.tangentialAcceleration,
      t: Math.max(0, currentTime - phase.startTime),
    };
    const alongEnteredValues = {
      uDisplay: phase.startTime === 0 &&
          particle.initialInclineContact?.inclineId === activeIncline.id
        ? createInclineInitialTangentialVelocityDisplay(
            particle,
            activeIncline,
          )
        : derivedValue(alongValues.u),
      aDisplay: inclineForceResolution.tangentialAcceleration,
      t: phase.startTime === 0 ? currentTimeEnteredText : undefined,
    };
    const alongDisplay = calculateKinematicDisplayValues(
      alongValues,
      alongEnteredValues,
    );
    const graphEndTime = determineInclineGraphEndTime(
      phase.incline.endpointTime,
      currentTime,
      phase.startTime,
    );
    const alongGraphPhase = createInclineGraphPhase(
      alongValues,
      phase.startTime,
    );
    const alongGraphPlan = createMotionGraphPlan(
      alongGraphPhase,
      graphEndTime,
      { positiveX: "right", positiveY: "up" },
      {
        y: {
          initialVelocity: alongEnteredValues.uDisplay,
          acceleration: alongEnteredValues.aDisplay,
        },
      },
    );
    const alongGraph = createMotionGraphData(
      alongGraphPlan,
      "y",
      currentTime,
    );
    const alongEquations = calculateSuvatEquationResults(
      alongValues,
      alongEnteredValues,
    );
    selectedKinematics = { x: alongDisplay, y: alongDisplay };
    selectedKinematicValues = { x: alongValues, y: alongValues };
    selectedMotionGraphs = { x: alongGraph, y: alongGraph };
    selectedEquations = { x: alongEquations, y: alongEquations };
  }

  return {
    type: "particle" as const,
    name: particle.name,
    shape: particle.shape,
    position: particleState.position,
    mass: particle.mass,
    massText: particle.massInput,
    appliedForceEditorMode: particle.appliedForceEditorMode,
    showResultantForce: particle.showResultantForce,
    appliedForces: particle.appliedForces.map((force) => ({
      id: force.id,
      ...createAppliedForceEditorConversion(force, scene.settings),
    })),
    forceDisplay,
    inclineForceResolution,
    inclineKinematicsActive: inclineContactActive,
    initialVelocityText: velocityEditor.componentText,
    initialVelocityValues: {
      ...velocityEditor.componentValues,
      ...velocityEditor.polarValues,
    },
    initialVelocityEditorMode: particle.initialVelocityEditorMode,
    initialVelocitySource: particle.initialVelocitySource,
    initialVelocityAngleText: velocityEditor.polarText,
    pauseAtGreatestHeight: particle.pauseAtGreatestHeight,
    pauseAtGroundContact: particle.pauseAtGroundContact,
    pauseAtParticleCoincidence: particle.pauseAtParticleCoincidence,
    pauseAtVerticalTarget: particle.pauseAtVerticalTarget,
    verticalPauseTargetText: scene.groundEnabled
      ? particle.pauseHeightAboveGroundText
      : convertEnteredScalarText(
          particle.pauseVerticalDisplacementInput.text,
          particle.pauseVerticalDisplacementInput.positiveDirection,
          scene.settings.positiveY,
        ),
    groundEnabled: scene.groundEnabled,
    horizontalAccelerated: Math.abs(kinematics.x.a) >= 1e-12,
    phaseNote: createPhaseIntervalNote({
      particle,
      phase,
      currentTime,
      currentTimeEnteredText,
      gravityText: phase.kind === "incline-contact"
        ? null
        : getDownwardAccelerationText(particle),
      groundHeight: scene.groundHeight,
    }),
    kinematics: selectedKinematics,
    kinematicValues: selectedKinematicValues,
    motionGraphs: selectedMotionGraphs,
    equations: selectedEquations,
    stringConnectionMessage,
  };
}

function getKnownVerticalDisplacementDisplay(
  particle: (typeof scene.particles)[number],
  displacement: number,
): DisplayValue | undefined {
  const impactTime = scene.groundEnabled
    ? calculateGroundImpactTimeWithAcceleration(
        particle.initialPosition.y,
        particle.initialVelocity.y,
        analyseNonContactForces(particle, scene.settings.gravity).acceleration.y,
        scene.groundHeight,
      )
    : null;
  if (
    impactTime !== null &&
    isAtPositiveGroundImpact(currentTime, impactTime)
  ) {
    return createExactHeightDisplacementDisplay(
      particle.initialPosition.y,
      scene.groundHeight,
      displacement,
    );
  }

  if (
    verticalTargetPauseEvent &&
    sameTime(currentTime, verticalTargetPauseEvent.time) &&
    verticalTargetPauseEvent.particleIds.includes(particle.id)
  ) {
    if (!scene.groundEnabled) {
      const exactText = convertEnteredScalarText(
        particle.pauseVerticalDisplacementInput.text,
        particle.pauseVerticalDisplacementInput.positiveDirection,
        scene.settings.positiveY,
      );
      const exact = rationalFromDecimal(exactText);
      return exact ? derivedValue(displacement, exact) : undefined;
    }

    const ground = rationalFromDecimal(String(scene.groundHeight));
    const height = rationalFromDecimal(particle.pauseHeightAboveGroundText);
    if (!ground || !height) return undefined;
    const targetHeight = addRationals(ground, height);
    return createExactHeightDisplacementDisplay(
      particle.initialPosition.y,
      Number(targetHeight.numerator) / Number(targetHeight.denominator),
      displacement,
      targetHeight,
    );
  }

  return undefined;
}

function createExactHeightDisplacementDisplay(
  initialHeight: number,
  finalHeight: number,
  displacement: number,
  finalHeightExact = rationalFromDecimal(String(finalHeight)),
): DisplayValue | undefined {
  const initialHeightExact = rationalFromDecimal(String(initialHeight));
  if (!initialHeightExact || !finalHeightExact) return undefined;
  const worldDisplacement = subtractRationals(
    finalHeightExact,
    initialHeightExact,
  );
  const scalarDisplacement: Rational = scene.settings.positiveY === "up"
    ? worldDisplacement
    : {
        numerator: -worldDisplacement.numerator,
        denominator: worldDisplacement.denominator,
      };
  return derivedValue(displacement, scalarDisplacement);
}

function getMotionGraphPlan(
  particle: (typeof scene.particles)[number],
  phase: KinematicPhase,
  exactComponents: MotionGraphExactComponents,
): MotionGraphPlan {
  if (
    isPlaying &&
    motionGraphPlanLock?.particleId === particle.id &&
    isMotionGraphPlanValid(motionGraphPlanLock.plan, phase, scene.settings)
  ) {
    return motionGraphPlanLock.plan;
  }

  const endTime = determineMotionGraphEndTime(
    particle,
    phase,
    currentTime,
    {
      gravity: scene.settings.gravity,
      groundEnabled: scene.groundEnabled,
      groundHeight: scene.groundHeight,
      groundRough: scene.groundRough,
      groundFriction: scene.groundFriction,
      inclines: scene.inclines,
    },
  );
  const plan = createMotionGraphPlan(
    phase,
    endTime,
    scene.settings,
    exactComponents,
  );
  if (isPlaying) motionGraphPlanLock = { particleId: particle.id, plan };
  return plan;
}

function createGraphInputDisplay(
  value: number,
  enteredText?: string,
): DisplayValue {
  return enteredText === undefined
    ? derivedValue(value)
    : enteredDecimal(enteredText, value);
}

function getDownwardAccelerationText(
  particle: (typeof scene.particles)[number],
): string | null {
  const acceleration = analyseNonContactForces(
    particle,
    scene.settings.gravity,
  ).acceleration.y;
  if (acceleration >= 0) return null;
  return formatWorkingValue(
    absoluteDisplayValue(
      createParticleForceDisplay(particle, scene.settings).acceleration.y,
    ),
  );
}

function getInitialVelocityEnteredText(
  particle: (typeof scene.particles)[number],
  axis: "x" | "y",
): string {
  const input = particle.initialVelocityInput[axis];
  if (axis === "x") {
    return convertEnteredScalarText(
      input.text,
      particle.initialVelocityInput.x.positiveDirection,
      scene.settings.positiveX,
    );
  }
  return convertEnteredScalarText(
    input.text,
    particle.initialVelocityInput.y.positiveDirection,
    scene.settings.positiveY,
  );
}

function calculateActiveParticleStates(): ParticleState[] {
  return calculateSceneState(scene, currentTime);
}

function getPlaybackButtonState(): PlaybackButtonState {
  if (
    !isPlaying &&
    connectedBoundaryEvent &&
    sameTime(connectedBoundaryEvent.time, currentTime)
  ) {
    return "blocked";
  }
  if (!isPlaying) return "paused";
  return pendingPauseTime === null ? "playing" : "pause-pending";
}

function updatePlaybackControl(): void {
  const state = getPlaybackButtonState();
  controls.setPlaybackState(
    state,
    state === "blocked" && connectedBoundaryEvent
      ? getConnectedBoundaryPlayReason(connectedBoundaryEvent)
      : null,
  );
}

function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const canvasContext = canvas.getContext("2d");
  if (!canvasContext) throw new Error("This browser does not support the Canvas 2D API.");
  return canvasContext;
}
