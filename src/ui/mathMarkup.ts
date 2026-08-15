const MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML";

const SUPERSCRIPT_CHARACTERS: Record<string, string> = {
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
  "⁻": "−",
};

export type MathToken =
  | {
      kind: "fraction";
      numerator: string;
      denominator: string;
      exponent?: string;
    }
  | {
      kind: "number" | "operator" | "text" | "space";
      value: string;
      exponent?: string;
    }
  | {
      kind: "identifier";
      value: string;
      subscript?: string;
      exponent?: string;
    }
  | {
      kind: "summation";
      value: "Σ";
      exponent?: undefined;
    }
  | {
      kind: "function";
      value: "sin" | "cos" | "arctan";
      exponent?: string;
    }
  | {
      kind: "square-root";
      radicand: string;
      exponent?: string;
    }
  | {
      kind: "rational-surd";
      numeratorCoefficient: string;
      radicand: string;
      denominator: string;
      exponent?: string;
    };

export function tokenizeMathText(text: string): MathToken[] {
  const tokens: MathToken[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    const space = remaining.match(/^\s+/);
    if (space) {
      tokens.push({ kind: "space", value: " " });
      remaining = remaining.slice(space[0].length);
      continue;
    }

    const groupedFraction = readGroupedFraction(remaining);
    if (groupedFraction) {
      const exponent = readExponent(remaining.slice(groupedFraction.length));
      tokens.push({
        kind: "fraction",
        numerator: groupedFraction.numerator,
        denominator: groupedFraction.denominator,
        exponent: exponent.value,
      });
      remaining = remaining.slice(groupedFraction.length + exponent.length);
      continue;
    }

    const rationalSurd = remaining.match(
      /^([−-]?)((?:\d+(?:\.\d+)?|\.\d+)?)√\(([^()]*)\)\/((?:\d+(?:\.\d+)?|\.\d+))/,
    );
    if (rationalSurd) {
      const sign = rationalSurd[1] === "-" ? "−" : rationalSurd[1];
      tokens.push({
        kind: "rational-surd",
        numeratorCoefficient: `${sign}${rationalSurd[2] || "1"}`,
        radicand: rationalSurd[3],
        denominator: rationalSurd[4],
      });
      remaining = remaining.slice(rationalSurd[0].length);
      continue;
    }

    const squareRoot = remaining.match(/^√\(([^()]*)\)/);
    if (squareRoot) {
      tokens.push({ kind: "square-root", radicand: squareRoot[1] });
      remaining = remaining.slice(squareRoot[0].length);
      continue;
    }

    const trigFunction = remaining.match(/^(sin|cos|arctan)(?=\()/);
    if (trigFunction) {
      tokens.push({
        kind: "function",
        value: trigFunction[1] as "sin" | "cos" | "arctan",
      });
      remaining = remaining.slice(trigFunction[0].length);
      continue;
    }

    const fraction = remaining.match(
      /^((?:\d+(?:\.\d+)?|\.\d+))\/((?:\d+(?:\.\d+)?|\.\d+))/,
    );
    if (fraction) {
      const [matched, numerator, denominator] = fraction;
      const exponent = readExponent(remaining.slice(matched.length));
      tokens.push({ kind: "fraction", numerator, denominator, exponent: exponent.value });
      remaining = remaining.slice(matched.length + exponent.length);
      continue;
    }

    const number = remaining.match(/^(?:\d+(?:\.\d+)?|\.\d+)/);
    if (number) {
      const exponent = readExponent(remaining.slice(number[0].length));
      tokens.push({ kind: "number", value: number[0], exponent: exponent.value });
      remaining = remaining.slice(number[0].length + exponent.length);
      continue;
    }

    if (remaining.startsWith("Σ")) {
      tokens.push({ kind: "summation", value: "Σ" });
      remaining = remaining.slice(1);
      continue;
    }

    const identifier = remaining.match(/^[A-Za-z]/);
    if (identifier) {
      const subscript = remaining.slice(1).match(/^_([A-Za-z0-9∥⊥])/u);
      const identifierLength = 1 + (subscript?.[0].length ?? 0);
      const exponent = readExponent(remaining.slice(identifierLength));
      const token: Extract<MathToken, { kind: "identifier" }> = {
        kind: "identifier",
        value: identifier[0],
        exponent: exponent.value,
      };
      if (subscript) token.subscript = subscript[1];
      tokens.push(token);
      remaining = remaining.slice(identifierLength + exponent.length);
      continue;
    }

    const character = remaining[0];
    if ("=+−-±()[]·×≈".includes(character)) {
      tokens.push({ kind: "operator", value: normaliseOperator(character) });
    } else {
      tokens.push({ kind: "text", value: character });
    }
    remaining = remaining.slice(1);
  }

  return tokens;
}

export function createMathExpression(text: string): Element {
  const math = createMathElement("math");
  math.setAttribute("class", "suvat-math");
  math.setAttribute("aria-label", text);
  math.append(...createMathNodes(text));
  return math;
}

export function splitBreakableMathText(text: string): string[] {
  const chunks: string[] = [];
  let chunkStart = 0;
  let bracketDepth = 0;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === "(" || character === "[") {
      bracketDepth += 1;
      continue;
    }
    if (character === ")" || character === "]") {
      bracketDepth = Math.max(0, bracketDepth - 1);
      continue;
    }
    if (bracketDepth !== 0 || !"=+−-".includes(character)) continue;

    const precedingText = text.slice(chunkStart, index).trimEnd();
    const previousCharacter = precedingText.at(-1);
    const isUnarySign = character !== "=" && (
      precedingText.length === 0 ||
      previousCharacter === "=" ||
      previousCharacter === "+" ||
      previousCharacter === "−" ||
      previousCharacter === "-" ||
      previousCharacter === "±" ||
      previousCharacter === "·" ||
      previousCharacter === "×"
    );
    if (isUnarySign || precedingText.length === 0) continue;

    chunks.push(precedingText);
    chunkStart = index;
  }

  const finalChunk = text.slice(chunkStart).trim();
  if (finalChunk) chunks.push(finalChunk);
  return chunks.length > 0 ? chunks : [text];
}

export function createBreakableMathExpression(text: string): HTMLElement {
  const expression = document.createElement("span");
  expression.className = "breakable-math-expression";
  expression.setAttribute("aria-label", text);
  expression.append(...splitBreakableMathText(text).map((chunk) => {
    const math = createMathExpression(chunk);
    math.classList.add("math-break-chunk");
    math.setAttribute("aria-hidden", "true");
    return math;
  }));
  return expression;
}

export interface ForceEquationExpression {
  element: HTMLElement;
  finalAnswer: HTMLElement;
}

export function createForceResolutionExpression(
  axis: "x" | "y" | "parallel" | "perpendicular",
  terms: string,
  resultant: string,
  breakable = false,
): ForceEquationExpression {
  const axisSymbol = getForceAxisSymbol(axis);
  const ariaLabel = `sum of forces in ${axis}, equals ${terms}, equals ${resultant} newtons`;
  if (breakable) {
    return createBreakableForceEquationExpression(
      [`ΣF_${axisSymbol}`, ...splitBreakableMathText(`= ${terms}`)],
      resultant,
      "N",
      ariaLabel,
    );
  }
  return createForceEquationExpression(
    createMathExpression(`ΣF_${axisSymbol} = ${terms} = `),
    resultant,
    "N",
    ariaLabel,
  );
}

export function createForceAccelerationExpression(
  axis: "x" | "y" | "parallel" | "perpendicular",
  resultant: string,
  mass: string,
  acceleration: string,
  breakable = false,
): ForceEquationExpression {
  const axisSymbol = getForceAxisSymbol(axis);
  const ariaLabel = `a ${axis}, equals F ${axis} divided by m, equals ${resultant} divided by ${mass}, equals ${acceleration} metres per second squared`;
  if (breakable) {
    const leadingTerm = createMathExpression(`a_${axisSymbol}`);
    leadingTerm.classList.add("math-break-chunk");
    const symbolicTerm = createForceFractionChunk(
      `F_${axisSymbol}`,
      "m",
    );
    const substitutedTerm = createForceFractionChunk(resultant, mass);
    return createBreakableForceEquationExpression(
      [leadingTerm, symbolicTerm, substitutedTerm],
      acceleration,
      "m s⁻²",
      ariaLabel,
    );
  }
  const math = createMathElement("math");
  math.setAttribute("class", "suvat-math");
  math.setAttribute(
    "aria-label",
    `a ${axis}, equals F ${axis} divided by m, equals ${resultant} divided by ${mass}, equals`,
  );
  const symbolicFraction = createMathElement("mfrac");
  const symbolicNumerator = createMathElement("mrow");
  symbolicNumerator.append(...createMathNodes(`F_${axisSymbol}`));
  const symbolicDenominator = createMathElement("mrow");
  symbolicDenominator.append(...createMathNodes("m"));
  symbolicFraction.append(symbolicNumerator, symbolicDenominator);
  const substitutedFraction = createMathElement("mfrac");
  const substitutedNumerator = createMathElement("mrow");
  substitutedNumerator.append(...createMathNodes(resultant));
  const substitutedDenominator = createMathElement("mrow");
  substitutedDenominator.append(...createMathNodes(mass));
  substitutedFraction.append(substitutedNumerator, substitutedDenominator);
  math.append(
    ...createMathNodes(`a_${axisSymbol} = `),
    symbolicFraction,
    ...createMathNodes(" = "),
    substitutedFraction,
    ...createMathNodes(" = "),
  );
  return createForceEquationExpression(
    math,
    acceleration,
    "m s⁻²",
    ariaLabel,
  );
}

function createForceFractionChunk(
  numeratorText: string,
  denominatorText: string,
): Element {
  const math = createMathElement("math");
  math.setAttribute("class", "suvat-math math-break-chunk");
  const fraction = createMathElement("mfrac");
  const numerator = createMathElement("mrow");
  numerator.append(...createMathNodes(numeratorText));
  const denominator = createMathElement("mrow");
  denominator.append(...createMathNodes(denominatorText));
  fraction.append(numerator, denominator);
  math.append(...createMathNodes("= "), fraction);
  return math;
}

function getForceAxisSymbol(
  axis: "x" | "y" | "parallel" | "perpendicular",
): "x" | "y" | "∥" | "⊥" {
  if (axis === "parallel") return "∥";
  if (axis === "perpendicular") return "⊥";
  return axis;
}

function createForceEquationExpression(
  working: Element,
  result: string,
  unit: string,
  ariaLabel: string,
): ForceEquationExpression {
  const element = document.createElement("span");
  element.className = "force-equation-expression";
  element.setAttribute("aria-label", ariaLabel);
  const finalAnswer = document.createElement("span");
  finalAnswer.className = "force-final-answer";
  finalAnswer.append(createMathExpression(result));
  element.append(
    working,
    finalAnswer,
    createMathExpression(` ${unit}`),
  );
  return { element, finalAnswer };
}

function createBreakableForceEquationExpression(
  workingChunks: Array<string | Element>,
  result: string,
  unit: string,
  ariaLabel: string,
): ForceEquationExpression {
  const element = document.createElement("span");
  element.className = "force-equation-expression breakable-force-equation";
  element.setAttribute("aria-label", ariaLabel);
  for (const chunk of workingChunks) {
    const math = typeof chunk === "string" ? createMathExpression(chunk) : chunk;
    math.classList.add("math-break-chunk");
    math.setAttribute("aria-hidden", "true");
    element.append(math);
  }

  const resultChunk = document.createElement("span");
  resultChunk.className = "force-equation-result-chunk math-break-chunk";
  const equals = createMathExpression("=");
  equals.setAttribute("aria-hidden", "true");
  const finalAnswer = document.createElement("span");
  finalAnswer.className = "force-final-answer";
  finalAnswer.append(createMathExpression(result));
  const unitExpression = createMathExpression(` ${unit}`);
  unitExpression.setAttribute("aria-hidden", "true");
  resultChunk.append(equals, finalAnswer, unitExpression);
  element.append(resultChunk);
  return { element, finalAnswer };
}

export function createMathResult(
  value: string,
  unit: string,
  rounded: boolean,
): Element {
  const math = createMathElement("math");
  math.setAttribute("class", "suvat-math");
  const spokenText = `equals ${value} ${unit}${rounded ? ", to 3 decimal places" : ""}`;
  math.setAttribute("aria-label", spokenText);
  math.append(
    createMathElementWithText("mo", "="),
    ...createMathNodes(value),
    createMathElementWithText("mspace", "", { width: "0.35em" }),
    ...createMathNodes(unit),
  );

  if (rounded) {
    math.append(
      createMathElementWithText("mspace", "", { width: "0.45em" }),
      createMathElementWithText("mtext", "(3 d.p.)"),
    );
  }

  return math;
}

export function createSquareRootExpression(
  radicand: string,
  sign: "positive" | "negative" | "both" = "positive",
): Element {
  const math = createMathElement("math");
  math.setAttribute("class", "suvat-math");
  math.setAttribute(
    "aria-label",
    `v equals ${
      sign === "both"
        ? "plus or minus "
        : sign === "negative"
          ? "negative "
          : ""
    }the square root of ${radicand}`,
  );

  const squareRoot = createMathElement("msqrt");
  squareRoot.append(...createMathNodes(radicand));
  math.append(
    createMathElementWithText("mi", "v", { mathvariant: "normal" }),
    createMathElementWithText("mo", "="),
  );
  if (sign === "negative") math.append(createMathElementWithText("mo", "−"));
  if (sign === "both") math.append(createMathElementWithText("mo", "±"));
  math.append(squareRoot);
  return math;
}

export function createSquareRootValue(
  radicand: string,
  negative: boolean,
): Element {
  const math = createMathElement("math");
  math.setAttribute("class", "suvat-math");
  math.setAttribute(
    "aria-label",
    `${negative ? "negative " : ""}the square root of ${radicand}`,
  );

  if (negative) math.append(createMathElementWithText("mo", "−"));
  const squareRoot = createMathElement("msqrt");
  squareRoot.append(...createMathNodes(radicand));
  math.append(squareRoot);
  return math;
}

export function createQuadraticSurdValue(
  linearTerm: string,
  radicand: string,
  denominator: string,
  radicalSign: "plus" | "minus" = "plus",
): Element {
  const math = createMathElement("math");
  math.setAttribute("class", "suvat-math");
  math.setAttribute(
    "aria-label",
    `${linearTerm} ${radicalSign} the square root of ${radicand}, divided by ${denominator}`,
  );

  const numerator = createMathElement("mrow");
  const squareRoot = createMathElement("msqrt");
  squareRoot.append(...createMathNodes(radicand));
  numerator.append(
    ...createMathNodes(linearTerm),
    createMathElementWithText("mo", radicalSign === "plus" ? "+" : "−"),
    squareRoot,
  );

  if (denominator === "1") {
    math.append(numerator);
    return math;
  }

  const fraction = createMathElement("mfrac");
  const denominatorRow = createMathElement("mrow");
  denominatorRow.append(...createMathNodes(denominator));
  fraction.append(numerator, denominatorRow);
  math.append(fraction);
  return math;
}

export function createRationalSurdValue(
  numeratorCoefficient: string,
  radicand: string,
  denominator: string,
): Element {
  const math = createMathElement("math");
  math.setAttribute("class", "suvat-math");
  math.setAttribute(
    "aria-label",
    `${numeratorCoefficient} times the square root of ${radicand}, divided by ${denominator}`,
  );
  math.append(
    createRationalSurdNode(numeratorCoefficient, radicand, denominator),
  );
  return math;
}

function createMathNodes(text: string): Element[] {
  return tokenizeMathText(text).map(createTokenNode);
}

function createTokenNode(token: MathToken): Element {
  let node: Element;

  switch (token.kind) {
    case "fraction": {
      node = createMathElement("mfrac");
      const numerator = createMathElement("mrow");
      numerator.append(...createMathNodes(token.numerator));
      const denominator = createMathElement("mrow");
      denominator.append(...createMathNodes(token.denominator));
      node.append(numerator, denominator);
      break;
    }
    case "number":
      node = createMathElementWithText("mn", token.value);
      break;
    case "identifier": {
      node = createMathElementWithText("mi", token.value, {
        mathvariant: "normal",
      });
      if (token.subscript) node = createSubscript(node, token.subscript);
      break;
    }
    case "summation":
      node = createMathElementWithText("mo", token.value, {
        class: "summation-symbol",
        lspace: "0",
        rspace: "0",
      });
      break;
    case "function":
      node = createMathElementWithText("mi", token.value, {
        mathvariant: "normal",
      });
      break;
    case "square-root": {
      node = createMathElement("msqrt");
      node.append(...createMathNodes(token.radicand));
      break;
    }
    case "rational-surd":
      node = createRationalSurdNode(
        token.numeratorCoefficient,
        token.radicand,
        token.denominator,
      );
      break;
    case "operator":
      node = createMathElementWithText("mo", token.value);
      break;
    case "space":
      node = createMathElementWithText("mspace", "", { width: "0.28em" });
      break;
    case "text":
      node = createMathElementWithText("mtext", token.value);
      break;
  }

  return token.exponent ? createSuperscript(node, token.exponent) : node;
}

function createRationalSurdNode(
  numeratorCoefficient: string,
  radicand: string,
  denominator: string,
): Element {
  const numerator = createMathElement("mrow");
  if (numeratorCoefficient === "−1" || numeratorCoefficient === "-1") {
    numerator.append(createMathElementWithText("mo", "−"));
  } else if (numeratorCoefficient !== "1") {
    numerator.append(...createMathNodes(numeratorCoefficient));
  }
  const squareRoot = createMathElement("msqrt");
  squareRoot.append(...createMathNodes(radicand));
  numerator.append(squareRoot);

  if (denominator === "1") return numerator;
  const fraction = createMathElement("mfrac");
  const denominatorRow = createMathElement("mrow");
  denominatorRow.append(...createMathNodes(denominator));
  fraction.append(numerator, denominatorRow);
  return fraction;
}

function createSuperscript(base: Element, exponent: string): Element {
  const superscript = createMathElement("msup");
  const exponentRow = createMathElement("mrow");
  for (const character of exponent) {
    exponentRow.append(
      createMathElementWithText(character === "−" ? "mo" : "mn", character),
    );
  }
  superscript.append(base, exponentRow);
  return superscript;
}

function createSubscript(base: Element, subscript: string): Element {
  const node = createMathElement("msub");
  const subscriptNode = subscript === "∥"
    ? createParallelSubscript()
    : createMathElementWithText(
        /^\d$/.test(subscript) ? "mn" : "mi",
        subscript,
        { mathvariant: "normal" },
      );
  node.append(
    base,
    subscriptNode,
  );
  return node;
}

function createParallelSubscript(): Element {
  const symbol = createMathElement("mrow");
  symbol.setAttribute("aria-label", "parallel");
  symbol.append(
    createMathElementWithText("mo", "∣", { lspace: "0", rspace: "0" }),
    createMathElementWithText("mspace", "", { width: "0.14em" }),
    createMathElementWithText("mo", "∣", { lspace: "0", rspace: "0" }),
  );
  return symbol;
}

function readExponent(text: string): { value?: string; length: number } {
  let value = "";
  let length = 0;
  for (const character of text) {
    const normalised = SUPERSCRIPT_CHARACTERS[character];
    if (normalised === undefined) break;
    value += normalised;
    length += character.length;
  }
  return { value: value || undefined, length };
}

function readGroupedFraction(
  text: string,
): { numerator: string; denominator: string; length: number } | null {
  if (!text.startsWith("(")) return null;
  let depth = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "(") depth += 1;
    if (text[index] !== ")") continue;
    depth -= 1;
    if (depth !== 0) continue;
    const denominator = text.slice(index + 1).match(
      /^\/((?:\d+(?:\.\d+)?|\.\d+))/,
    );
    if (!denominator) return null;
    return {
      numerator: text.slice(1, index),
      denominator: denominator[1],
      length: index + 1 + denominator[0].length,
    };
  }
  return null;
}

function normaliseOperator(operator: string): string {
  return operator === "-" ? "−" : operator;
}

function createMathElement(name: string): Element {
  return document.createElementNS(MATHML_NAMESPACE, name);
}

function createMathElementWithText(
  name: string,
  text: string,
  attributes: Record<string, string> = {},
): Element {
  const element = createMathElement(name);
  element.textContent = text;
  for (const [attribute, value] of Object.entries(attributes)) {
    element.setAttribute(attribute, value);
  }
  return element;
}
