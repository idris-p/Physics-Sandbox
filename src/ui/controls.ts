import { PIXELS_PER_METRE } from "../config";
import type { Tool } from "../canvas/interaction";
import type {
  CoordinateConvention,
  HorizontalPositiveDirection,
  VerticalPositiveDirection,
} from "../kinematics/signConvention";
import {
  type KinematicEquationResult,
  type KinematicDisplayValues,
  type SuvatEquationResult,
} from "../kinematics/suvat";
import type { Vec2 } from "../math/Vec2";
import type {
  AngleConvention,
  AngleDirection,
  AngleReferenceAxis,
} from "../kinematics/angleConvention";
import type { InitialVelocityInputMode, ParticleShape } from "../model/Particle";
import type { AppliedForceInputMode } from "../model/AppliedForce";
import {
  MINIMUM_INCLINE_HORIZONTAL_LENGTH,
  type InclineDirection,
} from "../model/Incline";
import { MINIMUM_TABLE_SIZE } from "../model/Table";
import type { ParticleForceDisplay } from "../dynamics/forceDisplay";
import type { InclineForceResolutionDisplay } from "../dynamics/inclineForceDisplay";
import type {
  ConnectedSystemDisplay,
} from "../dynamics/connectedSystemDisplay";
import {
  formatAutoPauseTimeExactText,
  type AutoPauseTimeDisplay,
} from "../simulation/autoPauseTimeDisplay";
import {
  createBreakableMathExpression,
  createForceAccelerationExpression,
  createForceResolutionExpression,
  createMathResult,
} from "./mathMarkup";
import {
  createCanvasMathValueElement,
  createMathExpression,
} from "./canvasMathOverlay";
import {
  formatExactValueTooltip,
  getExactValueTooltip,
  isSymbolicExactDisplay,
} from "./exactValueTooltip";
import type {
  MotionGraphAnnotation,
  MotionGraphData,
} from "../kinematics/motionGraphs";
import {
  formatWorkingValue,
  type DisplayValue,
} from "../kinematics/exactDisplay";
import {
  chooseMotionGraphAnnotationPlacement,
  EXPANDED_MOTION_GRAPH_HEIGHT,
  EXPANDED_MOTION_GRAPH_WIDTH,
  getMotionGraphAnnotationLabel,
  getMotionGraphDialogTitle,
  renderMotionGraph,
  type MotionGraphQuantity,
  type RenderedMotionGraphAnnotation,
} from "./motionGraphCanvas";
import type {
  ExactPhaseTime,
  PhaseIntervalNote,
} from "../simulation/phaseIntervalNote";
import { attachStableButtonPress } from "./stableButtonPress";

export type PlaybackButtonState =
  | "paused"
  | "playing"
  | "pause-pending"
  | "blocked";
export type InitialVelocityField = "x" | "y" | "speed" | "angle";
type ForceCalculationId =
  | "resolve-parallel"
  | "resolve-perpendicular"
  | "resolve-x"
  | "resolve-y"
  | "fma";
type ParticlePropertiesTab = "general" | "forces" | "kinematics";
export type SelectionProperties =
  | {
      type: "particle";
      name: string;
      shape: ParticleShape;
      position: Vec2;
      mass: number;
      massText: string;
      appliedForceEditorMode: AppliedForceInputMode;
      showResultantForce: boolean;
      appliedForces: Array<{
        id: string;
        componentText: { x: string; y: string };
        componentValues: { x: number; y: number };
        polarText: { magnitude: string; angle: string };
        polarValues: { magnitude: number; angle: number };
      }>;
      forceDisplay: ParticleForceDisplay;
      inclineForceResolution: InclineForceResolutionDisplay | null;
      inclineKinematicsActive: boolean;
      initialVelocityText: { x: string; y: string };
      initialVelocityValues: {
        x: number;
        y: number;
        speed: number;
        angle: number;
      };
      initialVelocityEditorMode: InitialVelocityInputMode;
      initialVelocitySource: InitialVelocityInputMode;
      initialVelocityAngleText: { speed: string; angle: string } | null;
      pauseAtGreatestHeight: boolean;
      pauseAtGroundContact: boolean;
      pauseAtParticleCoincidence: boolean;
      pauseAtVerticalTarget: boolean;
      verticalPauseTargetText: string;
      groundEnabled: boolean;
      horizontalAccelerated: boolean;
      phaseNote: PhaseIntervalNote | null;
      kinematics: { x: KinematicDisplayValues; y: KinematicDisplayValues };
      kinematicValues: {
        x: Record<keyof KinematicDisplayValues, number>;
        y: Record<keyof KinematicDisplayValues, number>;
      };
      motionGraphs: { x: MotionGraphData; y: MotionGraphData };
      equations: {
        x: KinematicEquationResult[];
        y: SuvatEquationResult[];
      };
      stringConnectionMessage: string | null;
    }
  | { type: "ground"; rough: boolean; friction: number }
  | {
      type: "incline";
      position: Vec2;
      horizontalLengthInput: string;
      angleInput: string;
      direction: InclineDirection;
      rough: boolean;
      friction: number;
      frictionInput: string;
    }
  | {
      type: "table";
      position: Vec2;
      widthInput: string;
      heightInput: string;
      rough: boolean;
      friction: number;
      frictionInput: string;
    }
  | {
      type: "string";
      particleA: { id: string; name: string; mass: number };
      particleB: { id: string; name: string; mass: number };
      state: "taut" | "slack";
      length: number;
      lengthText: string;
      display: ConnectedSystemDisplay;
      boundaryMessage: string | null;
      pulley: {
        leftLength: number;
        leftLengthText: string;
        rightLength: number;
        rightLengthText: string;
      } | null;
    }
  | null;

export interface ControlCallbacks {
  onToolChange: (tool: Tool) => void;
  onRemove: () => void;
  onGroundChange: (enabled: boolean) => void;
  onShowForceArrowsChange: (visible: boolean) => void;
  onGravityChange: (gravity: number, enteredText: string) => void;
  onParticleNameChange: (name: string) => void;
  onParticleShapeChange: (shape: ParticleShape) => void;
  onParticleMassChange: (mass: number, enteredText: string) => void;
  onAddAppliedForce: () => void;
  onShowResultantForceChange: (enabled: boolean) => void;
  onRemoveAppliedForce: (forceId: string) => void;
  onAppliedForceModeChange: (mode: AppliedForceInputMode) => void;
  onAppliedForceComponentsChange: (
    forceId: string,
    vector: { x: number; y: number },
    enteredText: { x: string; y: string },
  ) => void;
  onAppliedForceMagnitudeDirectionChange: (
    forceId: string,
    magnitude: number,
    angle: number,
    enteredText: { magnitude: string; angle: string },
  ) => void;
  onParticleInitialVelocityComponentsChange: (
    velocity: { x: number; y: number },
    enteredText: { x: string; y: string },
  ) => void;
  onParticleInitialVelocityAngleChange: (
    speed: number,
    angle: number,
    enteredText: { speed: string; angle: string },
  ) => void;
  onParticleInitialVelocityModeChange: (mode: InitialVelocityInputMode) => void;
  onParticlePauseAtGreatestHeightChange: (enabled: boolean) => void;
  onParticlePauseAtGroundContactChange: (enabled: boolean) => void;
  onParticlePauseAtCoincidenceChange: (enabled: boolean) => void;
  onParticlePauseAtVerticalTargetChange: (enabled: boolean) => void;
  onParticleVerticalPauseTargetValueChange: (
    value: number,
    enteredText: string,
  ) => void;
  onConnectWithString: () => void;
  onStringLengthChange: (length: number, enteredText: string) => boolean;
  onPulleyStringLegLengthChange: (
    leg: "left" | "right",
    length: number,
    enteredText: string,
  ) => boolean;
  onPositiveXChange: (direction: HorizontalPositiveDirection) => void;
  onPositiveYChange: (direction: VerticalPositiveDirection) => void;
  onAngleConventionChange: (
    referenceAxis: AngleReferenceAxis,
    direction: AngleDirection,
  ) => void;
  onGroundFrictionChange: (coefficient: number) => void;
  onGroundRoughChange: (rough: boolean) => void;
  onInclineLengthChange: (length: number, enteredText: string) => void;
  onInclineAngleChange: (angle: number, enteredText: string) => void;
  onInclineDirectionChange: (direction: InclineDirection) => void;
  onInclineRoughChange: (rough: boolean) => void;
  onInclineFrictionChange: (coefficient: number, enteredText: string) => void;
  onTableWidthChange: (width: number, enteredText: string) => void;
  onTableHeightChange: (height: number, enteredText: string) => void;
  onTableRoughChange: (rough: boolean) => void;
  onTableFrictionChange: (coefficient: number, enteredText: string) => void;
  onClearScene: () => void;
  onTimeChange: (time: number, enteredText: string) => void;
  onPrevious: (interval: number) => void;
  onNext: (interval: number) => void;
  onPlayToggle: () => void;
  onReset: () => void;
  onZoom: (factor: number) => void;
  onResetView: () => void;
}

export interface Controls {
  canvas: HTMLCanvasElement;
  canvasMathOverlay: HTMLElement;
  deleteTarget: HTMLButtonElement;
  particleSource: HTMLButtonElement;
  inclineSource: HTMLButtonElement;
  tableSource: HTMLButtonElement;
  pulleySource: HTMLButtonElement;
  setTool: (tool: Tool) => void;
  setSelected: (hasSelection: boolean) => void;
  setSelectionProperties: (selection: SelectionProperties) => void;
  setCoordinateConvention: (
    convention: CoordinateConvention & AngleConvention,
  ) => void;
  setTime: (
    time: number,
    enteredText?: string,
    exactDisplay?: AutoPauseTimeDisplay | null,
  ) => void;
  setPlaybackState: (
    state: PlaybackButtonState,
    blockedReason?: string | null,
  ) => void;
  setZoom: (pixelsPerMetre: number) => void;
}

export function createControls(callbacks: ControlCallbacks): Controls {
  const canvas = getElement<HTMLCanvasElement>("scene-canvas");
  const canvasMathOverlay = getElement<HTMLElement>("canvas-math-overlay");
  const particleTool = getElement<HTMLButtonElement>("particle-tool");
  const inclineTool = getElement<HTMLButtonElement>("incline-tool");
  const tableTool = getElement<HTMLButtonElement>("table-tool");
  const pulleyTool = getElement<HTMLButtonElement>("pulley-tool");
  const removeParticle = getElement<HTMLButtonElement>("remove-particle");
  const groundToggle = getElement<HTMLInputElement>("ground-toggle");
  const showForceArrowsToggle = getElement<HTMLInputElement>(
    "show-force-arrows-toggle",
  );
  const gravityInput = getElement<HTMLInputElement>("gravity-input");
  const gravityError = getElement<HTMLElement>("gravity-error");
  const angleReferenceAxis = getElement<HTMLSelectElement>("angle-reference-axis");
  const angleDirection = getElement<HTMLSelectElement>("angle-direction");
  const clearScene = getElement<HTMLButtonElement>("clear-scene");
  const particleProperties = getElement<HTMLElement>("particle-properties");
  const particlePropertiesScroll = particleProperties.querySelector<HTMLElement>(
    ".particle-properties-scroll",
  );
  const particleGeneralTab = getElement<HTMLButtonElement>(
    "particle-tab-general",
  );
  const particleForcesTab = getElement<HTMLButtonElement>(
    "particle-tab-forces",
  );
  const particleKinematicsTab = getElement<HTMLButtonElement>(
    "particle-tab-kinematics",
  );
  const particleGeneralContent = getElement<HTMLElement>(
    "particle-general-content",
  );
  const particleAnalysisContent = getElement<HTMLElement>(
    "particle-analysis-content",
  );
  const particleForcesContent = getElement<HTMLElement>(
    "particle-forces-content",
  );
  const particlePositionX = getElement<HTMLOutputElement>("particle-position-x");
  const particlePositionY = getElement<HTMLOutputElement>("particle-position-y");
  const particleNameInput = getElement<HTMLInputElement>("particle-name-input");
  const particleShapeSelect = getElement<HTMLSelectElement>(
    "particle-shape-select",
  );
  const connectString = getElement<HTMLButtonElement>("connect-string");
  const connectStringMessage = getElement<HTMLElement>("connect-string-message");
  const particleMassInput = getElement<HTMLInputElement>("particle-mass-input");
  const connectedSystemProperties = getElement<HTMLElement>(
    "connected-system-properties",
  );
  const tableProperties = getElement<HTMLElement>("table-properties");
  const tablePositionX = getElement<HTMLOutputElement>("table-position-x");
  const tablePositionY = getElement<HTMLOutputElement>("table-position-y");
  const tableWidthInput = getElement<HTMLInputElement>("table-width-input");
  const tableHeightInput = getElement<HTMLInputElement>("table-height-input");
  const tableRoughToggle = getElement<HTMLInputElement>("table-rough-toggle");
  const tableFrictionControl = getElement<HTMLElement>("table-friction-control");
  const tableFrictionInput = getElement<HTMLInputElement>("table-friction-input");
  const connectedParticleA = getElement<HTMLOutputElement>("connected-particle-a");
  const connectedParticleB = getElement<HTMLOutputElement>("connected-particle-b");
  const connectedStringState = getElement<HTMLOutputElement>("connected-string-state");
  const connectedLengthRow = getElement<HTMLElement>("connected-length-row");
  const connectedLengthInput = getElement<HTMLInputElement>(
    "connected-length-input",
  );
  const connectedLengthError = getElement<HTMLElement>("connected-length-error");
  const connectedPulleyLengthControls = getElement<HTMLElement>(
    "connected-pulley-length-controls",
  );
  const connectedLeftLengthInput = getElement<HTMLInputElement>(
    "connected-left-length-input",
  );
  const connectedLeftLengthError = getElement<HTMLElement>(
    "connected-left-length-error",
  );
  const connectedRightLengthInput = getElement<HTMLInputElement>(
    "connected-right-length-input",
  );
  const connectedRightLengthError = getElement<HTMLElement>(
    "connected-right-length-error",
  );
  const connectedCommonAccelerationRow = getElement<HTMLElement>(
    "connected-common-acceleration-row",
  );
  const connectedSlackNote = getElement<HTMLElement>("connected-slack-note");
  const connectedForceResolutionSection = getElement<HTMLElement>(
    "connected-force-resolution-section",
  );
  const connectedFmaSection = getElement<HTMLElement>("connected-fma-section");
  const connectedAcceleration = getElement<HTMLOutputElement>(
    "connected-acceleration",
  );
  const connectedTension = getElement<HTMLOutputElement>("connected-tension");
  const connectedForceResolution = getElement<HTMLElement>(
    "connected-force-resolution",
  );
  const connectedFma = getElement<HTMLElement>("connected-fma");
  const connectedBoundaryMessage = getElement<HTMLElement>(
    "connected-boundary-message",
  );
  const particleWeightValue = getElement<HTMLOutputElement>(
    "particle-weight-value",
  );
  const particleWeightDirection = getElement<HTMLElement>(
    "particle-weight-direction",
  );
  const normalReactionRow = getElement<HTMLElement>("normal-reaction-row");
  const particleNormalReactionValue = getElement<HTMLOutputElement>(
    "particle-normal-reaction-value",
  );
  const particleNormalReactionDirection = getElement<HTMLElement>(
    "particle-normal-reaction-direction",
  );
  const frictionRow = getElement<HTMLElement>("friction-row");
  const tensionRow = getElement<HTMLElement>("tension-row");
  const particleTensionValue = getElement<HTMLOutputElement>(
    "particle-tension-value",
  );
  const particleTensionDirection = getElement<HTMLElement>(
    "particle-tension-direction",
  );
  const particleFrictionValue = getElement<HTMLOutputElement>(
    "particle-friction-value",
  );
  const particleFrictionCondition = getElement<HTMLElement>(
    "particle-friction-condition",
  );
  const particleFrictionDirection = getElement<HTMLElement>(
    "particle-friction-direction",
  );
  const appliedForcesList = getElement<HTMLElement>("applied-forces-list");
  const addAppliedForce = getElement<HTMLButtonElement>("add-applied-force");
  const showResultantForceToggle = getElement<HTMLInputElement>(
    "show-resultant-force-toggle",
  );
  const appliedForceGlobalMode = getElement<HTMLElement>(
    "applied-force-global-mode",
  );
  const appliedForceModeComponents = getElement<HTMLButtonElement>(
    "applied-force-mode-components",
  );
  const appliedForceModePolar = getElement<HTMLButtonElement>(
    "applied-force-mode-polar",
  );
  const forceResultantX = getElement<HTMLElement>("force-resultant-x");
  const forceResultantY = getElement<HTMLElement>("force-resultant-y");
  const forceResolutionParallelRow = getElement<HTMLElement>(
    "force-resolution-parallel-row",
  );
  const forceResolutionPerpendicularRow = getElement<HTMLElement>(
    "force-resolution-perpendicular-row",
  );
  const forceResultantParallel = getElement<HTMLElement>(
    "force-resultant-parallel",
  );
  const forceResultantPerpendicular = getElement<HTMLElement>(
    "force-resultant-perpendicular",
  );
  const forceAccelerationParallel = getElement<HTMLElement>(
    "force-acceleration-parallel",
  );
  const forceAccelerationPerpendicular = getElement<HTMLElement>(
    "force-acceleration-perpendicular",
  );
  const forceAccelerationX = getElement<HTMLElement>("force-acceleration-x");
  const forceAccelerationY = getElement<HTMLElement>("force-acceleration-y");
  const forceAnalysis = getElement<HTMLElement>("force-analysis");
  const particleInitialVelocityXInput = getElement<HTMLInputElement>(
    "particle-initial-velocity-x-input",
  );
  const particleInitialVelocityYInput = getElement<HTMLInputElement>(
    "particle-initial-velocity-y-input",
  );
  const particleInitialSpeedInput = getElement<HTMLInputElement>(
    "particle-initial-speed-input",
  );
  const particleInitialAngleInput = getElement<HTMLInputElement>(
    "particle-initial-angle-input",
  );
  const particleInitialVelocityXExact = getElement<HTMLButtonElement>(
    "particle-initial-velocity-x-exact",
  );
  const particleInitialVelocityYExact = getElement<HTMLButtonElement>(
    "particle-initial-velocity-y-exact",
  );
  const particleInitialSpeedExact = getElement<HTMLButtonElement>(
    "particle-initial-speed-exact",
  );
  const particleInitialAngleExact = getElement<HTMLButtonElement>(
    "particle-initial-angle-exact",
  );
  const velocityModeAngle = getElement<HTMLButtonElement>("velocity-mode-angle");
  const velocityModeComponents = getElement<HTMLButtonElement>(
    "velocity-mode-components",
  );
  const initialVelocityAngleFields = getElement<HTMLElement>(
    "initial-velocity-angle-fields",
  );
  const initialVelocityComponentFields = getElement<HTMLElement>(
    "initial-velocity-component-fields",
  );
  const particlePauseAtGreatestToggle = getElement<HTMLInputElement>(
    "particle-pause-at-greatest-toggle",
  );
  const particlePauseAtGroundToggle = getElement<HTMLInputElement>(
    "particle-pause-at-ground-toggle",
  );
  const particlePauseAtGroundRow = getElement<HTMLElement>(
    "particle-pause-at-ground-row",
  );
  const particlePauseAtCoincidenceToggle = getElement<HTMLInputElement>(
    "particle-pause-at-coincidence-toggle",
  );
  const particlePauseTargetToggle = getElement<HTMLInputElement>(
    "particle-pause-target-toggle",
  );
  const particlePauseTargetInput = getElement<HTMLInputElement>(
    "particle-pause-target-input",
  );
  const particlePauseTargetControl = getElement<HTMLElement>(
    "particle-pause-target-control",
  );
  const particlePauseTargetLabel = getElement<HTMLElement>(
    "particle-pause-target-label",
  );
  const positiveLeft = getElement<HTMLButtonElement>("positive-left");
  const positiveRight = getElement<HTMLButtonElement>("positive-right");
  const positiveUp = getElement<HTMLButtonElement>("positive-up");
  const positiveDown = getElement<HTMLButtonElement>("positive-down");
  const kinematicOutputs = {
    s: getElement<HTMLOutputElement>("kinematic-s"),
    u: getElement<HTMLOutputElement>("kinematic-u"),
    v: getElement<HTMLOutputElement>("kinematic-v"),
    a: getElement<HTMLOutputElement>("kinematic-a"),
    t: getElement<HTMLOutputElement>("kinematic-t"),
  };
  const kinematicPhaseNote = getElement<HTMLElement>("kinematic-phase-note");
  const displacementTimeGraph = getElement<HTMLCanvasElement>(
    "displacement-time-graph",
  );
  const velocityTimeGraph = getElement<HTMLCanvasElement>(
    "velocity-time-graph",
  );
  const motionGraphDialog = getElement<HTMLDialogElement>(
    "motion-graph-dialog",
  );
  const motionGraphDialogTitle = getElement<HTMLElement>(
    "motion-graph-dialog-title",
  );
  const enlargedMotionGraph = getElement<HTMLCanvasElement>(
    "enlarged-motion-graph",
  );
  const enlargedMotionGraphAnnotations = getElement<HTMLElement>(
    "enlarged-motion-graph-annotations",
  );
  const motionGraphExactTooltip = getElement<HTMLElement>(
    "motion-graph-exact-tooltip",
  );
  const closeMotionGraphDialog = getElement<HTMLButtonElement>(
    "close-motion-graph-dialog",
  );
  const kinematicVertical = getElement<HTMLButtonElement>("kinematic-vertical");
  const kinematicHorizontal = getElement<HTMLButtonElement>("kinematic-horizontal");
  const kinematicComponentSelector = getElement<HTMLElement>(
    "kinematic-component-selector",
  );
  const kinematicQuantityRows = new Map(
    Array.from(
      document.querySelectorAll<HTMLElement>("[data-kinematic-quantity]"),
    ).map((row) => [row.dataset.kinematicQuantity, row]),
  );
  const suvatEquations = getElement<HTMLElement>("suvat-equations");
  const suvatTitle = getElement<HTMLElement>("suvat-title");
  const suvatCalculationDialog = getElement<HTMLDialogElement>(
    "suvat-calculation-dialog",
  );
  const suvatCalculationDialogTitle = getElement<HTMLElement>(
    "suvat-calculation-dialog-title",
  );
  const closeSuvatCalculationDialog = getElement<HTMLButtonElement>(
    "close-suvat-calculation-dialog",
  );
  const suvatCalculationDialogEquation = getElement<HTMLElement>(
    "suvat-calculation-dialog-equation",
  );
  const suvatCalculationDialogContent = suvatCalculationDialog.querySelector<HTMLElement>(
    ".suvat-calculation-dialog-content",
  );
  const suvatCalculationDialogHeader = suvatCalculationDialog.querySelector<HTMLElement>(
    ".suvat-calculation-dialog-header",
  );
  if (!suvatCalculationDialogContent || !suvatCalculationDialogHeader) {
    throw new Error("Missing required enlarged calculation layout elements.");
  }
  const groundProperties = getElement<HTMLElement>("ground-properties");
  const groundRoughToggle = getElement<HTMLInputElement>("ground-rough-toggle");
  const groundFrictionInput = getElement<HTMLInputElement>("ground-friction-input");
  const inclineProperties = getElement<HTMLElement>("incline-properties");
  const inclinePositionX = getElement<HTMLOutputElement>("incline-position-x");
  const inclinePositionY = getElement<HTMLOutputElement>("incline-position-y");
  const inclineAngleInput = getElement<HTMLInputElement>("incline-angle-input");
  const inclineLengthInput = getElement<HTMLInputElement>("incline-length-input");
  const inclineRisesRight = getElement<HTMLButtonElement>("incline-rises-right");
  const inclineRisesLeft = getElement<HTMLButtonElement>("incline-rises-left");
  const inclineRoughToggle = getElement<HTMLInputElement>("incline-rough-toggle");
  const inclineFrictionControl = getElement<HTMLElement>("incline-friction-control");
  const inclineFrictionInput = getElement<HTMLInputElement>("incline-friction-input");
  const groundFrictionControl = groundFrictionInput.closest<HTMLElement>(
    ".ground-friction-control",
  );
  const previousTime = getElement<HTMLButtonElement>("previous-time");
  const nextTime = getElement<HTMLButtonElement>("next-time");
  const playTime = getElement<HTMLButtonElement>("play-time");
  const playDisabledReason = getElement<HTMLElement>("play-disabled-reason");
  const resetTime = getElement<HTMLButtonElement>("reset-time");
  const timeInput = getElement<HTMLInputElement>("time-input");
  const timeExactValue = getElement<HTMLButtonElement>("time-exact-value");
  const stepInterval = getElement<HTMLSelectElement>("step-interval");
  const zoomOut = getElement<HTMLButtonElement>("zoom-out");
  const zoomIn = getElement<HTMLButtonElement>("zoom-in");
  const resetView = getElement<HTMLButtonElement>("reset-view");
  const scenePropertiesShell = getElement<HTMLElement>("scene-properties-title").closest<HTMLElement>(
    ".scene-properties-shell",
  );
  const toggleSceneProperties = getElement<HTMLButtonElement>("toggle-scene-properties");
  const scaleLine = document.querySelector<HTMLElement>(".scale-key span");

  if (!scaleLine) throw new Error("Missing required scale key line.");
  if (!scenePropertiesShell) throw new Error("Missing scene properties panel.");
  if (!groundFrictionControl) throw new Error("Missing ground friction control.");
  if (!particlePropertiesScroll) {
    throw new Error("Missing particle properties scroll region.");
  }

  const getNumericTextInput = (target: EventTarget | null): HTMLInputElement | null =>
    target instanceof HTMLInputElement &&
    target.type === "text" &&
    target.inputMode === "decimal"
      ? target
      : null;
  const automaticallyClearedZeroInputs = new WeakSet<HTMLInputElement>();
  const clearSoleZero = (event: Event): void => {
    const input = getNumericTextInput(event.target);
    if (!input || input.value.trim() !== "0") return;
    input.value = clearSoleZeroInputValue(input.value);
    automaticallyClearedZeroInputs.add(input);
  };
  document.addEventListener("pointerdown", clearSoleZero);
  document.addEventListener("focusin", clearSoleZero);
  document.addEventListener("input", (event) => {
    const input = getNumericTextInput(event.target);
    if (input) automaticallyClearedZeroInputs.delete(input);
  });
  document.addEventListener("change", (event) => {
    const input = getNumericTextInput(event.target);
    if (!input) return;
    input.value = defaultBlankInputValue(input.value);
    automaticallyClearedZeroInputs.delete(input);
  }, true);
  document.addEventListener("focusout", (event) => {
    const input = getNumericTextInput(event.target);
    if (!input || input.value.trim() !== "") return;
    const wasAutomaticallyCleared = automaticallyClearedZeroInputs.has(input);
    automaticallyClearedZeroInputs.delete(input);
    input.value = "0";
    if (!wasAutomaticallyCleared) {
      input.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });

  let currentGravityText = gravityInput.value;
  let currentTimeText = timeInput.value;
  let currentDisplayedTime = 0;
  let lastExactTimeDisplay: AutoPauseTimeDisplay | null = null;
  let exactTimeDisplaySuppressed = false;
  let isEditingExactTime = false;
  let currentParticleMassText = particleMassInput.value;
  let currentParticleName = particleNameInput.value;
  let currentParticleInitialVelocityText = {
    x: particleInitialVelocityXInput.value,
    y: particleInitialVelocityYInput.value,
  };
  let currentParticleInitialVelocityValues = {
    x: Number(particleInitialVelocityXInput.value),
    y: Number(particleInitialVelocityYInput.value),
    speed: Number(particleInitialSpeedInput.value),
    angle: Number(particleInitialAngleInput.value),
  };
  let currentParticleInitialAngleText = {
    speed: particleInitialSpeedInput.value,
    angle: particleInitialAngleInput.value,
  };
  const initialVelocityInputs: Record<InitialVelocityField, HTMLInputElement> = {
    x: particleInitialVelocityXInput,
    y: particleInitialVelocityYInput,
    speed: particleInitialSpeedInput,
    angle: particleInitialAngleInput,
  };
  const initialVelocityExactValues: Record<InitialVelocityField, HTMLButtonElement> = {
    x: particleInitialVelocityXExact,
    y: particleInitialVelocityYExact,
    speed: particleInitialSpeedExact,
    angle: particleInitialAngleExact,
  };
  let exactInitialVelocityFields = new Set<InitialVelocityField>();
  let editingExactInitialVelocityField: InitialVelocityField | null = null;
  let currentParticlePauseTargetText = particlePauseTargetInput.value;
  let currentGroundFriction = Number(groundFrictionInput.value);
  let currentStringLengthText = connectedLengthInput.value;
  let currentPulleyLeftLengthText = connectedLeftLengthInput.value;
  let currentPulleyRightLengthText = connectedRightLengthInput.value;
  let currentTool: Tool = "select";
  let selectedParticleTab: ParticlePropertiesTab = "general";
  const particleTabScrollPositions: Record<ParticlePropertiesTab, number> = {
    general: 0,
    forces: 0,
    kinematics: 0,
  };
  let selectedKinematicAxis: "x" | "y" = "y";
  let currentParticleSelection: Extract<SelectionProperties, { type: "particle" }> | null = null;
  let currentSuvatEquations: KinematicEquationResult[] = [];
  let expandedSuvatEquationId: string | null = null;
  let expandedForceCalculationId: ForceCalculationId | null = null;
  let expandedMotionGraphQuantity: MotionGraphQuantity | null = null;

  const getInitialVelocityFieldText = (field: InitialVelocityField): string =>
    field === "x" || field === "y"
      ? currentParticleInitialVelocityText[field]
      : currentParticleInitialAngleText[field];

  const refreshInitialVelocityField = (field: InitialVelocityField): void => {
    const input = initialVelocityInputs[field];
    const exactValue = initialVelocityExactValues[field];
    const showExact =
      exactInitialVelocityFields.has(field) &&
      editingExactInitialVelocityField !== field;
    exactValue.classList.toggle("is-hidden", !showExact);
    input.classList.toggle("is-hidden", showExact);

    if (showExact) {
      const text = getInitialVelocityFieldText(field);
      const tooltip = formatExactValueTooltip(
        currentParticleInitialVelocityValues[field],
      );
      exactValue.replaceChildren(createMathExpression(text));
      exactValue.dataset.exactApproximation = tooltip;
      exactValue.setAttribute("aria-description", `Approximately ${tooltip}`);
    } else {
      delete exactValue.dataset.exactApproximation;
      exactValue.removeAttribute("aria-description");
      if (
        editingExactInitialVelocityField !== field &&
        document.activeElement !== input
      ) {
        input.value = getInitialVelocityFieldText(field);
      }
    }
  };

  for (const field of ["x", "y", "speed", "angle"] as const) {
    const input = initialVelocityInputs[field];
    const exactValue = initialVelocityExactValues[field];
    exactValue.addEventListener("click", () => {
      editingExactInitialVelocityField = field;
      exactValue.classList.add("is-hidden");
      input.classList.remove("is-hidden");
      input.value = formatEditableVelocityDecimal(
        currentParticleInitialVelocityValues[field],
      );
      input.focus();
      input.select();
    });
    input.addEventListener("blur", () => {
      if (editingExactInitialVelocityField !== field) return;
      editingExactInitialVelocityField = null;
      refreshInitialVelocityField(field);
    });
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") input.blur();
    });
  }

  const particleTabs: Array<{
    id: ParticlePropertiesTab;
    button: HTMLButtonElement;
    panel: HTMLElement;
  }> = [
    { id: "general", button: particleGeneralTab, panel: particleGeneralContent },
    { id: "forces", button: particleForcesTab, panel: particleForcesContent },
    { id: "kinematics", button: particleKinematicsTab, panel: particleAnalysisContent },
  ];

  const selectParticleTab = (
    tab: ParticlePropertiesTab,
    moveFocus = false,
  ): void => {
    particleTabScrollPositions[selectedParticleTab] = particlePropertiesScroll.scrollTop;
    selectedParticleTab = tab;

    for (const item of particleTabs) {
      const active = item.id === tab;
      item.button.classList.toggle("is-active", active);
      item.button.setAttribute("aria-selected", String(active));
      item.button.tabIndex = active ? 0 : -1;
      item.panel.hidden = !active;
    }

    particlePropertiesScroll.scrollTop = particleTabScrollPositions[tab];
    if (moveFocus) particleTabs.find((item) => item.id === tab)?.button.focus();
  };

  particleTabs.forEach((item, index) => {
    item.button.addEventListener("click", () => selectParticleTab(item.id));
    item.button.addEventListener("keydown", (event) => {
      let targetIndex: number | null = null;
      if (event.key === "ArrowRight") targetIndex = (index + 1) % particleTabs.length;
      if (event.key === "ArrowLeft") {
        targetIndex = (index - 1 + particleTabs.length) % particleTabs.length;
      }
      if (event.key === "Home") targetIndex = 0;
      if (event.key === "End") targetIndex = particleTabs.length - 1;
      if (targetIndex === null) return;
      event.preventDefault();
      selectParticleTab(particleTabs[targetIndex].id, true);
    });
  });

  particlePropertiesScroll.addEventListener("scroll", () => {
    particleTabScrollPositions[selectedParticleTab] = particlePropertiesScroll.scrollTop;
  });

  connectString.addEventListener("click", callbacks.onConnectWithString);
  connectedLengthInput.addEventListener("change", () => {
    const enteredText = connectedLengthInput.value.trim();
    const length = parseNonNegativeProperty(enteredText);
    if (length === null) {
      connectedLengthInput.value = currentStringLengthText;
      connectedLengthInput.setAttribute("aria-invalid", "true");
      connectedLengthError.textContent = "Enter a non-negative value with up to 3 decimal places.";
      return;
    }
    if (!callbacks.onStringLengthChange(length, enteredText)) {
      connectedLengthInput.value = currentStringLengthText;
      connectedLengthInput.setAttribute("aria-invalid", "true");
      connectedLengthError.textContent =
        "Length cannot be smaller than the current particle separation.";
      return;
    }
    currentStringLengthText = enteredText;
    connectedLengthInput.removeAttribute("aria-invalid");
    connectedLengthError.textContent = "";
  });

  const commitPulleyLegLength = (
    leg: "left" | "right",
    input: HTMLInputElement,
    error: HTMLElement,
    previousText: string,
    setCurrentText: (value: string) => void,
  ): void => {
    const enteredText = input.value.trim();
    const length = parseNonNegativeProperty(enteredText);
    if (length === null) {
      input.value = previousText;
      input.setAttribute("aria-invalid", "true");
      error.textContent = "Enter a non-negative value with up to 3 decimal places.";
      return;
    }
    if (!callbacks.onPulleyStringLegLengthChange(leg, length, enteredText)) {
      input.value = previousText;
      input.setAttribute("aria-invalid", "true");
      error.textContent = "That length cannot be used with the current Pulley route.";
      return;
    }
    setCurrentText(enteredText);
    input.removeAttribute("aria-invalid");
    error.textContent = "";
  };
  connectedLeftLengthInput.addEventListener("change", () => {
    commitPulleyLegLength(
      "left",
      connectedLeftLengthInput,
      connectedLeftLengthError,
      currentPulleyLeftLengthText,
      (value) => {
        currentPulleyLeftLengthText = value;
      },
    );
  });
  connectedRightLengthInput.addEventListener("change", () => {
    commitPulleyLegLength(
      "right",
      connectedRightLengthInput,
      connectedRightLengthError,
      currentPulleyRightLengthText,
      (value) => {
        currentPulleyRightLengthText = value;
      },
    );
  });

  const renderSelectedKinematicComponent = (): void => {
    const selection = currentParticleSelection;
    if (!selection) return;

    if (selection.inclineKinematicsActive) selectedKinematicAxis = "y";

    const isVertical = selectedKinematicAxis === "y";
    kinematicVertical.textContent = selection.inclineKinematicsActive
      ? "Parallel to incline"
      : "Vertical";
    kinematicHorizontal.hidden = selection.inclineKinematicsActive;
    kinematicComponentSelector.classList.toggle(
      "is-single-component",
      selection.inclineKinematicsActive,
    );
    kinematicVertical.classList.toggle("is-active", isVertical);
    kinematicHorizontal.classList.toggle("is-active", !isVertical);
    kinematicVertical.setAttribute("aria-pressed", String(isVertical));
    kinematicHorizontal.setAttribute("aria-pressed", String(!isVertical));
    const usesSuvat = selection.inclineKinematicsActive ||
      isVertical || selection.horizontalAccelerated;
    kinematicQuantityRows.get("u")?.toggleAttribute("hidden", !usesSuvat);
    kinematicQuantityRows.get("a")?.toggleAttribute("hidden", !usesSuvat);
    suvatTitle.textContent = usesSuvat ? "SUVAT" : "Horizontal motion";
    suvatCalculationDialogTitle.textContent = selection.inclineKinematicsActive
      ? "Along-Incline SUVAT Calculation"
      : isVertical
      ? "SUVAT Calculation"
      : selection.horizontalAccelerated
        ? "Horizontal SUVAT Calculation"
        : "Horizontal Calculation";

    currentSuvatEquations = selection.equations[selectedKinematicAxis];
    setPhaseIntervalNote(kinematicPhaseNote, selection.phaseNote);
    setKinematicOutputs(
      kinematicOutputs,
      selection.kinematics[selectedKinematicAxis],
      selection.kinematicValues[selectedKinematicAxis],
    );
    const graph = selection.motionGraphs[selectedKinematicAxis];
    renderMotionGraph(displacementTimeGraph, graph, "displacement");
    renderMotionGraph(velocityTimeGraph, graph, "velocity");
    if (motionGraphDialog.open && expandedMotionGraphQuantity) {
      renderExpandedMotionGraph(graph, expandedMotionGraphQuantity);
    }
    setSuvatAnalysis(suvatEquations, currentSuvatEquations);
    refreshExpandedCalculation();
  };

  kinematicVertical.addEventListener("click", () => {
    selectedKinematicAxis = "y";
    renderSelectedKinematicComponent();
  });
  kinematicHorizontal.addEventListener("click", () => {
    selectedKinematicAxis = "x";
    renderSelectedKinematicComponent();
  });

  const renderExpandedMotionGraph = (
    graph: MotionGraphData,
    quantity: MotionGraphQuantity,
  ): void => {
    const title = getMotionGraphDialogTitle(selectedKinematicAxis, quantity);
    motionGraphDialogTitle.textContent = title;
    enlargedMotionGraph.setAttribute("aria-label", title);
    const annotations = renderMotionGraph(
      enlargedMotionGraph,
      graph,
      quantity,
      "expanded",
    );
    renderExpandedMotionGraphAnnotations(
      enlargedMotionGraphAnnotations,
      annotations,
      graph,
      quantity,
    );
  };

  const openMotionGraph = (quantity: MotionGraphQuantity): void => {
    const selection = currentParticleSelection;
    if (!selection) return;
    expandedMotionGraphQuantity = quantity;
    if (!motionGraphDialog.open) motionGraphDialog.showModal();
    renderExpandedMotionGraph(
      selection.motionGraphs[selectedKinematicAxis],
      quantity,
    );
    closeMotionGraphDialog.focus();
  };

  const showMotionGraphExactTooltip = (
    label: HTMLElement,
    clientX: number,
    clientY: number,
  ): void => {
    const text = label.dataset.exactApproximation;
    if (!text) return;
    motionGraphExactTooltip.textContent = text;
    motionGraphExactTooltip.hidden = false;
    const bounds = enlargedMotionGraphAnnotations.getBoundingClientRect();
    const gap = 12;
    const proposedLeft = clientX - bounds.left + gap;
    const proposedTop = clientY - bounds.top + gap;
    motionGraphExactTooltip.style.left = `${Math.max(
      gap,
      Math.min(
        proposedLeft,
        bounds.width - motionGraphExactTooltip.offsetWidth - gap,
      ),
    )}px`;
    motionGraphExactTooltip.style.top = `${Math.max(
      gap,
      Math.min(
        proposedTop,
        bounds.height - motionGraphExactTooltip.offsetHeight - gap,
      ),
    )}px`;
  };

  enlargedMotionGraphAnnotations.addEventListener("pointermove", (event) => {
    if (!(event.target instanceof Element)) return;
    const label = event.target.closest<HTMLElement>(
      ".motion-graph-coordinate[data-exact-approximation]",
    );
    if (!label) {
      motionGraphExactTooltip.hidden = true;
      return;
    }
    showMotionGraphExactTooltip(label, event.clientX, event.clientY);
  });
  enlargedMotionGraphAnnotations.addEventListener("pointerleave", () => {
    motionGraphExactTooltip.hidden = true;
  });
  enlargedMotionGraphAnnotations.addEventListener("focusin", (event) => {
    if (!(event.target instanceof HTMLElement)) return;
    const bounds = event.target.getBoundingClientRect();
    showMotionGraphExactTooltip(event.target, bounds.right, bounds.bottom);
  });
  enlargedMotionGraphAnnotations.addEventListener("focusout", () => {
    motionGraphExactTooltip.hidden = true;
  });

  const activateMotionGraphFromKeyboard = (
    event: KeyboardEvent,
    quantity: MotionGraphQuantity,
  ): void => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openMotionGraph(quantity);
  };

  displacementTimeGraph.addEventListener("click", () => {
    openMotionGraph("displacement");
  });
  velocityTimeGraph.addEventListener("click", () => {
    openMotionGraph("velocity");
  });
  displacementTimeGraph.addEventListener("keydown", (event) => {
    activateMotionGraphFromKeyboard(event, "displacement");
  });
  velocityTimeGraph.addEventListener("keydown", (event) => {
    activateMotionGraphFromKeyboard(event, "velocity");
  });
  closeMotionGraphDialog.addEventListener("click", () => {
    motionGraphDialog.close();
  });
  motionGraphDialog.addEventListener("click", (event) => {
    if (event.target === motionGraphDialog) motionGraphDialog.close();
  });
  motionGraphDialog.addEventListener("close", () => {
    expandedMotionGraphQuantity = null;
    motionGraphExactTooltip.hidden = true;
  });

  const closeExpandedSuvatEquation = (): void => {
    if (suvatCalculationDialog.open) suvatCalculationDialog.close();
    suvatCalculationDialogEquation.style.removeProperty("margin-top");
    expandedSuvatEquationId = null;
    expandedForceCalculationId = null;
  };

  const updateExpandedCalculationAlignment = (): void => {
    suvatCalculationDialogEquation.style.removeProperty("margin-top");
    if (!suvatCalculationDialog.open) return;

    const contentStyle = getComputedStyle(suvatCalculationDialogContent);
    const verticalPadding =
      Number.parseFloat(contentStyle.paddingTop) +
      Number.parseFloat(contentStyle.paddingBottom);
    const availableHeight = suvatCalculationDialogContent.clientHeight -
      verticalPadding;
    const calculationHeight = Math.max(
      suvatCalculationDialogEquation.offsetHeight,
      suvatCalculationDialogEquation.scrollHeight,
    );
    if (calculationHeight <= availableHeight) {
      const headerHeight = suvatCalculationDialogHeader.getBoundingClientRect().height;
      const centredTopMargin = Math.max(
        0,
        (availableHeight - headerHeight - calculationHeight) / 2,
      );
      suvatCalculationDialogEquation.style.marginTop = `${centredTopMargin}px`;
    }
  };

  const scheduleExpandedCalculationAlignment = (): void => {
    requestAnimationFrame(updateExpandedCalculationAlignment);
  };

  window.addEventListener("resize", scheduleExpandedCalculationAlignment);

  function refreshExpandedCalculation(): void {
    if (expandedForceCalculationId) {
      populateExpandedForceCalculation(expandedForceCalculationId);
      scheduleExpandedCalculationAlignment();
      return;
    }
    if (!expandedSuvatEquationId) return;
    const equation = currentSuvatEquations.find(
      (candidate) => candidate.id === expandedSuvatEquationId,
    );
    if (!equation) {
      closeExpandedSuvatEquation();
      return;
    }

    populateSuvatEquationElement(suvatCalculationDialogEquation, equation, true);
    scheduleExpandedCalculationAlignment();
  }

  const openExpandedSuvatEquation = (equationId: string): void => {
    const equation = currentSuvatEquations.find(
      (candidate) => candidate.id === equationId,
    );
    if (!equation) return;

    expandedForceCalculationId = null;
    expandedSuvatEquationId = equation.id;
    populateSuvatEquationElement(suvatCalculationDialogEquation, equation, true);
    if (!suvatCalculationDialog.open) suvatCalculationDialog.showModal();
    scheduleExpandedCalculationAlignment();
    closeSuvatCalculationDialog.focus();
  };

  const getSuvatEquationFromEvent = (event: Event): HTMLElement | null => {
    if (!(event.target instanceof Element)) return null;
    const equation = event.target.closest<HTMLElement>("[data-suvat-equation]");
    return equation && suvatEquations.contains(equation) ? equation : null;
  };

  suvatEquations.addEventListener("click", (event) => {
    const equation = getSuvatEquationFromEvent(event);
    if (equation?.dataset.suvatEquation) {
      openExpandedSuvatEquation(equation.dataset.suvatEquation);
    }
  });

  suvatEquations.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const equation = getSuvatEquationFromEvent(event);
    if (!equation?.dataset.suvatEquation) return;
    event.preventDefault();
    openExpandedSuvatEquation(equation.dataset.suvatEquation);
  });

  closeSuvatCalculationDialog.addEventListener(
    "click",
    closeExpandedSuvatEquation,
  );
  suvatCalculationDialog.addEventListener("click", (event) => {
    if (event.target === suvatCalculationDialog) closeExpandedSuvatEquation();
  });
  suvatCalculationDialog.addEventListener("close", () => {
    expandedSuvatEquationId = null;
    expandedForceCalculationId = null;
  });

  function populateExpandedForceCalculation(
    calculationId: ForceCalculationId,
  ): void {
    const selection = currentParticleSelection;
    if (!selection) {
      closeExpandedSuvatEquation();
      return;
    }
    const formula = suvatCalculationDialogEquation.querySelector<HTMLElement>(
      ".suvat-formula",
    );
    const substitution = suvatCalculationDialogEquation.querySelector<HTMLElement>(
      ".suvat-substitution",
    );
    const result = suvatCalculationDialogEquation.querySelector<HTMLElement>(
      ".suvat-result",
    );
    const squareRoot = suvatCalculationDialogEquation.querySelector<HTMLElement>(
      ".suvat-square-root",
    );
    if (!formula || !substitution || !result || !squareRoot) return;

    const display = selection.forceDisplay;
    const inclineResolution = selection.inclineForceResolution;
    suvatCalculationDialogEquation.classList.add("force-modal-equation");
    formula.hidden = true;
    formula.replaceChildren();
    squareRoot.classList.add("is-hidden");
    squareRoot.replaceChildren();
    const calculationTitles: Record<ForceCalculationId, string> = {
      "resolve-parallel": "Resolve parallel to incline",
      "resolve-perpendicular": "Resolve perpendicular to incline",
      "resolve-x": "Resolve horizontally",
      "resolve-y": "Resolve vertically",
      fma: "F = ma",
    };
    suvatCalculationDialogTitle.textContent = calculationTitles[calculationId];

    if (calculationId !== "fma") {
      const inclineAxis = calculationId === "resolve-parallel"
        ? "parallel"
        : calculationId === "resolve-perpendicular"
          ? "perpendicular"
          : null;
      if (inclineAxis && !inclineResolution) {
        closeExpandedSuvatEquation();
        return;
      }
      const worldAxis = calculationId === "resolve-x" ? "x" : "y";
      const axis = inclineAxis ?? worldAxis;
      const values = inclineAxis === "parallel"
        ? inclineResolution?.parallelForces ?? []
        : inclineAxis === "perpendicular"
          ? inclineResolution?.perpendicularForces ?? []
          : display.forces.map((force) => force[worldAxis]);
      const resultantValue = inclineAxis === "parallel"
        ? inclineResolution?.parallelResultant
        : inclineAxis === "perpendicular"
          ? inclineResolution?.perpendicularResultant
          : display.resultant[worldAxis];
      if (!resultantValue) return;
      const terms = values.map(formatWorkingValue);
      const resultant = formatWorkingValue(resultantValue);
      const expression = createForceResolutionExpression(
        axis,
        formatSignedTerms(terms),
        resultant,
        true,
      );
      setExactValueTooltip(
        expression.finalAnswer,
        resultant,
        resultantValue.value,
      );
      substitution.replaceChildren(expression.element);
      result.replaceChildren();
      result.hidden = true;
      return;
    }

    result.hidden = false;
    const accelerationCalculations: Array<{
      axis: "x" | "y" | "parallel" | "perpendicular";
      resultantValue: DisplayValue;
      accelerationValue: DisplayValue;
    }> = inclineResolution
      ? [
          {
            axis: "parallel",
            resultantValue: inclineResolution.parallelResultant,
            accelerationValue: inclineResolution.tangentialAcceleration,
          },
          {
            axis: "perpendicular",
            resultantValue: inclineResolution.perpendicularResultant,
            accelerationValue: inclineResolution.perpendicularAcceleration,
          },
          {
            axis: "x",
            resultantValue: display.resultant.x,
            accelerationValue: display.acceleration.x,
          },
          {
            axis: "y",
            resultantValue: display.resultant.y,
            accelerationValue: display.acceleration.y,
          },
        ]
      : [
          {
            axis: "x",
            resultantValue: display.resultant.x,
            accelerationValue: display.acceleration.x,
          },
          {
            axis: "y",
            resultantValue: display.resultant.y,
            accelerationValue: display.acceleration.y,
          },
        ];
    const accelerationLines = accelerationCalculations.map((calculation) => {
      const { axis, resultantValue, accelerationValue } = calculation;
      const resultant = formatWorkingValue(resultantValue);
      const acceleration = formatWorkingValue(accelerationValue);
      const expression = createForceAccelerationExpression(
        axis,
        resultant,
        selection.massText,
        acceleration,
        true,
      );
      setExactValueTooltip(
        expression.finalAnswer,
        acceleration,
        accelerationValue.value,
      );
      const line = document.createElement("span");
      line.className = "suvat-math-line";
      line.append(expression.element);
      return line;
    });
    substitution.replaceChildren(accelerationLines[0]);
    result.replaceChildren(...accelerationLines.slice(1));
  }

  const openExpandedForceCalculation = (
    calculationId: ForceCalculationId,
  ): void => {
    if (!currentParticleSelection) return;
    expandedSuvatEquationId = null;
    expandedForceCalculationId = calculationId;
    populateExpandedForceCalculation(calculationId);
    if (!suvatCalculationDialog.open) suvatCalculationDialog.showModal();
    scheduleExpandedCalculationAlignment();
    closeSuvatCalculationDialog.focus();
  };

  const getForceCalculationFromEvent = (
    event: Event,
  ): ForceCalculationId | null => {
    if (!(event.target instanceof Element)) return null;
    const calculation = event.target.closest<HTMLElement>(
      "[data-force-calculation]",
    );
    if (!calculation || !forceAnalysis.contains(calculation)) return null;
    const id = calculation.dataset.forceCalculation;
    return id === "resolve-parallel" ||
        id === "resolve-perpendicular" ||
        id === "resolve-x" ||
        id === "resolve-y" ||
        id === "fma"
      ? id
      : null;
  };

  forceAnalysis.addEventListener("click", (event) => {
    const calculationId = getForceCalculationFromEvent(event);
    if (calculationId) openExpandedForceCalculation(calculationId);
  });
  forceAnalysis.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const calculationId = getForceCalculationFromEvent(event);
    if (!calculationId) return;
    event.preventDefault();
    openExpandedForceCalculation(calculationId);
  });

  const setTool = (tool: Tool): void => {
    currentTool = tool;
    const particleActive = tool === "particle";
    const inclineActive = tool === "incline";
    const tableActive = tool === "table";
    const pulleyActive = tool === "pulley";
    particleTool.classList.toggle("is-active", particleActive);
    particleTool.setAttribute("aria-pressed", String(particleActive));
    inclineTool.classList.toggle("is-active", inclineActive);
    inclineTool.setAttribute("aria-pressed", String(inclineActive));
    tableTool.classList.toggle("is-active", tableActive);
    tableTool.setAttribute("aria-pressed", String(tableActive));
    pulleyTool.classList.toggle("is-active", pulleyActive);
    pulleyTool.setAttribute("aria-pressed", String(pulleyActive));
    canvas.classList.toggle(
      "is-placing",
      particleActive || inclineActive || tableActive || pulleyActive,
    );
  };

  particleTool.addEventListener("click", () => {
    const nextTool = currentTool === "particle" ? "select" : "particle";
    setTool(nextTool);
    callbacks.onToolChange(nextTool);
  });

  inclineTool.addEventListener("click", () => {
    const nextTool = currentTool === "incline" ? "select" : "incline";
    setTool(nextTool);
    callbacks.onToolChange(nextTool);
  });

  tableTool.addEventListener("click", () => {
    const nextTool = currentTool === "table" ? "select" : "table";
    setTool(nextTool);
    callbacks.onToolChange(nextTool);
  });

  pulleyTool.addEventListener("click", () => {
    const nextTool = currentTool === "pulley" ? "select" : "pulley";
    setTool(nextTool);
    callbacks.onToolChange(nextTool);
  });

  inclineLengthInput.addEventListener("change", () => {
    const value = parseInclineHorizontalLength(inclineLengthInput.value);
    if (value === null) {
      inclineLengthInput.setAttribute("aria-invalid", "true");
      return;
    }
    inclineLengthInput.removeAttribute("aria-invalid");
    callbacks.onInclineLengthChange(value, inclineLengthInput.value.trim());
  });
  inclineAngleInput.addEventListener("change", () => {
    const value = parseInclineAngle(inclineAngleInput.value);
    if (value === null) {
      inclineAngleInput.setAttribute("aria-invalid", "true");
      return;
    }
    inclineAngleInput.removeAttribute("aria-invalid");
    callbacks.onInclineAngleChange(value, inclineAngleInput.value.trim());
  });
  inclineRisesRight.addEventListener("click", () =>
    callbacks.onInclineDirectionChange("rises-right")
  );
  inclineRisesLeft.addEventListener("click", () =>
    callbacks.onInclineDirectionChange("rises-left")
  );
  inclineRoughToggle.addEventListener("change", () =>
    callbacks.onInclineRoughChange(inclineRoughToggle.checked)
  );
  inclineFrictionInput.addEventListener("change", () => {
    const value = parseGravity(inclineFrictionInput.value);
    if (value === null) {
      inclineFrictionInput.setAttribute("aria-invalid", "true");
      return;
    }
    inclineFrictionInput.removeAttribute("aria-invalid");
    callbacks.onInclineFrictionChange(value, inclineFrictionInput.value.trim());
  });
  tableWidthInput.addEventListener("change", () => {
    const value = parsePositiveProperty(tableWidthInput.value);
    if (value === null || value < MINIMUM_TABLE_SIZE) {
      tableWidthInput.setAttribute("aria-invalid", "true");
      return;
    }
    tableWidthInput.removeAttribute("aria-invalid");
    callbacks.onTableWidthChange(value, tableWidthInput.value.trim());
  });
  tableHeightInput.addEventListener("change", () => {
    const value = parsePositiveProperty(tableHeightInput.value);
    if (value === null || value < MINIMUM_TABLE_SIZE) {
      tableHeightInput.setAttribute("aria-invalid", "true");
      return;
    }
    tableHeightInput.removeAttribute("aria-invalid");
    callbacks.onTableHeightChange(value, tableHeightInput.value.trim());
  });
  tableRoughToggle.addEventListener("change", () =>
    callbacks.onTableRoughChange(tableRoughToggle.checked)
  );
  tableFrictionInput.addEventListener("change", () => {
    const value = parseGravity(tableFrictionInput.value);
    if (value === null) {
      tableFrictionInput.setAttribute("aria-invalid", "true");
      return;
    }
    tableFrictionInput.removeAttribute("aria-invalid");
    callbacks.onTableFrictionChange(value, tableFrictionInput.value.trim());
  });

  removeParticle.addEventListener("click", callbacks.onRemove);
  groundToggle.addEventListener("change", () => {
    callbacks.onGroundChange(groundToggle.checked);
  });
  showForceArrowsToggle.addEventListener("change", () => {
    callbacks.onShowForceArrowsChange(showForceArrowsToggle.checked);
  });

  gravityInput.addEventListener("change", () => {
    const result = parseGravity(gravityInput.value);
    if (result === null) {
      gravityInput.value = currentGravityText;
      gravityInput.setAttribute("aria-invalid", "true");
      gravityError.textContent = "Enter a non-negative value with up to 3 decimal places.";
      return;
    }

    const enteredText = gravityInput.value.trim();
    currentGravityText = enteredText;
    gravityInput.value = enteredText;
    gravityInput.removeAttribute("aria-invalid");
    gravityError.textContent = "";
    callbacks.onGravityChange(result, enteredText);
  });

  particleMassInput.addEventListener("change", () => {
    const result = parsePositiveProperty(particleMassInput.value);
    if (result === null) {
      particleMassInput.value = currentParticleMassText;
      particleMassInput.setAttribute("aria-invalid", "true");
      return;
    }

    const enteredText = particleMassInput.value.trim();
    currentParticleMassText = enteredText;
    particleMassInput.value = enteredText;
    particleMassInput.removeAttribute("aria-invalid");
    callbacks.onParticleMassChange(result, enteredText);
  });

  particleNameInput.addEventListener("change", () => {
    const name = normalizeParticleName(particleNameInput.value);
    if (name === null) {
      particleNameInput.value = currentParticleName;
      particleNameInput.setAttribute("aria-invalid", "true");
      return;
    }
    currentParticleName = name;
    particleNameInput.value = name;
    particleNameInput.removeAttribute("aria-invalid");
    callbacks.onParticleNameChange(name);
  });
  particleNameInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") particleNameInput.blur();
  });
  particleShapeSelect.addEventListener("change", () => {
    callbacks.onParticleShapeChange(particleShapeSelect.value as ParticleShape);
  });

  attachStableButtonPress(addAppliedForce, callbacks.onAddAppliedForce);
  showResultantForceToggle.addEventListener("change", () => {
    callbacks.onShowResultantForceChange(showResultantForceToggle.checked);
  });
  appliedForceModeComponents.addEventListener("click", () => {
    callbacks.onAppliedForceModeChange("components");
  });
  appliedForceModePolar.addEventListener("click", () => {
    callbacks.onAppliedForceModeChange("magnitude-direction");
  });

  const commitInitialVelocityComponents = (changedAxis: "x" | "y"): void => {
    const changedInput = changedAxis === "x"
      ? particleInitialVelocityXInput
      : particleInitialVelocityYInput;
    const changedValue = parseSignedValue(changedInput.value);
    if (changedValue === null) {
      const input = changedAxis === "x"
        ? particleInitialVelocityXInput
        : particleInitialVelocityYInput;
      input.value = currentParticleInitialVelocityText[changedAxis];
      input.setAttribute("aria-invalid", "true");
      return;
    }
    const values = {
      x: currentParticleInitialVelocityValues.x,
      y: currentParticleInitialVelocityValues.y,
      [changedAxis]: changedValue,
    };

    const enteredText = replaceInitialVelocityFieldText(
      currentParticleInitialVelocityText,
      changedAxis,
      changedInput.value.trim(),
    );
    currentParticleInitialVelocityText = enteredText;
    currentParticleInitialVelocityValues = {
      ...currentParticleInitialVelocityValues,
      ...values,
    };
    particleInitialVelocityXInput.value = enteredText.x;
    particleInitialVelocityYInput.value = enteredText.y;
    particleInitialVelocityXInput.removeAttribute("aria-invalid");
    particleInitialVelocityYInput.removeAttribute("aria-invalid");
    callbacks.onParticleInitialVelocityComponentsChange(
      { x: values.x, y: values.y },
      enteredText,
    );
  };

  particleInitialVelocityXInput.addEventListener("change", () => {
    commitInitialVelocityComponents("x");
  });
  particleInitialVelocityYInput.addEventListener("change", () => {
    commitInitialVelocityComponents("y");
  });

  const commitInitialVelocityAngle = (changedField: "speed" | "angle"): void => {
    const changedInput = changedField === "speed"
      ? particleInitialSpeedInput
      : particleInitialAngleInput;
    const changedValue = changedField === "speed"
      ? parseNonNegativeProperty(changedInput.value)
      : parseAngle(changedInput.value);
    if (changedValue === null) {
      const input = changedField === "speed"
        ? particleInitialSpeedInput
        : particleInitialAngleInput;
      input.value = currentParticleInitialAngleText[changedField];
      input.setAttribute("aria-invalid", "true");
      return;
    }
    const speed = changedField === "speed"
      ? changedValue
      : currentParticleInitialVelocityValues.speed;
    const angle = changedField === "angle"
      ? changedValue
      : currentParticleInitialVelocityValues.angle;

    const enteredText = replaceInitialVelocityFieldText(
      currentParticleInitialAngleText,
      changedField,
      changedInput.value.trim(),
    );
    currentParticleInitialAngleText = enteredText;
    currentParticleInitialVelocityValues = {
      ...currentParticleInitialVelocityValues,
      speed,
      angle,
    };
    particleInitialSpeedInput.value = enteredText.speed;
    particleInitialAngleInput.value = enteredText.angle;
    particleInitialSpeedInput.removeAttribute("aria-invalid");
    particleInitialAngleInput.removeAttribute("aria-invalid");
    callbacks.onParticleInitialVelocityAngleChange(speed, angle, enteredText);
  };

  particleInitialSpeedInput.addEventListener("change", () => {
    commitInitialVelocityAngle("speed");
  });
  particleInitialAngleInput.addEventListener("change", () => {
    commitInitialVelocityAngle("angle");
  });
  velocityModeAngle.addEventListener("click", () => {
    editingExactInitialVelocityField = null;
    callbacks.onParticleInitialVelocityModeChange("angle");
  });
  velocityModeComponents.addEventListener("click", () => {
    editingExactInitialVelocityField = null;
    callbacks.onParticleInitialVelocityModeChange("components");
  });

  const createAppliedForceField = (
    symbol: string,
    textValue: string,
    numericValue: number,
    unit: string,
    parse: (text: string) => number | null,
    commit: (value: number, text: string) => void,
  ): HTMLElement => {
    const label = document.createElement("label");
    label.className = "force-input-field";
    const symbolElement = document.createElement("i");
    const [baseSymbol, subscriptText] = symbol.split("_");
    symbolElement.textContent = baseSymbol;
    if (subscriptText) {
      const subscript = document.createElement("sub");
      subscript.textContent = subscriptText;
      symbolElement.append(subscript);
    }
    if (symbol === "θ") symbolElement.classList.add("physics-symbol");
    const equalsElement = document.createElement("span");
    equalsElement.textContent = "=";
    const field = document.createElement("span");
    field.className = "property-number-field";
    const input = document.createElement("input");
    input.type = "text";
    input.inputMode = "decimal";
    input.value = textValue;
    const exactButton = document.createElement("button");
    exactButton.type = "button";
    exactButton.className = "force-exact-value";
    exactButton.setAttribute("aria-label", `Edit exact ${symbol} value`);
    const symbolic = isSymbolicExactDisplay(textValue);
    if (symbolic) {
      input.hidden = true;
      exactButton.replaceChildren(createMathExpression(textValue));
      exactButton.dataset.exactApproximation = formatExactValueTooltip(numericValue);
      exactButton.addEventListener("click", () => {
        exactButton.hidden = true;
        input.hidden = false;
        input.value = formatEditableVelocityDecimal(numericValue);
        input.focus();
        input.select();
      });
      input.addEventListener("blur", () => {
        if (input.value === formatEditableVelocityDecimal(numericValue)) {
          input.hidden = true;
          exactButton.hidden = false;
        }
      });
    } else {
      exactButton.hidden = true;
    }
    input.addEventListener("change", () => {
      const parsed = parse(input.value);
      if (parsed === null) {
        input.value = textValue;
        input.setAttribute("aria-invalid", "true");
        return;
      }
      input.removeAttribute("aria-invalid");
      commit(parsed, input.value.trim());
    });
    field.append(input, exactButton);
    const unitElement = document.createElement("span");
    unitElement.textContent = unit;
    label.append(symbolElement, equalsElement, field, unitElement);
    return label;
  };

  const renderAppliedForces = (
    selection: Extract<SelectionProperties, { type: "particle" }>,
  ): void => {
    const editors = selection.appliedForces.map((force, index) => {
      const editor = document.createElement("article");
      editor.className = "applied-force-editor";
      const header = document.createElement("div");
      header.className = "applied-force-header";
      const title = document.createElement("span");
      title.textContent = `Applied Force ${index + 1}`;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-applied-force";
      remove.setAttribute("aria-label", `Remove Applied Force ${index + 1}`);
      const removeIcon = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg",
      );
      removeIcon.setAttribute("viewBox", "0 0 24 24");
      removeIcon.setAttribute("aria-hidden", "true");
      const removeIconPath = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path",
      );
      removeIconPath.setAttribute(
        "d",
        "M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13M10 10v7M14 10v7",
      );
      removeIcon.append(removeIconPath);
      remove.append(removeIcon);
      remove.addEventListener("click", () => callbacks.onRemoveAppliedForce(force.id));
      header.append(title, remove);

      const fields = document.createElement("div");
      fields.className = "force-input-fields";
      const componentsActive = selection.appliedForceEditorMode === "components";
      if (componentsActive) {
        fields.append(
          createAppliedForceField(
            "F_x",
            force.componentText.x,
            force.componentValues.x,
            "N",
            parseSignedValue,
            (value, text) => callbacks.onAppliedForceComponentsChange(
              force.id,
              { x: value, y: force.componentValues.y },
              { x: text, y: force.componentText.y },
            ),
          ),
          createAppliedForceField(
            "F_y",
            force.componentText.y,
            force.componentValues.y,
            "N",
            parseSignedValue,
            (value, text) => callbacks.onAppliedForceComponentsChange(
              force.id,
              { x: force.componentValues.x, y: value },
              { x: force.componentText.x, y: text },
            ),
          ),
        );
      } else {
        fields.append(
          createAppliedForceField(
            "F",
            force.polarText.magnitude,
            force.polarValues.magnitude,
            "N",
            parseGravity,
            (value, text) => callbacks.onAppliedForceMagnitudeDirectionChange(
              force.id,
              value,
              force.polarValues.angle,
              { magnitude: text, angle: force.polarText.angle },
            ),
          ),
          createAppliedForceField(
            "θ",
            force.polarText.angle,
            force.polarValues.angle,
            "°",
            parseAngle,
            (value, text) => callbacks.onAppliedForceMagnitudeDirectionChange(
              force.id,
              force.polarValues.magnitude,
              value,
              { magnitude: force.polarText.magnitude, angle: text },
            ),
          ),
        );
      }
      editor.append(header, fields);
      return editor;
    });
    appliedForcesList.replaceChildren(...editors);
  };

  const renderForceAnalysis = (
    selection: Extract<SelectionProperties, { type: "particle" }>,
  ): void => {
    const display = selection.forceDisplay;
    const weightText = formatWorkingValue(display.weightMagnitude);
    const weightExpression = createMathExpression(
      `W = mg = ${display.weightWorking} = ${weightText} N`,
    );
    weightExpression.querySelectorAll("mi").forEach((identifier) => {
      if (identifier.textContent === "m") identifier.classList.add("weight-m-symbol");
      if (identifier.textContent === "g") identifier.classList.add("physics-symbol");
    });
    particleWeightValue.replaceChildren(weightExpression);
    setExactValueTooltip(
      particleWeightValue,
      weightText,
      display.weightMagnitude.value,
    );
    setForceDirectionArrow(particleWeightDirection, display.weightDirection);
    normalReactionRow.hidden = display.normalReaction === null;
    if (display.normalReaction) {
      const reactionText = formatWorkingValue(display.normalReaction);
      const reactionExpression = createMathExpression(`R = ${reactionText} N`);
      particleNormalReactionValue.replaceChildren(reactionExpression);
      setExactValueTooltip(
        particleNormalReactionValue,
        reactionText,
        display.normalReaction.value,
      );
      if (display.normalReactionDirection) {
        setForceDirectionArrow(
          particleNormalReactionDirection,
          display.normalReactionDirection,
        );
      }
    } else {
      particleNormalReactionValue.replaceChildren();
      setExactValueTooltip(particleNormalReactionValue, null, 0);
    }
    frictionRow.hidden = display.friction === null;
    if (display.friction && display.frictionLimit && display.frictionRegime) {
      const frictionText = formatWorkingValue(display.friction);
      const limitText = formatWorkingValue(display.frictionLimit);
      particleFrictionValue.replaceChildren(
        createMathExpression(`F = ${frictionText} N`),
      );
      setExactValueTooltip(
        particleFrictionValue,
        frictionText,
        display.friction.value,
      );
      const relation = display.frictionRegime === "static" ? "≤" : "=";
      particleFrictionCondition.replaceChildren(
        createMathExpression(`F ${relation} μR = ${limitText} N`),
      );
      if (display.frictionDirection) {
        setForceDirectionArrow(
          particleFrictionDirection,
          display.frictionDirection,
        );
      }
    } else {
      particleFrictionValue.replaceChildren();
      particleFrictionCondition.replaceChildren();
      setExactValueTooltip(particleFrictionValue, null, 0);
    }
    tensionRow.hidden = display.tension === null;
    if (display.tension && display.tensionDirection) {
      const tensionText = formatWorkingValue(display.tension);
      particleTensionValue.replaceChildren(
        createMathExpression(`T = ${tensionText} N`),
      );
      setExactValueTooltip(
        particleTensionValue,
        tensionText,
        display.tension.value,
      );
      setForceDirectionArrow(
        particleTensionDirection,
        display.tensionDirection,
      );
    } else {
      particleTensionValue.replaceChildren();
      setExactValueTooltip(particleTensionValue, null, 0);
    }
    const renderResolutionLine = (
      element: HTMLElement,
      axis: "x" | "y" | "parallel" | "perpendicular",
      terms: string,
      result: string,
      value: { value: number },
    ): void => {
      const expression = createForceResolutionExpression(axis, terms, result);
      element.replaceChildren(expression.element);
      setExactValueTooltip(expression.finalAnswer, result, value.value);
    };
    const inclineResolution = selection.inclineForceResolution;
    forceResolutionParallelRow.hidden = !inclineResolution;
    forceResolutionPerpendicularRow.hidden = !inclineResolution;
    forceAccelerationParallel.hidden = !inclineResolution;
    forceAccelerationPerpendicular.hidden = !inclineResolution;

    if (inclineResolution) {
      const parallelResultant = formatWorkingValue(
        inclineResolution.parallelResultant,
      );
      const perpendicularResultant = formatWorkingValue(
        inclineResolution.perpendicularResultant,
      );
      renderResolutionLine(
        forceResultantParallel,
        "parallel",
        formatSignedTerms(
          inclineResolution.parallelForces.map(formatWorkingValue),
        ),
        parallelResultant,
        inclineResolution.parallelResultant,
      );
      renderResolutionLine(
        forceResultantPerpendicular,
        "perpendicular",
        formatSignedTerms(
          inclineResolution.perpendicularForces.map(formatWorkingValue),
        ),
        perpendicularResultant,
        inclineResolution.perpendicularResultant,
      );
      const parallelAcceleration = formatWorkingValue(
        inclineResolution.tangentialAcceleration,
      );
      const perpendicularAcceleration = formatWorkingValue(
        inclineResolution.perpendicularAcceleration,
      );
      const parallelExpression = createForceAccelerationExpression(
        "parallel",
        parallelResultant,
        selection.massText,
        parallelAcceleration,
      );
      forceAccelerationParallel.replaceChildren(parallelExpression.element);
      setExactValueTooltip(
        parallelExpression.finalAnswer,
        parallelAcceleration,
        inclineResolution.tangentialAcceleration.value,
      );
      const perpendicularExpression = createForceAccelerationExpression(
        "perpendicular",
        perpendicularResultant,
        selection.massText,
        perpendicularAcceleration,
      );
      forceAccelerationPerpendicular.replaceChildren(
        perpendicularExpression.element,
      );
      setExactValueTooltip(
        perpendicularExpression.finalAnswer,
        perpendicularAcceleration,
        inclineResolution.perpendicularAcceleration.value,
      );
    } else {
      forceResultantParallel.replaceChildren();
      forceResultantPerpendicular.replaceChildren();
      forceAccelerationParallel.replaceChildren();
      forceAccelerationPerpendicular.replaceChildren();
    }

    const resultantX = formatWorkingValue(display.resultant.x);
    const resultantY = formatWorkingValue(display.resultant.y);
    renderResolutionLine(
      forceResultantX,
      "x",
      formatSignedTerms(display.forces.map((force) => formatWorkingValue(force.x))),
      resultantX,
      display.resultant.x,
    );
    renderResolutionLine(
      forceResultantY,
      "y",
      formatSignedTerms(display.forces.map((force) => formatWorkingValue(force.y))),
      resultantY,
      display.resultant.y,
    );
    const accelerationX = formatWorkingValue(display.acceleration.x);
    const accelerationY = formatWorkingValue(display.acceleration.y);
    const accelerationXExpression = createForceAccelerationExpression(
      "x",
      resultantX,
      selection.massText,
      accelerationX,
    );
    forceAccelerationX.replaceChildren(accelerationXExpression.element);
    setExactValueTooltip(
      accelerationXExpression.finalAnswer,
      accelerationX,
      display.acceleration.x.value,
    );
    const accelerationYExpression = createForceAccelerationExpression(
      "y",
      resultantY,
      selection.massText,
      accelerationY,
    );
    forceAccelerationY.replaceChildren(accelerationYExpression.element);
    setExactValueTooltip(
      accelerationYExpression.finalAnswer,
      accelerationY,
      display.acceleration.y.value,
    );
    refreshExpandedCalculation();
  };

  particlePauseAtGreatestToggle.addEventListener("change", () => {
    callbacks.onParticlePauseAtGreatestHeightChange(
      particlePauseAtGreatestToggle.checked,
    );
  });

  particlePauseAtGroundToggle.addEventListener("change", () => {
    callbacks.onParticlePauseAtGroundContactChange(
      particlePauseAtGroundToggle.checked,
    );
  });

  particlePauseAtCoincidenceToggle.addEventListener("change", () => {
    callbacks.onParticlePauseAtCoincidenceChange(
      particlePauseAtCoincidenceToggle.checked,
    );
  });

  particlePauseTargetToggle.addEventListener("change", () => {
    callbacks.onParticlePauseAtVerticalTargetChange(
      particlePauseTargetToggle.checked,
    );
  });

  particlePauseTargetInput.addEventListener("change", () => {
    const groundEnabled = currentParticleSelection?.groundEnabled ?? false;
    const result = groundEnabled
      ? parseGravity(particlePauseTargetInput.value)
      : parseSignedValue(particlePauseTargetInput.value);
    if (result === null) {
      particlePauseTargetInput.value = currentParticlePauseTargetText;
      particlePauseTargetInput.setAttribute("aria-invalid", "true");
      return;
    }

    currentParticlePauseTargetText = particlePauseTargetInput.value.trim();
    particlePauseTargetInput.value = currentParticlePauseTargetText;
    particlePauseTargetInput.removeAttribute("aria-invalid");
    callbacks.onParticleVerticalPauseTargetValueChange(
      result,
      currentParticlePauseTargetText,
    );
  });

  positiveLeft.addEventListener("click", () => callbacks.onPositiveXChange("left"));
  positiveRight.addEventListener("click", () => callbacks.onPositiveXChange("right"));
  positiveUp.addEventListener("click", () => {
    callbacks.onPositiveYChange("up");
  });
  positiveDown.addEventListener("click", () => {
    callbacks.onPositiveYChange("down");
  });
  const commitAngleConvention = (): void => {
    callbacks.onAngleConventionChange(
      angleReferenceAxis.value as AngleReferenceAxis,
      angleDirection.value as AngleDirection,
    );
  };
  angleReferenceAxis.addEventListener("change", commitAngleConvention);
  angleDirection.addEventListener("change", commitAngleConvention);

  groundFrictionInput.addEventListener("change", () => {
    const result = parsePositiveProperty(groundFrictionInput.value);
    if (result === null) {
      groundFrictionInput.value = formatNumber(currentGroundFriction);
      groundFrictionInput.setAttribute("aria-invalid", "true");
      return;
    }

    currentGroundFriction = result;
    groundFrictionInput.value = formatNumber(result);
    groundFrictionInput.removeAttribute("aria-invalid");
    callbacks.onGroundFrictionChange(result);
  });

  groundRoughToggle.addEventListener("change", () => {
    const rough = groundRoughToggle.checked;
    const defaultedFriction = rough && currentGroundFriction <= 0 ? 0.5 : null;
    groundFrictionControl.classList.toggle("is-hidden", !rough);
    groundFrictionInput.disabled = !rough;
    callbacks.onGroundRoughChange(rough);
    if (defaultedFriction !== null) {
      callbacks.onGroundFrictionChange(defaultedFriction);
    }
  });

  clearScene.addEventListener("click", callbacks.onClearScene);

  timeInput.addEventListener("change", () => {
    const enteredText = timeInput.value.trim();
    const result = parseTime(timeInput.value);
    if (result === null) {
      isEditingExactTime = false;
      timeInput.value = currentTimeText;
      timeInput.setAttribute("aria-invalid", "true");
      return;
    }

    isEditingExactTime = false;
    currentTimeText = enteredText;
    timeInput.value = enteredText;
    timeInput.removeAttribute("aria-invalid");
    callbacks.onTimeChange(result, enteredText);
  });

  timeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") timeInput.blur();
  });

  timeInput.addEventListener("blur", () => {
    if (!isEditingExactTime || lastExactTimeDisplay === null) return;

    isEditingExactTime = false;
    exactTimeDisplaySuppressed = false;
    timeInput.classList.add("is-hidden");
    timeExactValue.classList.remove("is-hidden");
  });

  timeExactValue.addEventListener("click", () => {
    isEditingExactTime = true;
    exactTimeDisplaySuppressed = true;
    timeExactValue.classList.add("is-hidden");
    timeInput.classList.remove("is-hidden");
    currentTimeText = formatTime(currentDisplayedTime);
    timeInput.value = currentTimeText;
    timeInput.focus();
    timeInput.select();
  });

  toggleSceneProperties.addEventListener("click", () => {
    const collapsed = scenePropertiesShell.classList.toggle("is-collapsed");
    toggleSceneProperties.setAttribute("aria-expanded", String(!collapsed));
    toggleSceneProperties.setAttribute(
      "aria-label",
      collapsed ? "Expand scene properties" : "Collapse scene properties",
    );
  });

  const getStepInterval = (): number => Number(stepInterval.value);
  previousTime.addEventListener("click", () => callbacks.onPrevious(getStepInterval()));
  nextTime.addEventListener("click", () => callbacks.onNext(getStepInterval()));
  playTime.addEventListener("click", callbacks.onPlayToggle);
  resetTime.addEventListener("click", callbacks.onReset);
  zoomOut.addEventListener("click", () => callbacks.onZoom(0.8));
  zoomIn.addEventListener("click", () => callbacks.onZoom(1.25));
  resetView.addEventListener("click", callbacks.onResetView);

  return {
    canvas,
    canvasMathOverlay,
    deleteTarget: removeParticle,
    particleSource: particleTool,
    inclineSource: inclineTool,
    tableSource: tableTool,
    pulleySource: pulleyTool,
    setTool,
    setSelected: (hasSelection) => {
      removeParticle.disabled = !hasSelection;
    },
    setSelectionProperties: (selection) => {
      const preservedScrollTop = particlePropertiesScroll.scrollTop;
      particleProperties.classList.toggle(
        "is-hidden",
        selection?.type !== "particle",
      );
      groundProperties.classList.toggle(
        "is-hidden",
        selection?.type !== "ground",
      );
      inclineProperties.classList.toggle(
        "is-hidden",
        selection?.type !== "incline",
      );
      tableProperties.classList.toggle(
        "is-hidden",
        selection?.type !== "table",
      );
      connectedSystemProperties.classList.toggle(
        "is-hidden",
        selection?.type !== "string",
      );

      if (selection?.type === "particle") {
        currentParticleSelection = selection;
        currentParticleName = selection.name;
        currentParticleMassText = selection.massText;
        currentParticleInitialVelocityText = { ...selection.initialVelocityText };
        currentParticleInitialVelocityValues = {
          ...selection.initialVelocityValues,
        };
        currentParticleInitialAngleText = selection.initialVelocityAngleText ?? {
          speed: "0",
          angle: "0",
        };
        particlePositionX.textContent = formatNumber(selection.position.x);
        particlePositionY.textContent = formatNumber(selection.position.y);
        if (document.activeElement !== particleNameInput) {
          particleNameInput.value = selection.name;
        }
        particleShapeSelect.value = selection.shape;
        particleNameInput.removeAttribute("aria-invalid");
        if (document.activeElement !== particleMassInput) {
          particleMassInput.value = selection.massText;
        }
        particleMassInput.removeAttribute("aria-invalid");
        showResultantForceToggle.checked = selection.showResultantForce;
        appliedForceGlobalMode.hidden = selection.appliedForces.length === 0;
        const cartesianForces = selection.appliedForceEditorMode === "components";
        appliedForceModeComponents.classList.toggle("is-active", cartesianForces);
        appliedForceModePolar.classList.toggle("is-active", !cartesianForces);
        appliedForceModeComponents.setAttribute(
          "aria-pressed",
          String(cartesianForces),
        );
        appliedForceModePolar.setAttribute(
          "aria-pressed",
          String(!cartesianForces),
        );
        renderAppliedForces(selection);
        renderForceAnalysis(selection);
        if (document.activeElement !== particleInitialVelocityXInput) {
          particleInitialVelocityXInput.value = selection.initialVelocityText.x;
        }
        if (document.activeElement !== particleInitialVelocityYInput) {
          particleInitialVelocityYInput.value = selection.initialVelocityText.y;
        }
        particleInitialVelocityXInput.removeAttribute("aria-invalid");
        particleInitialVelocityYInput.removeAttribute("aria-invalid");
        if (document.activeElement !== particleInitialSpeedInput) {
          particleInitialSpeedInput.value = currentParticleInitialAngleText.speed;
        }
        if (document.activeElement !== particleInitialAngleInput) {
          particleInitialAngleInput.value = currentParticleInitialAngleText.angle;
        }
        particleInitialSpeedInput.removeAttribute("aria-invalid");
        particleInitialAngleInput.removeAttribute("aria-invalid");
        const angleMode = selection.initialVelocityEditorMode === "angle";
        velocityModeAngle.classList.toggle("is-active", angleMode);
        velocityModeComponents.classList.toggle("is-active", !angleMode);
        velocityModeAngle.setAttribute("aria-pressed", String(angleMode));
        velocityModeComponents.setAttribute("aria-pressed", String(!angleMode));
        initialVelocityAngleFields.hidden = !angleMode;
        initialVelocityComponentFields.hidden = angleMode;
        exactInitialVelocityFields = getExactInitialVelocityFields({
          ...currentParticleInitialVelocityText,
          ...currentParticleInitialAngleText,
        });
        for (const field of ["x", "y", "speed", "angle"] as const) {
          refreshInitialVelocityField(field);
        }
        particlePauseAtGreatestToggle.checked = selection.pauseAtGreatestHeight;
        particlePauseAtGroundToggle.checked = selection.pauseAtGroundContact;
        particlePauseAtGroundRow.hidden = !selection.groundEnabled;
        particlePauseAtCoincidenceToggle.checked =
          selection.pauseAtParticleCoincidence;
        particlePauseTargetToggle.checked = selection.pauseAtVerticalTarget;
        particlePauseTargetControl.hidden = !selection.pauseAtVerticalTarget;
        particlePauseTargetLabel.textContent = selection.groundEnabled
          ? "Height above ground"
          : "Vertical displacement";
        currentParticlePauseTargetText = selection.verticalPauseTargetText;
        if (document.activeElement !== particlePauseTargetInput) {
          particlePauseTargetInput.value = selection.verticalPauseTargetText;
        }
        particlePauseTargetInput.setAttribute(
          "aria-label",
          selection.groundEnabled
            ? "Height above ground in metres"
            : "Vertical displacement in metres",
        );
        particlePauseTargetInput.removeAttribute("aria-invalid");
        connectString.disabled = false;
        connectStringMessage.textContent = selection.stringConnectionMessage ?? "";
        renderSelectedKinematicComponent();
        particlePropertiesScroll.scrollTop = preservedScrollTop;
        particleTabScrollPositions[selectedParticleTab] =
          particlePropertiesScroll.scrollTop;
      } else if (selection?.type === "ground") {
        if (motionGraphDialog.open) motionGraphDialog.close();
        currentParticleSelection = null;
        currentSuvatEquations = [];
        closeExpandedSuvatEquation();
        currentGroundFriction = selection.friction;
        groundRoughToggle.checked = selection.rough;
        groundFrictionControl.classList.toggle("is-hidden", !selection.rough);
        groundFrictionInput.disabled = !selection.rough;
        groundFrictionInput.value = formatNumber(selection.friction);
        groundFrictionInput.removeAttribute("aria-invalid");
      } else if (selection?.type === "incline") {
        if (motionGraphDialog.open) motionGraphDialog.close();
        currentParticleSelection = null;
        currentSuvatEquations = [];
        closeExpandedSuvatEquation();
        inclinePositionX.textContent = formatNumber(selection.position.x);
        inclinePositionY.textContent = formatNumber(selection.position.y);
        inclineAngleInput.value = selection.angleInput;
        inclineLengthInput.value = selection.horizontalLengthInput;
        inclineAngleInput.removeAttribute("aria-invalid");
        inclineLengthInput.removeAttribute("aria-invalid");
        const risesRight = selection.direction === "rises-right";
        inclineRisesRight.setAttribute("aria-pressed", String(risesRight));
        inclineRisesLeft.setAttribute("aria-pressed", String(!risesRight));
        inclineRisesRight.classList.toggle("is-active", risesRight);
        inclineRisesLeft.classList.toggle("is-active", !risesRight);
        inclineRoughToggle.checked = selection.rough;
        inclineFrictionControl.classList.toggle("is-hidden", !selection.rough);
        inclineFrictionInput.disabled = !selection.rough;
        inclineFrictionInput.value = selection.frictionInput;
        inclineFrictionInput.removeAttribute("aria-invalid");
      } else if (selection?.type === "table") {
        if (motionGraphDialog.open) motionGraphDialog.close();
        currentParticleSelection = null;
        currentSuvatEquations = [];
        closeExpandedSuvatEquation();
        tablePositionX.textContent = formatNumber(selection.position.x);
        tablePositionY.textContent = formatNumber(selection.position.y);
        tableWidthInput.value = selection.widthInput;
        tableHeightInput.value = selection.heightInput;
        tableWidthInput.removeAttribute("aria-invalid");
        tableHeightInput.removeAttribute("aria-invalid");
        tableRoughToggle.checked = selection.rough;
        tableFrictionControl.classList.toggle("is-hidden", !selection.rough);
        tableFrictionInput.disabled = !selection.rough;
        tableFrictionInput.value = selection.frictionInput;
        tableFrictionInput.removeAttribute("aria-invalid");
      } else if (selection?.type === "string") {
        if (motionGraphDialog.open) motionGraphDialog.close();
        currentParticleSelection = null;
        currentSuvatEquations = [];
        closeExpandedSuvatEquation();
        connectedParticleA.textContent = `${selection.particleA.name}, ${formatNumber(selection.particleA.mass)} kg`;
        connectedParticleB.textContent = `${selection.particleB.name}, ${formatNumber(selection.particleB.mass)} kg`;
        connectedStringState.textContent = selection.state === "taut" ? "Taut" : "Slack";
        connectedLengthRow.hidden = selection.pulley !== null;
        connectedLengthError.hidden = selection.pulley !== null;
        connectedPulleyLengthControls.hidden = selection.pulley === null;
        currentStringLengthText = selection.lengthText;
        if (document.activeElement !== connectedLengthInput) {
          connectedLengthInput.value = selection.lengthText;
        }
        connectedLengthInput.removeAttribute("aria-invalid");
        connectedLengthError.textContent = "";
        if (selection.pulley) {
          currentPulleyLeftLengthText = selection.pulley.leftLengthText;
          currentPulleyRightLengthText = selection.pulley.rightLengthText;
          if (document.activeElement !== connectedLeftLengthInput) {
            connectedLeftLengthInput.value = selection.pulley.leftLengthText;
          }
          if (document.activeElement !== connectedRightLengthInput) {
            connectedRightLengthInput.value = selection.pulley.rightLengthText;
          }
        }
        connectedLeftLengthInput.removeAttribute("aria-invalid");
        connectedRightLengthInput.removeAttribute("aria-invalid");
        connectedLeftLengthError.textContent = "";
        connectedRightLengthError.textContent = "";
        const display = selection.display;
        const independentlyMoving = display.commonAcceleration === null;
        connectedCommonAccelerationRow.hidden = independentlyMoving;
        connectedSlackNote.hidden = selection.state !== "slack";
        connectedSlackNote.textContent =
          "Particles move independently while the string is slack.";
        connectedForceResolutionSection.hidden = independentlyMoving;
        connectedFmaSection.hidden = independentlyMoving;
        if (display.commonAcceleration === null) {
          connectedAcceleration.textContent = "\u2014";
          setExactValueTooltip(connectedAcceleration, null, 0);
          connectedForceResolution.replaceChildren(
            createConnectedSystemForceResolution(display),
          );
          connectedFma.textContent =
            "The string is slack, so there is no common acceleration.";
        } else {
          const accelerationText = formatWorkingValue(display.commonAcceleration);
          const forceResolution = createConnectedSystemForceResolution(display);
          const totalMassText = `(${formatWorkingValue(display.endpointA.mass)} + ${formatWorkingValue(display.endpointB.mass)})`;
          const fmaExpression = createForceAccelerationExpression(
            display.axis,
            formatWorkingValue(display.externalResultant),
            totalMassText,
            accelerationText,
            true,
          );
          connectedForceResolution.replaceChildren(forceResolution);
          connectedFma.replaceChildren(fmaExpression.element);
          setExactValueTooltip(
            fmaExpression.finalAnswer,
            accelerationText,
            display.commonAcceleration.value,
          );
          renderConnectedAcceleration(
            connectedAcceleration,
            accelerationText,
            display.commonAcceleration,
          );
        }
        const tensionText = formatWorkingValue(display.tension);
        connectedTension.replaceChildren(
          createMathExpression(tensionText),
        );
        setExactValueTooltip(connectedTension, tensionText, display.tension.value);
        connectedBoundaryMessage.textContent = selection.boundaryMessage ?? "";
        connectedBoundaryMessage.hidden = selection.boundaryMessage === null;
      } else {
        if (motionGraphDialog.open) motionGraphDialog.close();
        currentParticleSelection = null;
        currentSuvatEquations = [];
        closeExpandedSuvatEquation();
      }
    },
    setCoordinateConvention: (convention) => {
      updateDirectionButtons(
        convention.positiveX === "right",
        positiveRight,
        positiveLeft,
      );
      updateDirectionButtons(
        convention.positiveY === "up",
        positiveUp,
        positiveDown,
      );
      angleReferenceAxis.value = convention.angleReferenceAxis;
      angleDirection.value = convention.angleDirection;
    },
    setTime: (time, enteredText, exactDisplay = null) => {
      currentDisplayedTime = time;
      currentTimeText = enteredText ?? formatTime(time);
      if (lastExactTimeDisplay !== exactDisplay) {
        exactTimeDisplaySuppressed = false;
        lastExactTimeDisplay = exactDisplay;
      }

      const showExactTime =
        exactDisplay !== null &&
        !exactTimeDisplaySuppressed &&
        document.activeElement !== timeInput;
      timeExactValue.classList.toggle("is-hidden", !showExactTime);
      timeInput.classList.toggle("is-hidden", showExactTime);

      if (showExactTime) {
        timeExactValue.replaceChildren(createAutoPauseTimeValue(exactDisplay));
        setExactValueTooltip(timeExactValue, exactDisplay, time);
      } else {
        setExactValueTooltip(timeExactValue, null, time);
        if (document.activeElement !== timeInput) {
          timeInput.value = currentTimeText;
      }
    }
      previousTime.disabled = time <= 0;
      resetTime.disabled = time <= 0;
    },
    setPlaybackState: (state, blockedReason = null) => {
      const blocked = state === "blocked";
      playTime.classList.toggle("is-playing", state === "playing");
      playTime.classList.toggle("is-pause-pending", state === "pause-pending");
      playTime.classList.toggle("is-blocked", blocked);
      playTime.disabled = blocked;
      nextTime.classList.toggle("is-blocked", blocked);
      nextTime.disabled = blocked;
      playDisabledReason.hidden = !blocked || !blockedReason;
      playDisabledReason.textContent = blockedReason ?? "";
      playTime.setAttribute(
        "aria-label",
        state === "blocked"
          ? `Play unavailable${blockedReason ? `: ${blockedReason}` : ""}`
          : state === "paused"
            ? "Play"
            : "Pause",
      );
    },
    setZoom: (pixelsPerMetre) => {
      resetView.textContent = `${Math.round((pixelsPerMetre / PIXELS_PER_METRE) * 100)}%`;
      scaleLine.style.width = `${pixelsPerMetre}px`;
    },
  };
}

export function getForceDirectionArrowRotation(vector: Vec2): number {
  return Math.atan2(-vector.y, vector.x) * 180 / Math.PI;
}

function setForceDirectionArrow(element: HTMLElement, vector: Vec2): void {
  element.style.setProperty(
    "--force-direction-angle",
    `${getForceDirectionArrowRotation(vector)}deg`,
  );
}

function createAutoPauseTimeValue(value: AutoPauseTimeDisplay): Element {
  if (typeof value === "string") return createMathExpression(value);
  if (value.kind === "rational-trig") {
    return createMathExpression(
      formatAutoPauseTimeExactText(value),
    );
  }
  const exactText = formatAutoPauseTimeExactText(value);
  return createCanvasMathValueElement(
    exactText,
    exactText,
  );
}

export function parseGravity(value: string): number | null {
  const trimmedValue = value.trim();
  if (!/^(?:\d+|\d*\.\d{1,3})$/.test(trimmedValue)) return null;

  const parsedValue = Number(trimmedValue);
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : null;
}

export function clearSoleZeroInputValue(value: string): string {
  return value.trim() === "0" ? "" : value;
}

export function defaultBlankInputValue(value: string): string {
  return value.trim() === "" ? "0" : value;
}

export function parsePositiveProperty(value: string): number | null {
  const parsedValue = parseGravity(value);
  return parsedValue !== null && parsedValue > 0 ? parsedValue : null;
}

export function normalizeParticleName(value: string): string | null {
  const name = value.trim();
  return name.length > 0 && name.length <= 40 ? name : null;
}

export function parseNonNegativeProperty(value: string): number | null {
  return parseGravity(value);
}

export function parseInclineAngle(value: string): number | null {
  const parsedValue = parseGravity(value);
  return parsedValue !== null && parsedValue > 0 && parsedValue < 90
    ? parsedValue
    : null;
}

export function parseInclineHorizontalLength(value: string): number | null {
  const parsedValue = parseGravity(value);
  return parsedValue !== null &&
      parsedValue >= MINIMUM_INCLINE_HORIZONTAL_LENGTH
    ? parsedValue
    : null;
}

export function parseTime(value: string): number | null {
  const trimmedValue = value.trim();
  if (!/^(?:\d+|\d*\.\d+)$/.test(trimmedValue)) return null;

  const parsedValue = Number(trimmedValue);
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : null;
}

export function formatPlaybackTime(time: number): string {
  return Math.max(0, time).toFixed(2);
}

export function parseWorldCoordinate(value: string): number | null {
  return parseSignedValue(value);
}

export function parseSignedValue(value: string): number | null {
  const trimmedValue = value.trim();
  if (!/^-?(?:\d+|\d*\.\d{1,3})$/.test(trimmedValue)) return null;

  const parsedValue = Number(trimmedValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

export function parseAngle(value: string): number | null {
  const angle = parseSignedValue(value);
  return angle !== null && angle > -180 && angle <= 180 ? angle : null;
}

export function replaceInitialVelocityFieldText<
  Values extends Record<string, string>,
  Field extends keyof Values,
>(values: Values, changedField: Field, changedText: string): Values {
  return { ...values, [changedField]: changedText };
}

export function getExactInitialVelocityFields(
  values: Record<InitialVelocityField, string>,
): Set<InitialVelocityField> {
  return new Set(
    (Object.keys(values) as InitialVelocityField[]).filter((field) =>
      isSymbolicExactDisplay(values[field])
    ),
  );
}

function formatNumber(value: number): string {
  return String(Number(value.toFixed(3)));
}

function formatEditableVelocityDecimal(value: number): string {
  const rounded = Number(value.toFixed(3));
  return (Object.is(rounded, -0) ? 0 : rounded).toFixed(3);
}

export function formatTime(time: number): string {
  return String(Object.is(time, -0) ? 0 : time);
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element: #${id}`);
  return element as T;
}

function updateDirectionButtons(
  firstIsPositive: boolean,
  firstButton: HTMLButtonElement,
  secondButton: HTMLButtonElement,
): void {
  firstButton.classList.toggle("is-active", firstIsPositive);
  secondButton.classList.toggle("is-active", !firstIsPositive);
  firstButton.setAttribute("aria-pressed", String(firstIsPositive));
  secondButton.setAttribute("aria-pressed", String(!firstIsPositive));
}

function setKinematicOutputs(
  outputs: Record<keyof KinematicDisplayValues, HTMLOutputElement>,
  state: KinematicDisplayValues,
  numericalState: Record<keyof KinematicDisplayValues, number>,
): void {
  for (const quantity of ["s", "u", "v", "a", "t"] as const) {
    const output = outputs[quantity];
    const value = state[quantity];
    setExactValueTooltip(output, value, numericalState[quantity]);
    output.classList.toggle("has-fraction", usesCompactKinematicText(value));
    if (typeof value !== "string") {
      output.classList.add("has-square-root");
      output.replaceChildren(
        createCanvasMathValueElement(
          value,
          `${value.negative ? "negative " : ""}the square root of ${value.radicand}`,
        ),
      );
      continue;
    }

    output.classList.remove("has-square-root");
    output.replaceChildren(createMathExpression(value));
  }
}

export function usesCompactKinematicText(
  value: KinematicDisplayValues[keyof KinematicDisplayValues],
): boolean {
  return typeof value === "string"
    ? value.includes("/")
    : value.radicand.includes("/");
}

function createConnectedSystemForceResolution(
  display: ConnectedSystemDisplay,
): HTMLElement {
  const terms = formatSignedTerms([
    ...display.systemForces,
  ]
      .filter((force) => Math.abs(force.value) > 1e-12)
      .map(formatWorkingValue));
  const resultantText = formatWorkingValue(display.externalResultant);
  const expression = createForceResolutionExpression(
    display.axis,
    terms,
    resultantText,
    true,
  );
  setExactValueTooltip(
    expression.finalAnswer,
    resultantText,
    display.externalResultant.value,
  );
  return expression.element;
}

function renderConnectedAcceleration(
  output: HTMLOutputElement,
  accelerationText: string,
  acceleration: DisplayValue,
): void {
  output.replaceChildren(createMathExpression(accelerationText));
  setExactValueTooltip(output, accelerationText, acceleration.value);
}

function setExactValueTooltip(
  element: HTMLElement,
  display: string | { kind: string } | null,
  value: number,
): void {
  const tooltip = display === null
    ? null
    : getExactValueTooltip(display, value);
  if (tooltip) {
    element.dataset.exactApproximation = tooltip;
    element.setAttribute("aria-description", `Approximately ${tooltip}`);
  } else {
    delete element.dataset.exactApproximation;
    element.removeAttribute("aria-description");
  }
}

function renderExpandedMotionGraphAnnotations(
  container: HTMLElement,
  annotations: RenderedMotionGraphAnnotation[],
  graph: MotionGraphData,
  quantity: MotionGraphQuantity,
): void {
  const labels = annotations.map(({ annotation, leftPercent, topPercent }) => {
    const label = document.createElement("span");
    const exactText = getMotionGraphAnnotationLabel(annotation);
    label.className = "motion-graph-coordinate";
    label.style.left = `${leftPercent}%`;
    label.style.top = `${topPercent}%`;
    label.setAttribute("aria-label", exactText);
    label.append(createMathExpression(exactText));

    const tooltip = getMotionGraphAnnotationTooltip(annotation);
    if (tooltip) {
      label.dataset.exactApproximation = tooltip;
      label.setAttribute("aria-description", `Approximately ${tooltip}`);
      label.tabIndex = 0;
    }
    return label;
  });
  container.replaceChildren(...labels);
  const bounds = container.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) return;
  labels.forEach((label, index) => {
    const rendered = annotations[index];
    if (!rendered) return;
    const labelBounds = label.getBoundingClientRect();
    const placement = chooseMotionGraphAnnotationPlacement(
      rendered.annotation,
      graph,
      quantity,
      labelBounds.width * EXPANDED_MOTION_GRAPH_WIDTH / bounds.width,
      labelBounds.height * EXPANDED_MOTION_GRAPH_HEIGHT / bounds.height,
    );
    label.classList.add(`motion-graph-coordinate--${placement}`);
  });
}

export function getMotionGraphAnnotationTooltip(
  annotation: MotionGraphAnnotation,
): string | null {
  const timeText = formatWorkingValue(annotation.timeDisplay);
  const valueText = formatWorkingValue(annotation.valueDisplay);
  if (annotation.kind === "turning-point") {
    const hasSymbolicCoordinate =
      getExactValueTooltip(timeText, annotation.time) !== null ||
      getExactValueTooltip(valueText, annotation.value) !== null;
    if (!hasSymbolicCoordinate) return null;
    return `(${formatThreeDecimalPlaces(annotation.time)}, ${formatThreeDecimalPlaces(annotation.value)}) (3 d.p.)`;
  }

  return Math.abs(annotation.value) < 1e-10
    ? getExactValueTooltip(timeText, annotation.time)
    : getExactValueTooltip(valueText, annotation.value);
}

function formatThreeDecimalPlaces(value: number): string {
  const rounded = Number(value.toFixed(3));
  return Object.is(rounded, -0) ? "0.000" : rounded.toFixed(3);
}

export function formatSignedTerms(terms: string[]): string {
  if (terms.length === 0) return "0";
  return terms.reduce((text, term, index) => {
    const negative = /^[-−]/.test(term);
    const magnitude = term.replace(/^[-−]/, "");
    if (index === 0) return negative ? `−${magnitude}` : magnitude;
    return `${text} ${negative ? "−" : "+"} ${magnitude}`;
  }, "");
}

function setSuvatAnalysis(
  equationsContainer: HTMLElement,
  equations: KinematicEquationResult[],
): void {
  equationsContainer.classList.remove("is-hidden");
  ensureSuvatEquationElements(equationsContainer, equations);

  for (const equation of equations) {
    const element = equationsContainer.querySelector<HTMLElement>(
      `[data-suvat-equation="${equation.id}"]`,
    );
    if (!element) continue;

    populateSuvatEquationElement(element, equation);
  }
}

function setPhaseIntervalNote(
  element: HTMLElement,
  note: PhaseIntervalNote | null,
): void {
  element.classList.toggle("is-hidden", note === null);
  if (!note) {
    element.replaceChildren();
    return;
  }

  const changedLine = document.createElement("span");
  changedLine.className = "phase-interval-note-line";
  changedLine.append(
    document.createTextNode("Acceleration changed at "),
    createExactPhaseTimeMath(note.startTime, (text) => `t = ${text} s`),
    document.createTextNode("."),
  );
  const intervalLine = document.createElement("span");
  intervalLine.className = "phase-interval-note-line";
  intervalLine.append(
    document.createTextNode("Analysis interval: "),
    createExactPhaseTimeMath(note.startTime, (text) => `${text} s`),
    document.createTextNode(" to "),
    createExactPhaseTimeMath(note.endTime, (text) => `${text} s`),
    document.createTextNode("."),
  );
  const calculationLine = document.createElement("span");
  calculationLine.className = "phase-interval-note-line";
  calculationLine.append(
    createExactPhaseTimeMath(note.endTime, (text) => `${text} s`),
    document.createTextNode(" − "),
    createExactPhaseTimeMath(note.startTime, (text) => `${text} s`),
    document.createTextNode(" = "),
    createExactPhaseTimeMath(note.phaseTime, (text) => `${text} s`),
    document.createTextNode("."),
  );
  element.replaceChildren(changedLine, intervalLine, calculationLine);
}

function createExactPhaseTimeMath(
  time: ExactPhaseTime,
  expression: (text: string) => string,
): HTMLElement {
  const wrapper = document.createElement("span");
  const tooltip = formatExactValueTooltip(time.value);
  wrapper.className = "phase-exact-time";
  wrapper.dataset.exactApproximation = tooltip;
  wrapper.setAttribute("aria-description", `Approximately ${tooltip}`);
  wrapper.append(createMathExpression(expression(time.text)));
  return wrapper;
}

function populateSuvatEquationElement(
  element: HTMLElement,
  equation: KinematicEquationResult,
  breakable = false,
): void {
  const formula = element.querySelector<HTMLElement>(".suvat-formula");
  const substitution = element.querySelector<HTMLElement>(".suvat-substitution");
  const result = element.querySelector<HTMLElement>(".suvat-result");
  const squareRoot = element.querySelector<HTMLElement>(".suvat-square-root");
  if (!formula || !substitution || !result || !squareRoot) return;

  element.classList.remove("force-modal-equation");
  formula.hidden = false;
  result.hidden = false;
  const createExpression = breakable
    ? createBreakableMathExpression
    : createMathExpression;
  formula.replaceChildren(createExpression(equation.formula));
  substitution.replaceChildren(createExpression(`= ${equation.substitution}`));
  result.replaceChildren(
    ...equation.finalValues.map((finalValue) => {
      const line = document.createElement("span");
      line.className = "suvat-math-line";
      line.append(
        createMathResult(finalValue.value, equation.unit, finalValue.rounded),
      );
      return line;
    }),
  );

  squareRoot.classList.toggle("is-hidden", !equation.squareRootWorking);
  const squareRootWorking = equation.squareRootWorking;
  if (squareRootWorking) {
    const expression = document.createElement("span");
    expression.className = "suvat-math-line";
    const sign = squareRootWorking.sign === "both"
      ? "±"
      : squareRootWorking.sign === "negative"
        ? "−"
        : "";
    const exactText = `v = ${sign}√(${squareRootWorking.radicand})`;
    expression.append(
      createCanvasMathValueElement(exactText, exactText),
    );
    const valueLines = squareRootWorking.finalValues.map((finalValue) => {
      const line = document.createElement("span");
      line.className = "suvat-math-line";
      line.append(
        createMathResult(finalValue.value, squareRootWorking.unit, finalValue.rounded),
      );
      return line;
    });
    squareRoot.replaceChildren(expression, ...valueLines);
  } else {
    squareRoot.replaceChildren();
  }
}

function ensureSuvatEquationElements(
  container: HTMLElement,
  equations: KinematicEquationResult[],
): void {
  const existingIds = Array.from(
    container.querySelectorAll<HTMLElement>("[data-suvat-equation]"),
  ).map((element) => element.dataset.suvatEquation);
  if (
    existingIds.length === equations.length &&
    existingIds.every((id, index) => id === equations[index]?.id)
  ) {
    return;
  }

  const elements = equations.map((equation) => {
    const element = document.createElement("article");
    element.className = "suvat-equation";
    element.dataset.suvatEquation = equation.id;
    element.setAttribute("role", "button");
    element.setAttribute("tabindex", "0");
    element.setAttribute("aria-label", `Open enlarged working for ${equation.formula}`);

    const formula = document.createElement("strong");
    formula.className = "suvat-formula";
    const substitution = document.createElement("span");
    substitution.className = "suvat-substitution";
    const result = document.createElement("span");
    result.className = "suvat-result";
    const squareRoot = document.createElement("span");
    squareRoot.className = "suvat-square-root is-hidden";
    element.append(formula, substitution, result, squareRoot);
    return element;
  });
  container.replaceChildren(...elements);
}
