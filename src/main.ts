import "./styles/main.css";

import {
  createCamera,
  panCamera,
  resetCamera,
  resizeCamera,
  zoomCameraAt,
} from "./canvas/camera";
import { attachCanvasInteraction, type Tool } from "./canvas/interaction";
import { render } from "./canvas/renderer";
import { createParticle } from "./model/Particle";
import type { ParticleState } from "./model/Particle";
import { createScene } from "./model/Scene";
import { calculateSceneState } from "./physics/calculateSceneState";
import { advancePlayback, getNextIntegerSecond } from "./simulation/playback";
import { createControls, type PlaybackButtonState } from "./ui/controls";

const scene = createScene();
const camera = createCamera(1, 1);
let activeTool: Tool = "select";
let selectedParticleId: string | null = null;
let groundSelected = false;
let draggedParticleId: string | null = null;
let currentTime = 0;
let isPlaying = false;
let pendingPauseTime: number | null = null;
let previousFrameTimestamp: number | null = null;
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
  onGravityChange: (gravity) => {
    scene.settings.gravity = gravity;
    resetTime();
  },
  onParticleMassChange: (mass) => {
    const particle = scene.particles.find(
      (candidate) => candidate.id === selectedParticleId,
    );
    if (particle) particle.mass = mass;
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
  onTimeChange: (time) => {
    setPlaying(false);
    currentTime = time;
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
    activeTool = "select";
    controls.setTool("select");
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
    particle.initialVelocity = { x: 0, y: 0 };
    selectedParticleId = particleId;
    groundSelected = false;
    resetTime();
    updateUi();
  },
  onParticleDragChange: (particleId) => {
    draggedParticleId = particleId;
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
  if (isPlaying) {
    if (previousFrameTimestamp !== null) {
      const advance = advancePlayback(
        currentTime,
        (timestamp - previousFrameTimestamp) / 1000,
        pendingPauseTime,
      );
      currentTime = advance.time;

      if (advance.reachedScheduledPause) {
        setPlaying(false);
      }
      controls.setTime(currentTime);
    }

    if (isPlaying) previousFrameTimestamp = timestamp;
  } else {
    previousFrameTimestamp = null;
  }

  const activeParticleStates = calculateActiveParticleStates();
  render(
    context,
    scene,
    activeParticleStates.filter(
      (particle) => particle.id !== draggedParticleId,
    ),
    selectedParticleId,
    groundSelected,
    camera,
  );
  requestAnimationFrame(renderFrame);
}

function stepTime(interval: number): void {
  setPlaying(false);
  currentTime = Math.max(0, roundTime(currentTime + interval));
  updateUi();
}

function resetTime(): void {
  setPlaying(false);
  currentTime = 0;
  updateUi();
}

function setPlaying(playing: boolean): void {
  isPlaying = playing;
  pendingPauseTime = null;
  previousFrameTimestamp = null;
  controls.setPlaybackState(playing ? "playing" : "paused");
}

function togglePlayback(): void {
  if (!isPlaying) {
    selectedParticleId = null;
    groundSelected = false;
    activeTool = "select";
    controls.setTool("select");
    setPlaying(true);
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
  const selectedParticleState = selectedParticleId
    ? calculateActiveParticleStates().find(
        (particle) => particle.id === selectedParticleId,
      ) ?? null
    : null;
  const selectedParticle = selectedParticleState
    ? scene.particles.find((particle) => particle.id === selectedParticleState.id) ?? null
    : null;
  controls.setSelected(selectedParticleState !== null);
  controls.setSelectionProperties(
    selectedParticleState && selectedParticle
      ? {
          type: "particle",
          position: selectedParticleState.position,
          mass: selectedParticle.mass,
        }
      : groundSelected && scene.groundEnabled
        ? {
            type: "ground",
            rough: scene.groundRough,
            friction: scene.groundFriction,
          }
        : null,
  );
  controls.setTime(currentTime);
  controls.setPlaybackState(getPlaybackButtonState());
  controls.setZoom(camera.pixelsPerMetre);
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
