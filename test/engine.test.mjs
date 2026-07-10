import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { Frac, F, UNIT_TO_IN, roundToDen, fracToMixedString, fmtNum, parseLengthText, applyOp } = require("../engine.js");

let count = 0;
function test(name, fn) {
  try { fn(); count++; }
  catch (e) { console.error(`✗ ${name}\n  ${e.message}`); process.exitCode = 1; return; }
  console.log(`✓ ${name}`);
}

const inch = (txt) => parseLengthText(txt);
const len = (txt, unit = "in") => ({ fr: inch(txt).mul(UNIT_TO_IN[unit]), dim: 1 });

test("suma de fracciones: 3 1/2 + 5/8 = 4 1/8", () => {
  const r = applyOp(len("3 1/2"), "+", len("5/8"));
  assert.equal(fracToMixedString(r.fr), "4 1/8″");
});

test("resta con resultado negativo: 1/4 − 1/2 = −1/4", () => {
  const r = applyOp(len("1/4"), "-", len("1/2"));
  assert.equal(fracToMixedString(r.fr), "−1/4″");
});

test("unidades mezcladas: 1 pulg + 25.4 mm = 2 pulg exactas", () => {
  const r = applyOp(len("1"), "+", len("25.4", "mm"));
  assert.equal(r.fr.cmp(F(2n)), 0);
});

test("30 cm + 2 1/2 pulg ≈ 14.31 pulg", () => {
  const r = applyOp(len("30", "cm"), "+", len("2 1/2"));
  assert.ok(Math.abs(r.fr.toNumber() - (30 / 2.54 + 2.5)) < 1e-12);
});

test("longitud × longitud = área (dim 2)", () => {
  const r = applyOp(len("3"), "*", len("4"));
  assert.equal(r.dim, 2);
  assert.equal(r.fr.toNumber(), 12);
});

test("área × longitud = volumen; ÷ longitud vuelve a área", () => {
  const area = applyOp(len("6"), "*", len("4"));
  const vol = applyOp(area, "*", len("2"));
  assert.equal(vol.dim, 3);
  assert.equal(vol.fr.toNumber(), 48);
  const back = applyOp(vol, "/", len("2"));
  assert.equal(back.dim, 2);
});

test("sumar longitud + área lanza error", () => {
  const area = applyOp(len("2"), "*", len("2"));
  assert.throws(() => applyOp(len("1"), "+", area));
});

test("división entre cero lanza error", () => {
  assert.throws(() => len("1").fr.div(F(0n)));
});

test("redondeo a 1/16: 10 mm → 6/16 = 3/8 (no exacto)", () => {
  const frIn = F(10n).mul(UNIT_TO_IN.mm); // 50/127
  const { rounded, exact } = roundToDen(frIn, 16);
  assert.equal(fracToMixedString(rounded), "3/8″");
  assert.equal(exact, false);
});

test("redondeo exacto: 1/2 a 1/16 sigue siendo 1/2 y exact=true", () => {
  const { rounded, exact } = roundToDen(inch("1/2"), 16);
  assert.equal(exact, true);
  assert.equal(fracToMixedString(rounded), "1/2″");
});

test("redondeo negativo simétrico: −10 mm → −3/8", () => {
  const frIn = F(-10n).mul(UNIT_TO_IN.mm);
  const { rounded } = roundToDen(frIn, 16);
  assert.equal(fracToMixedString(rounded), "−3/8″");
});

test("parseLengthText acepta variantes", () => {
  assert.equal(inch("3 1/2").toNumber(), 3.5);
  assert.equal(inch("3+1/2").toNumber(), 3.5);
  assert.equal(inch("5/8").toNumber(), 0.625);
  assert.equal(inch("2.5").toNumber(), 2.5);
  assert.equal(inch("2,5").toNumber(), 2.5);
  assert.equal(inch('-1 3/4"').toNumber(), -1.75);
  assert.equal(inch("7").toNumber(), 7);
});

test("parseLengthText rechaza entradas inválidas", () => {
  assert.equal(inch("abc"), null);
  assert.equal(inch("1/0"), null);
  assert.equal(inch(""), null);
  assert.equal(inch("1 2 3"), null);
});

test("conversión exacta: 1 pie = 304.8 mm", () => {
  const mm = UNIT_TO_IN.ft.mul(F(127n, 5n));
  assert.equal(mm.toNumber(), 304.8);
});

test("fmtNum recorta ceros y no da -0", () => {
  assert.equal(fmtNum(2.5), "2.5");
  assert.equal(fmtNum(3), "3");
  assert.equal(fmtNum(-0.00001, 2), "0");
  assert.equal(fmtNum(1234.5678, 2), "1234.57");
});

test("Frac.fromNumber aproxima bien", () => {
  assert.ok(Math.abs(Frac.fromNumber(Math.SQRT2).toNumber() - Math.SQRT2) < 1e-6);
});

test("aritmética encadenada sin pérdida: (1/3 pulg × 3) = 1 exacto", () => {
  const r = len("1/3").fr.mul(F(3n));
  assert.equal(r.cmp(F(1n)), 0);
});

console.log(`\n${count} pruebas pasaron`);
