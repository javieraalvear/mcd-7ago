// ======================================================
// 01 — CONFIGURACIÓN
// ======================================================
// Fuente: wesad_light.csv (dataset propio, derivado de WESAD).
// La cámara del usuario es la imagen que se corrompe; los datos
// biométricos de un sujeto grabado en otro momento son la regla
// que decide cómo se rompe esa imagen, en tiempo real.

const RUTA_CSV = "./assets/data/wesad_light.csv";
const DURACION_SESION_MS = 45000; // duración de la reproducción, comprimida
const BLOQUES_POR_SESION = 60;
const ANCHO_PROCESO = 320;
const ALTO_PROCESO = 240;

const video = document.querySelector("#video-fuente");
const canvas = document.querySelector("#lienzo");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
canvas.width = ANCHO_PROCESO;
canvas.height = ALTO_PROCESO;

let filas = [];
let sujetosOrdenados = [];
let rangoEdaPorSujeto = new Map();
let rangoTempPorSujeto = new Map();
let bloquesSesion = [];

let reproduciendo = false;
let inicioReproduccion = 0;
let bufferAnterior = null; // ImageData del frame anterior, para el frame bleed

const nombresCondicion = {
  baseline: "Baseline",
  stress: "Estrés",
  amusement: "Diversión",
};

const notasCondicion = {
  baseline: "Reposo. La imagen apenas se altera: casi todo el peso queda en tu propio reflejo, sin corrupción.",
  stress: "Pixel sorting agresivo, aberración marcada y un frame bleed errático. La imagen se rompe de forma impredecible.",
  amusement: "Frame bleed suave y rítmico, sin aberración cromática. La ruptura tiene pulso, no caos.",
};

// ======================================================
// 02 — CÁMARA
// ======================================================

async function iniciarCamara() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: 640, height: 480 },
      audio: false,
    });
    video.srcObject = stream;
    document.querySelector("#mensaje-camara").textContent =
      "Cámara activa · presiona Iniciar sesión";
  } catch (error) {
    console.error("No se pudo acceder a la cámara", error);
    document.querySelector("#mensaje-camara").textContent =
      "No se pudo acceder a la cámara. Revisa los permisos del navegador y recarga.";
  }
}

// ======================================================
// 03 — DATOS: CSV → BLOQUES DE SESIÓN
// ======================================================

async function cargarDatos() {
  const respuesta = await fetch(RUTA_CSV, { cache: "no-store" });
  const texto = await respuesta.text();
  filas = parsearCSV(texto);

  sujetosOrdenados = [...new Set(filas.map((f) => f.subject))].sort(
    (a, b) => Number(a.slice(1)) - Number(b.slice(1))
  );

  rangoEdaPorSujeto = calcularRangoPorSujeto("eda_mean");
  rangoTempPorSujeto = calcularRangoPorSujeto("temp_mean");

  poblarSelectorSujetos();
  construirSesion(sujetosOrdenados[0]);
  document.querySelector("#fuente-label").textContent =
    "WESAD · dataset propio (CSV)";
}

function parsearCSV(texto) {
  const lineas = texto.trim().split("\n");
  const encabezados = lineas[0].split(",");
  return lineas.slice(1).map((linea) => {
    const valores = linea.split(",");
    const fila = {};
    encabezados.forEach((clave, i) => {
      fila[clave] =
        clave === "subject" || clave === "condition"
          ? valores[i]
          : Number(valores[i]);
    });
    return fila;
  });
}

function calcularRangoPorSujeto(campo) {
  const rangos = new Map();
  sujetosOrdenados.forEach((sujeto) => {
    const valores = filas
      .filter((f) => f.subject === sujeto)
      .map((f) => f[campo]);
    rangos.set(sujeto, { min: Math.min(...valores), max: Math.max(...valores) });
  });
  return rangos;
}

function normalizar(valor, rango) {
  if (!rango || rango.max === rango.min) return 0.5;
  return Math.min(1, Math.max(0, (valor - rango.min) / (rango.max - rango.min)));
}

function poblarSelectorSujetos() {
  const selector = document.querySelector("#filtro-sujeto");
  sujetosOrdenados.forEach((sujeto) => {
    const opcion = document.createElement("option");
    opcion.value = sujeto;
    opcion.textContent = sujeto;
    selector.appendChild(opcion);
  });

  selector.addEventListener("change", (event) => {
    construirSesion(event.target.value);
  });
}

// Reduce la sesión completa de un sujeto a N bloques temporales,
// cada uno con su condición dominante y sus tres variables
// normalizadas, listos para conducir el motor de glitch.
function construirSesion(sujeto) {
  const filasSujeto = filas
    .filter((f) => f.subject === sujeto)
    .sort((a, b) => a.window_start_s - b.window_start_s);

  if (filasSujeto.length === 0) return;

  const tInicio = filasSujeto[0].window_start_s;
  const tFin = filasSujeto[filasSujeto.length - 1].window_start_s;
  const duracion = Math.max(1, tFin - tInicio);

  const grupos = Array.from({ length: BLOQUES_POR_SESION }, () => []);
  filasSujeto.forEach((fila) => {
    const posicion = (fila.window_start_s - tInicio) / duracion;
    const indice = Math.min(BLOQUES_POR_SESION - 1, Math.floor(posicion * BLOQUES_POR_SESION));
    grupos[indice].push(fila);
  });

  const rangoEda = rangoEdaPorSujeto.get(sujeto);
  const rangoTemp = rangoTempPorSujeto.get(sujeto);

  bloquesSesion = grupos
    .map((grupo) => {
      if (grupo.length === 0) return null;

      const conteo = {};
      grupo.forEach((f) => (conteo[f.condition] = (conteo[f.condition] || 0) + 1));
      const condicion = Object.entries(conteo).sort((a, b) => b[1] - a[1])[0][0];

      const edaNorm =
        grupo.reduce((acc, f) => acc + normalizar(f.eda_mean, rangoEda), 0) / grupo.length;
      const tempNorm =
        grupo.reduce((acc, f) => acc + normalizar(f.temp_mean, rangoTemp), 0) / grupo.length;
      const bvpStd = grupo.reduce((acc, f) => acc + f.bvp_std, 0) / grupo.length;

      return {
        condicion,
        edaNorm,
        tempInvertida: 1 - tempNorm, // vasoconstricción (temp baja) = más aberración
        bvpIntensidad: Math.min(1, Math.log(1 + bvpStd) / 3),
      };
    })
    .filter(Boolean);
}

// ======================================================
// 04 — GRAMÁTICAS POR CONDICIÓN
// ======================================================
// Las tres condiciones no se distinguen por color, se distinguen
// por cómo combinan y modulan las tres técnicas de glitch.

function calcularIntensidades(bloque, tiempoMs) {
  const t = tiempoMs / 1000;

  if (bloque.condicion === "baseline") {
    return {
      sorting: bloque.edaNorm * 0.15,
      bleed: bloque.bvpIntensidad * 0.1,
      chroma: bloque.tempInvertida * 0.15,
    };
  }

  if (bloque.condicion === "stress") {
    const jitter = 0.7 + Math.random() * 0.6; // erraticidad
    return {
      sorting: Math.min(1, bloque.edaNorm * 1.1 * jitter),
      bleed: Math.min(1, bloque.bvpIntensidad * 1.2 * (0.6 + Math.random() * 0.8)),
      chroma: Math.min(1, bloque.tempInvertida * 1.3),
    };
  }

  // amusement: ritmo suave y periódico, sin aberración cromática.
  const ritmo = 0.5 + 0.5 * Math.sin(t * 2.4);
  return {
    sorting: bloque.edaNorm * 0.3,
    bleed: bloque.bvpIntensidad * 0.5 * ritmo,
    chroma: 0,
  };
}

// ======================================================
// 05 — TÉCNICAS DE GLITCH
// ======================================================

function aplicarPixelSorting(imageData, intensidad) {
  if (intensidad < 0.02) return;

  const { data, width, height } = imageData;
  const filasAfectadas = Math.floor(height * intensidad);
  const largoSegmento = Math.max(8, Math.floor(width * intensidad * 0.7));

  for (let i = 0; i < filasAfectadas; i++) {
    const y = Math.floor(Math.random() * height);
    const inicioX = Math.floor(Math.random() * Math.max(1, width - largoSegmento));
    const segmento = [];

    for (let x = inicioX; x < inicioX + largoSegmento; x++) {
      const idx = (y * width + x) * 4;
      const brillo = data[idx] * 0.3 + data[idx + 1] * 0.59 + data[idx + 2] * 0.11;
      segmento.push({ r: data[idx], g: data[idx + 1], b: data[idx + 2], a: data[idx + 3], brillo });
    }

    segmento.sort((a, b) => a.brillo - b.brillo);

    segmento.forEach((pixel, j) => {
      const idx = (y * width + inicioX + j) * 4;
      data[idx] = pixel.r;
      data[idx + 1] = pixel.g;
      data[idx + 2] = pixel.b;
      data[idx + 3] = pixel.a;
    });
  }
}

function aplicarFrameBleed(imageData, intensidad) {
  if (!bufferAnterior || intensidad < 0.02) return;

  const { data } = imageData;
  const anterior = bufferAnterior.data;

  for (let i = 0; i < data.length; i += 4) {
    data[i] = data[i] * (1 - intensidad) + anterior[i] * intensidad;
    data[i + 1] = data[i + 1] * (1 - intensidad) + anterior[i + 1] * intensidad;
    data[i + 2] = data[i + 2] * (1 - intensidad) + anterior[i + 2] * intensidad;
  }
}

function aplicarAberracionCromatica(imageData, intensidad) {
  if (intensidad < 0.02) return;

  const { data, width, height } = imageData;
  const origen = new Uint8ClampedArray(data);
  const desplazamiento = Math.round(intensidad * 14);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      const xR = Math.min(width - 1, x + desplazamiento);
      const xB = Math.max(0, x - desplazamiento);
      const idxR = (y * width + xR) * 4;
      const idxB = (y * width + xB) * 4;

      data[idx] = origen[idxR];
      data[idx + 2] = origen[idxB + 2];
    }
  }
}

// ======================================================
// 06 — BUCLE PRINCIPAL
// ======================================================

function renderizarFrame() {
  requestAnimationFrame(renderizarFrame);
  if (video.readyState < 2) return;

  // Dibuja el frame de cámara espejado, para que sea un reflejo real.
  ctx.save();
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  ctx.restore();

  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  if (reproduciendo && bloquesSesion.length > 0) {
    const tiempoTranscurrido = performance.now() - inicioReproduccion;
    const progreso = Math.min(1, tiempoTranscurrido / DURACION_SESION_MS);
    const indiceBloque = Math.min(
      bloquesSesion.length - 1,
      Math.floor(progreso * bloquesSesion.length)
    );
    const bloque = bloquesSesion[indiceBloque];
    const intensidades = calcularIntensidades(bloque, tiempoTranscurrido);

    aplicarFrameBleed(imageData, intensidades.bleed);
    aplicarPixelSorting(imageData, intensidades.sorting);
    aplicarAberracionCromatica(imageData, intensidades.chroma);

    const etiquetaCondicion = document.querySelector("#condicion-label");
    etiquetaCondicion.textContent = nombresCondicion[bloque.condicion] ?? bloque.condicion;
    etiquetaCondicion.setAttribute("data-condicion", bloque.condicion);

    document.querySelector("#condicion-nota").textContent = notasCondicion[bloque.condicion] ?? "";
    document.querySelector("#progreso-label").textContent =
      `${Math.round(progreso * 100)}%`;

    if (progreso >= 1) {
      reproduciendo = false;
      document.querySelector("#reproducir").textContent = "Iniciar sesión";
    }
  }

  bufferAnterior = new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height
  );

  ctx.putImageData(imageData, 0, 0);
}

// ======================================================
// 07 — CONTROLES
// ======================================================

document.querySelector("#reproducir").addEventListener("click", (event) => {
  reproduciendo = !reproduciendo;
  inicioReproduccion = performance.now();
  event.target.textContent = reproduciendo ? "Pausar" : "Iniciar sesión";
});

document.querySelector("#reiniciar").addEventListener("click", () => {
  reproduciendo = false;
  document.querySelector("#reproducir").textContent = "Iniciar sesión";
  document.querySelector("#condicion-label").textContent = "—";
  document.querySelector("#progreso-label").textContent = "—";
});

// ======================================================
// 08 — ARRANQUE
// ======================================================

iniciarCamara();
cargarDatos();
renderizarFrame();
