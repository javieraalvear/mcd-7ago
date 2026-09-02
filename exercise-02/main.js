// ======================================================
// 01 — CONFIGURACIÓN
// ======================================================
// Fuente: rse.csv, datos reales de openpsychometrics.org
// (Rosenberg Self-Esteem Scale). Mismo dataset y misma regla de
// puntaje (10-40, ítems invertidos) que la versión 3D anterior de
// este ejercicio — lo que cambia es la representación, no el dato.
//
// La silueta NO es tu cámara: es un cuerpo paramétrico dibujado por
// código (cabeza/torso/brazos/piernas), cuya altura y proporciones
// varían con los controles de edad/género. No hay dato real de
// estatura en el CSV — la curva de crecimiento es ilustrativa, no
// medida (se documenta en alturaFactor).
//
// Lo que SÍ es dato real: el promedio de autoestima por edad y
// género, calculado del propio CSV, es la única variable que mueve
// el sistema — la única regla de animación (anillos concéntricos).

const RUTA_CSV = "./assets/data/rse.csv";
const ITEMS_INVERTIDOS = new Set(["Q3", "Q5", "Q8", "Q9", "Q10"]);

const EDAD_MIN = 5;
const EDAD_MAX = 90;
const NOMBRE_GENERO = { 1: "hombre", 2: "mujer" };

const TAMANO_CELDA = 6; // px, grilla de muestreo de la silueta
const UMBRAL_BRILLO = 80; // 0-255
const PROBABILIDAD_INTERIOR = 0.78; // dropout: no cada celda "dentro" se dibuja

const N_MINIMO_CONFIABLE = 30; // tamaño de muestra mínimo por bin edad×género
const ESCALA_AUTOESTIMA = { min: 22, max: 33 }; // rango observado real, para normalizar a 0-1

let filas = [];
let promediosPorBin = {};

const estado = {
  edad: 25,
  genero: 2,
  reproduciendo: true,
};

// ======================================================
// 02 — LIENZO
// ======================================================

const lienzo = document.querySelector("#lienzo");
const ctx = lienzo.getContext("2d");

// Lienzo auxiliar oculto: acá se dibuja el cuerpo paramétrico sólido
// una sola vez por cambio de edad/género, y de ahí se muestrea la
// grilla de partículas — nunca se dibuja el cuerpo directamente en
// el lienzo visible.
const ALTO_DISENO = 640;
const ANCHO_DISENO = 320;
const lienzoFigura = document.createElement("canvas");
lienzoFigura.width = ANCHO_DISENO;
lienzoFigura.height = ALTO_DISENO;
const ctxFigura = lienzoFigura.getContext("2d", { willReadFrequently: true });

let particulas = []; // { xBase, yBase, distancia, angulo, tamano }
let centroFigura = { x: ANCHO_DISENO / 2, y: ALTO_DISENO * 0.5 };

function ajustarLienzo() {
  lienzo.width = window.innerWidth;
  lienzo.height = window.innerHeight;
}
window.addEventListener("resize", ajustarLienzo);
ajustarLienzo();

// ======================================================
// 03 — DATOS: CSV → PROMEDIO DE AUTOESTIMA POR EDAD × GÉNERO
// ======================================================

async function cargarDatos() {
  try {
    const respuesta = await fetch(RUTA_CSV, { cache: "no-store" });
    if (!respuesta.ok) throw new Error("No se pudo leer rse.csv");
    const texto = await respuesta.text();

    const personas = procesarCSV(texto);
    promediosPorBin = construirPromediosPorEdad(personas);

    reconstruirTodo();
  } catch (error) {
    console.error(error);
    document.querySelector("#indicador").textContent = "error cargando rse.csv";
  }
}

function procesarCSV(texto) {
  const lineas = texto.trim().split("\n");
  const delimitador = lineas[0].includes("\t") ? "\t" : lineas[0].includes(",") ? "," : /\s+/;
  const encabezados = lineas[0].trim().split(delimitador);

  return lineas
    .slice(1)
    .map((linea) => {
      const valores = linea.trim().split(delimitador);
      const fila = {};
      encabezados.forEach((clave, i) => (fila[clave] = valores[i]));
      return calcularPersona(fila);
    })
    .filter(Boolean);
}

function calcularPersona(fila) {
  const edad = Number(fila.age);
  const genero = Number(fila.gender);

  if (!edad || edad < 5 || edad > 100) return null;
  if (![1, 2, 3].includes(genero)) return null;

  let puntaje = 0;
  for (let i = 1; i <= 10; i++) {
    const clave = `Q${i}`;
    const valorCrudo = Number(fila[clave]);
    if (!valorCrudo || valorCrudo < 1 || valorCrudo > 4) return null;
    puntaje += ITEMS_INVERTIDOS.has(clave) ? 5 - valorCrudo : valorCrudo;
  }

  return { edad, puntaje, genero };
}

// Bins de 5 años × género (1=hombre, 2=mujer — la figura solo modela
// estas dos, "otro" no tiene una silueta convencional que dibujar).
function construirPromediosPorEdad(personas) {
  const bins = {};
  personas.forEach((p) => {
    if (p.genero === 3) return;
    const bin = Math.floor(p.edad / 5) * 5;
    const clave = `${bin}_${p.genero}`;
    if (!bins[clave]) bins[clave] = { suma: 0, n: 0 };
    bins[clave].suma += p.puntaje;
    bins[clave].n += 1;
  });

  const promedios = {};
  Object.entries(bins).forEach(([clave, { suma, n }]) => {
    promedios[clave] = { media: suma / n, n };
  });
  return promedios;
}

// Si el bin exacto tiene muestra insuficiente (edades muy bajas o muy
// altas están poco representadas en el dataset), busca el bin válido
// más cercano en vez de mostrar un promedio ruidoso de n=2.
function promedioParaEdad(edad, genero) {
  const binBase = Math.floor(edad / 5) * 5;

  for (let distancia = 0; distancia <= 18; distancia++) {
    const signos = distancia === 0 ? [0] : [-1, 1];
    for (const signo of signos) {
      const entrada = promediosPorBin[`${binBase + signo * distancia * 5}_${genero}`];
      if (entrada && entrada.n >= N_MINIMO_CONFIABLE) return entrada;
    }
  }
  return promediosPorBin[`${binBase}_${genero}`] ?? { media: 25, n: 0 };
}

function normalizarAutoestima(media) {
  const { min, max } = ESCALA_AUTOESTIMA;
  return clamp((media - min) / (max - min), 0, 1);
}

// ======================================================
// 04 — FIGURA PARAMÉTRICA (edad/género → forma)
// ======================================================
// No hay dato de estatura en el CSV: esta curva es una forma de
// crecimiento ilustrativa (rápido de niño a adolescente, plano en la
// adultez, leve retracción en edad avanzada) — no una medición.
function alturaFactor(edad) {
  const crecimiento = suavizar(clamp((edad - 5) / (18 - 5), 0, 1));
  const factor = 0.65 + crecimiento * 0.35; // 0.65 (niño) .. 1.0 (adulto)

  if (edad <= 70) return factor;
  const declive = suavizar(clamp((edad - 70) / (90 - 70), 0, 1));
  return factor - declive * 0.04;
}

function suavizar(t) {
  return t * t * (3 - 2 * t);
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// Convención esquemática (no antropométrica): hombros relativamente
// más anchos que las caderas para "hombre", caderas relativamente
// más anchas que los hombros para "mujer". Un solo parámetro, nada
// caricaturesco — es un diagrama técnico, no una ilustración.
function proporcionesGenero(genero) {
  return genero === 1
    ? { hombros: 0.92, caderas: 0.62, estatura: 1.0 }
    : { hombros: 0.78, caderas: 0.7, estatura: 0.94 };
}

function dibujarFiguraEnLienzoAuxiliar(edad, genero) {
  ctxFigura.clearRect(0, 0, ANCHO_DISENO, ALTO_DISENO);
  ctxFigura.fillStyle = "#ffffff";

  const prop = proporcionesGenero(genero);
  const alturaPx = ALTO_DISENO * 0.92 * alturaFactor(edad) * prop.estatura;
  const cx = ANCHO_DISENO / 2;
  const pieY = ALTO_DISENO * 0.96;
  const hu = alturaPx / 7.5; // "unidad cabeza", proporción clásica de figura humana

  const yCabeza = pieY - alturaPx;
  const yHombros = yCabeza + hu * 1.4;
  const yCadera = yCabeza + hu * 3.6;
  const yRodilla = yCabeza + hu * 5.6;
  const yPie = pieY;

  const anchoHombros = hu * 1.9 * prop.hombros;
  const anchoCadera = hu * 1.5 * prop.caderas;
  const anchoCintura = anchoCadera * 0.82;

  // cabeza
  ctxFigura.beginPath();
  ctxFigura.ellipse(cx, yCabeza + hu * 0.5, hu * 0.42, hu * 0.5, 0, 0, Math.PI * 2);
  ctxFigura.fill();

  // cuello
  ctxFigura.fillRect(cx - hu * 0.18, yCabeza + hu * 0.95, hu * 0.36, hu * 0.5);

  // torso + caderas, un solo polígono cerrado y simétrico
  ctxFigura.beginPath();
  ctxFigura.moveTo(cx - anchoHombros / 2, yHombros);
  ctxFigura.lineTo(cx + anchoHombros / 2, yHombros);
  ctxFigura.quadraticCurveTo(cx + anchoCintura / 2, (yHombros + yCadera) / 2, cx + anchoCadera / 2, yCadera);
  ctxFigura.lineTo(cx - anchoCadera / 2, yCadera);
  ctxFigura.quadraticCurveTo(cx - anchoCintura / 2, (yHombros + yCadera) / 2, cx - anchoHombros / 2, yHombros);
  ctxFigura.closePath();
  ctxFigura.fill();

  // piernas
  const anchoPierna = hu * 0.42;
  const separacion = hu * 0.28;
  [-1, 1].forEach((lado) => {
    const xCadera = cx + lado * (anchoCadera / 4);
    const xPie = cx + lado * separacion;
    ctxFigura.beginPath();
    ctxFigura.moveTo(xCadera - anchoPierna / 2, yCadera);
    ctxFigura.lineTo(xCadera + anchoPierna / 2, yCadera);
    ctxFigura.lineTo(xPie + anchoPierna * 0.38, yPie);
    ctxFigura.lineTo(xPie - anchoPierna * 0.38, yPie);
    ctxFigura.closePath();
    ctxFigura.fill();
  });

  // brazos, colgando a los costados
  const anchoBrazo = hu * 0.34;
  const yManoY = yCadera + hu * 0.3;
  [-1, 1].forEach((lado) => {
    const xHombro = cx + lado * (anchoHombros / 2 - anchoBrazo * 0.3);
    const xMano = cx + lado * (anchoHombros / 2 + hu * 0.05);
    ctxFigura.beginPath();
    ctxFigura.moveTo(xHombro - anchoBrazo / 2, yHombros);
    ctxFigura.lineTo(xHombro + anchoBrazo / 2, yHombros);
    ctxFigura.lineTo(xMano + anchoBrazo * 0.32, yManoY);
    ctxFigura.lineTo(xMano - anchoBrazo * 0.32, yManoY);
    ctxFigura.closePath();
    ctxFigura.fill();
  });

  return { cx, cy: (yCabeza + yPie) / 2 };
}

// ======================================================
// 05 — GRILLA → PARTÍCULAS (silueta de ruido, no imagen continua)
// ======================================================

function construirParticulas(edad, genero) {
  const centro = dibujarFiguraEnLienzoAuxiliar(edad, genero);
  const { data } = ctxFigura.getImageData(0, 0, ANCHO_DISENO, ALTO_DISENO);

  const nuevas = [];

  for (let y = TAMANO_CELDA / 2; y < ALTO_DISENO; y += TAMANO_CELDA) {
    for (let x = TAMANO_CELDA / 2; x < ANCHO_DISENO; x += TAMANO_CELDA) {
      const idx = (Math.floor(y) * ANCHO_DISENO + Math.floor(x)) * 4;
      const brillo = data[idx]; // el relleno es blanco puro: R=G=B
      if (brillo <= UMBRAL_BRILLO) continue;
      if (Math.random() > PROBABILIDAD_INTERIOR) continue; // dropout: silueta de ruido, no bloque sólido

      const dx = x - centro.cx;
      const dy = y - centro.cy;
      nuevas.push({
        xBase: x,
        yBase: y,
        distancia: Math.hypot(dx, dy),
        angulo: Math.atan2(dy, dx),
        tamano: 1 + Math.floor(Math.random() * 2), // 1-2px en espacio de diseño
      });
    }
  }

  particulas = nuevas;
  centroFigura = centro;
}

// ======================================================
// 06 — CICLO DE PULSO: LA ÚNICA REGLA DE ANIMACIÓN
// ======================================================
// Entrada: una variable normalizada 0-1 (promedio real de autoestima
// para la edad/género activos) + eventos puntuales (cada cambio de
// edad o género). Un anillo concéntrico viaja desde el centro de la
// figura hacia afuera y de vuelta — su amplitud escala con la
// variable + el impulso del último evento; su velocidad escala con
// qué tan seguido llegan los eventos. Nada más anima el sistema.

const RITMO_REPOSO_S = 3.0;
const RITMO_MIN_S = 0.55;
const DURACION_KICK_MS = 1400;
const EMPUJE_MAX_PX = 340; // en espacio de pantalla, no de diseño

let periodoObjetivo = RITMO_REPOSO_S;
let periodoActual = RITMO_REPOSO_S;
let faseAcumulada = 0;
let amplitudVariable = 0.3;
let kickIntensidad = 0;
let kickInicioMs = 0;
let ultimoEventoMs = 0;
let historialEventosMs = [];

function dispararEvento(intensidad) {
  const ahora = performance.now();
  historialEventosMs.push(ahora);
  historialEventosMs = historialEventosMs.filter((t) => ahora - t < 6000);

  if (historialEventosMs.length >= 2) {
    const intervalos = [];
    for (let i = 1; i < historialEventosMs.length; i++) {
      intervalos.push(historialEventosMs[i] - historialEventosMs[i - 1]);
    }
    const promedioS = intervalos.reduce((a, b) => a + b, 0) / intervalos.length / 1000;
    periodoObjetivo = clamp(promedioS * 0.85, RITMO_MIN_S, RITMO_REPOSO_S);
  }

  kickIntensidad = clamp(Math.max(0.2, intensidad), 0, 1);
  kickInicioMs = ahora;
  ultimoEventoMs = ahora;
}

let ultimoFrameMs = performance.now();

function avanzarCiclo(ahoraMs) {
  const dt = Math.min(0.1, (ahoraMs - ultimoFrameMs) / 1000);
  ultimoFrameMs = ahoraMs;

  if (!estado.reproduciendo) return;

  // sin eventos recientes, el ciclo se calma solo
  if (ahoraMs - ultimoEventoMs > 4500) periodoObjetivo = RITMO_REPOSO_S;
  periodoActual += (periodoObjetivo - periodoActual) * 0.02;

  faseAcumulada = (faseAcumulada + dt / periodoActual) % 1;
}

function amplitudActual(ahoraMs) {
  const decaimientoKick = clamp(1 - (ahoraMs - kickInicioMs) / DURACION_KICK_MS, 0, 1);
  return clamp(amplitudVariable + kickIntensidad * decaimientoKick, 0, 1.3);
}

// posición del frente de onda dentro del ciclo: 0→1 (expansión), 1→0 (contracción)
function posicionOnda(fase) {
  return fase < 0.5 ? fase * 2 : (1 - fase) * 2;
}

// ======================================================
// 07 — CAPAS FIJAS (no se deforman con el pulso)
// ======================================================

let marcadores = [];
function generarMarcadores() {
  const n = 5 + Math.floor(Math.random() * 4); // 5-8
  marcadores = Array.from({ length: n }, () => ({
    x: 0.08 + Math.random() * 0.84,
    y: 0.1 + Math.random() * 0.8,
    r: 5 + Math.random() * 4,
    rot: Math.random() * Math.PI * 2,
  }));
}
generarMarcadores();

function dibujarCapasFijas() {
  const w = lienzo.width;
  const h = lienzo.height;

  ctx.strokeStyle = "rgba(255,255,255,0.5)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();

  marcadores.forEach((m) => {
    const x = m.x * w;
    const y = m.y * h;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(m.rot);
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -m.r);
    ctx.lineTo(m.r * 0.87, m.r * 0.5);
    ctx.lineTo(-m.r * 0.87, m.r * 0.5);
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  });
}

// ======================================================
// 08 — DIBUJO
// ======================================================

function mapaDisenoAPantalla() {
  const w = lienzo.width;
  const h = lienzo.height;
  const escala = Math.min(w / ANCHO_DISENO, h / ALTO_DISENO) * 0.86;
  const offsetX = w / 2 - (ANCHO_DISENO / 2) * escala;
  const offsetY = h * 0.5 - (ALTO_DISENO * 0.55) * escala;
  return { escala, offsetX, offsetY };
}

function dibujar(ahoraMs) {
  const w = lienzo.width;
  const h = lienzo.height;

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, w, h);

  dibujarCapasFijas();

  const { escala, offsetX, offsetY } = mapaDisenoAPantalla();
  const fase = faseAcumulada;
  const radioOnda = posicionOnda(fase) * EMPUJE_MAX_PX;
  const amplitud = amplitudActual(ahoraMs);
  const anchoAnillo = 70;

  ctx.fillStyle = "#ffffff";

  particulas.forEach((p) => {
    const distanciaPantalla = p.distancia * escala;
    const factorOnda = Math.exp(-((distanciaPantalla - radioOnda) ** 2) / (2 * anchoAnillo * anchoAnillo));
    const empuje = amplitud * factorOnda * EMPUJE_MAX_PX * 0.55;

    const x = offsetX + p.xBase * escala + Math.cos(p.angulo) * empuje;
    const y = offsetY + p.yBase * escala + Math.sin(p.angulo) * empuje;
    const tam = p.tamano;

    ctx.fillRect(x, y, tam, tam);
  });

  dibujarIndicador();
}

function dibujarIndicador() {
  const info = promedioParaEdad(estado.edad, estado.genero);
  document.querySelector("#indicador").textContent =
    `AUTOESTIMA PROM. ${info.media.toFixed(1)}/40 · EDAD ${estado.edad} · ${NOMBRE_GENERO[estado.genero].toUpperCase()} · n=${info.n}`;
}

// ======================================================
// 09 — RECONSTRUCCIÓN AL CAMBIAR EDAD/GÉNERO
// ======================================================

function reconstruirTodo() {
  construirParticulas(estado.edad, estado.genero);

  const info = promedioParaEdad(estado.edad, estado.genero);
  const nuevaAmplitud = normalizarAutoestima(info.media);
  const intensidadEvento = Math.abs(nuevaAmplitud - amplitudVariable);
  amplitudVariable = nuevaAmplitud;

  dispararEvento(intensidadEvento);
}

// ======================================================
// 10 — CONTROLES (UI mínima)
// ======================================================

document.querySelector("#control-edad").addEventListener("input", (evento) => {
  estado.edad = Number(evento.target.value);
  document.querySelector("#valor-edad").textContent = estado.edad;
  reconstruirTodo();
});

document.querySelectorAll("[data-genero]").forEach((boton) => {
  boton.addEventListener("click", () => {
    estado.genero = Number(boton.dataset.genero);
    document.querySelectorAll("[data-genero]").forEach((b) => b.classList.toggle("activo", b === boton));
    reconstruirTodo();
  });
});

document.querySelector("#reproducir").addEventListener("click", (evento) => {
  estado.reproduciendo = !estado.reproduciendo;
  evento.target.textContent = estado.reproduciendo ? "Pausar" : "Reproducir";
  if (estado.reproduciendo) ultimoFrameMs = performance.now();
});

// ======================================================
// 11 — BUCLE PRINCIPAL
// ======================================================

function animar(ahoraMs) {
  requestAnimationFrame(animar);
  avanzarCiclo(ahoraMs);
  dibujar(ahoraMs);
}

cargarDatos();
requestAnimationFrame(animar);
