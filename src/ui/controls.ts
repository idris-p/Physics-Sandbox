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
import type { InitialVelocityInputMode } from "../model/Particle";
import {
  formatAutoPauseTimeExactText,
  type AutoPauseTimeDisplay,
} from "../simulation/autoPauseTimeDisplay";
import {
  createMathExpression,
  createMathResult,
  createQuadraticSurdValue,
  createRationalSurdValue,
  createSquareRootExpression,
  createSquareRootValue,
} from "./mathMarkup";
import {
  formatExactValueTooltip,
  getExactValueTooltip,
  isSymbolicExactDisplay,
} from "./exactValueTooltip";
import type {
  MotionGraphAnnotation,
  MotionGraphData,
} from "../kinematics/motionGraphs";
import { formatWorkingValue } from "../kinematics/exactDisplay";
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

export type PlaybackButtonState = "paused" | "playing" | "pause-pending";
export type InitialVelocityField = "x" | "y" | "speed" | "angle";
export type SelectionProperties =
  | {
      type: "particle";
      position: Vec2;
      mass: number;
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
    }
  | { type: "ground"; rough: boolean; friction: number }
  | null;

export interface ControlCallbacks {
  onToolChange: (tool: Tool) => void;
  onRemove: () => void;
  onGroundChange: (enabled: boolean) => void;
  onGravityChange: (gravity: number, enteredText: string) => void;
  onParticleMassChange: (mass: number) => void;
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
  onPositiveXChange: (direction: HorizontalPositiveDirection) => void;
  onPositiveYChange: (direction: VerticalPositiveDirection) => void;
  onAngleConventionChange: (
    referenceAxis: AngleReferenceAxis,
    direction: AngleDirection,
  ) => void;
  onGroundFrictionChange: (coefficient: number) => void;
  onGroundRoughChange: (rough: boolean) => void;
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
  deleteTarget: HTMLButtonElement;
  particleSource: HTMLButtonElement;
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
  setPlaybackState: (state: PlaybackButtonState) => void;
  setZoom: (pixelsPerMetre: number) => void;
}

export function createControls(callbacks: ControlCallbacks): Controls {
  const canvas = getElement<HTMLCanvasElement>("scene-canvas");
  const particleTool = getElement<HTMLButtonElement>("particle-tool");
  const removeParticle = getElement<HTMLButtonElement>("remove-particle");
  const groundToggle = getElement<HTMLInputElement>("ground-toggle");
  const gravityInput = getElement<HTMLInputElement>("gravity-input");
  const gravityError = getElement<HTMLElement>("gravity-error");
  const angleReferenceAxis = getElement<HTMLSelectElement>("angle-reference-axis");
  const angleDirection = getElement<HTMLSelectElement>("angle-direction");
  const clearScene = getElement<HTMLButtonElement>("clear-scene");
  const particleProperties = getElement<HTMLElement>("particle-properties");
  const particlePropertiesScroll = particleProperties.querySelector<HTMLElement>(
    ".particle-properties-scroll",
  );
  const toggleParticleAnalysis = getElement<HTMLButtonElement>(
    "toggle-particle-analysis",
  );
  const particleAnalysisContent = getElement<HTMLElement>(
    "particle-analysis-content",
  );
  const particlePositionX = getElement<HTMLOutputElement>("particle-position-x");
  const particlePositionY = getElement<HTMLOutputElement>("particle-position-y");
  const particleMassInput = getElement<HTMLInputElement>("particle-mass-input");
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
  const groundProperties = getElement<HTMLElement>("ground-properties");
  const groundRoughToggle = getElement<HTMLInputElement>("ground-rough-toggle");
  const groundFrictionInput = getElement<HTMLInputElement>("ground-friction-input");
  const groundFrictionControl = groundFrictionInput.closest<HTMLElement>(
    ".ground-friction-control",
  );
  const previousTime = getElement<HTMLButtonElement>("previous-time");
  const nextTime = getElement<HTMLButtonElement>("next-time");
  const playTime = getElement<HTMLButtonElement>("play-time");
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

  let currentGravityText = gravityInput.value;
  let currentTimeText = timeInput.value;
  let currentDisplayedTime = 0;
  let lastExactTimeDisplay: AutoPauseTimeDisplay | null = null;
  let exactTimeDisplaySuppressed = false;
  let isEditingExactTime = false;
  let currentParticleMass = Number(particleMassInput.value);
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
  let currentTool: Tool = "select";
  let particleAnalysisExpanded = false;
  let particlePropertiesScrollTop = 0;
  let selectedKinematicAxis: "x" | "y" = "y";
  let currentParticleSelection: Extract<SelectionProperties, { type: "particle" }> | null = null;
  let currentSuvatEquations: KinematicEquationResult[] = [];
  let expandedSuvatEquationId: string | null = null;
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

  const setParticleAnalysisExpanded = (expanded: boolean): void => {
    if (!expanded) particlePropertiesScrollTop = particlePropertiesScroll.scrollTop;

    particleAnalysisExpanded = expanded;
    particleAnalysisContent.hidden = !expanded;
    toggleParticleAnalysis.setAttribute("aria-expanded", String(expanded));
    toggleParticleAnalysis.setAttribute(
      "aria-label",
      expanded
        ? "Collapse kinematics and SUVAT"
        : "Expand kinematics and SUVAT",
    );

    if (expanded) particlePropertiesScroll.scrollTop = particlePropertiesScrollTop;
  };

  toggleParticleAnalysis.addEventListener("click", () => {
    setParticleAnalysisExpanded(!particleAnalysisExpanded);
  });

  particlePropertiesScroll.addEventListener("scroll", () => {
    if (particleAnalysisExpanded) {
      particlePropertiesScrollTop = particlePropertiesScroll.scrollTop;
    }
  });

  const renderSelectedKinematicComponent = (): void => {
    const selection = currentParticleSelection;
    if (!selection) return;

    const isVertical = selectedKinematicAxis === "y";
    kinematicVertical.classList.toggle("is-active", isVertical);
    kinematicHorizontal.classList.toggle("is-active", !isVertical);
    kinematicVertical.setAttribute("aria-pressed", String(isVertical));
    kinematicHorizontal.setAttribute("aria-pressed", String(!isVertical));
    kinematicQuantityRows.get("u")?.toggleAttribute("hidden", !isVertical);
    kinematicQuantityRows.get("a")?.toggleAttribute("hidden", !isVertical);
    suvatTitle.textContent = isVertical ? "SUVAT" : "Horizontal motion";
    suvatCalculationDialogTitle.textContent = isVertical
      ? "SUVAT Calculation"
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
    refreshExpandedSuvatEquation();
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
    expandedSuvatEquationId = null;
  };

  function refreshExpandedSuvatEquation(): void {
    if (!expandedSuvatEquationId) return;
    const equation = currentSuvatEquations.find(
      (candidate) => candidate.id === expandedSuvatEquationId,
    );
    if (!equation) {
      closeExpandedSuvatEquation();
      return;
    }

    populateSuvatEquationElement(suvatCalculationDialogEquation, equation);
  }

  const openExpandedSuvatEquation = (equationId: string): void => {
    const equation = currentSuvatEquations.find(
      (candidate) => candidate.id === equationId,
    );
    if (!equation) return;

    expandedSuvatEquationId = equation.id;
    populateSuvatEquationElement(suvatCalculationDialogEquation, equation);
    if (!suvatCalculationDialog.open) suvatCalculationDialog.showModal();
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
  });

  const setTool = (tool: Tool): void => {
    currentTool = tool;
    const isPlacing = tool === "particle";
    particleTool.classList.toggle("is-active", isPlacing);
    particleTool.setAttribute("aria-pressed", String(isPlacing));
    canvas.classList.toggle("is-placing", isPlacing);
  };

  particleTool.addEventListener("click", () => {
    const nextTool = currentTool === "particle" ? "select" : "particle";
    setTool(nextTool);
    callbacks.onToolChange(nextTool);
  });

  removeParticle.addEventListener("click", callbacks.onRemove);
  groundToggle.addEventListener("change", () => {
    callbacks.onGroundChange(groundToggle.checked);
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
      particleMassInput.value = formatNumber(currentParticleMass);
      particleMassInput.setAttribute("aria-invalid", "true");
      return;
    }

    currentParticleMass = result;
    particleMassInput.value = formatNumber(result);
    particleMassInput.removeAttribute("aria-invalid");
    callbacks.onParticleMassChange(result);
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
      ? parsePositiveProperty(changedInput.value)
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
    deleteTarget: removeParticle,
    particleSource: particleTool,
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

      if (selection?.type === "particle") {
        currentParticleSelection = selection;
        currentParticleMass = selection.mass;
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
        if (document.activeElement !== particleMassInput) {
          particleMassInput.value = formatNumber(selection.mass);
        }
        particleMassInput.removeAttribute("aria-invalid");
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
        renderSelectedKinematicComponent();
        particlePropertiesScroll.scrollTop = preservedScrollTop;
        if (particleAnalysisExpanded) {
          particlePropertiesScrollTop = particlePropertiesScroll.scrollTop;
        }
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
    setPlaybackState: (state) => {
      playTime.classList.toggle("is-playing", state === "playing");
      playTime.classList.toggle("is-pause-pending", state === "pause-pending");
      playTime.setAttribute("aria-label", state === "paused" ? "Play" : "Pause");
    },
    setZoom: (pixelsPerMetre) => {
      resetView.textContent = `${Math.round((pixelsPerMetre / PIXELS_PER_METRE) * 100)}%`;
      scaleLine.style.width = `${pixelsPerMetre}px`;
    },
  };
}

function createAutoPauseTimeValue(value: AutoPauseTimeDisplay): Element {
  if (typeof value === "string") return createMathExpression(value);
  if (value.kind === "square-root") {
    return createSquareRootValue(value.radicand, value.negative);
  }
  if (value.kind === "rational-surd") {
    return createRationalSurdValue(
      value.numeratorCoefficient,
      value.radicand,
      value.denominator,
    );
  }
  if (value.kind === "rational-trig") {
    return createMathExpression(
      formatAutoPauseTimeExactText(value),
    );
  }
  return createQuadraticSurdValue(
    value.linearTerm,
    value.radicand,
    value.denominator,
    value.radicalSign,
  );
}

export function parseGravity(value: string): number | null {
  const trimmedValue = value.trim();
  if (!/^(?:\d+|\d*\.\d{1,3})$/.test(trimmedValue)) return null;

  const parsedValue = Number(trimmedValue);
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : null;
}

export function parsePositiveProperty(value: string): number | null {
  const parsedValue = parseGravity(value);
  return parsedValue !== null && parsedValue > 0 ? parsedValue : null;
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
        createSquareRootValue(value.radicand, value.negative),
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
): void {
  const formula = element.querySelector<HTMLElement>(".suvat-formula");
  const substitution = element.querySelector<HTMLElement>(".suvat-substitution");
  const result = element.querySelector<HTMLElement>(".suvat-result");
  const squareRoot = element.querySelector<HTMLElement>(".suvat-square-root");
  if (!formula || !substitution || !result || !squareRoot) return;

  formula.replaceChildren(createMathExpression(equation.formula));
  substitution.replaceChildren(createMathExpression(`= ${equation.substitution}`));
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
    expression.append(
      createSquareRootExpression(
        squareRootWorking.radicand,
        squareRootWorking.sign,
      ),
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
