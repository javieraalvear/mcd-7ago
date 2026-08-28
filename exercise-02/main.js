// ======================================================
// 01 — CONFIGURACIÓN
// ======================================================
// Fuente: dataset propio, derivado de WESAD (Schmidt et al. 2018).
// wesad_light.csv fue generado preprocesando los .pkl originales de
// 15 sujetos: EDA/BVP/TEMP de la muñeca, agregados en ventanas de 5s,
// etiquetadas con la condición dominante en esa ventana.
//
// Este ejercicio no grafica esos datos: los usa para corromper en
// vivo una imagen real sobre un <canvas> 2D. La distorsión ES la
// visualización — no hay barras, ejes ni leyendas de color.

const RUTA_CSV = "./assets/data/wesad_light.csv";
const NOMBRES_IMAGEN = ["retrato.jpg", "retrato.jpeg", "retrato.png"];

const ANCHO_MAX_LIENZO = 520;
const BLOQUES_POR_SESION = 60;      // resolución temporal de la sesión
const DURACION_BLOQUE_MS = 550;     // cuánto "dura" cada bloque al reproducir
const INTERVALO_RECALCULO_MS = 90;  // el glitch se recalcula ~11 veces/seg,
                                     // no cada frame: el "stepping" es parte
                                     // de la estética, no una limitación oculta.

const nombresCondicion = {
  baseline: "Baseline",
  stress: "Estrés",
  amusement: "Diversión",
};

// GRAMÁTICA POR CONDICIÓN
// --------------------------------------------------------------
// Las tres condiciones no se pintan de un color distinto: activan
// las mismas tres técnicas con pesos y modos de modulación distintos.
// "sort"/"aberr"/"bleed" multiplican la intensidad que ya viene de
// los datos; "sortEjes" y "bleedModo" cambian la TEXTURA, no solo
// la magnitud.
const GRAMATICA = {
  baseline: {
    sort: 0.12,
    sortEjes: "fila",
    aberr: 0.15,
    bleed: 0.14,
    bleedModo: "plano", // casi sin modulación en el tiempo
  },
  stress: {
    sort: 1.5,
    sortEjes: "ambos", // filas Y columnas: textura "desgarrada"
    aberr: 1.6,
    bleed: 1.1,
    bleedModo: "erratico", // salta de golpe, cambia de signo
  },
  amusement: {
    sort: 0.4,
    sortEjes: "fila",
    aberr: 0, // aberración cromática desactivada por completo
    bleed: 0.85,
    bleedModo: "ritmico", // oscila suave, tipo respiración
  },
};

// ======================================================
// 02 — LIENZO
// ======================================================

const lienzo = document.querySelector("#lienzo");
let ctx = null;
let anchoLienzo = 0;
let altoLienzo = 0;

let pristinoData = null;   // ImageData original, nunca se modifica
let bufferAnterior = null; // salida del frame anterior (para el frame bleed)
let imageDataSalida = null;

// ======================================================
// 03 — DATOS: FETCH + PARSEO DE CSV
// ======================================================

let filas = [];
let sujetosOrdenados = [];
let sesionActual = { sujeto: null, bloques: [] };

async function cargarDatos() {
  actualizarEstadoDatos("cargando");

  try {
    const respuesta = await fetch(RUTA_CSV, { cache: "no-store" });
    if (!respuesta.ok) throw new Error("No se pudo leer el CSV.");

    const texto = await respuesta.text();
    filas = parsearCSV(texto);

    sujetosOrdenados = [...new Set(filas.map((fila) => fila.subject))].sort(
      (a, b) => Number(a.slice(1)) - Number(b.slice(1))
    );

    poblarSelectorSujetos();
    actualizarEstadoDatos("listo");

    seleccionarSujeto(sujetosOrdenados[0]);
  } catch (error) {
    console.error("No fue posible cargar wesad_light.csv", error);
    actualizarEstadoDatos("error");
  }
}

function parsearCSV(texto) {
  const lineas = texto.trim().split("\n");
  const encabezados = lineas[0].split(",");

  return lineas.slice(1).map((linea) => {
    const valores = linea.split(",");
    const fila = {};
    encabezados.forEach((clave, indice) => {
      const valor = valores[indice];
      fila[clave] =
        clave === "subject" || clave === "condition" ? valor : Number(valor);
    });
    return fila;
  });
}

function poblarSelectorSujetos() {
  const selector = document.querySelector("#filtro-sujeto");
  sujetosOrdenados.forEach((sujeto) => {
    const opcion = document.createElement("option");
    opcion.value = sujeto;
    opcion.textContent = sujeto;
    selector.appendChild(opcion);
  });
}

// ======================================================
// 04 — BLOQUES TEMPORALES DE LA SESIÓN
// ======================================================
// Agrupa las filas de un sujeto en N bloques temporales, promediando
// (o, en el caso de BVP, midiendo la variabilidad de) las señales
// dentro de cada bloque. La sesión se reproduce recorriendo estos
// bloques en orden, no fila por fila.

function normalizarEda(fila, rango) {
  if (!rango || rango.max === rango.min) return 0.5;
  return (fila.eda_mean - rango.min) / (rango.max - rango.min);
}

function desviacionEstandar(valores) {
  if (valores.length === 0) return 0;
  const media = valores.reduce((acc, v) => acc + v, 0) / valores.length;
  const varianza =
    valores.reduce((acc, v) => acc + (v - media) ** 2, 0) / valores.length;
  return Math.sqrt(varianza);
}

function construirBloquesDeSujeto(sujeto, n) {
  const filasSujeto = filas
    .filter((fila) => fila.subject === sujeto)
    .sort((a, b) => a.window_start_s - b.window_start_s);

  if (filasSujeto.length === 0) return [];

  const valoresEda = filasSujeto.map((fila) => fila.eda_mean);
  const rangoEda = { min: Math.min(...valoresEda), max: Math.max(...valoresEda) };

  const tInicio = filasSujeto[0].window_start_s;
  const tFin = filasSujeto[filasSujeto.length - 1].window_start_s;
  const duracion = Math.max(1, tFin - tInicio);

  const grupos = Array.from({ length: n }, () => []);

  filasSujeto.forEach((fila) => {
    const posicion = (fila.window_start_s - tInicio) / duracion;
    const indice = Math.min(n - 1, Math.floor(posicion * n));
    grupos[indice].push(fila);
  });

  return grupos
    .map((grupo, indice) => {
      if (grupo.length === 0) return null;

      const conteoCondiciones = {};
      grupo.forEach((fila) => {
        conteoCondiciones[fila.condition] =
          (conteoCondiciones[fila.condition] || 0) + 1;
      });
      const condicionDominante = Object.entries(conteoCondiciones).sort(
        (a, b) => b[1] - a[1]
      )[0][0];

      const edaNorm =
        grupo.reduce((acc, fila) => acc + normalizarEda(fila, rangoEda), 0) /
        grupo.length;

      // El CSV no trae un "bvp_std" por ventana: lo construimos aquí
      // como la desviación estándar del bvp_mean de las ventanas de 5s
      // que caen dentro de este bloque. Eso SÍ es variabilidad de pulso
      // real, calculada a partir del dato crudo, no inventada.
      const bvpStd = desviacionEstandar(grupo.map((fila) => fila.bvp_mean));

      const tempMean =
        grupo.reduce((acc, fila) => acc + fila.temp_mean, 0) / grupo.length;

      return {
        sujeto,
        indice,
        posicionTemporal: indice / (n - 1 || 1),
        condicion: condicionDominante,
        edaNorm,
        bvpStd,
        tempMean,
      };
    })
    .filter(Boolean);
}

// Normaliza bvpStd y tempMean 0..1 dentro de la propia sesión del
// sujeto, igual que edaNorm ya viene normalizado por sujeto. Cada
// sesión usa su propio rango dinámico.
function normalizarSesion(bloques) {
  const valoresBvp = bloques.map((b) => b.bvpStd);
  const valoresTemp = bloques.map((b) => b.tempMean);

  const bvpMin = Math.min(...valoresBvp);
  const bvpMax = Math.max(...valoresBvp);
  const tempMin = Math.min(...valoresTemp);
  const tempMax = Math.max(...valoresTemp);

  return bloques.map((b) => ({
    ...b,
    bvpStdNorm: bvpMax > bvpMin ? (b.bvpStd - bvpMin) / (bvpMax - bvpMin) : 0.5,
    tempNorm: tempMax > tempMin ? (b.tempMean - tempMin) / (tempMax - tempMin) : 0.5,
  }));
}

function seleccionarSujeto(sujeto) {
  const crudos = construirBloquesDeSujeto(sujeto, BLOQUES_POR_SESION);
  sesionActual = { sujeto, bloques: normalizarSesion(crudos) };

  tiempoAcumuladoMs = 0;
  reproduciendo = false;
  document.querySelector("#reproducir").textContent = "Reproducir sesión";
  document.querySelector("#filtro-sujeto").value = sujeto;

  dibujarFramePristino();
}

// ======================================================
// 05 — TÉCNICAS DE GLITCH
// ======================================================
// Cada técnica lee UNA variable y no sabe nada de las otras dos.
// La condición no aparece aquí adentro: solo entra como pesos
// (ver GRAMATICA) que el motor de reproducción aplica por fuera.

function clamp(valor, min, max) {
  return Math.max(min, Math.min(max, valor));
}

// --- 1. EDA (arousal) → pixel sorting -------------------------------

function ordenarSegmento(data, ancho, indiceLinea, inicio, fin, esFila) {
  const n = fin - inicio;
  if (n <= 1) return;

  const pixeles = new Array(n);
  for (let i = 0; i < n; i++) {
    const coord = inicio + i;
    const idx = esFila
      ? (indiceLinea * ancho + coord) * 4
      : (coord * ancho + indiceLinea) * 4;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const a = data[idx + 3];
    const luminancia = 0.299 * r + 0.587 * g + 0.114 * b;
    pixeles[i] = [luminancia, r, g, b, a];
  }

  pixeles.sort((p1, p2) => p1[0] - p2[0]);

  for (let i = 0; i < n; i++) {
    const coord = inicio + i;
    const idx = esFila
      ? (indiceLinea * ancho + coord) * 4
      : (coord * ancho + indiceLinea) * 4;
    data[idx] = pixeles[i][1];
    data[idx + 1] = pixeles[i][2];
    data[idx + 2] = pixeles[i][3];
    data[idx + 3] = pixeles[i][4];
  }
}

function ordenarPorFilas(data, ancho, alto, intensidad) {
  const filasAfectadas = Math.max(1, Math.round(alto * intensidad * 0.6));
  for (let i = 0; i < filasAfectadas; i++) {
    const y = Math.floor(Math.random() * alto);
    const largo = Math.max(6, Math.floor(ancho * intensidad * (0.4 + Math.random() * 0.6)));
    const inicio = Math.floor(Math.random() * Math.max(1, ancho - largo));
    ordenarSegmento(data, ancho, y, inicio, Math.min(ancho, inicio + largo), true);
  }
}

function ordenarPorColumnas(data, ancho, alto, intensidad) {
  const columnasAfectadas = Math.max(1, Math.round(ancho * intensidad * 0.5));
  for (let i = 0; i < columnasAfectadas; i++) {
    const x = Math.floor(Math.random() * ancho);
    const largo = Math.max(6, Math.floor(alto * intensidad * (0.4 + Math.random() * 0.6)));
    const inicio = Math.floor(Math.random() * Math.max(1, alto - largo));
    ordenarSegmento(data, ancho, x, inicio, Math.min(alto, inicio + largo), false);
  }
}

// El largo de la corrida de sorting escala con edaNorm (arousal).
function aplicarPixelSorting(data, ancho, alto, edaNorm, g) {
  const intensidad = clamp(edaNorm * g.sort, 0, 1);
  if (intensidad < 0.03) return;

  ordenarPorFilas(data, ancho, alto, intensidad);
  if (g.sortEjes === "ambos") {
    ordenarPorColumnas(data, ancho, alto, intensidad * 0.7);
  }
}

// --- 2. bvp_std (variabilidad de pulso) → frame bleed ---------------
// Mezcla el frame anterior sobre el actual. Un pequeño desplazamiento
// horizontal del frame anterior simula un artefacto de compensación
// de movimiento (el "fantasma" no queda perfectamente alineado).

function ruidoPseudoAleatorio(tiempoMs, semilla) {
  const paso = Math.floor(tiempoMs / 80);
  const x = Math.sin(paso * 12.9898 + semilla * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

function calcularOpacidadBleed(bvpStdNorm, g, tiempoMs) {
  const base = bvpStdNorm * g.bleed;

  if (g.bleedModo === "erratico") {
    const ruido = ruidoPseudoAleatorio(tiempoMs, 1);
    return clamp(base * (0.35 + ruido * 0.9), 0, 0.85);
  }

  if (g.bleedModo === "ritmico") {
    const fase = (tiempoMs / 1000) * 0.6 * Math.PI * 2; // ritmo lento, ~0.6 Hz
    const onda = 0.5 + 0.5 * Math.sin(fase);
    return clamp(base * (0.4 + 0.6 * onda), 0, 0.85);
  }

  // "plano": casi sin modulación temporal, apenas respira.
  return clamp(base * 0.3, 0, 0.85);
}

function aplicarFrameBleed(actual, anterior, ancho, alto, opacidad, g, tiempoMs) {
  if (opacidad < 0.01 || !anterior) return;

  let desplazamiento = Math.round(opacidad * 3);
  if (g.bleedModo === "erratico" && ruidoPseudoAleatorio(tiempoMs, 2) > 0.5) {
    desplazamiento *= -1;
  }

  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const idx = (y * ancho + x) * 4;
      const xAnt = clamp(x - desplazamiento, 0, ancho - 1);
      const idxAnt = (y * ancho + xAnt) * 4;

      actual[idx] = actual[idx] * (1 - opacidad) + anterior[idxAnt] * opacidad;
      actual[idx + 1] = actual[idx + 1] * (1 - opacidad) + anterior[idxAnt + 1] * opacidad;
      actual[idx + 2] = actual[idx + 2] * (1 - opacidad) + anterior[idxAnt + 2] * opacidad;
    }
  }
}

// --- 3. temp_mean → aberración cromática (mapeo invertido) ----------
// Temperatura baja (vasoconstricción / estrés) separa los canales
// más. Temperatura alta los mantiene alineados. Por eso el offset
// se calcula sobre (1 - tempNorm), no sobre tempNorm.

const OFFSET_MAX_ABERRACION_PX = 16;

function calcularOffsetAberracion(tempNorm, g) {
  if (g.aberr === 0) return 0;
  return (1 - tempNorm) * OFFSET_MAX_ABERRACION_PX * g.aberr;
}

function aplicarAberracionCromatica(data, ancho, alto, offsetPx) {
  const desplazamiento = Math.round(offsetPx);
  if (desplazamiento < 1) return;

  const original = new Uint8ClampedArray(data);

  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const idx = (y * ancho + x) * 4;
      const idxR = (y * ancho + clamp(x - desplazamiento, 0, ancho - 1)) * 4;
      const idxB = (y * ancho + clamp(x + desplazamiento, 0, ancho - 1)) * 4;

      data[idx] = original[idxR];         // rojo, desplazado
      data[idx + 2] = original[idxB + 2]; // azul, desplazado al lado contrario
      // el verde queda en su lugar: ancla la imagen y hace legible el corte
    }
  }
}

// ======================================================
// 06 — MOTOR DE REPRODUCCIÓN
// ======================================================

let reproduciendo = false;
let tiempoInicioMs = 0;
let tiempoAcumuladoMs = 0;
let ultimoRecalculoMs = -Infinity;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function evaluarSesionEnTiempo(transcurridoMs) {
  const bloques = sesionActual.bloques;
  if (bloques.length === 0) return null;

  const duracionTotal = bloques.length * DURACION_BLOQUE_MS;
  // % puede devolver negativo si transcurridoMs < 0 (posible en el primer
  // frame tras dar play, por redondeo entre performance.now() y el
  // timestamp de requestAnimationFrame). Se normaliza al rango positivo.
  const t = ((transcurridoMs % duracionTotal) + duracionTotal) % duracionTotal;
  const posicion = t / DURACION_BLOQUE_MS;

  const i0 = Math.floor(posicion) % bloques.length;
  const i1 = (i0 + 1) % bloques.length;
  const frac = posicion - Math.floor(posicion);

  const a = bloques[i0];
  const b = bloques[i1];

  return {
    condicion: a.condicion,
    edaNorm: lerp(a.edaNorm, b.edaNorm, frac),
    bvpStdNorm: lerp(a.bvpStdNorm, b.bvpStdNorm, frac),
    tempNorm: lerp(a.tempNorm, b.tempNorm, frac),
  };
}

function aplicarCorrupcion(params, tiempoMs) {
  if (!ctx || !pristinoData) return;

  const g = gramaticaSegura(params.condicion);
  const trabajo = new Uint8ClampedArray(pristinoData);

  const offsetAberracion = calcularOffsetAberracion(params.tempNorm, g);
  aplicarAberracionCromatica(trabajo, anchoLienzo, altoLienzo, offsetAberracion);

  aplicarPixelSorting(trabajo, anchoLienzo, altoLienzo, params.edaNorm, g);

  const opacidadBleed = calcularOpacidadBleed(params.bvpStdNorm, g, tiempoMs);
  aplicarFrameBleed(trabajo, bufferAnterior, anchoLienzo, altoLienzo, opacidadBleed, g, tiempoMs);

  bufferAnterior.set(trabajo);
  imageDataSalida.data.set(trabajo);
  ctx.putImageData(imageDataSalida, 0, 0);
}

function gramaticaSegura(condicion) {
  return GRAMATICA[condicion] ?? GRAMATICA.baseline;
}

function dibujarFramePristino() {
  if (!ctx || !pristinoData) return;
  bufferAnterior.set(pristinoData);
  imageDataSalida.data.set(pristinoData);
  ctx.putImageData(imageDataSalida, 0, 0);
  actualizarEtiquetaCondicion(null);
}

function actualizarEtiquetaCondicion(condicion) {
  const etiqueta = document.querySelector("#condicion-label");
  if (!condicion) {
    etiqueta.textContent = "—";
    etiqueta.dataset.condicion = "";
    return;
  }
  etiqueta.textContent = nombresCondicion[condicion] ?? condicion;
  etiqueta.dataset.condicion = condicion;
}

function pasoReproduccion(ahoraMs) {
  if (!reproduciendo || sesionActual.bloques.length === 0) return;

  const transcurrido = Math.max(0, tiempoAcumuladoMs + (ahoraMs - tiempoInicioMs));
  const params = evaluarSesionEnTiempo(transcurrido);
  if (!params) return;

  actualizarEtiquetaCondicion(params.condicion);

  if (ahoraMs - ultimoRecalculoMs >= INTERVALO_RECALCULO_MS) {
    ultimoRecalculoMs = ahoraMs;
    aplicarCorrupcion(params, transcurrido);
  }
}

// ======================================================
// 07 — IMAGEN FUENTE
// ======================================================

function cargarImagen(indice = 0) {
  if (indice >= NOMBRES_IMAGEN.length) {
    console.warn(
      "No se encontró ninguna imagen en assets/images/. Usando silueta de referencia."
    );
    prepararLienzoConPlaceholder();
    return;
  }

  const img = new Image();
  img.onload = () => prepararLienzoConImagen(img);
  img.onerror = () => cargarImagen(indice + 1);
  img.src = `./assets/images/${NOMBRES_IMAGEN[indice]}`;
}

function inicializarBuffers() {
  const inicial = ctx.getImageData(0, 0, anchoLienzo, altoLienzo);
  pristinoData = new Uint8ClampedArray(inicial.data);
  bufferAnterior = new Uint8ClampedArray(inicial.data);
  imageDataSalida = ctx.createImageData(anchoLienzo, altoLienzo);
}

function prepararLienzoConImagen(img) {
  const escala = Math.min(1, ANCHO_MAX_LIENZO / img.width);
  anchoLienzo = Math.round(img.width * escala);
  altoLienzo = Math.round(img.height * escala);

  lienzo.width = anchoLienzo;
  lienzo.height = altoLienzo;
  ctx = lienzo.getContext("2d", { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, anchoLienzo, altoLienzo);

  inicializarBuffers();
  document.querySelector("#imagen-label").textContent = "imagen propia cargada";
}

function prepararLienzoConPlaceholder() {
  anchoLienzo = 420;
  altoLienzo = 520;

  lienzo.width = anchoLienzo;
  lienzo.height = altoLienzo;
  ctx = lienzo.getContext("2d", { willReadFrequently: true });

  const gradiente = ctx.createRadialGradient(
    anchoLienzo / 2, altoLienzo * 0.38, 20,
    anchoLienzo / 2, altoLienzo * 0.5, altoLienzo * 0.75
  );
  gradiente.addColorStop(0, "#d8c9b8");
  gradiente.addColorStop(0.55, "#8a7261");
  gradiente.addColorStop(1, "#221c17");
  ctx.fillStyle = gradiente;
  ctx.fillRect(0, 0, anchoLienzo, altoLienzo);

  ctx.fillStyle = "rgba(20,16,14,0.85)";
  ctx.beginPath();
  ctx.ellipse(anchoLienzo / 2, altoLienzo * 0.34, anchoLienzo * 0.19, altoLienzo * 0.24, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(anchoLienzo * 0.26, altoLienzo * 0.98);
  ctx.quadraticCurveTo(anchoLienzo * 0.5, altoLienzo * 0.55, anchoLienzo * 0.74, altoLienzo * 0.98);
  ctx.closePath();
  ctx.fill();

  inicializarBuffers();

  document.querySelector("#imagen-label").textContent = "silueta de referencia (falta assets/images/retrato.*)";
  document.querySelector("#aviso-imagen").hidden = false;
}

// ======================================================
// 08 — INTERFAZ
// ======================================================

document.querySelector("#filtro-sujeto").addEventListener("change", (event) => {
  seleccionarSujeto(event.target.value);
});

document.querySelector("#reproducir").addEventListener("click", (event) => {
  reproduciendo = !reproduciendo;

  if (reproduciendo) {
    tiempoInicioMs = performance.now();
  } else {
    tiempoAcumuladoMs += performance.now() - tiempoInicioMs;
  }

  event.target.textContent = reproduciendo ? "Pausar sesión" : "Reproducir sesión";
});

function actualizarEstadoDatos(tipo) {
  const estado = document.querySelector("#estado-label");
  if (tipo === "listo") {
    estado.innerHTML = '<i class="status-dot"></i> listo';
  } else if (tipo === "error") {
    estado.textContent = "error cargando CSV";
  } else {
    estado.textContent = "cargando…";
  }
}

// ======================================================
// 09 — BUCLE PRINCIPAL
// ======================================================

function animar(ahoraMs) {
  requestAnimationFrame(animar);
  pasoReproduccion(ahoraMs);
}

cargarImagen();
cargarDatos();
requestAnimationFrame(animar);
