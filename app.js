"use strict";

/* La aritmética de fracciones (Frac, roundToDen, parseLengthText, applyOp…)
 * vive en engine.js, cargado antes que este archivo. */

let precisionDen = 16; // denominador global de redondeo (8/16/32/64)

/* Formatea pulgadas exactas como fracción redondeada + nota de error */
function formatInchesAsFraction(frIn, den = precisionDen) {
  const { rounded, exact } = roundToDen(frIn, den);
  let s = fracToMixedString(rounded);
  if (!exact) {
    const errMm = frIn.sub(rounded).mul(F(127n, 5n)).toNumber();
    const sign = errMm > 0 ? "+" : "−";
    s += ` <span class="note">(≈, error ${sign}${Math.abs(errMm).toFixed(2)} mm)</span>`;
  }
  return s;
}

/* Bloque de conversión completo para una longitud en pulgadas */
function lengthReport(frIn) {
  const inches = frIn.toNumber();
  const mm = frIn.mul(F(127n, 5n)).toNumber();
  const rows = [];
  rows.push(`<div class="big">${formatInchesAsFraction(frIn)}</div>`);
  const absIn = Math.abs(inches);
  if (absIn >= 12) {
    const ftPart = Math.trunc(inches / 12);
    const inPart = frIn.sub(F(BigInt(ftPart) * 12n));
    rows.push(`${ftPart}′ ${formatInchesAsFraction(inPart)}`);
  }
  rows.push(`${fmtNum(inches)} pulg decimales`);
  rows.push(`<b>${fmtNum(mm, 2)} mm</b> · ${fmtNum(mm / 10, 3)} cm` + (Math.abs(mm) >= 1000 ? ` · ${fmtNum(mm / 1000, 4)} m` : ""));
  return rows.join("<br>");
}

/* Reporte para áreas (pulg²) y volúmenes (pulg³) */
function areaReport(frIn2) {
  const in2 = frIn2.toNumber();
  const cm2 = in2 * 6.4516;
  const out = [`<div class="big">${fmtNum(in2)} pulg²</div>`];
  out.push(`${fmtNum(in2 / 144, 4)} pies²`);
  out.push(`<b>${fmtNum(cm2, 2)} cm²</b>` + (cm2 >= 10000 ? ` · ${fmtNum(cm2 / 10000, 4)} m²` : ""));
  return out.join("<br>");
}

function volumeReport(frIn3) {
  const in3 = frIn3.toNumber();
  const cm3 = in3 * 16.387064;
  const out = [`<div class="big">${fmtNum(in3)} pulg³</div>`];
  out.push(`<b>${fmtNum(in3 / 144, 3)} pies tablares</b> · ${fmtNum(in3 / 1728, 4)} pies³`);
  out.push(`${fmtNum(cm3, 1)} cm³ · ${fmtNum(cm3 / 1000, 3)} L` + (cm3 >= 100000 ? ` · ${fmtNum(cm3 / 1e6, 4)} m³` : ""));
  return out.join("<br>");
}

/* Reporte según dimensión (0 = escalar, 1 = longitud, 2 = área, 3 = volumen) */
function valueReport(val) {
  switch (val.dim) {
    case 0: {
      const parts = [`<div class="big">${fracToMixedString(val.fr, "")}</div>`];
      if (val.fr.d !== 1n) parts.push(`${fmtNum(val.fr.toNumber(), 6)} decimal`);
      return parts.join("<br>");
    }
    case 1: return lengthReport(val.fr);
    case 2: return areaReport(val.fr);
    case 3: return volumeReport(val.fr);
    default: return `<span class="err">Dimensión no soportada</span>`;
  }
}

function shortValue(val) {
  switch (val.dim) {
    case 0: return fracToMixedString(val.fr, "");
    case 1: return fracToMixedString(roundToDen(val.fr, precisionDen).rounded);
    case 2: return fmtNum(val.fr.toNumber()) + " pulg²";
    case 3: return fmtNum(val.fr.toNumber()) + " pulg³";
  }
}

/* Lee un campo de texto + selector de unidad → Frac en pulgadas, o null */
function readLengthField(inputId, unitId) {
  const raw = document.getElementById(inputId).value;
  if (!raw.trim()) return null;
  const fr = parseLengthText(raw);
  if (fr === null) return undefined; // undefined = texto inválido
  const unit = document.getElementById(unitId) ? document.getElementById(unitId).value : "in";
  return fr.mul(UNIT_TO_IN[unit]);
}

/* ==========================================================================
 * Calculadora principal
 * ========================================================================== */

const calc = {
  acc: null,          // {fr: Frac(en pulgadas^dim), dim: 0..3}
  pendingOp: null,    // "+", "-", "*", "/"
  exprParts: [],      // texto de la expresión
  justEvaluated: false,
  entry: null,
};

function newEntry() {
  return { whole: "", num: "", den: "", mode: "whole", unit: "in", decimal: false };
}
calc.entry = newEntry();

function entryIsEmpty(e) { return e.whole === "" && e.num === "" && e.den === ""; }

function entryText(e) {
  let s = "";
  if (e.mode === "whole") s = e.whole || "0";
  else {
    if (e.whole !== "") s = e.whole + " ";
    s += (e.num || "0") + "⁄" + (e.mode === "den" ? (e.den || "▂") : "▂");
  }
  return s + " " + UNIT_LABEL[e.unit];
}

/* Convierte la entrada a {fr(en pulgadas), dim:1} o escalar si así se usa */
function entryToValue(e) {
  let fr;
  if (e.mode === "whole") {
    const w = e.whole || "0";
    if (e.decimal) {
      const [i, dec = ""] = w.split(".");
      fr = F(BigInt((i || "0") + dec), 10n ** BigInt(dec.length));
    } else {
      fr = F(BigInt(w || "0"));
    }
  } else {
    const den = BigInt(e.den || "0");
    if (den === 0n) throw new Error("Fracción incompleta: falta el denominador");
    fr = F(BigInt(e.whole || "0") * den + BigInt(e.num || "0"), den);
  }
  return { fr: fr.mul(UNIT_TO_IN[e.unit]), dim: 1 };
}

const OP_LABEL = { "+": "+", "-": "−", "*": "×", "/": "÷" };

const elExpr = document.getElementById("calcExpr");
const elEntry = document.getElementById("calcEntry");
const elLive = document.getElementById("calcLive");
const elResult = document.getElementById("calcResult");

function renderCalc() {
  elExpr.innerHTML = calc.exprParts.join(" ") || "&nbsp;";
  if (!entryIsEmpty(calc.entry)) {
    elEntry.textContent = entryText(calc.entry);
    // conversión en vivo mientras se escribe
    try {
      const v = entryToValue(calc.entry);
      const mm = v.fr.mul(F(127n, 5n)).toNumber();
      elLive.textContent = `= ${fmtNum(v.fr.toNumber(), 3)}″ · ${fmtNum(mm, 2)} mm · ${formatInchesAsFraction(v.fr).replace(/<[^>]*>/g, "")}`;
    } catch { elLive.innerHTML = "&nbsp;"; }
  } else if (calc.acc) {
    elEntry.textContent = shortValue(calc.acc);
    elLive.innerHTML = "&nbsp;";
  } else {
    elEntry.textContent = "0";
    elLive.innerHTML = "&nbsp;";
  }
}

function calcError(msg) {
  elResult.hidden = false;
  elResult.innerHTML = `<span class="err">⚠ ${msg}</span>`;
}

function commitEntry() {
  if (entryIsEmpty(calc.entry)) return false;
  const v = entryToValue(calc.entry);
  calc.exprParts.push(entryText(calc.entry));
  calc.acc = calc.pendingOp && calc.acc ? applyOp(calc.acc, calc.pendingOp, v) : v;
  calc.pendingOp = null;
  calc.entry = newEntry();
  return true;
}

function pressKey(k) {
  try {
    elResult.hidden = true;
    const e = calc.entry;

    if (k >= "0" && k <= "9") {
      if (calc.justEvaluated) { clearCalc(false); }
      const ee = calc.entry;
      if (ee.mode === "whole") ee.whole += k;
      else if (ee.mode === "num") ee.num += k;
      else ee.den += k;
    } else if (k === ".") {
      if (calc.justEvaluated) { clearCalc(false); }
      const ee = calc.entry;
      if (ee.mode !== "whole") return; // sin decimales dentro de la fracción
      if (!ee.whole.includes(".")) { ee.whole = (ee.whole || "0") + "."; ee.decimal = true; }
    } else if (k === "sp") {
      // separa entero de fracción: sólo con entero ya escrito y sin decimal
      if (e.mode === "whole" && e.whole !== "" && !e.decimal) e.mode = "num";
    } else if (k === "frac") {
      if (e.decimal) return;
      if (e.mode === "whole") {
        // "5 ⁄" ⇒ el 5 es numerador
        if (e.whole === "") return;
        e.num = e.whole; e.whole = ""; e.mode = "den";
      } else if (e.mode === "num" && e.num !== "") {
        e.mode = "den";
      }
    } else if (k === "bs") {
      if (e.mode === "den" && e.den !== "") e.den = e.den.slice(0, -1);
      else if (e.mode === "den") { e.mode = e.whole !== "" ? "num" : "whole"; if (e.whole === "") { e.whole = e.num; e.num = ""; } }
      else if (e.mode === "num" && e.num !== "") e.num = e.num.slice(0, -1);
      else if (e.mode === "num") e.mode = "whole";
      else if (e.whole !== "") {
        if (e.whole.endsWith(".")) e.decimal = false;
        e.whole = e.whole.slice(0, -1);
        if (!e.whole.includes(".")) e.decimal = false;
      } else if (calc.pendingOp) {
        calc.pendingOp = null; calc.exprParts.pop();
      }
    } else if (k === "C") {
      clearCalc(true);
    } else if (k === "+" || k === "-" || k === "*" || k === "/op") {
      const op = k === "/op" ? "/" : k;
      calc.justEvaluated = false;
      if (!entryIsEmpty(calc.entry)) {
        commitEntry();
        calc.pendingOp = op;
        calc.exprParts.push(OP_LABEL[op]);
      } else if (calc.acc) {
        if (calc.pendingOp) calc.exprParts.pop();
        else if (calc.exprParts.length === 0) calc.exprParts.push(shortValue(calc.acc));
        calc.pendingOp = op;
        calc.exprParts.push(OP_LABEL[op]);
      }
    } else if (k === "=") {
      if (entryIsEmpty(calc.entry) && !calc.pendingOp) {
        if (calc.acc) showCalcResult();
        renderCalc();
        return;
      }
      if (calc.pendingOp && entryIsEmpty(calc.entry)) throw new Error("Falta el segundo número");
      commitEntry();
      showCalcResult();
      addHistory(calc.exprParts.join(" "), calc.acc);
      calc.exprParts = [shortValue(calc.acc), "="];
      calc.justEvaluated = true;
    }
    renderCalc();
  } catch (err) {
    calcError(err.message);
  }
}

function showCalcResult() {
  elResult.hidden = false;
  elResult.innerHTML = valueReport(calc.acc);
}

function clearCalc(full) {
  calc.entry = newEntry();
  calc.entry.unit = currentUnit;
  calc.exprParts = [];
  calc.pendingOp = null;
  calc.justEvaluated = false;
  if (full) { calc.acc = null; elResult.hidden = true; }
  else calc.acc = null;
}

/* Teclado */
document.getElementById("keypad").addEventListener("click", (ev) => {
  const btn = ev.target.closest(".key");
  if (btn) pressKey(btn.dataset.k);
});

/* Unidad de la entrada actual */
let currentUnit = "in";
document.getElementById("unitRow").addEventListener("click", (ev) => {
  const btn = ev.target.closest(".unit-chip");
  if (!btn) return;
  currentUnit = btn.dataset.unit;
  calc.entry.unit = currentUnit;
  document.querySelectorAll(".unit-chip").forEach(c => c.classList.toggle("active", c === btn));
  renderCalc();
});

/* Precisión global */
document.getElementById("precisionRow").addEventListener("click", (ev) => {
  const btn = ev.target.closest(".chip");
  if (!btn) return;
  precisionDen = parseInt(btn.dataset.den, 10);
  localStorage.setItem("carp.precision", String(precisionDen));
  document.querySelectorAll("#precisionRow .chip").forEach(c => c.classList.toggle("active", c === btn));
  renderCalc();
  if (!elResult.hidden && calc.acc) showCalcResult();
  runConverter();
});

/* Teclado físico */
document.addEventListener("keydown", (ev) => {
  if (ev.target.matches("input, select, textarea")) return;
  const map = { "+": "+", "-": "-", "*": "*", "x": "*", "/": "frac", "Enter": "=", "=": "=", "Backspace": "bs", "Escape": "C", " ": "sp", ".": "." };
  if (ev.key >= "0" && ev.key <= "9") { pressKey(ev.key); ev.preventDefault(); }
  else if (map[ev.key] !== undefined) { pressKey(map[ev.key]); ev.preventDefault(); }
});

/* ==========================================================================
 * Pestañas
 * ========================================================================== */

document.querySelector(".tab-bar").addEventListener("click", (ev) => {
  const btn = ev.target.closest(".tab-btn");
  if (!btn) return;
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.toggle("active", b === btn));
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("active", p.id === "tab-" + btn.dataset.tab));
  if (btn.dataset.tab === "hist") renderHistory();
});

/* ==========================================================================
 * Conversor
 * ========================================================================== */

const convInput = document.getElementById("convInput");
const convUnit = document.getElementById("convUnit");
const convResult = document.getElementById("convResult");

function runConverter() {
  const raw = convInput.value.trim();
  if (!raw) { convResult.hidden = true; return; }
  const fr = parseLengthText(raw);
  convResult.hidden = false;
  if (fr === null) {
    convResult.innerHTML = `<span class="err">⚠ No entiendo esa medida. Ejemplos: 3 1/2 · 5/8 · 2.5</span>`;
    return;
  }
  const frIn = fr.mul(UNIT_TO_IN[convUnit.value]);
  convResult.innerHTML = lengthReport(frIn);
}
convInput.addEventListener("input", runConverter);
convUnit.addEventListener("change", runConverter);

/* ==========================================================================
 * Pies tablares
 * ========================================================================== */

document.getElementById("bfCalc").addEventListener("click", () => {
  const out = document.getElementById("bfResult");
  out.hidden = false;
  const t = readLengthField("bfThick", null);
  const w = readLengthField("bfWidth", null);
  const L = readLengthField("bfLen", "bfLenUnit");
  const qty = Math.max(1, parseInt(document.getElementById("bfQty").value, 10) || 1);
  const price = parseFloat(document.getElementById("bfPrice").value) || 0;
  if (t === undefined || w === undefined || L === undefined) {
    out.innerHTML = `<span class="err">⚠ Revisa las medidas: acepto fracciones como 1 1/2 o decimales.</span>`;
    return;
  }
  if (!t || !w || !L) {
    out.innerHTML = `<span class="err">⚠ Completa espesor, ancho y largo.</span>`;
    return;
  }
  const in3each = t.mul(w).mul(L).toNumber();
  const bfEach = in3each / 144;
  const bfTotal = bfEach * qty;
  const m3Total = in3each * qty * 16.387064 / 1e6;
  let html = `<div class="big">${fmtNum(bfTotal, 3)} pies tablares</div>`;
  html += `${fmtNum(bfEach, 3)} pies tablares por pieza × ${qty} pieza(s)<br>`;
  html += `Volumen total: <b>${fmtNum(m3Total, 4)} m³</b> · ${fmtNum(in3each * qty, 1)} pulg³ · ${fmtNum(in3each * qty / 1728, 3)} pies³`;
  if (price > 0) html += `<br>Costo estimado: <b>$${(bfTotal * price).toFixed(2)}</b> (a $${price.toFixed(2)}/pie tablar)`;
  out.innerHTML = html;
});

/* ==========================================================================
 * Espaciado uniforme
 * ========================================================================== */

document.getElementById("spCalc").addEventListener("click", () => {
  const out = document.getElementById("spResult");
  out.hidden = false;
  const total = readLengthField("spTotal", "spTotalUnit");
  const n = Math.max(0, parseInt(document.getElementById("spCount").value, 10) || 0);
  const thickRaw = document.getElementById("spThick").value.trim();
  const thick = thickRaw ? readLengthField("spThick", "spThickUnit") : F(0n);
  if (total === undefined || thick === undefined) {
    out.innerHTML = `<span class="err">⚠ Revisa las medidas: acepto fracciones como 1 1/2 o decimales.</span>`;
    return;
  }
  if (!total || total.isZero() || total.isNeg()) {
    out.innerHTML = `<span class="err">⚠ Ingresa el largo total.</span>`;
    return;
  }
  const nB = BigInt(n);
  const occupied = thick.mul(F(nB));
  const gap = total.sub(occupied).div(F(nB + 1n)); // n piezas ⇒ n+1 espacios
  if (gap.isNeg()) {
    out.innerHTML = `<span class="err">⚠ Las piezas no caben: ${n} × ${fracToMixedString(roundToDen(thick, precisionDen).rounded)} supera el largo total.</span>`;
    return;
  }
  const gapMm = gap.mul(F(127n, 5n)).toNumber();
  let html = `<div class="big">Espacio libre: ${formatInchesAsFraction(gap)}</div>`;
  html += `${fmtNum(gapMm, 1)} mm entre piezas · ${n} pieza(s) · ${n + 1} espacios<br>`;
  if (n > 0) {
    html += `<table><tr><th>Pieza</th><th>Inicio (borde)</th><th>Centro</th></tr>`;
    const shown = Math.min(n, 30);
    for (let i = 1; i <= shown; i++) {
      const iB = BigInt(i);
      const start = gap.mul(F(iB)).add(thick.mul(F(iB - 1n)));
      const center = start.add(thick.div(F(2n)));
      html += `<tr><td>${i}</td><td>${formatInchesAsFraction(start)}</td><td>${formatInchesAsFraction(center)}</td></tr>`;
    }
    html += `</table>`;
    if (n > shown) html += `<span class="note">Mostrando las primeras ${shown} piezas.</span>`;
    html += `<span class="note">Las posiciones se miden desde el extremo izquierdo (0).</span>`;
  }
  out.innerHTML = html;
});

/* ==========================================================================
 * Triángulo / escuadra
 * ========================================================================== */

document.getElementById("triCalc").addEventListener("click", () => {
  const out = document.getElementById("triResult");
  out.hidden = false;
  const a = readLengthField("triA", "triAUnit");
  const b = readLengthField("triB", "triBUnit");
  const c = readLengthField("triC", "triCUnit");
  if (a === undefined || b === undefined || c === undefined) {
    out.innerHTML = `<span class="err">⚠ Revisa las medidas: acepto fracciones como 1 1/2 o decimales.</span>`;
    return;
  }
  const given = [a, b, c].filter(v => v !== null).length;
  if (given < 2) {
    out.innerHTML = `<span class="err">⚠ Ingresa al menos dos valores.</span>`;
    return;
  }
  const av = a ? a.toNumber() : null;
  const bv = b ? b.toNumber() : null;
  const cv = c ? c.toNumber() : null;
  let A = av, B = bv, C = cv;
  if (A !== null && B !== null && C === null) C = Math.hypot(A, B);
  else if (A !== null && C !== null && B === null) {
    if (C <= A) { out.innerHTML = `<span class="err">⚠ La diagonal debe ser mayor que el lado A.</span>`; return; }
    B = Math.sqrt(C * C - A * A);
  } else if (B !== null && C !== null && A === null) {
    if (C <= B) { out.innerHTML = `<span class="err">⚠ La diagonal debe ser mayor que el lado B.</span>`; return; }
    A = Math.sqrt(C * C - B * B);
  }
  // si dieron los tres, comprueba escuadra
  const angle = Math.atan2(B, A) * 180 / Math.PI;
  const pitch = A > 0 ? (B / A) * 12 : 0;
  const row = (label, x) => {
    const fr = Frac.fromNumber(x);
    return `<tr><td>${label}</td><td>${formatInchesAsFraction(fr)}</td><td>${fmtNum(x * 25.4, 1)} mm</td></tr>`;
  };
  let html = "";
  if (given === 3) {
    const calcC = Math.hypot(av, bv);
    const diff = cv - calcC;
    const okTol = Math.abs(diff) * 25.4 <= 1;
    html += `<div class="big">${okTol ? "✅ Escuadrado" : "⚠️ Fuera de escuadra"}</div>`;
    html += `Diagonal ideal: <b>${formatInchesAsFraction(Frac.fromNumber(calcC))}</b> (${fmtNum(calcC * 25.4, 1)} mm)<br>`;
    html += `Diferencia con tu diagonal: <b>${fmtNum(diff * 25.4, 1)} mm</b><br><span class="note">Tolerancia de ±1 mm.</span>`;
  } else {
    html += `<div class="big">Diagonal: ${formatInchesAsFraction(Frac.fromNumber(C))}</div>`;
    html += `<table><tr><th></th><th>Fracción</th><th>Métrico</th></tr>`;
    html += row("Lado A", A) + row("Lado B", B) + row("Diagonal", C);
    html += `</table>`;
    html += `Ángulo en la base: <b>${fmtNum(angle, 2)}°</b> · Pendiente: <b>${fmtNum(pitch, 2)}:12</b>`;
  }
  out.innerHTML = html;
});

/* ==========================================================================
 * Historial (localStorage)
 * ========================================================================== */

const HIST_KEY = "carp.history";

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HIST_KEY)) || []; }
  catch { return []; }
}

function addHistory(expr, val) {
  const list = loadHistory();
  list.unshift({
    expr,
    res: shortValue(val),
    n: val.fr.n.toString(),
    d: val.fr.d.toString(),
    dim: val.dim,
    ts: Date.now(),
  });
  if (list.length > 100) list.length = 100;
  localStorage.setItem(HIST_KEY, JSON.stringify(list));
}

function renderHistory() {
  const el = document.getElementById("histList");
  const list = loadHistory();
  if (!list.length) {
    el.innerHTML = `<div class="hist-empty">Sin cálculos todavía.<br>Los resultados de la calculadora se guardan aquí.</div>`;
    return;
  }
  el.innerHTML = list.map((h, i) => `
    <div class="hist-item" data-i="${i}" title="Tocar para reutilizar en la calculadora">
      <div class="h-expr">${h.expr}</div>
      <div class="h-res">= ${h.res}</div>
      <div class="h-ts">${new Date(h.ts).toLocaleString()}</div>
    </div>`).join("");
}

document.getElementById("histList").addEventListener("click", (ev) => {
  const item = ev.target.closest(".hist-item");
  if (!item) return;
  const h = loadHistory()[parseInt(item.dataset.i, 10)];
  if (!h) return;
  clearCalc(true);
  calc.acc = { fr: new Frac(BigInt(h.n), BigInt(h.d)), dim: h.dim };
  calc.exprParts = [shortValue(calc.acc)];
  renderCalc();
  showCalcResult();
  document.querySelector('.tab-btn[data-tab="calc"]').click();
});

document.getElementById("histClear").addEventListener("click", () => {
  localStorage.removeItem(HIST_KEY);
  renderHistory();
});

/* ==========================================================================
 * Arranque
 * ========================================================================== */

(function init() {
  const savedPrec = parseInt(localStorage.getItem("carp.precision"), 10);
  if ([8, 16, 32, 64].includes(savedPrec)) {
    precisionDen = savedPrec;
    document.querySelectorAll("#precisionRow .chip").forEach(c =>
      c.classList.toggle("active", parseInt(c.dataset.den, 10) === savedPrec));
  }
  renderCalc();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
})();
