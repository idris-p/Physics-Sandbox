export const SELECTION_PULSE_PERIOD_MS = 900;
export const MAXIMUM_SELECTION_WHITE_MIX = 0.5;

export function getSelectionWhiteMix(timestamp: number): number {
  const normalisedTime =
    ((timestamp % SELECTION_PULSE_PERIOD_MS) + SELECTION_PULSE_PERIOD_MS) %
    SELECTION_PULSE_PERIOD_MS;
  const phase = (normalisedTime / SELECTION_PULSE_PERIOD_MS) * Math.PI * 2;
  const progress = (1 - Math.cos(phase)) / 2;
  return progress * MAXIMUM_SELECTION_WHITE_MIX;
}

export function mixColourWithWhite(colour: string, amount: number): string {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(colour);
  if (!match) throw new Error(`Expected a six-digit hexadecimal colour, got ${colour}.`);

  const clampedAmount = Math.max(0, Math.min(1, amount));
  const channels = match.slice(1).map((channel) => Number.parseInt(channel, 16));
  const [red, green, blue] = channels.map((channel) =>
    Math.round(channel + (255 - channel) * clampedAmount),
  );
  return `rgb(${red}, ${green}, ${blue})`;
}
