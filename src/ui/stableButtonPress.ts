export interface PointerPosition {
  x: number;
  y: number;
}

const MAXIMUM_CLICK_MOVEMENT_PX = 8;

export function isStationaryButtonPress(
  start: PointerPosition,
  end: PointerPosition,
): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) <=
    MAXIMUM_CLICK_MOVEMENT_PX;
}

/**
 * Keeps a button press intact when a blur commit reflows the button between
 * pointer-down and pointer-up. Native keyboard-generated clicks still use the
 * regular click path.
 */
export function attachStableButtonPress(
  button: HTMLButtonElement,
  action: () => void,
): void {
  let activePointer: { id: number; start: PointerPosition } | null = null;
  let suppressNextClick = false;

  button.addEventListener("pointerdown", (event) => {
    if (event.button !== 0 || !event.isPrimary || button.disabled) return;
    activePointer = {
      id: event.pointerId,
      start: { x: event.clientX, y: event.clientY },
    };
    button.setPointerCapture(event.pointerId);
  });

  button.addEventListener("pointerup", (event) => {
    if (!activePointer || activePointer.id !== event.pointerId) return;
    const start = activePointer.start;
    activePointer = null;
    if (
      button.disabled ||
      !isStationaryButtonPress(start, { x: event.clientX, y: event.clientY })
    ) {
      return;
    }

    suppressNextClick = true;
    // Browsers may run a microtask checkpoint between pointer-up and the
    // synthesized click. Keep the guard through the next task so that click
    // cannot invoke the action a second time.
    setTimeout(() => {
      suppressNextClick = false;
    }, 0);
    action();
  });

  button.addEventListener("pointercancel", (event) => {
    if (activePointer?.id === event.pointerId) activePointer = null;
  });

  button.addEventListener("click", (event) => {
    if (suppressNextClick) {
      event.preventDefault();
      suppressNextClick = false;
      return;
    }
    action();
  });
}
