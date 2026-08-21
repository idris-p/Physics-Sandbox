import {
  drawCanvasMathValue,
  measureCanvasMathValue,
  type CanvasMathLabel,
} from "../canvas/renderer";
import type { SquareRootValueDisplay } from "../kinematics/exactDisplay";
import { createMathExpression as createMathMarkupExpression } from "./mathMarkup";

type CanvasMathValue = string | SquareRootValueDisplay;

export function createMathExpression(text: string): Element {
  return text.includes("√")
    ? createCanvasMathValueElement(text, text)
    : createMathMarkupExpression(text);
}

export function createCanvasMathValueElement(
  value: CanvasMathValue,
  ariaLabel: string,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.className = "suvat-math canvas-rendered-math";
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", ariaLabel);

  renderCanvasMathValueElement(canvas, value, 18);
  requestAnimationFrame(() => renderAttachedCanvasMathValue(canvas, value));
  void document.fonts?.ready.then(() => {
    if (canvas.isConnected) renderAttachedCanvasMathValue(canvas, value);
  });
  return canvas;
}

function renderAttachedCanvasMathValue(
  canvas: HTMLCanvasElement,
  value: CanvasMathValue,
): void {
  if (!canvas.isConnected) return;
  const fontSize = Number.parseFloat(getComputedStyle(canvas).fontSize);
  renderCanvasMathValueElement(
    canvas,
    value,
    Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 18,
  );
}

function renderCanvasMathValueElement(
  canvas: HTMLCanvasElement,
  value: CanvasMathValue,
  fontSize: number,
): void {
  const context = canvas.getContext("2d");
  if (!context) return;

  context.font = `700 ${fontSize}px "KG Primary Penmanship Alt", sans-serif`;
  const measuredWidth = measureCanvasMathValue(context, value, fontSize);
  const sourceText = typeof value === "string" ? value : value.radicand;
  const cssWidth = Math.ceil(measuredWidth + 4);
  const cssHeight = Math.ceil(fontSize * (sourceText.includes("/") ? 2.55 : 1.55));
  const pixelRatio = Math.max(1, window.devicePixelRatio || 1);

  canvas.width = Math.ceil(cssWidth * pixelRatio);
  canvas.height = Math.ceil(cssHeight * pixelRatio);
  canvas.style.width = `${cssWidth}px`;
  canvas.style.height = `${cssHeight}px`;

  const drawContext = canvas.getContext("2d");
  if (!drawContext) return;
  drawContext.scale(pixelRatio, pixelRatio);
  const colour = canvas.isConnected ? getComputedStyle(canvas).color : "#242725";
  drawContext.fillStyle = colour;
  drawContext.strokeStyle = colour;
  drawContext.font = `700 ${fontSize}px "KG Primary Penmanship Alt", sans-serif`;
  drawContext.textAlign = "left";
  drawContext.textBaseline = "middle";
  drawContext.lineCap = "round";
  drawContext.lineJoin = "round";
  drawCanvasMathValue(drawContext, value, 2, cssHeight / 2, fontSize);
}

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
