import type { ScreenPoint, Vec2 } from "../math/Vec2";
import type { ParticleState } from "../model/Particle";
import { screenToWorld, worldToScreen, type Camera } from "./camera";
import { hitTestParticles } from "./hitTest";
import { getRenderedParticleGeometry } from "./particleGeometry";

export type Tool = "select" | "particle";

interface InteractionOptions {
  canvas: HTMLCanvasElement;
  deleteTarget: HTMLElement;
  particleSource: HTMLElement;
  getCamera: () => Camera;
  getTool: () => Tool;
  getParticleStates: () => ParticleState[];
  isGroundEnabled: () => boolean;
  getGroundHeight: () => number;
  onSelect: (particleId: string | null) => void;
  onSelectGround: () => void;
  onPlace: (position: Vec2) => void;
  onMoveParticle: (particleId: string, position: Vec2) => void;
  onParticleDragChange: (particleId: string | null) => void;
  onDeleteParticle: (particleId: string) => void;
  onPan: (screenDelta: ScreenPoint) => void;
  onZoom: (screenPoint: ScreenPoint, factor: number) => void;
}

interface PanGesture {
  pointerId: number;
  lastPoint: ScreenPoint;
  totalDistance: number;
  clearsSelectionOnClick: boolean;
}

interface ParticleDragGesture {
  pointerId: number;
  particleId: string;
  startPoint: ScreenPoint;
  pointOffset: ScreenPoint;
  hasMoved: boolean;
  preview: HTMLElement | null;
}

interface HotbarDragGesture {
  pointerId: number;
  startPoint: ScreenPoint;
  isDragging: boolean;
  preview: HTMLElement | null;
}

const PAN_THRESHOLD_PX = 3;

export function attachCanvasInteraction(options: InteractionOptions): () => void {
  let panGesture: PanGesture | null = null;
  let particleDragGesture: ParticleDragGesture | null = null;
  let hotbarDragGesture: HotbarDragGesture | null = null;
  let suppressNextSourceClick = false;

  const startPan = (
    event: PointerEvent,
    point: ScreenPoint,
    clearsSelectionOnClick: boolean,
  ): void => {
    event.preventDefault();
    panGesture = {
      pointerId: event.pointerId,
      lastPoint: point,
      totalDistance: 0,
      clearsSelectionOnClick,
    };
    options.canvas.setPointerCapture(event.pointerId);
    options.canvas.classList.add("is-panning");
  };

  const handlePointerDown = (event: PointerEvent): void => {
    const pointer = getCanvasPoint(event, options.canvas);
    const isAlternatePan = event.button === 1 || event.button === 2;

    if (isAlternatePan) {
      startPan(event, pointer, false);
      return;
    }

    if (event.button !== 0) return;

    if (options.getTool() === "particle") {
      options.onPlace(getPlacement(pointer, options, true));
      return;
    }

    const particleStates = options.getParticleStates();
    const hitParticleId = hitTestParticles(
      pointer,
      particleStates,
      options.getCamera(),
      {
        groundEnabled: options.isGroundEnabled(),
        groundHeight: options.getGroundHeight(),
      },
    );

    if (hitParticleId) {
      options.onSelect(hitParticleId);
      const particleState = particleStates.find((particle) => particle.id === hitParticleId);
      if (!particleState) return;

      const mathematicalPoint = worldToScreen(
        particleState.position,
        options.getCamera(),
      );
      particleDragGesture = {
        pointerId: event.pointerId,
        particleId: hitParticleId,
        startPoint: pointer,
        pointOffset: {
          x: pointer.x - mathematicalPoint.x,
          y: pointer.y - mathematicalPoint.y,
        },
        hasMoved: false,
        preview: null,
      };
      options.canvas.setPointerCapture(event.pointerId);
    } else if (
      options.isGroundEnabled() &&
      isGroundHit(pointer, options.getCamera(), options.getGroundHeight())
    ) {
      options.onSelectGround();
    } else {
      startPan(event, pointer, true);
    }
  };

  const handlePointerMove = (event: PointerEvent): void => {
    if (particleDragGesture?.pointerId === event.pointerId) {
      const pointer = getCanvasPoint(event, options.canvas);
      const distance = Math.hypot(
        pointer.x - particleDragGesture.startPoint.x,
        pointer.y - particleDragGesture.startPoint.y,
      );

      if (!particleDragGesture.hasMoved && distance < PAN_THRESHOLD_PX) return;

      if (!particleDragGesture.hasMoved) {
        particleDragGesture.hasMoved = true;
        options.onParticleDragChange(particleDragGesture.particleId);
        particleDragGesture.preview = document.createElement("span");
        particleDragGesture.preview.className = "particle-drag-preview";
        document.body.append(particleDragGesture.preview);
      }

      options.canvas.classList.add("is-dragging-particle");
      const isOverDeleteTarget = isPointerOverElement(event, options.deleteTarget);
      options.deleteTarget.classList.toggle("is-drop-target", isOverDeleteTarget);
      const targetPoint = {
        x: pointer.x - particleDragGesture.pointOffset.x,
        y: pointer.y - particleDragGesture.pointOffset.y,
      };
      const freePosition = getPlacement(targetPoint, options, false);

      if (particleDragGesture.preview) {
        updateWorldDragPreview(particleDragGesture.preview, freePosition, options);
      }

      if (!isOverDeleteTarget) {
        options.onMoveParticle(
          particleDragGesture.particleId,
          freePosition,
        );
      }
      return;
    }

    if (!panGesture || panGesture.pointerId !== event.pointerId) return;

    const pointer = getCanvasPoint(event, options.canvas);
    const delta = {
      x: pointer.x - panGesture.lastPoint.x,
      y: pointer.y - panGesture.lastPoint.y,
    };
    panGesture.totalDistance += Math.hypot(delta.x, delta.y);
    panGesture.lastPoint = pointer;
    options.onPan(delta);
  };

  const finishPointerGesture = (event: PointerEvent): void => {
    if (particleDragGesture?.pointerId === event.pointerId) {
      const shouldDelete =
        event.type === "pointerup" &&
        particleDragGesture.hasMoved &&
        isPointerOverElement(event, options.deleteTarget);
      const draggedParticleId = particleDragGesture.particleId;
      const shouldSnap =
        event.type === "pointerup" &&
        particleDragGesture.hasMoved &&
        !shouldDelete;

      if (shouldSnap) {
        const pointer = getCanvasPoint(event, options.canvas);
        const targetPoint = {
          x: pointer.x - particleDragGesture.pointOffset.x,
          y: pointer.y - particleDragGesture.pointOffset.y,
        };
        options.onMoveParticle(
          draggedParticleId,
          getPlacement(targetPoint, options, true),
        );
      }

      particleDragGesture.preview?.remove();
      options.onParticleDragChange(null);
      particleDragGesture = null;
      options.canvas.classList.remove("is-dragging-particle");
      options.deleteTarget.classList.remove("is-drop-target");
      releasePointer(options.canvas, event.pointerId);

      if (shouldDelete) options.onDeleteParticle(draggedParticleId);
      return;
    }

    if (!panGesture || panGesture.pointerId !== event.pointerId) return;

    if (
      panGesture.clearsSelectionOnClick &&
      panGesture.totalDistance < PAN_THRESHOLD_PX
    ) {
      options.onSelect(null);
    }

    panGesture = null;
    options.canvas.classList.remove("is-panning");
    releasePointer(options.canvas, event.pointerId);
  };

  const handleWheel = (event: WheelEvent): void => {
    event.preventDefault();
    const pointer = getCanvasPoint(event, options.canvas);
    options.onZoom(pointer, Math.exp(-event.deltaY * 0.0015));
  };

  const handleSourcePointerDown = (event: PointerEvent): void => {
    if (event.button !== 0) return;

    hotbarDragGesture = {
      pointerId: event.pointerId,
      startPoint: { x: event.clientX, y: event.clientY },
      isDragging: false,
      preview: null,
    };
    options.particleSource.setPointerCapture(event.pointerId);
  };

  const handleSourcePointerMove = (event: PointerEvent): void => {
    if (!hotbarDragGesture || hotbarDragGesture.pointerId !== event.pointerId) return;

    const distance = Math.hypot(
      event.clientX - hotbarDragGesture.startPoint.x,
      event.clientY - hotbarDragGesture.startPoint.y,
    );

    if (!hotbarDragGesture.isDragging && distance < PAN_THRESHOLD_PX) return;

    if (!hotbarDragGesture.isDragging) {
      hotbarDragGesture.isDragging = true;
      hotbarDragGesture.preview = document.createElement("span");
      hotbarDragGesture.preview.className = "particle-drag-preview";
      document.body.append(hotbarDragGesture.preview);
      options.particleSource.classList.add("is-dragging");
    }

    event.preventDefault();
    const camera = options.getCamera();
    const canvasBounds = options.canvas.getBoundingClientRect();
    const isOverCanvas = isPointerOverElement(event, options.canvas);
    let previewCentre = { x: event.clientX, y: event.clientY };

    if (isOverCanvas) {
      const canvasPoint = getCanvasPoint(event, options.canvas);
      const freePosition = getPlacement(canvasPoint, options, false);
      const mathematicalPoint = worldToScreen(freePosition, camera);
      const geometry = getRenderedParticleGeometry(mathematicalPoint, camera, {
        groundEnabled: options.isGroundEnabled(),
        groundHeight: options.getGroundHeight(),
      });

      previewCentre = {
        x: canvasBounds.left + geometry.centre.x,
        y: canvasBounds.top + geometry.centre.y,
      };
      options.canvas.classList.add("is-drop-target");
    } else {
      options.canvas.classList.remove("is-drop-target");
    }

    if (hotbarDragGesture.preview) {
      updateDragPreview(
        hotbarDragGesture.preview,
        previewCentre,
        camera.pixelsPerMetre,
      );
    }
  };

  const finishSourcePointerGesture = (event: PointerEvent): void => {
    if (!hotbarDragGesture || hotbarDragGesture.pointerId !== event.pointerId) return;

    const completedDrag = hotbarDragGesture.isDragging;
    const droppedPosition =
      event.type === "pointerup" && isPointerOverElement(event, options.canvas)
        ? getPlacement(getCanvasPoint(event, options.canvas), options, true)
        : null;

    hotbarDragGesture.preview?.remove();
    hotbarDragGesture = null;
    options.particleSource.classList.remove("is-dragging");
    options.canvas.classList.remove("is-drop-target");
    releasePointer(options.particleSource, event.pointerId);

    if (completedDrag) {
      event.preventDefault();
      suppressNextSourceClick = true;
      if (droppedPosition) options.onPlace(droppedPosition);
    }
  };

  const suppressSourceClickAfterDrag = (event: MouseEvent): void => {
    if (!suppressNextSourceClick) return;
    suppressNextSourceClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  const preventContextMenu = (event: MouseEvent): void => event.preventDefault();

  options.canvas.addEventListener("pointerdown", handlePointerDown);
  options.canvas.addEventListener("pointermove", handlePointerMove);
  options.canvas.addEventListener("pointerup", finishPointerGesture);
  options.canvas.addEventListener("pointercancel", finishPointerGesture);
  options.canvas.addEventListener("wheel", handleWheel, { passive: false });
  options.canvas.addEventListener("contextmenu", preventContextMenu);
  options.particleSource.addEventListener("pointerdown", handleSourcePointerDown);
  options.particleSource.addEventListener("pointermove", handleSourcePointerMove);
  options.particleSource.addEventListener("pointerup", finishSourcePointerGesture);
  options.particleSource.addEventListener("pointercancel", finishSourcePointerGesture);
  options.particleSource.addEventListener("click", suppressSourceClickAfterDrag, true);

  return () => {
    options.canvas.removeEventListener("pointerdown", handlePointerDown);
    options.canvas.removeEventListener("pointermove", handlePointerMove);
    options.canvas.removeEventListener("pointerup", finishPointerGesture);
    options.canvas.removeEventListener("pointercancel", finishPointerGesture);
    options.canvas.removeEventListener("wheel", handleWheel);
    options.canvas.removeEventListener("contextmenu", preventContextMenu);
    options.particleSource.removeEventListener("pointerdown", handleSourcePointerDown);
    options.particleSource.removeEventListener("pointermove", handleSourcePointerMove);
    options.particleSource.removeEventListener("pointerup", finishSourcePointerGesture);
    options.particleSource.removeEventListener("pointercancel", finishSourcePointerGesture);
    options.particleSource.removeEventListener("click", suppressSourceClickAfterDrag, true);
  };
}

function updateDragPreview(
  preview: HTMLElement,
  centre: ScreenPoint,
  diameter: number,
): void {
  preview.style.width = `${diameter}px`;
  preview.style.height = `${diameter}px`;
  preview.style.fontSize = `${Math.max(10, diameter * 0.52)}px`;
  preview.style.left = `${centre.x - diameter / 2}px`;
  preview.style.top = `${centre.y - diameter / 2}px`;
}

function updateWorldDragPreview(
  preview: HTMLElement,
  position: Vec2,
  options: InteractionOptions,
): void {
  const camera = options.getCamera();
  const canvasBounds = options.canvas.getBoundingClientRect();
  const mathematicalPoint = worldToScreen(position, camera);
  const geometry = getRenderedParticleGeometry(mathematicalPoint, camera, {
    groundEnabled: options.isGroundEnabled(),
    groundHeight: options.getGroundHeight(),
  });

  updateDragPreview(
    preview,
    {
      x: canvasBounds.left + geometry.centre.x,
      y: canvasBounds.top + geometry.centre.y,
    },
    camera.pixelsPerMetre,
  );
}

function isPointerOverElement(
  event: Pick<MouseEvent, "clientX" | "clientY">,
  element: HTMLElement,
): boolean {
  const bounds = element.getBoundingClientRect();
  return (
    event.clientX >= bounds.left &&
    event.clientX <= bounds.right &&
    event.clientY >= bounds.top &&
    event.clientY <= bounds.bottom
  );
}

function releasePointer(element: HTMLElement, pointerId: number): void {
  if (element.hasPointerCapture(pointerId)) {
    element.releasePointerCapture(pointerId);
  }
}

function getPlacement(
  pointer: ScreenPoint,
  options: InteractionOptions,
  snapToGrid: boolean,
): Vec2 {
  const world = screenToWorld(pointer, options.getCamera());
  const snappedPosition = {
    x: snapToGrid ? Math.round(world.x) : world.x,
    y: snapToGrid ? Math.round(world.y) : world.y,
  };

  if (options.isGroundEnabled() && snappedPosition.y < options.getGroundHeight()) {
    snappedPosition.y = options.getGroundHeight();
  }

  return snappedPosition;
}

function getCanvasPoint(
  event: Pick<MouseEvent, "clientX" | "clientY">,
  canvas: HTMLCanvasElement,
): ScreenPoint {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: event.clientX - bounds.left,
    y: event.clientY - bounds.top,
  };
}

function isGroundHit(
  pointer: ScreenPoint,
  camera: Camera,
  groundHeight: number,
): boolean {
  const pointerWorld = screenToWorld(pointer, camera);
  return pointerWorld.y <= groundHeight && pointerWorld.y >= groundHeight - 5;
}
