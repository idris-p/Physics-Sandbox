import type { CanvasMathLabel } from "../canvas/renderer";
import { createMathExpression } from "./mathMarkup";

export function renderCanvasMathLabels(
  overlay: HTMLElement,
  labels: readonly CanvasMathLabel[],
): void {
  labels.forEach((label, index) => {
    const existing = overlay.children.item(index);
    const element = existing instanceof HTMLElement
      ? existing
      : createCanvasMathLabelElement(overlay);
    if (element.dataset.mathText !== label.text) {
      element.dataset.mathText = label.text;
      element.replaceChildren(createMathExpression(label.text));
    }
    element.style.left = `${label.position.x}px`;
    element.style.top = `${label.position.y}px`;
    element.style.fontSize = `${label.fontSize}px`;
    element.style.color = label.colour;
  });

  while (overlay.children.length > labels.length) {
    overlay.lastElementChild?.remove();
  }
}

function createCanvasMathLabelElement(overlay: HTMLElement): HTMLElement {
  const element = document.createElement("span");
  element.className = "canvas-math-label";
  overlay.append(element);
  return element;
}
