import type { ScreenPoint, Vec2 } from "../math/Vec2";
import type { ParticleShape, ParticleState } from "../model/Particle";
import { screenToWorld, worldToScreen, type Camera } from "./camera";
import { hitTestParticles } from "./hitTest";
import { getRenderedParticleGeometry } from "./particleGeometry";
import type { Incline } from "../model/Incline";
import type { Scene } from "../model/Scene";
import {
  createIncline,
  DEFAULT_INCLINE_ANGLE_DEGREES,
  DEFAULT_INCLINE_HORIZONTAL_LENGTH,
} from "../model/Incline";
import { canPlaceIncline } from "../geometry/inclineGeometry";
import { hitTestInclines } from "./inclineHitTest";
import {
  findInclineGridSnap,
  resolveParticlePlacementAgainstInclines,
} from "../simulation/inclineSetup";
import type { PlacementPreview } from "./placementPreview";
import {
  calculateInclineAngleAnnotationGeometry,
  getParticleForceContactDisplay,
} from "./renderer";
import { calculateInitialVelocityTextSize } from "./initialVelocityAnnotation";
import {
  calculateDraggedInclineHorizontalLength,
  calculateInclineLengthControlGeometry,
  hitTestInclineLengthControl,
  stepInclineHorizontalLength,
} from "./inclineLengthControl";
import { hitTestStrings } from "./stringGeometry";

export type Tool = "select" | "particle" | "incline";

interface InteractionOptions {
  canvas: HTMLCanvasElement;
  deleteTarget: HTMLElement;
  particleSource: HTMLElement;
  inclineSource: HTMLElement;
  getCamera: () => Camera;
  getTool: () => Tool;
  getCurrentTime: () => number;
  getParticleStates: () => ParticleState[];
  getScene: () => Scene;
  getInclines: () => readonly Incline[];
  getSelectedInclineId: () => string | null;
  isGroundEnabled: () => boolean;
  getGroundHeight: () => number;
  onSelect: (particleId: string | null) => void;
  onSelectGround: () => void;
  onSelectIncline: (inclineId: string) => void;
  onSelectString: (stringId: string) => void;
  getStringConnectionSourceId: () => string | null;
  onStringConnectionPointerMove: (position: Vec2 | null) => void;
  onStringConnectionTarget: (particleId: string | null) => void;
  onPlace: (position: Vec2) => void;
  onPlaceIncline: (position: Vec2) => void;
  resolveParticleMove: (
    particleId: string,
    pointerPosition: Vec2,
    defaultPosition: Vec2,
  ) => Vec2;
  isParticleMoveValid: (particleId: string, position: Vec2) => boolean;
  onMoveParticle: (particleId: string, position: Vec2) => Vec2;
  onMoveIncline: (inclineId: string, lowerEndpoint: Vec2) => void;
  onResizeIncline: (inclineId: string, horizontalLength: number) => void;
  onParticleDragChange: (particleId: string | null) => void;
  onDeleteParticle: (particleId: string) => void;
  onDeleteIncline: (inclineId: string) => void;
  onPlacementPreviewChange: (preview: PlacementPreview | null) => void;
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

interface InclineDragGesture {
  pointerId: number;
  inclineId: string;
  startPoint: ScreenPoint;
  pointOffset: ScreenPoint;
  hasMoved: boolean;
}

interface InclineLengthGesture {
  pointerId: number;
  inclineId: string;
  startPoint: ScreenPoint;
  initialLength: number;
  direction: Incline["direction"];
  lastLength: number;
}

interface HotbarDragGesture {
  pointerId: number;
  startPoint: ScreenPoint;
  isDragging: boolean;
  preview: HTMLElement | null;
  kind: "particle" | "incline";
  source: HTMLElement;
}

const PAN_THRESHOLD_PX = 3;

export function attachCanvasInteraction(options: InteractionOptions): () => void {
  let panGesture: PanGesture | null = null;
  let particleDragGesture: ParticleDragGesture | null = null;
  let inclineDragGesture: InclineDragGesture | null = null;
  let inclineLengthGesture: InclineLengthGesture | null = null;
  let hotbarDragGesture: HotbarDragGesture | null = null;
  let suppressNextSourceClick = false;

  const updateInclineLengthControlHover = (
    point: ScreenPoint | null,
  ): void => {
    let hoveringControl = false;
    if (point && options.getTool() === "select") {
      const selectedInclineId = options.getSelectedInclineId();
      const selectedIncline = selectedInclineId
        ? options.getInclines().find(
            (incline) => incline.id === selectedInclineId,
          )
        : undefined;
      hoveringControl = selectedIncline !== undefined &&
        hitTestInclineLengthControl(
          point,
          calculateInclineLengthControlGeometry(
            selectedIncline,
            options.getCamera(),
          ),
        ) !== null;
    }
    options.canvas.classList.toggle(
      "is-hovering-incline-length-control",
      hoveringControl,
    );
  };

  const startPan = (
    event: PointerEvent,
    point: ScreenPoint,
    clearsSelectionOnClick: boolean,
  ): void => {
    event.preventDefault();
    updateInclineLengthControlHover(null);
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
    updateInclineLengthControlHover(pointer);

    if (options.getTool() === "select") {
      const selectedInclineId = options.getSelectedInclineId();
      const selectedIncline = selectedInclineId
        ? options.getInclines().find((incline) => incline.id === selectedInclineId)
        : undefined;
      if (selectedIncline) {
        const target = hitTestInclineLengthControl(
          pointer,
          calculateInclineLengthControlGeometry(
            selectedIncline,
            options.getCamera(),
          ),
        );
        if (target === "decrease" || target === "increase") {
          const length = stepInclineHorizontalLength(
            selectedIncline.horizontalLength,
            target,
          );
          if (
            length !== selectedIncline.horizontalLength &&
            isInclineLengthValid(selectedIncline, length, options)
          ) {
            options.onResizeIncline(selectedIncline.id, length);
          }
          event.preventDefault();
          return;
        }
        if (target === "handle") {
          event.preventDefault();
          inclineLengthGesture = {
            pointerId: event.pointerId,
            inclineId: selectedIncline.id,
            startPoint: pointer,
            initialLength: selectedIncline.horizontalLength,
            direction: selectedIncline.direction,
            lastLength: selectedIncline.horizontalLength,
          };
          options.canvas.setPointerCapture(event.pointerId);
          options.canvas.classList.add("is-resizing-incline");
          return;
        }
      }
    }

    if (options.getTool() === "particle" || options.getTool() === "incline") {
      if (options.getTool() === "particle") {
        options.onPlace(getParticlePlacement(pointer, options, true));
      } else {
        const position = getPlacement(pointer, options, true);
        if (isInclinePlacementValid(position, options)) {
          options.onPlaceIncline(position);
        }
      }
      return;
    }

    const particleStates = options.getParticleStates();
    const hitParticleId = hitTestParticles(
      pointer,
      particleStates,
      options.getCamera(),
      (particleId) => {
        const scene = options.getScene();
        const particle = scene.particles.find(
          (candidate) => candidate.id === particleId,
        );
        return {
          shape: particle?.shape ?? "circle",
          incline: particle?.shape === "square"
            ? getParticleForceContactDisplay(
                scene,
                particle,
                options.getCurrentTime(),
              ).incline
            : null,
        };
      },
    );

    if (options.getStringConnectionSourceId()) {
      options.onStringConnectionTarget(hitParticleId);
      event.preventDefault();
      return;
    }

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
      return;
    } else {
      const stringId = hitTestStrings(
        pointer,
        options.getScene(),
        particleStates,
        options.getCamera(),
      );
      if (stringId) {
        options.onSelectString(stringId);
        return;
      }
      const inclineId = hitTestInclines(
        pointer,
        options.getInclines(),
        options.getCamera(),
      );
      if (inclineId) {
        options.onSelectIncline(inclineId);
        const incline = options.getInclines().find(
          (candidate) => candidate.id === inclineId,
        );
        if (!incline) return;
        const lowerEndpoint = worldToScreen(
          incline.anchor,
          options.getCamera(),
        );
        inclineDragGesture = {
          pointerId: event.pointerId,
          inclineId,
          startPoint: pointer,
          pointOffset: {
            x: pointer.x - lowerEndpoint.x,
            y: pointer.y - lowerEndpoint.y,
          },
          hasMoved: false,
        };
        options.canvas.setPointerCapture(event.pointerId);
        return;
      }
    }

    if (
      options.isGroundEnabled() &&
      isGroundHit(pointer, options.getCamera(), options.getGroundHeight())
    ) {
      options.onSelectGround();
    } else {
      startPan(event, pointer, true);
    }
  };

  const handlePointerMove = (event: PointerEvent): void => {
    if (inclineLengthGesture?.pointerId === event.pointerId) {
      const pointer = getCanvasPoint(event, options.canvas);
      const incline = options.getInclines().find(
        (candidate) => candidate.id === inclineLengthGesture?.inclineId,
      );
      if (!incline) return;
      const length = calculateDraggedInclineHorizontalLength(
        inclineLengthGesture.initialLength,
        pointer.x - inclineLengthGesture.startPoint.x,
        options.getCamera().pixelsPerMetre,
        inclineLengthGesture.direction,
      );
      if (
        length !== inclineLengthGesture.lastLength &&
        isInclineLengthValid(incline, length, options)
      ) {
        inclineLengthGesture.lastLength = length;
        options.onResizeIncline(incline.id, length);
      }
      return;
    }

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
        const draggedParticle = options.getScene().particles.find(
          (particle) => particle.id === particleDragGesture?.particleId,
        );
        particleDragGesture.preview.className = getParticleDragPreviewClassName(
          draggedParticle?.shape ?? "circle",
        );
        document.body.append(particleDragGesture.preview);
      }

      options.canvas.classList.add("is-dragging-particle");
      const isOverDeleteTarget = isPointerOverElement(event, options.deleteTarget);
      options.deleteTarget.classList.toggle("is-drop-target", isOverDeleteTarget);
      const targetPoint = {
        x: pointer.x - particleDragGesture.pointOffset.x,
        y: pointer.y - particleDragGesture.pointOffset.y,
      };
      const freePosition = getParticlePlacement(targetPoint, options, false);
      const snappedPosition = getParticlePlacement(targetPoint, options, true);
      const candidatePosition = options.resolveParticleMove(
        particleDragGesture.particleId,
        freePosition,
        snappedPosition,
      );

      if (particleDragGesture.preview) {
        particleDragGesture.preview.classList.toggle(
          "is-invalid",
          !isOverDeleteTarget && !options.isParticleMoveValid(
            particleDragGesture.particleId,
            candidatePosition,
          ),
        );
        updateWorldDragPreview(
          particleDragGesture.preview,
          freePosition,
          options,
        );
      }
      return;
    }

    if (inclineDragGesture?.pointerId === event.pointerId) {
      const pointer = getCanvasPoint(event, options.canvas);
      const distance = Math.hypot(
        pointer.x - inclineDragGesture.startPoint.x,
        pointer.y - inclineDragGesture.startPoint.y,
      );
      if (!inclineDragGesture.hasMoved && distance < PAN_THRESHOLD_PX) return;
      if (!inclineDragGesture.hasMoved) {
        inclineDragGesture.hasMoved = true;
      }
      options.canvas.classList.add("is-dragging-incline");
      const isOverDeleteTarget = isPointerOverElement(event, options.deleteTarget);
      options.deleteTarget.classList.toggle("is-drop-target", isOverDeleteTarget);
      if (!isOverDeleteTarget) {
        const targetPoint = {
          x: pointer.x - inclineDragGesture.pointOffset.x,
          y: pointer.y - inclineDragGesture.pointOffset.y,
        };
        const position = getPlacement(targetPoint, options, false);
        options.onPlacementPreviewChange({
          kind: "incline",
          position,
          isValid: isInclinePlacementValid(
            position,
            options,
            inclineDragGesture.inclineId,
          ),
          sourceInclineId: inclineDragGesture.inclineId,
        });
      }
      return;
    }

    if (panGesture?.pointerId === event.pointerId) {
      const pointer = getCanvasPoint(event, options.canvas);
      const delta = {
        x: pointer.x - panGesture.lastPoint.x,
        y: pointer.y - panGesture.lastPoint.y,
      };
      panGesture.totalDistance += Math.hypot(delta.x, delta.y);
      panGesture.lastPoint = pointer;
      options.onPan(delta);
      return;
    }

    updateInclineLengthControlHover(getCanvasPoint(event, options.canvas));

    if (options.getStringConnectionSourceId()) {
      options.onStringConnectionPointerMove(
        screenToWorld(getCanvasPoint(event, options.canvas), options.getCamera()),
      );
      options.onPlacementPreviewChange(null);
      return;
    }

    const placementTool = options.getTool();
    if (placementTool === "particle" || placementTool === "incline") {
      const pointer = getCanvasPoint(event, options.canvas);
      if (placementTool === "particle") {
        options.onPlacementPreviewChange({
          kind: "particle",
          position: getParticlePlacement(pointer, options, true),
        });
      } else {
        const position = getPlacement(pointer, options, true);
        options.onPlacementPreviewChange({
          kind: "incline",
          position,
          isValid: isInclinePlacementValid(position, options),
        });
      }
      return;
    }
    options.onPlacementPreviewChange(null);
  };

  const finishPointerGesture = (event: PointerEvent): void => {
    if (inclineLengthGesture?.pointerId === event.pointerId) {
      inclineLengthGesture = null;
      options.canvas.classList.remove("is-resizing-incline");
      releasePointer(options.canvas, event.pointerId);
      updateInclineLengthControlHover(
        event.type === "pointerup"
          ? getCanvasPoint(event, options.canvas)
          : null,
      );
      return;
    }

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
        const freePosition = getParticlePlacement(targetPoint, options, false);
        const defaultPosition = getParticlePlacement(targetPoint, options, true);
        options.onMoveParticle(
          draggedParticleId,
          options.resolveParticleMove(
            draggedParticleId,
            freePosition,
            defaultPosition,
          ),
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

    if (inclineDragGesture?.pointerId === event.pointerId) {
      const draggedInclineId = inclineDragGesture.inclineId;
      const shouldDelete =
        event.type === "pointerup" &&
        inclineDragGesture.hasMoved &&
        isPointerOverElement(event, options.deleteTarget);
      const shouldSnap =
        event.type === "pointerup" &&
        inclineDragGesture.hasMoved &&
        !shouldDelete;
      if (shouldSnap) {
        const pointer = getCanvasPoint(event, options.canvas);
        const targetPoint = {
          x: pointer.x - inclineDragGesture.pointOffset.x,
          y: pointer.y - inclineDragGesture.pointOffset.y,
        };
        const position = getPlacement(targetPoint, options, true);
        if (isInclinePlacementValid(position, options, draggedInclineId)) {
          options.onMoveIncline(draggedInclineId, position);
        }
      }
      options.onPlacementPreviewChange(null);
      inclineDragGesture = null;
      options.canvas.classList.remove("is-dragging-incline");
      options.deleteTarget.classList.remove("is-drop-target");
      releasePointer(options.canvas, event.pointerId);
      if (shouldDelete) options.onDeleteIncline(draggedInclineId);
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

  const handleSourcePointerDown = (
    event: PointerEvent,
    kind: "particle" | "incline",
    source: HTMLElement,
  ): void => {
    if (event.button !== 0) return;

    hotbarDragGesture = {
      pointerId: event.pointerId,
      startPoint: { x: event.clientX, y: event.clientY },
      isDragging: false,
      preview: null,
      kind,
      source,
    };
    source.setPointerCapture(event.pointerId);
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
      hotbarDragGesture.preview = hotbarDragGesture.kind === "particle"
        ? document.createElement("span")
        : createInclineDragPreviewElement();
      hotbarDragGesture.preview.className = hotbarDragGesture.kind === "particle"
        ? "particle-drag-preview"
        : "incline-drag-preview";
      document.body.append(hotbarDragGesture.preview);
      hotbarDragGesture.source.classList.add("is-dragging");
    }

    event.preventDefault();
    const camera = options.getCamera();
    const canvasBounds = options.canvas.getBoundingClientRect();
    const isOverCanvas = isPointerOverElement(event, options.canvas);
    let previewCentre = { x: event.clientX, y: event.clientY };
    let inclinePlacementValid = true;

    if (isOverCanvas) {
      const canvasPoint = getCanvasPoint(event, options.canvas);
      const freePosition = hotbarDragGesture.kind === "particle"
        ? getParticlePlacement(canvasPoint, options, false)
        : getPlacement(canvasPoint, options, false);
      const mathematicalPoint = worldToScreen(freePosition, camera);
      if (hotbarDragGesture.kind === "particle") {
        const geometry = getRenderedParticleGeometry(mathematicalPoint, camera);
        previewCentre = {
          x: canvasBounds.left + geometry.centre.x,
          y: canvasBounds.top + geometry.centre.y,
        };
      } else {
        inclinePlacementValid = isInclinePlacementValid(
          freePosition,
          options,
        );
        previewCentre = {
          x: canvasBounds.left + mathematicalPoint.x,
          y: canvasBounds.top + mathematicalPoint.y,
        };
      }
      options.canvas.classList.add("is-drop-target");
    } else {
      options.canvas.classList.remove("is-drop-target");
    }

    if (hotbarDragGesture.preview) {
      if (hotbarDragGesture.kind === "particle") {
        updateDragPreview(
          hotbarDragGesture.preview,
          previewCentre,
          camera.pixelsPerMetre,
        );
      } else {
        hotbarDragGesture.preview.classList.toggle(
          "is-invalid",
          isOverCanvas && !inclinePlacementValid,
        );
        updateInclineDragPreview(
          hotbarDragGesture.preview,
          previewCentre,
          camera.pixelsPerMetre,
        );
      }
    }
  };

  const finishSourcePointerGesture = (event: PointerEvent): void => {
    if (!hotbarDragGesture || hotbarDragGesture.pointerId !== event.pointerId) return;

    const completedDrag = hotbarDragGesture.isDragging;
    const { kind, source } = hotbarDragGesture;
    const droppedPosition =
      event.type === "pointerup" && isPointerOverElement(event, options.canvas)
        ? kind === "particle"
          ? getParticlePlacement(
              getCanvasPoint(event, options.canvas),
              options,
              true,
            )
          : getPlacement(getCanvasPoint(event, options.canvas), options, true)
        : null;
    const droppedPositionIsValid = kind !== "incline" ||
      droppedPosition === null ||
      isInclinePlacementValid(droppedPosition, options);

    hotbarDragGesture.preview?.remove();
    hotbarDragGesture = null;
    source.classList.remove("is-dragging");
    options.canvas.classList.remove("is-drop-target");
    releasePointer(source, event.pointerId);

    if (completedDrag) {
      event.preventDefault();
      suppressNextSourceClick = true;
      if (droppedPosition && droppedPositionIsValid) {
        if (kind === "particle") options.onPlace(droppedPosition);
        else options.onPlaceIncline(droppedPosition);
      }
    }
  };

  const suppressSourceClickAfterDrag = (event: MouseEvent): void => {
    if (!suppressNextSourceClick) return;
    suppressNextSourceClick = false;
    event.preventDefault();
    event.stopImmediatePropagation();
  };

  const preventContextMenu = (event: MouseEvent): void => event.preventDefault();
  const clearPlacementPreview = (): void => {
    if (inclineDragGesture) return;
    options.onPlacementPreviewChange(null);
    if (options.getStringConnectionSourceId()) {
      options.onStringConnectionPointerMove(null);
    }
    if (!inclineLengthGesture) updateInclineLengthControlHover(null);
  };

  options.canvas.addEventListener("pointerdown", handlePointerDown);
  options.canvas.addEventListener("pointermove", handlePointerMove);
  options.canvas.addEventListener("pointerup", finishPointerGesture);
  options.canvas.addEventListener("pointercancel", finishPointerGesture);
  options.canvas.addEventListener("wheel", handleWheel, { passive: false });
  options.canvas.addEventListener("contextmenu", preventContextMenu);
  options.canvas.addEventListener("pointerleave", clearPlacementPreview);
  const handleParticleSourcePointerDown = (event: PointerEvent) =>
    handleSourcePointerDown(event, "particle", options.particleSource);
  const handleInclineSourcePointerDown = (event: PointerEvent) =>
    handleSourcePointerDown(event, "incline", options.inclineSource);
  options.particleSource.addEventListener("pointerdown", handleParticleSourcePointerDown);
  options.inclineSource.addEventListener("pointerdown", handleInclineSourcePointerDown);
  options.particleSource.addEventListener("pointermove", handleSourcePointerMove);
  options.inclineSource.addEventListener("pointermove", handleSourcePointerMove);
  options.particleSource.addEventListener("pointerup", finishSourcePointerGesture);
  options.inclineSource.addEventListener("pointerup", finishSourcePointerGesture);
  options.particleSource.addEventListener("pointercancel", finishSourcePointerGesture);
  options.inclineSource.addEventListener("pointercancel", finishSourcePointerGesture);
  options.particleSource.addEventListener("click", suppressSourceClickAfterDrag, true);
  options.inclineSource.addEventListener("click", suppressSourceClickAfterDrag, true);

  return () => {
    options.canvas.removeEventListener("pointerdown", handlePointerDown);
    options.canvas.removeEventListener("pointermove", handlePointerMove);
    options.canvas.removeEventListener("pointerup", finishPointerGesture);
    options.canvas.removeEventListener("pointercancel", finishPointerGesture);
    options.canvas.removeEventListener("wheel", handleWheel);
    options.canvas.removeEventListener("contextmenu", preventContextMenu);
    options.canvas.removeEventListener("pointerleave", clearPlacementPreview);
    options.particleSource.removeEventListener("pointerdown", handleParticleSourcePointerDown);
    options.inclineSource.removeEventListener("pointerdown", handleInclineSourcePointerDown);
    options.particleSource.removeEventListener("pointermove", handleSourcePointerMove);
    options.inclineSource.removeEventListener("pointermove", handleSourcePointerMove);
    options.particleSource.removeEventListener("pointerup", finishSourcePointerGesture);
    options.inclineSource.removeEventListener("pointerup", finishSourcePointerGesture);
    options.particleSource.removeEventListener("pointercancel", finishSourcePointerGesture);
    options.inclineSource.removeEventListener("pointercancel", finishSourcePointerGesture);
    options.particleSource.removeEventListener("click", suppressSourceClickAfterDrag, true);
    options.inclineSource.removeEventListener("click", suppressSourceClickAfterDrag, true);
    options.canvas.classList.remove("is-hovering-incline-length-control");
    options.canvas.classList.remove("is-resizing-incline");
  };
}

function createInclineDragPreviewElement(): HTMLSpanElement {
  const preview = document.createElement("span");
  const svgNamespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNamespace, "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");
  const triangle = document.createElementNS(svgNamespace, "polygon");
  triangle.classList.add("incline-drag-preview-surface");
  triangle.setAttribute("vector-effect", "non-scaling-stroke");
  const angleArc = document.createElementNS(svgNamespace, "path");
  angleArc.classList.add("incline-drag-preview-angle");
  angleArc.setAttribute("vector-effect", "non-scaling-stroke");
  const angleLabel = document.createElementNS(svgNamespace, "text");
  angleLabel.classList.add("incline-drag-preview-angle-label");
  angleLabel.textContent = `${DEFAULT_INCLINE_ANGLE_DEGREES}°`;
  svg.appendChild(triangle);
  svg.appendChild(angleArc);
  svg.appendChild(angleLabel);
  preview.appendChild(svg);
  return preview;
}

function updateInclineDragPreview(
  preview: HTMLElement,
  lowerEndpoint: ScreenPoint,
  pixelsPerMetre: number,
): void {
  const geometry = calculateInclineDragPreviewGeometry(
    lowerEndpoint,
    pixelsPerMetre,
  );
  preview.style.width = `${geometry.width}px`;
  preview.style.height = `${geometry.height}px`;
  preview.style.left = `${geometry.left}px`;
  preview.style.top = `${geometry.top}px`;
  const svg = preview.querySelector<SVGSVGElement>("svg");
  const triangle = preview.querySelector<SVGPolygonElement>(
    ".incline-drag-preview-surface",
  );
  const angleArc = preview.querySelector<SVGPathElement>(
    ".incline-drag-preview-angle",
  );
  const angleLabel = preview.querySelector<SVGTextElement>(
    ".incline-drag-preview-angle-label",
  );
  if (!svg || !triangle || !angleArc || !angleLabel) return;
  svg.setAttribute("viewBox", `0 0 ${geometry.width} ${geometry.height}`);
  triangle.setAttribute(
    "points",
    `0,${geometry.height} ${geometry.width},0 ${geometry.width},${geometry.height}`,
  );
  angleLabel.style.fontSize =
    `${calculateInitialVelocityTextSize(pixelsPerMetre)}px`;
  const annotation = calculateInclineAngleAnnotationGeometry(
    { x: 0, y: geometry.height },
    "rises-right",
    DEFAULT_INCLINE_ANGLE_DEGREES,
    pixelsPerMetre,
    angleLabel.getComputedTextLength(),
    DEFAULT_INCLINE_HORIZONTAL_LENGTH,
  );
  const start = {
    x: Math.cos(annotation.startAngle) * annotation.arcRadius,
    y: geometry.height + Math.sin(annotation.startAngle) * annotation.arcRadius,
  };
  const end = {
    x: Math.cos(annotation.endAngle) * annotation.arcRadius,
    y: geometry.height + Math.sin(annotation.endAngle) * annotation.arcRadius,
  };
  angleArc.setAttribute(
    "d",
    `M ${start.x} ${start.y} A ${annotation.arcRadius} ${annotation.arcRadius} 0 0 0 ${end.x} ${end.y}`,
  );
  angleLabel.setAttribute("x", String(annotation.labelPosition.x));
  angleLabel.setAttribute("y", String(annotation.labelPosition.y));
}

export function calculateInclineDragPreviewGeometry(
  lowerEndpoint: ScreenPoint,
  pixelsPerMetre: number,
): { left: number; top: number; width: number; height: number } {
  const scale = Math.max(0, pixelsPerMetre);
  const width = DEFAULT_INCLINE_HORIZONTAL_LENGTH * scale;
  const height = DEFAULT_INCLINE_HORIZONTAL_LENGTH *
    Math.tan(DEFAULT_INCLINE_ANGLE_DEGREES * Math.PI / 180) * scale;
  return {
    left: lowerEndpoint.x,
    top: lowerEndpoint.y - height,
    width,
    height,
  };
}

export function getParticleDragPreviewClassName(shape: ParticleShape): string {
  return shape === "square"
    ? "particle-drag-preview is-square"
    : "particle-drag-preview";
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
  const geometry = getRenderedParticleGeometry(mathematicalPoint, camera);

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

function getParticlePlacement(
  pointer: ScreenPoint,
  options: InteractionOptions,
  snapToGrid: boolean,
): Vec2 {
  const inclines = options.getInclines();
  const freePosition = resolveParticlePlacementAgainstInclines(
    getPlacement(pointer, options, false),
    inclines,
  );
  if (snapToGrid) {
    const inclineGridSnap = findInclineGridSnap(freePosition, inclines);
    if (inclineGridSnap) return inclineGridSnap.position;
  }
  return snapToGrid
    ? resolveParticlePlacementAgainstInclines(
        getPlacement(pointer, options, true),
        inclines,
      )
    : freePosition;
}

function isInclinePlacementValid(
  position: Vec2,
  options: InteractionOptions,
  sourceInclineId?: string,
): boolean {
  const sourceIncline = sourceInclineId
    ? options.getInclines().find((incline) => incline.id === sourceInclineId)
    : undefined;
  const candidate = sourceIncline
    ? { ...sourceIncline, anchor: { ...position } }
    : createIncline("placement-preview", position);
  return canPlaceIncline(candidate, options.getInclines());
}

function isInclineLengthValid(
  incline: Incline,
  horizontalLength: number,
  options: InteractionOptions,
): boolean {
  return canPlaceIncline(
    {
      ...incline,
      horizontalLength,
      horizontalLengthInput: String(horizontalLength),
    },
    options.getInclines(),
  );
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
