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
import { getVerticalTargetMeasurements } from "./canvas/verticalTargetAnnotation";
import {
  findCanvasExactValueHoverTarget,
  render,
  type CanvasExactValueHoverTarget,
} from "./canvas/renderer";
import {
  calculateKinematicDisplayValues,
  calculateSuvatEquationResults,
} from "./kinematics/suvat";
import {
  addRationals,
  convertEnteredScalarText,
  derivedValue,
  enteredDecimal,
  formatWorkingValue,
  negateEnteredDecimal,
  rationalFromDecimal,
  subtractRationals,
  type DisplayValue,
  type Rational,
} from "./kinematics/exactDisplay";
import {
  determineActiveKinematicPhase,
  type KinematicPhase,
} from "./kinematics/kinematicPhase";
import { calculateHorizontalEquationResults } from "./kinematics/horizontalKinematics";
import { calculateParticleKinematicState2D } from "./kinematics/particleKinematics2D";
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
import { createParticle } from "./model/Particle";
import type { ParticleState } from "./model/Particle";
import { createScene } from "./model/Scene";
import { calculateSceneState } from "./physics/calculateSceneState";
import {
  calculateGroundImpactTime,
  isAtPositiveGroundImpact,
} from "./physics/calculateParticleState";
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
let verticalTargetPauseEvent: VerticalTargetPauseEvent | null = null;
let autoPauseTimeDisplay: AutoPauseTimeDisplay | null = null;
let nextParticleId = 1;
let canvasExactValueHoverTargets: CanvasExactValueHoverTarget[] = [];
let motionGraphPlanLock: { particleId: string; plan: MotionGraphPlan } | null = null;

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
  onParticleInitialVelocityComponentsChange: (velocity, enteredText) => {
    const particleIndex = scene.particles.findIndex(
      (particle) => particle.id === selectedParticleId,
    );
    if (particleIndex < 0) return;

    scene.particles[particleIndex] = editParticleInitialVelocityComponents(
      scene.particles[particleIndex],
      velocity,
      scene.settings,
      enteredText,
    );
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

    scene.particles[particleIndex] = editParticleInitialVelocityAngle(
      scene.particles[particleIndex],
      speed,
      angle,
      scene.settings,
      enteredText,
    );
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
    scene.particles = scene.particles.map((particle) =>
      reexpressParticleInitialVelocityAngle(particle, convention)
    );
    scene.settings.angleReferenceAxis = referenceAxis;
    scene.settings.angleDirection = direction;
    motionGraphPlanLock = null;
    refreshCurrentAutoPauseTimeDisplay();
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
    verticalTargetPauseEvent = null;
    autoPauseTimeDisplay = null;
    currentTime = time;
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
    if (particleId) {
      greatestHeightPauseEvent = null;
      verticalTargetPauseEvent = null;
    }
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
      const nextVerticalTargetEvent = getNextVerticalTargetPauseEvent(
        scene.particles,
        currentTime,
        scene.settings.gravity,
        scene.groundEnabled,
        scene.groundHeight,
      );
      const nextParticleCoincidenceEvent =
        getNextParticleCoincidencePauseEvent(
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
          earliestPauseTime(
            earliestPauseTime(
              pendingPauseTime,
              nextGreatestHeightEvent?.time ?? null,
            ),
            nextGroundContactEvent?.time ?? null,
          ),
          earliestPauseTime(
            nextVerticalTargetEvent?.time ?? null,
            nextParticleCoincidenceEvent?.time ?? null,
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
  canvasExactValueHoverTargets = render(
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
    [
      ...getGreatestHeightMeasurements(
        greatestHeightPauseEvent,
        currentTime,
        scene.groundEnabled,
        scene.groundHeight,
        scene.particles,
        activeParticleStates,
        scene.settings.gravityInput,
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
  );
  requestAnimationFrame(renderFrame);
}

function stepTime(interval: number, direction: "previous" | "next"): void {
  setPlaying(false);
  greatestHeightPauseEvent = null;
  verticalTargetPauseEvent = null;
  autoPauseTimeDisplay = null;
  currentTime = getAdjacentStepTime(currentTime, interval, direction);
  currentTimeEnteredText = undefined;
  updateUi();
}

function resetTime(): void {
  setPlaying(false);
  greatestHeightPauseEvent = null;
  verticalTargetPauseEvent = null;
  autoPauseTimeDisplay = null;
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
  controls.setCoordinateConvention(scene.settings);
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
  verticalTargetEvent: VerticalTargetPauseEvent | null,
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

  if (verticalTargetEvent && sameTime(pauseTime, verticalTargetEvent.time)) {
    const particle = scene.particles.find(
      (candidate) => candidate.id === verticalTargetEvent.particleIds[0],
    );
    return particle
      ? getVerticalTargetPauseTimeDisplay(
          particle,
          scene.settings.gravityInput,
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
        if (!particle.pauseAtGroundContact) return [];
        const impactTime = calculateGroundImpactTime(
          particle.initialPosition.y,
          particle.initialVelocity.y,
          scene.settings.gravity,
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
  const velocityEditor = createVelocityEditorConversion(
    particle,
    scene.settings,
  );
  const phase = determineActiveKinematicPhase(particle, currentTime, {
    gravity: scene.settings.gravity,
    groundEnabled: scene.groundEnabled,
    groundHeight: scene.groundHeight,
  });
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
  const horizontalPolarVelocity = phase.kind === "free-flight"
    ? createPolarVelocityComponentDisplay(particle, "x", scene.settings)
    : undefined;
  const verticalPolarVelocity = phase.kind === "free-flight"
    ? createPolarVelocityComponentDisplay(particle, "y", scene.settings)
    : undefined;
  const verticalEnteredValues = {
    sDisplay: getKnownVerticalDisplacementDisplay(
      particle,
      kinematics.y.s,
    ),
    u:
      phase.kind === "free-flight" && particle.initialVelocitySource === "components"
        ? getInitialVelocityEnteredText(particle, "y")
        : undefined,
    uDisplay: verticalPolarVelocity,
    a:
      phase.kind === "free-flight"
        ? getGravityEnteredText(kinematics.y.a)
        : undefined,
    t: sharedEnteredTime,
    tDisplay: sharedExactTime,
  };
  const horizontalEnteredValues = {
    u:
      phase.kind === "free-flight" && particle.initialVelocitySource === "components"
        ? getInitialVelocityEnteredText(particle, "x")
        : undefined,
    uDisplay: horizontalPolarVelocity,
    a: phase.kind === "free-flight" ? "0" : undefined,
    t: sharedEnteredTime,
    tDisplay: sharedExactTime,
  };
  const horizontalDisplayValues = calculateKinematicDisplayValues(
    kinematics.x,
    horizontalEnteredValues,
  );
  if (phase.kind === "free-flight") {
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
      acceleration: createGraphInputDisplay(
        kinematics.x.a,
        horizontalEnteredValues.a,
      ),
    },
    y: {
      initialVelocity: verticalEnteredValues.uDisplay ??
        createGraphInputDisplay(kinematics.y.u, verticalEnteredValues.u),
      acceleration: createGraphInputDisplay(
        kinematics.y.a,
        verticalEnteredValues.a,
      ),
    },
  };
  const motionGraphPlan = getMotionGraphPlan(
    particle,
    phase,
    motionGraphExactComponents,
  );

  return {
    type: "particle" as const,
    position: particleState.position,
    mass: particle.mass,
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
    phaseNote: createPhaseIntervalNote({
      particle,
      phase,
      currentTime,
      currentTimeEnteredText,
      gravityText: scene.settings.gravityInput,
      groundHeight: scene.groundHeight,
    }),
    kinematics: {
      x: horizontalDisplayValues,
      y: calculateKinematicDisplayValues(kinematics.y, verticalEnteredValues),
    },
    kinematicValues: kinematics,
    motionGraphs: {
      x: createMotionGraphData(motionGraphPlan, "x", currentTime),
      y: createMotionGraphData(motionGraphPlan, "y", currentTime),
    },
    equations: {
      x: calculateHorizontalEquationResults(kinematics.x, horizontalEnteredValues),
      y: calculateSuvatEquationResults(kinematics.y, verticalEnteredValues),
    },
  };
}

function getKnownVerticalDisplacementDisplay(
  particle: (typeof scene.particles)[number],
  displacement: number,
): DisplayValue | undefined {
  const impactTime = scene.groundEnabled
    ? calculateGroundImpactTime(
        particle.initialPosition.y,
        particle.initialVelocity.y,
        scene.settings.gravity,
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

function getGravityEnteredText(acceleration: number): string | undefined {
  const gravityAcceleration =
    scene.settings.positiveY === "up"
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

function getCanvasContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const canvasContext = canvas.getContext("2d");
  if (!canvasContext) throw new Error("This browser does not support the Canvas 2D API.");
  return canvasContext;
}
