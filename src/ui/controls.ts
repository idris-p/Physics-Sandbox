import { PIXELS_PER_METRE } from "../config";
import type { Tool } from "../canvas/interaction";
import type { Vec2 } from "../math/Vec2";

export type PlaybackButtonState = "paused" | "playing" | "pause-pending";
export type SelectionProperties =
  | { type: "particle"; position: Vec2; mass: number }
  | { type: "ground"; rough: boolean; friction: number }
  | null;

export interface ControlCallbacks {
  onToolChange: (tool: Tool) => void;
  onRemove: () => void;
  onGroundChange: (enabled: boolean) => void;
  onGravityChange: (gravity: number) => void;
  onParticleMassChange: (mass: number) => void;
  onGroundFrictionChange: (coefficient: number) => void;
  onGroundRoughChange: (rough: boolean) => void;
  onClearScene: () => void;
  onTimeChange: (time: number) => void;
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
  setTime: (time: number) => void;
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
  const particlePositionX = getElement<HTMLOutputElement>("particle-position-x");
  const particlePositionY = getElement<HTMLOutputElement>("particle-position-y");
  const particleMassInput = getElement<HTMLInputElement>("particle-mass-input");
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

  let currentGravity = Number(gravityInput.value);
  let currentTime = Number(timeInput.value);
  let currentParticleMass = Number(particleMassInput.value);
  let currentGroundFriction = Number(groundFrictionInput.value);
  let currentTool: Tool = "select";

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
      gravityInput.value = formatNumber(currentGravity);
      gravityInput.setAttribute("aria-invalid", "true");
      gravityError.textContent = "Enter a non-negative value with up to 3 decimal places.";
      return;
    }

    currentGravity = result;
    gravityInput.value = formatNumber(result);
    gravityInput.removeAttribute("aria-invalid");
    gravityError.textContent = "";
    callbacks.onGravityChange(result);
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
    const result = parseTime(timeInput.value);
    if (result === null) {
      timeInput.value = formatTime(currentTime);
      timeInput.setAttribute("aria-invalid", "true");
      return;
    }

    currentTime = result;
    timeInput.value = formatTime(result);
    timeInput.removeAttribute("aria-invalid");
    callbacks.onTimeChange(result);
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
      particleProperties.classList.toggle(
        "is-hidden",
        selection?.type !== "particle",
      );
      groundProperties.classList.toggle(
        "is-hidden",
        selection?.type !== "ground",
      );

      if (selection?.type === "particle") {
        currentParticleMass = selection.mass;
        particlePositionX.textContent = formatNumber(selection.position.x);
        particlePositionY.textContent = formatNumber(selection.position.y);
        particleMassInput.value = formatNumber(selection.mass);
        particleMassInput.removeAttribute("aria-invalid");
      } else if (selection?.type === "ground") {
        currentGroundFriction = selection.friction;
        groundRoughToggle.checked = selection.rough;
        groundFrictionControl.classList.toggle("is-hidden", !selection.rough);
        groundFrictionInput.disabled = !selection.rough;
        groundFrictionInput.value = formatNumber(selection.friction);
        groundFrictionInput.removeAttribute("aria-invalid");
      }
    },
    setTime: (time) => {
      currentTime = time;
      if (document.activeElement !== timeInput) timeInput.value = formatTime(time);
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
  if (!/^(?:\d+|\d*\.\d{1,2})$/.test(trimmedValue)) return null;

  const parsedValue = Number(trimmedValue);
  return Number.isFinite(parsedValue) && parsedValue >= 0 ? parsedValue : null;
}

export function parseWorldCoordinate(value: string): number | null {
  const trimmedValue = value.trim();
  if (!/^-?(?:\d+|\d*\.\d{1,3})$/.test(trimmedValue)) return null;

  const parsedValue = Number(trimmedValue);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function formatNumber(value: number): string {
  return String(Number(value.toFixed(3)));
}

export function formatTime(time: number): string {
  return time.toFixed(2);
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing required element: #${id}`);
  return element as T;
}
