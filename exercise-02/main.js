// ======================================================
// 01 — CONFIGURACIÓN
// ======================================================
// Fuente: rse.csv, datos reales de openpsychometrics.org
// (Rosenberg Self-Esteem Scale). Mismo dataset y misma regla de
// puntaje (10-40, ítems invertidos) que las versiones anteriores.
//
// Dos cuerpos paramétricos (hombre / mujer, simultáneos, comparables
// en pantalla) girando en 3D — proyección 3D→2D hecha a mano,
// sin librerías. Cada cuerpo es una nube de puntos fija; lo único
// que anima es (a) el giro, que es una rotación aplicada sobre esa
// base fija, nunca la reemplaza, y (b) un anillo — una capa aparte,
// no el cuerpo — que pulsa según el promedio real de autoestima de
// ese grupo. El cuerpo nunca se deforma.

const RUTA_CSV = "./assets/data/rse.csv";
const ITEMS_INVERTIDOS = new Set(["Q3", "Q5", "Q8", "Q9", "Q10"]);

const EDAD_MIN = 5;
const EDAD_MAX = 90;
const GENEROS = [1, 2];
const NOMBRE_GENERO = { 1: "hombre", 2: "mujer" };

const N_MINIMO_CONFIABLE = 30; // tamaño de muestra mínimo por bin edad×género
const ESCALA_AUTOESTIMA = { min: 22, max: 33 }; // rango real observado, para normalizar a 0-1

let filas = [];
let promediosPorBin = {};

const estado = { edad: 25, reproduciendo: true };

// ======================================================
// 02 — LIENZO
// ======================================================

const lienzo = document.querySelector("#lienzo");
const ctx = lienzo.getContext("2d");

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

function construirPromediosPorEdad(personas) {
  const bins = {};
  personas.forEach((p) => {
    if (p.genero === 3) return; // la figura solo modela hombre/mujer
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

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// ======================================================
// 04 — CUERPO PARAMÉTRICO EN 3D (edad/género → forma)
// ======================================================
// No hay dato de estatura en el CSV: esta curva de crecimiento es
// ilustrativa (rápida de niño a adolescente, plana en la adultez,
// leve retracción en edad avanzada) — no una medición.
function alturaFactor(edad) {
  const crecimiento = suavizar(clamp((edad - 5) / (18 - 5), 0, 1));
  const factor = 0.65 + crecimiento * 0.35;
  if (edad <= 70) return factor;
  const declive = suavizar(clamp((edad - 70) / (90 - 70), 0, 1));
  return factor - declive * 0.04;
}

function suavizar(t) {
  return t * t * (3 - 2 * t);
}

// Convención esquemática (no antropométrica): hombros relativamente
// más anchos que las caderas para "hombre", caderas relativamente
// más anchas que los hombros para "mujer" — un diagrama técnico, no
// una caricatura.
function proporcionesGenero(genero) {
  return genero === 1
    ? { hombros: 0.92, caderas: 0.62, estatura: 1.0 }
    : { hombros: 0.78, caderas: 0.7, estatura: 0.94 };
}

// Perfil de radio del tronco+cabeza a lo largo de la altura (en
// unidades-cabeza "hu"), como un sólido de revolución: puntos clave
// interpolados linealmente entre ellos.
function radioTroncoEnHu(t, hu, prop) {
  const puntos = [
    [0.0, 0.0],
    [0.28, hu * 0.42], // ancho máx. de la cabeza
    [0.75, hu * 0.16], // base de la cabeza
    [1.2, hu * 0.16], // cuello
    [1.45, hu * 0.95 * prop.hombros], // hombros
    [2.6, hu * 0.6 * prop.caderas], // cintura
    [3.6, hu * 0.78 * prop.caderas], // caderas
  ];
  for (let i = 0; i < puntos.length - 1; i++) {
    const [t0, r0] = puntos[i];
    const [t1, r1] = puntos[i + 1];
    if (t >= t0 && t <= t1) {
      const f = (t - t0) / (t1 - t0 || 1);
      return r0 + (r1 - r0) * f;
    }
  }
  return 0;
}

// Genera puntos sobre una superficie de revolución: para cada nivel
// de altura, un anillo de puntos alrededor del eje vertical local.
function muestrearRevolucion(radioEn, tInicio, tFin, hu, pasosAltura, pasosAngulo, dropout, offsetX = 0) {
  const puntos = [];
  for (let i = 0; i <= pasosAltura; i++) {
    const t = tInicio + ((tFin - tInicio) * i) / pasosAltura;
    const radio = radioEn(t);
    if (radio <= 0.5) continue;
    const y = t * hu;
    for (let j = 0; j < pasosAngulo; j++) {
      if (Math.random() < dropout) continue;
      const angulo = (j / pasosAngulo) * Math.PI * 2 + Math.random() * 0.15;
      const r = radio * (0.94 + Math.random() * 0.12); // leve ruido radial, textura no orgánica
      puntos.push({
        x: offsetX + Math.cos(angulo) * r,
        y,
        z: Math.sin(angulo) * r,
      });
    }
  }
  return puntos;
}

// Construye la nube de puntos base (fija) de un cuerpo completo.
function construirCuerpo(edad, genero) {
  const prop = proporcionesGenero(genero);
  const alturaTotal = 620 * alturaFactor(edad) * prop.estatura;
  const hu = alturaTotal / 7.5;

  let puntos = [];

  // tronco + cabeza, un solo sólido de revolución
  puntos = puntos.concat(
    muestrearRevolucion((t) => radioTroncoEnHu(t, hu, prop), 0, 3.6, hu, 46, 14, 0.35)
  );

  // piernas: dos cilindros angostos, cada uno con su propio eje local.
  // radioCaderaPx ya es un radio (igual que en radioTroncoEnHu, no un
  // ancho total) — el offset tiene que ser mayor que el radio de cada
  // pierna o los dos cilindros se funden en una sola columna.
  const radioCaderaPx = hu * 0.78 * prop.caderas;
  [-1, 1].forEach((lado) => {
    const offsetX = lado * radioCaderaPx * 0.7;
    puntos = puntos.concat(
      muestrearRevolucion(
        (t) => hu * (0.26 - 0.05 * ((t - 3.6) / 3.9)),
        3.6,
        7.5,
        hu,
        30,
        9,
        0.3,
        offsetX
      )
    );
  });

  // brazos: dos cilindros angostos colgando a los costados. Mismo
  // motivo: radioHombrosPx ya es el radio del torso a la altura del
  // hombro, así que el offset del brazo debe partir de ahí hacia
  // afuera, no de la mitad (si no, el brazo queda adentro del torso).
  const radioHombrosPx = hu * 0.95 * prop.hombros;
  [-1, 1].forEach((lado) => {
    const offsetX = lado * (radioHombrosPx + hu * 0.12);
    puntos = puntos.concat(
      muestrearRevolucion(
        (t) => hu * (0.2 - 0.04 * ((t - 1.45) / 2.35)),
        1.45,
        3.8,
        hu,
        24,
        9,
        0.3,
        offsetX
      )
    );
  });

  return puntos.map((p) => ({
    ...p,
    distanciaEje: Math.hypot(p.x, p.z),
    tamano: 1 + Math.floor(Math.random() * 2),
  }));
}

// ======================================================
// 05 — PROYECCIÓN 3D → 2D (rotación + perspectiva, sin librerías)
// ======================================================

const FOCAL = 900;
const VELOCIDAD_ROTACION = (Math.PI * 2) / 18; // una vuelta completa cada 18s

let anguloRotacion = 0;

// ======================================================
// 06 — ANILLO: UNA CAPA APARTE, EL CUERPO NUNCA SE DEFORMA
// ======================================================
// El pulso no mueve ni un solo punto del cuerpo — es un anillo
// horizontal independiente, a la altura del pecho, que crece y se
// contrae. Esa es la única regla de animación del sistema (además
// del giro, que es la misma rotación para cuerpo y anillo).

const RITMO_REPOSO_S = 3.0;
const RITMO_MIN_S = 0.55;
const DURACION_KICK_MS = 1400;
const RADIO_MAX_ANILLO = 210; // unidades locales, se escala igual que el cuerpo
const PUNTOS_ANILLO = 90;

function crearEstadoPulso() {
  return {
    periodoObjetivo: RITMO_REPOSO_S,
    periodoActual: RITMO_REPOSO_S,
    fase: Math.random(), // desfasados entre sí, no laten idénticos
    amplitudVariable: 0.3,
    kickIntensidad: 0,
    kickInicioMs: 0,
    ultimoEventoMs: 0,
    historialEventosMs: [],
  };
}

function dispararEvento(pulso, intensidad) {
  const ahora = performance.now();
  pulso.historialEventosMs.push(ahora);
  pulso.historialEventosMs = pulso.historialEventosMs.filter((t) => ahora - t < 6000);

  if (pulso.historialEventosMs.length >= 2) {
    const intervalos = [];
    for (let i = 1; i < pulso.historialEventosMs.length; i++) {
      intervalos.push(pulso.historialEventosMs[i] - pulso.historialEventosMs[i - 1]);
    }
    const promedioS = intervalos.reduce((a, b) => a + b, 0) / intervalos.length / 1000;
    pulso.periodoObjetivo = clamp(promedioS * 0.85, RITMO_MIN_S, RITMO_REPOSO_S);
  }

  pulso.kickIntensidad = clamp(Math.max(0.2, intensidad), 0, 1);
  pulso.kickInicioMs = ahora;
  pulso.ultimoEventoMs = ahora;
}

function avanzarPulso(pulso, ahoraMs, dt) {
  if (!estado.reproduciendo) return;
  if (ahoraMs - pulso.ultimoEventoMs > 4500) pulso.periodoObjetivo = RITMO_REPOSO_S;
  pulso.periodoActual += (pulso.periodoObjetivo - pulso.periodoActual) * 0.02;
  pulso.fase = (pulso.fase + dt / pulso.periodoActual) % 1;
}

function amplitudDelPulso(pulso, ahoraMs) {
  const decaimiento = clamp(1 - (ahoraMs - pulso.kickInicioMs) / DURACION_KICK_MS, 0, 1);
  return clamp(pulso.amplitudVariable + pulso.kickIntensidad * decaimiento, 0, 1);
}

function posicionOnda(fase) {
  return fase < 0.5 ? fase * 2 : (1 - fase) * 2;
}

function puntosAnillo(hu) {
  const alturaAnillo = hu * 2.2; // altura del pecho, mismo espacio local que el cuerpo
  const puntos = [];
  for (let i = 0; i < PUNTOS_ANILLO; i++) {
    const angulo = (i / PUNTOS_ANILLO) * Math.PI * 2;
    puntos.push({ angulo, y: alturaAnillo });
  }
  return puntos;
}

// ======================================================
// 07 — CAPAS FIJAS (no se deforman con el pulso)
// ======================================================

let marcadores = [];
function generarMarcadores() {
  const n = 5 + Math.floor(Math.random() * 4);
  marcadores = Array.from({ length: n }, () => ({
    x: 0.06 + Math.random() * 0.88,
    y: 0.1 + Math.random() * 0.8,
    r: 5 + Math.random() * 4,
    rot: Math.random() * Math.PI * 2,
  }));
}
generarMarcadores();

function dibujarCapasFijas() {
  const w = lienzo.width;
  const h = lienzo.height;

  ctx.strokeStyle = "#ffffff";
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
// 08 — FIGURAS: DOS CUERPOS SIMULTÁNEOS (hombre / mujer)
// ======================================================

const figuras = {
  1: { puntos: [], hu: 0, alturaTotal: 0, pulso: crearEstadoPulso() },
  2: { puntos: [], hu: 0, alturaTotal: 0, pulso: crearEstadoPulso() },
};

function reconstruirTodo() {
  GENEROS.forEach((genero) => {
    const prop = proporcionesGenero(genero);
    const alturaTotal = 620 * alturaFactor(estado.edad) * prop.estatura;
    figuras[genero].puntos = construirCuerpo(estado.edad, genero);
    figuras[genero].hu = alturaTotal / 7.5;
    figuras[genero].alturaTotal = alturaTotal;

    const info = promedioParaEdad(estado.edad, genero);
    const nuevaAmplitud = normalizarAutoestima(info.media);
    const intensidad = Math.abs(nuevaAmplitud - figuras[genero].pulso.amplitudVariable);
    figuras[genero].pulso.amplitudVariable = nuevaAmplitud;
    dispararEvento(figuras[genero].pulso, intensidad);
  });
}

// ======================================================
// 09 — DIBUJO
// ======================================================

function dibujarFigura(genero, centroXFraccion, ahoraMs) {
  const figura = figuras[genero];
  if (figura.puntos.length === 0) return;

  const w = lienzo.width;
  const h = lienzo.height;
  const escala = clamp(h / 900, 0.55, 1.4);
  const centroX = w * centroXFraccion;
  const baseY = h * 0.86;

  ctx.fillStyle = "#ffffff";

  // cuerpo: SIEMPRE en su posición base, solo rotado — nunca deformado.
  figura.puntos.forEach((p) => {
    const cosA = Math.cos(anguloRotacion);
    const sinA = Math.sin(anguloRotacion);
    const xRot = p.x * cosA + p.z * sinA;
    const zRot = -p.x * sinA + p.z * cosA;
    const factor = FOCAL / (FOCAL + zRot);

    const x = centroX + xRot * escala * factor;
    // p.y = 0 en la cabeza, crece hacia los pies — se ancla el pie a
    // baseY y la cabeza queda arriba, a (alturaTotal - p.y) de distancia.
    const y = baseY - (figura.alturaTotal - p.y) * escala * factor;
    const tam = Math.max(1, p.tamano * factor);
    ctx.fillRect(x, y, tam, tam);
  });

  // anillo: capa aparte, la única que pulsa.
  const pulso = figura.pulso;
  const amplitud = amplitudDelPulso(pulso, ahoraMs);
  const radioLocal = posicionOnda(pulso.fase) * RADIO_MAX_ANILLO * (0.35 + amplitud * 0.65);

  if (radioLocal > 4) {
    puntosAnillo(figura.hu).forEach(({ angulo, y: yLocal }) => {
      const xLocal = Math.cos(angulo) * radioLocal;
      const zLocal = Math.sin(angulo) * radioLocal;

      const cosA = Math.cos(anguloRotacion);
      const sinA = Math.sin(anguloRotacion);
      const xRot = xLocal * cosA + zLocal * sinA;
      const zRot = -xLocal * sinA + zLocal * cosA;
      const factor = FOCAL / (FOCAL + zRot);

      const x = centroX + xRot * escala * factor;
      const y = baseY - (figura.alturaTotal - yLocal) * escala * factor;
      ctx.fillRect(x, y, Math.max(1.5, 2 * factor), Math.max(1.5, 2 * factor));
    });
  }

  // etiqueta de figura — pequeña, técnica, junto a los pies, no centrada.
  ctx.font = "10px 'SF Mono','Courier New',monospace";
  ctx.textAlign = "center";
  ctx.fillText(NOMBRE_GENERO[genero].toUpperCase(), centroX, baseY + 24);
}

function dibujarIndicador() {
  const h = figuras[1].pulso, m = figuras[2].pulso;
  const infoH = promedioParaEdad(estado.edad, 1);
  const infoM = promedioParaEdad(estado.edad, 2);
  document.querySelector("#indicador").textContent =
    `EDAD ${estado.edad} · HOMBRE ${infoH.media.toFixed(1)}/40 (n=${infoH.n}) · MUJER ${infoM.media.toFixed(1)}/40 (n=${infoM.n})`;
}

function dibujar(ahoraMs) {
  const w = lienzo.width;
  const h = lienzo.height;

  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, w, h);

  dibujarCapasFijas();
  dibujarFigura(1, 0.32, ahoraMs);
  dibujarFigura(2, 0.68, ahoraMs);
  dibujarIndicador();
}

// ======================================================
// 10 — CONTROLES (UI mínima)
// ======================================================

document.querySelector("#control-edad").addEventListener("input", (evento) => {
  estado.edad = Number(evento.target.value);
  document.querySelector("#valor-edad").textContent = estado.edad;
  reconstruirTodo();
});

document.querySelector("#reproducir").addEventListener("click", (evento) => {
  estado.reproduciendo = !estado.reproduciendo;
  evento.target.textContent = estado.reproduciendo ? "Pausar" : "Reproducir";
  if (estado.reproduciendo) ultimoFrameMs = performance.now();
});

// ======================================================
// 11 — BUCLE PRINCIPAL
// ======================================================

let ultimoFrameMs = performance.now();

function animar(ahoraMs) {
  requestAnimationFrame(animar);

  const dt = Math.min(0.1, (ahoraMs - ultimoFrameMs) / 1000);
  ultimoFrameMs = ahoraMs;

  if (estado.reproduciendo) {
    anguloRotacion = (anguloRotacion + VELOCIDAD_ROTACION * dt) % (Math.PI * 2);
    GENEROS.forEach((genero) => avanzarPulso(figuras[genero].pulso, ahoraMs, dt));
  }

  dibujar(ahoraMs);
}

cargarDatos();
requestAnimationFrame(animar);
