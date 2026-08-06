export type SymbolicExactDisplay = string | { kind: string };

export function isSymbolicExactDisplay(
  display: SymbolicExactDisplay,
): boolean {
  if (typeof display !== "string") return true;
  return /(?:\/|√|\b(?:sin|cos|arctan)[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]*\s*\()/u.test(display);
}

export function formatExactValueTooltip(value: number): string {
  const rounded = Number(value.toFixed(3));
  return `${Object.is(rounded, -0) ? "0.000" : rounded.toFixed(3)} (3 d.p.)`;
}

export function getExactValueTooltip(
  display: SymbolicExactDisplay,
  value: number,
): string | null {
  return Number.isFinite(value) && isSymbolicExactDisplay(display)
    ? formatExactValueTooltip(value)
    : null;
}
