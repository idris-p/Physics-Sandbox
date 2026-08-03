import "./styles/main.css";

import {
  createCamera,
  panCamera,
  resetCamera,
  resizeCamera,
  zoomCameraAt,
} from "./canvas/camera";
import { attachCanvasInteraction, type Tool } from "./canvas/interaction";
import { getGreatestHeightMeasurements } from "./canvas/greatestHeightAnnotation";
import { render } from "./canvas/renderer";
import {
  calculateKinematicDisplayValues,
  calculateSuvatEquationResults,
} from "./kinematics/suvat";
import {
  derivedValue,
  enteredDecimal,
  formatWorkingValue,
  negateEnteredDecimal,
} from "./kinematics/exactDisplay";
import {
  determineActiveKinematicPhase,
  type KinematicPhase,
} from "./kinematics/kinematicPhase";
import { calculateVerticalKinematicState } from "./kinematics/verticalKinematics";
import { createParticle } from "./model/Particle";
import type { ParticleState } from "./model/Particle";
import { createScene } from "./model/Scene";
import { calculateSceneState } from "./physics/calculateSceneState";
import { editParticleInitialVerticalVelocity } from "./simulation/editInitialConditions";
import {
  getGreatestHeightPauseTimeDisplay,
  getGroundContactPauseTimeDisplay,
  type AutoPauseTimeDisplay,
} from "./simulation/autoPauseTimeDisplay";
import {
  advancePlayback,
  earliestPauseTime,
  getNextGroundContactPauseEvent,
  getNextGreatestHeightPauseEvent,
  getNextIntegerSecond,
  sameTime,
  type GreatestHeightPauseEvent,
  type GroundContactPauseEvent,
} from "./simulation/playback";
import {
  createControls,
  formatPlaybackTime,
  type PlaybackButtonState,
} from "./ui/controls";

const scene = createScene();
const camera = createCamera(1, 1);
let activeTool: Tool = "select";
let selectedParticleId: string | null = null;
let groundSelected = false;
let draggedParticleId: string | null = null;
let currentTime = 0;
let currentTimeEnteredText: string | undefined = "0";
let isPlaying = false;
let pendingPauseTime: number | null = null;
let previousFrameTimestamp: number | null = null;
let greatestHeightPauseEvent: GreatestHeightPauseEvent | null = null;
let autoPauseTimeDisplay: AutoPauseTimeDisplay | null = null;
let nextParticleId = 1;

const controls = createControls({
  onToolChange: (tool) => {
    activeTool = tool;
  },
  onRemove: removeSelectedParticle,
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
  onGravityChange: (gravity, enteredText) => {
    scene.settings.gravity = gravity;
    scene.settings.gravityInput = enteredText;
    resetTime();
  },
  onParticleMassChange: (mass) => {
    const particle = scene.particles.find(
      (candidate) => candidate.id === selectedParticleId,
    );
    if (particle) particle.mass = mass;
    updateUi();
  },
  onParticleInitialVelocityChange: (velocity, enteredText) => {
    const particleIndex = scene.particles.findIndex(
      (particle) => particle.id === selectedParticleId,
    );
    if (particleIndex < 0) return;

    scene.particles[particleIndex] = editParticleInitialVerticalVelocity(
      scene.particles[particleIndex],
      velocity,
      scene.settings.positiveDirection,
      enteredText,
    );
    greatestHeightPauseEvent = null;
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
  onPositiveDirectionChange: (direction) => {
    scene.settings.positiveDirection = direction;
    updateUi();
  },
  onGroundFrictionChange: (coefficient) => {
    scene.groundFriction = coefficient;
    updateUi();
  },
  onGroundRoughChange: (rough) => {
    scene.groundRough = rough;
    updateUi();
  },
  onClearScene: clearScene,
  onTimeChange: (time, enteredText) => {
    setPlaying(false);
    greatestHeightPauseEvent = null;
    autoPauseTimeDisplay = null;
    currentTime = time;
    currentTimeEnteredText = enteredText;
    updateUi();
  },
  onPrevious: (interval) => stepTime(-interval),
  onNext: (interval) => stepTime(interval),
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

const context = getCanvasContext(controls.canvas);

attachCanvasInteraction({
  canvas: controls.canvas,
  deleteTarget: controls.deleteTarget,
  particleSource: controls.particleSource,
  getCamera: () => camera,
  getTool: () => activeTool,
  getParticleStates: calculateActiveParticleStates,
  isGroundEnabled: () => scene.groundEnabled,
  getGroundHeight: () => scene.groundHeight,
  onSelect: (particleId) => {
    selectedParticleId = particleId;
    groundSelected = false;
    updateUi();
  },
  onSelectGround: () => {
    selectedParticleId = null;
    groundSelected = true;
    updateUi();
  },
  onPlace: (position) => {
    const particle = createParticle(`particle-${nextParticleId}`, position);
    nextParticleId += 1;
    scene.particles.push(particle);
    selectedParticleId = particle.id;
    groundSelected = false;
    resetTime();
    updateUi();
  },
  onMoveParticle: (particleId, position) => {
    const particle = scene.particles.find((candidate) => candidate.id === particleId);
    if (!particle) return;
    if (
      particle.initialPosition.x === position.x &&
      particle.initialPosition.y === position.y
    ) {
      return;
    }

    particle.initialPosition = { ...position };
    selectedParticleId = particleId;
    groundSelected = false;
    resetTime();
    updateUi();
  },
  onParticleDragChange: (particleId) => {
    draggedParticleId = particleId;
    if (particleId) greatestHeightPauseEvent = null;
  },
  onDeleteParticle: removeParticle,
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

  if (selectedParticleId && (event.key === "Delete" || event.key === "Backspace")) {
    event.preventDefault();
    removeSelectedParticle();
  } else if (event.key === "Escape") {
    activeTool = "select";
    controls.setTool("select");
  } else if (event.key === "1") {
    activeTool = "particle";
    controls.setTool("particle");
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
      const nextGreatestHeightEvent = getNextGreatestHeightPauseEvent(
        scene.particles,
        currentTime,
        scene.settings.gravity,
      );
      const nextGroundContactEvent = getNextGroundContactPauseEvent(
        scene.particles,
        currentTime,
        scene.settings.gravity,
        scene.groundEnabled,
        scene.groundHeight,
      );
      const advance = advancePlayback(
        currentTime,
        (timestamp - previousFrameTimestamp) / 1000,
        earliestPauseTime(
          earliestPauseTime(pendingPauseTime, nextGreatestHeightEvent?.time ?? null),
          nextGroundContactEvent?.time ?? null,
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
        autoPauseTimeDisplay = getTriggeredAutoPauseTimeDisplay(
          advance.time,
          nextGreatestHeightEvent,
          nextGroundContactEvent,
        );
      }
      controls.setTime(
        currentTime,
        isPlaying ? formatPlaybackTime(currentTime) : undefined,
        isPlaying ? null : autoPauseTimeDisplay,
      );
    }

    if (isPlaying) previousFrameTimestamp = timestamp;
  } else {
    previousFrameTimestamp = null;
  }

  const activeParticleStates = calculateActiveParticleStates();
  if ((isPlaying || playbackAdvanced) && selectedParticleId) {
    updateSelectionUi(activeParticleStates);
  }
  render(
    context,
    scene,
    activeParticleStates.filter(
      (particle) => particle.id !== draggedParticleId,
    ),
    selectedParticleId,
    groundSelected,
    camera,
    currentTime,
    timestamp,
    getGreatestHeightMeasurements(
      greatestHeightPauseEvent,
      currentTime,
      scene.groundEnabled,
      scene.groundHeight,
      activeParticleStates,
    ),
  );
  requestAnimationFrame(renderFrame);
}

function stepTime(interval: number): void {
  setPlaying(false);
  greatestHeightPauseEvent = null;
  autoPauseTimeDisplay = null;
  currentTime = Math.max(0, roundTime(currentTime + interval));
  currentTimeEnteredText = undefined;
  updateUi();
}

function resetTime(): void {
  setPlaying(false);
  greatestHeightPauseEvent = null;
  autoPauseTimeDisplay = null;
  currentTime = 0;
  currentTimeEnteredText = "0";
  updateUi();
}

function setPlaying(playing: boolean): void {
  if (playing) {
    greatestHeightPauseEvent = null;
    autoPauseTimeDisplay = null;
  }
  isPlaying = playing;
  pendingPauseTime = null;
  previousFrameTimestamp = null;
  controls.setPlaybackState(playing ? "playing" : "paused");
}

function togglePlayback(): void {
  if (!isPlaying) {
    activeTool = "select";
    controls.setTool("select");
    setPlaying(true);
    currentTimeEnteredText = undefined;
    updateUi();
    return;
  }

  if (pendingPauseTime === null) {
    pendingPauseTime = getNextIntegerSecond(currentTime);
    controls.setPlaybackState("pause-pending");
  }
}

function removeSelectedParticle(): void {
  if (!selectedParticleId) return;

  removeParticle(selectedParticleId);
}

function removeParticle(particleId: string): void {
  const index = scene.particles.findIndex((particle) => particle.id === particleId);
  if (index < 0) return;

  scene.particles.splice(index, 1);
  selectedParticleId = null;
  groundSelected = false;
  resetTime();
  updateUi();
}

function clearScene(): void {
  scene.particles.length = 0;
  selectedParticleId = null;
  groundSelected = false;
  draggedParticleId = null;
  resetTime();
}

function updateUi(): void {
  const activeParticleStates = calculateActiveParticleStates();
  updateSelectionUi(activeParticleStates);
  controls.setPositiveDirection(scene.settings.positiveDirection);
  controls.setTime(
    currentTime,
    isPlaying ? formatPlaybackTime(currentTime) : currentTimeEnteredText,
    isPlaying ? null : autoPauseTimeDisplay,
  );
  controls.setPlaybackState(getPlaybackButtonState());
  controls.setZoom(camera.pixelsPerMetre);
}

function getTriggeredAutoPauseTimeDisplay(
  pauseTime: number,
  greatestHeightEvent: GreatestHeightPauseEvent | null,
  groundContactEvent: GroundContactPauseEvent | null,
): AutoPauseTimeDisplay | null {
  if (greatestHeightEvent && sameTime(pauseTime, greatestHeightEvent.time)) {
    const particle = scene.particles.find(
      (candidate) => candidate.id === greatestHeightEvent.particleIds[0],
    );
    return particle
      ? getGreatestHeightPauseTimeDisplay(
          particle,
          scene.settings.gravityInput,
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
          scene.settings.gravityInput,
          scene.groundHeight,
        )
      : null;
  }

  return null;
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
  controls.setSelected(selectedParticleState !== null);
  controls.setSelectionProperties(
    selectedParticleState && selectedParticle
      ? createParticleSelectionProperties(selectedParticle, selectedParticleState)
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
  const phase = determineActiveKinematicPhase(particle, currentTime, {
    gravity: scene.settings.gravity,
    groundEnabled: scene.groundEnabled,
    groundHeight: scene.groundHeight,
  });
  const kinematics = calculateVerticalKinematicState(
    phase,
    particleState,
    currentTime,
    scene.settings.positiveDirection,
  );
  const enteredValues = {
    u:
      phase.kind === "free-flight"
        ? getInitialVelocityEnteredText(particle)
        : undefined,
    a:
      phase.kind === "free-flight"
        ? getGravityEnteredText(kinematics.a)
        : undefined,
    t: phase.startTime === 0 ? currentTimeEnteredText : undefined,
  };

  return {
    type: "particle" as const,
    position: particleState.position,
    mass: particle.mass,
    initialVelocityText: getInitialVelocityEnteredText(particle),
    pauseAtGreatestHeight: particle.pauseAtGreatestHeight,
    pauseAtGroundContact: particle.pauseAtGroundContact,
    groundEnabled: scene.groundEnabled,
    phaseNote: createPhaseIntervalNote(phase),
    kinematics: calculateKinematicDisplayValues(kinematics, enteredValues),
    suvatEquations: calculateSuvatEquationResults(kinematics, enteredValues),
  };
}

function createPhaseIntervalNote(phase: KinematicPhase) {
  if (phase.startTime === 0) return null;

  const phaseTime = Math.max(0, currentTime - phase.startTime);
  const startText = formatWorkingValue(derivedValue(phase.startTime));
  const endText = formatWorkingValue(
    currentTimeEnteredText === undefined
      ? derivedValue(currentTime)
      : enteredDecimal(currentTimeEnteredText, currentTime),
  );
  const phaseTimeText = formatWorkingValue(derivedValue(phaseTime));
  return { startTime: startText, endTime: endText, phaseTime: phaseTimeText };
}

function getInitialVelocityEnteredText(
  particle: (typeof scene.particles)[number],
): string {
  const input = particle.initialVelocityInput;
  return input.positiveDirection === scene.settings.positiveDirection
    ? input.text
    : negateEnteredDecimal(input.text);
}

function getGravityEnteredText(acceleration: number): string | undefined {
  const gravityAcceleration =
    scene.settings.positiveDirection === "up"
      ? -scene.settings.gravity
      : scene.settings.gravity;
  if (Math.abs(acceleration - gravityAcceleration) > 1e-12) return undefined;

  return gravityAcceleration < 0
    ? negateEnteredDecimal(scene.settings.gravityInput)
    : scene.settings.gravityInput;
}

function calculateActiveParticleStates(): ParticleState[] {
  return calculateSceneState(scene, currentTime);
}

function getPlaybackButtonState(): PlaybackButtonState {
  if (!isPlaying) return "paused";
  return pendingPauseTime === null ? "playing" : "pause-pending";
}

function roundTime(time: number): number {
  return Math.round(time * 1_000_000_000) / 1_000_000_000;
}

function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const canvasContext = canvas.getContext("2d");
  if (!canvasContext) throw new Error("This browser does not support the Canvas 2D API.");
  return canvasContext;
}
