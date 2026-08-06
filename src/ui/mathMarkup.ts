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
      kind: "number" | "identifier" | "operator" | "text" | "space";
      value: string;
      exponent?: string;
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

    const rationalSurd = remaining.match(/^([−-]?)(\d*)√\(([^()]*)\)\/(\d+)/);
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

    const fraction = remaining.match(/^(\d+)\/(\d+)/);
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

    const identifier = remaining.match(/^[A-Za-z]/);
    if (identifier) {
      const exponent = readExponent(remaining.slice(1));
      tokens.push({
        kind: "identifier",
        value: identifier[0],
        exponent: exponent.value,
      });
      remaining = remaining.slice(1 + exponent.length);
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
      node.append(
        createMathElementWithText("mn", token.numerator),
        createMathElementWithText("mn", token.denominator),
      );
      break;
    }
    case "number":
      node = createMathElementWithText("mn", token.value);
      break;
    case "identifier":
      node = createMathElementWithText("mi", token.value, {
        mathvariant: "normal",
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
