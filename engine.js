"use strict";

/* ==========================================================================
 * Motor de fracciones exactas para medidas de carpintería.
 * Sin dependencias del DOM: se puede probar con Node (test/engine.test.mjs).
 * ========================================================================== */

function bgcd(a, b) {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b) { [a, b] = [b, a % b]; }
  return a;
}

class Frac {
  constructor(n, d = 1n) {
    n = BigInt(n); d = BigInt(d);
    if (d === 0n) throw new Error("División entre cero");
    if (d < 0n) { n = -n; d = -d; }
    const g = bgcd(n, d) || 1n;
    this.n = n / g;
    this.d = d / g;
  }
  add(o) { return new Frac(this.n * o.d + o.n * this.d, this.d * o.d); }
  sub(o) { return new Frac(this.n * o.d - o.n * this.d, this.d * o.d); }
  mul(o) { return new Frac(this.n * o.n, this.d * o.d); }
  div(o) {
    if (o.n === 0n) throw new Error("División entre cero");
    return new Frac(this.n * o.d, this.d * o.n);
  }
  neg() { return new Frac(-this.n, this.d); }
  isZero() { return this.n === 0n; }
  isNeg() { return this.n < 0n; }
  cmp(o) { const x = this.n * o.d - o.n * this.d; return x < 0n ? -1 : x > 0n ? 1 : 0; }
  toNumber() { return Number(this.n) / Number(this.d); }
  static fromNumber(x, maxDen = 1000000) {
    // Convierte un flotante a fracción con denominador acotado.
    return new Frac(BigInt(Math.round(x * maxDen)), BigInt(maxDen));
  }
}

const F = (n, d = 1n) => new Frac(n, d);

/* Factores exactos a pulgadas: 1 in = 25.4 mm ⇒ 1 mm = 5/127 in */
const UNIT_TO_IN = {
  in: F(1n),
  ft: F(12n),
  mm: F(5n, 127n),
  cm: F(50n, 127n),
  m:  F(5000n, 127n),
};
const UNIT_LABEL = { in: "pulg", ft: "pies", mm: "mm", cm: "cm", m: "m" };

/* Redondea una fracción de pulgadas al denominador elegido (8/16/32/64). */
function roundToDen(fr, den) {
  const D = BigInt(den);
  const x = fr.n * D;          // redondear x / fr.d al entero más cercano
  const d = fr.d;
  // redondeo a mitad alejándose de cero (la división BigInt trunca hacia cero)
  const q = x >= 0n ? (2n * x + d) / (2n * d) : (2n * x - d) / (2n * d);
  const rounded = new Frac(q, D);
  return { rounded, exact: rounded.cmp(fr) === 0 };
}

/* "3 1/2″" a partir de una fracción ya redondeada. */
function fracToMixedString(fr, unitMark = "″") {
  const neg = fr.isNeg();
  const n = neg ? -fr.n : fr.n;
  const d = fr.d;
  const whole = n / d;
  const rem = n % d;
  let s = "";
  if (whole > 0n || rem === 0n) s += whole.toString();
  if (rem !== 0n) s += (whole > 0n ? " " : "") + rem.toString() + "/" + d.toString();
  return (neg ? "−" : "") + s + unitMark;
}

function fmtNum(x, dec = 4) {
  if (!isFinite(x)) return "∞";
  let s = x.toFixed(dec);
  if (s.includes(".")) s = s.replace(/\.?0+$/, "");
  return s === "-0" ? "0" : s;
}

/* Analiza "3 1/2", "5/8", "2.5", "-1 3/4" → Frac, o null si es inválido. */
function parseLengthText(text) {
  if (typeof text !== "string") return null;
  let s = text.trim().replace(/[″"']/g, "").replace(/,/g, ".").replace(/−/g, "-");
  if (!s) return null;
  let neg = false;
  if (s.startsWith("-")) { neg = true; s = s.slice(1).trim(); }
  let m;
  // entero num/den
  if ((m = s.match(/^(\d+)[ +](\d+)\/(\d+)$/))) {
    const d = BigInt(m[3]);
    if (d === 0n) return null;
    const fr = F(BigInt(m[1]) * d + BigInt(m[2]), d);
    return neg ? fr.neg() : fr;
  }
  // num/den
  if ((m = s.match(/^(\d+)\/(\d+)$/))) {
    if (m[2] === "0") return null;
    const fr = F(BigInt(m[1]), BigInt(m[2]));
    return neg ? fr.neg() : fr;
  }
  // decimal o entero
  if ((m = s.match(/^(\d+)(?:\.(\d+))?$/))) {
    const dec = m[2] || "";
    const fr = F(BigInt(m[1] + dec), 10n ** BigInt(dec.length));
    return neg ? fr.neg() : fr;
  }
  return null;
}

/* Aplica una operación respetando dimensiones (longitud × longitud = área…).
   Un valor es {fr: Frac en pulgadas^dim, dim: 0..3}. */
function applyOp(a, op, b) {
  switch (op) {
    case "+": case "-": {
      if (a.dim !== b.dim) throw new Error("No se pueden sumar unidades distintas (ej. longitud + área)");
      const fr = op === "+" ? a.fr.add(b.fr) : a.fr.sub(b.fr);
      return { fr, dim: a.dim };
    }
    case "*": {
      const dim = a.dim + b.dim;
      if (dim > 3) throw new Error("Resultado de más de 3 dimensiones");
      return { fr: a.fr.mul(b.fr), dim };
    }
    case "/": {
      const dim = a.dim - b.dim;
      if (dim < 0) throw new Error("Resultado con dimensión negativa");
      return { fr: a.fr.div(b.fr), dim };
    }
  }
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { Frac, F, UNIT_TO_IN, UNIT_LABEL, roundToDen, fracToMixedString, fmtNum, parseLengthText, applyOp };
}
