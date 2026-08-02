import { PIXELS_PER_METRE } from "../config";
import type { Tool } from "../canvas/interaction";
import type { VerticalPositiveDirection } from "../kinematics/signConvention";
import {
  type ConstantAccelerationInterval,
  type KinematicDisplayValues,
  type SuvatEquationResult,
} from "../kinematics/suvat";
import type { Vec2 } from "../math/Vec2";
import {
  createMathExpression,
  createMathResult,
  createSquareRootExpression,
  createSquareRootValue,
} from "./mathMarkup";

export type PlaybackButtonState = "paused" | "playing" | "pause-pending";
export type SelectionProperties =
  | {
      type: "particle";
      position: Vec2;
      mass: number;
      initialVelocityText: string;
      pauseAtMaximumHeight: boolean;
      pauseAtGroundContact: boolean;
      groundEnabled: boolean;
      kinematics: KinematicDisplayValues;
      suvatInterval: ConstantAccelerationInterval;
      suvatEquations: SuvatEquationResult[];
    }
  | { type: "ground"; rough: boolean; friction: number }
  | null;

export interface ControlCallbacks {
  onToolChange: (tool: Tool) => void;
  onRemove: () => void;
  onGroundChange: (enabled: boolean) => void;
  onGravityChange: (gravity: number, enteredText: string) => void;
  onParticleMassChange: (mass: number) => void;
  onParticleInitialVelocityChange: (velocity: number, enteredText: string) => void;
  onParticlePauseAtMaximumHeightChange: (enabled: boolean) => void;
  onParticlePauseAtGroundContactChange: (enabled: boolean) => void;
  onPositiveDirectionChange: (direction: VerticalPositiveDirection) => void;
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
  setPositiveDirection: (direction: VerticalPositiveDirection) => void;
  setTime: (time: number, enteredText?: string) => void;
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
  const particleInitialVelocityInput = getElement<HTMLInputElement>(
    "particle-initial-velocity-input",
  );
  const particlePauseAtMaximumToggle = getElement<HTMLInputElement>(
    "particle-pause-at-maximum-toggle",
  );
  const particlePauseAtGroundToggle = getElement<HTMLInputElement>(
    "particle-pause-at-ground-toggle",
  );
  const particlePauseAtGroundRow = getElement<HTMLElement>(
    "particle-pause-at-ground-row",
  );
  const positiveUp = getElement<HTMLButtonElement>("positive-up");
  const positiveDown = getElement<HTMLButtonElement>("positive-down");
  const kinematicOutputs = {
    s: getElement<HTMLOutputElement>("kinematic-s"),
    u: getElement<HTMLOutputElement>("kinematic-u"),
    v: getElement<HTMLOutputElement>("kinematic-v"),
    a: getElement<HTMLOutputElement>("kinematic-a"),
    t: getElement<HTMLOutputElement>("kinematic-t"),
  };
  const suvatInvalidReason = getElement<HTMLElement>("suvat-invalid-reason");
  const suvatEquations = getElement<HTMLElement>("suvat-equations");
  const suvatCalculationDialog = getElement<HTMLDialogElement>(
    "suvat-calculation-dialog",
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
  let currentParticleMass = Number(particleMassInput.value);
  let currentParticleInitialVelocityText = particleInitialVelocityInput.value;
  let currentGroundFriction = Number(groundFrictionInput.value);
  let currentTool: Tool = "select";
  let particleAnalysisExpanded = false;
  let particlePropertiesScrollTop = 0;
  let currentSuvatEquations: SuvatEquationResult[] = [];
  let expandedSuvatEquationId: SuvatEquationResult["id"] | null = null;

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

  const closeExpandedSuvatEquation = (): void => {
    if (suvatCalculationDialog.open) suvatCalculationDialog.close();
    expandedSuvatEquationId = null;
  };

  const refreshExpandedSuvatEquation = (): void => {
    if (!expandedSuvatEquationId) return;
    const equation = currentSuvatEquations.find(
      (candidate) => candidate.id === expandedSuvatEquationId,
    );
    if (!equation) {
      closeExpandedSuvatEquation();
      return;
    }

    populateSuvatEquationElement(suvatCalculationDialogEquation, equation);
  };

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

  particleInitialVelocityInput.addEventListener("change", () => {
    const result = parseSignedValue(particleInitialVelocityInput.value);
    if (result === null) {
      particleInitialVelocityInput.value = currentParticleInitialVelocityText;
      particleInitialVelocityInput.setAttribute("aria-invalid", "true");
      return;
    }

    const enteredText = particleInitialVelocityInput.value.trim();
    currentParticleInitialVelocityText = enteredText;
    particleInitialVelocityInput.value = enteredText;
    particleInitialVelocityInput.removeAttribute("aria-invalid");
    callbacks.onParticleInitialVelocityChange(result, enteredText);
  });

  particlePauseAtMaximumToggle.addEventListener("change", () => {
    callbacks.onParticlePauseAtMaximumHeightChange(
      particlePauseAtMaximumToggle.checked,
    );
  });

  particlePauseAtGroundToggle.addEventListener("change", () => {
    callbacks.onParticlePauseAtGroundContactChange(
      particlePauseAtGroundToggle.checked,
    );
  });

  positiveUp.addEventListener("click", () => {
    callbacks.onPositiveDirectionChange("up");
  });
  positiveDown.addEventListener("click", () => {
    callbacks.onPositiveDirectionChange("down");
  });

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
      timeInput.value = currentTimeText;
      timeInput.setAttribute("aria-invalid", "true");
      return;
    }

    currentTimeText = enteredText;
    timeInput.value = enteredText;
    timeInput.removeAttribute("aria-invalid");
    callbacks.onTimeChange(result, enteredText);
  });

  timeInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") timeInput.blur();
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
        currentSuvatEquations = selection.suvatEquations;
        currentParticleMass = selection.mass;
        currentParticleInitialVelocityText = selection.initialVelocityText;
        particlePositionX.textContent = formatNumber(selection.position.x);
        particlePositionY.textContent = formatNumber(selection.position.y);
        if (document.activeElement !== particleMassInput) {
          particleMassInput.value = formatNumber(selection.mass);
        }
        particleMassInput.removeAttribute("aria-invalid");
        if (document.activeElement !== particleInitialVelocityInput) {
          particleInitialVelocityInput.value = selection.initialVelocityText;
        }
        particleInitialVelocityInput.removeAttribute("aria-invalid");
        particlePauseAtMaximumToggle.checked = selection.pauseAtMaximumHeight;
        particlePauseAtGroundToggle.checked = selection.pauseAtGroundContact;
        particlePauseAtGroundRow.hidden = !selection.groundEnabled;
        setKinematicOutputs(kinematicOutputs, selection.kinematics);
        setSuvatAnalysis(
          suvatInvalidReason,
          suvatEquations,
          selection.suvatInterval,
          selection.suvatEquations,
        );
        refreshExpandedSuvatEquation();
        particlePropertiesScroll.scrollTop = preservedScrollTop;
        if (particleAnalysisExpanded) {
          particlePropertiesScrollTop = particlePropertiesScroll.scrollTop;
        }
      } else if (selection?.type === "ground") {
        currentSuvatEquations = [];
        closeExpandedSuvatEquation();
        currentGroundFriction = selection.friction;
        groundRoughToggle.checked = selection.rough;
        groundFrictionControl.classList.toggle("is-hidden", !selection.rough);
        groundFrictionInput.disabled = !selection.rough;
        groundFrictionInput.value = formatNumber(selection.friction);
        groundFrictionInput.removeAttribute("aria-invalid");
      } else {
        currentSuvatEquations = [];
        closeExpandedSuvatEquation();
      }
    },
    setPositiveDirection: (direction) => {
      updatePositiveDirectionButtons(direction, positiveUp, positiveDown);
    },
    setTime: (time, enteredText) => {
      currentTimeText = enteredText ?? formatTime(time);
      if (document.activeElement !== timeInput) timeInput.value = currentTimeText;
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

function formatNumber(value: number): string {
  return String(Number(value.toFixed(3)));
}

export function formatTime(time: number): string {
  return String(Object.is(time, -0) ? 0 : time);
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element: #${id}`);
  return element as T;
}

function updatePositiveDirectionButtons(
  direction: VerticalPositiveDirection,
  upButton: HTMLButtonElement,
  downButton: HTMLButtonElement,
): void {
  const upIsPositive = direction === "up";
  upButton.classList.toggle("is-active", upIsPositive);
  downButton.classList.toggle("is-active", !upIsPositive);
  upButton.setAttribute("aria-pressed", String(upIsPositive));
  downButton.setAttribute("aria-pressed", String(!upIsPositive));
}

function setKinematicOutputs(
  outputs: Record<keyof KinematicDisplayValues, HTMLOutputElement>,
  state: KinematicDisplayValues,
): void {
  for (const quantity of ["s", "u", "v", "a", "t"] as const) {
    const output = outputs[quantity];
    const value = state[quantity];
    if (typeof value !== "string") {
      output.classList.remove("is-long-value");
      output.classList.add("has-square-root");
      output.replaceChildren(
        createSquareRootValue(value.radicand, value.negative),
      );
      continue;
    }

    output.classList.remove("has-square-root");
    output.classList.toggle(
      "is-long-value",
      !value.includes("/") && value.replace(/^[-−]/, "").length > 10,
    );
    output.replaceChildren(createMathExpression(value));
  }
}

function setSuvatAnalysis(
  invalidReason: HTMLElement,
  equationsContainer: HTMLElement,
  interval: ConstantAccelerationInterval,
  equations: SuvatEquationResult[],
): void {
  invalidReason.classList.toggle("is-hidden", interval.valid);
  equationsContainer.classList.toggle("is-hidden", !interval.valid);

  if (!interval.valid) {
    invalidReason.textContent = interval.reason ?? "SUVAT is not valid over this interval.";
    return;
  }

  invalidReason.textContent = "";
  ensureSuvatEquationElements(equationsContainer, equations);

  for (const equation of equations) {
    const element = equationsContainer.querySelector<HTMLElement>(
      `[data-suvat-equation="${equation.id}"]`,
    );
    if (!element) continue;

    populateSuvatEquationElement(element, equation);
  }
}

function populateSuvatEquationElement(
  element: HTMLElement,
  equation: SuvatEquationResult,
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
        squareRootWorking.negative,
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
  equations: SuvatEquationResult[],
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
