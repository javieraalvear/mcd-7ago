// ======================================================
// SOLO EL DATO — sin cámara, sin glitch
// ======================================================
// Esta página no corrompe nada: muestra en gráficos simples exactamente
// los mismos números que produce main.js (construirBloquesDeSujeto +
// normalizarSesion) antes de que esos números lleguen a convertirse en
// pixel sorting, frame bleed o aberración cromática. Es el paso previo
// al "cruce" — para verlo hay que ver primero qué hay en el CSV.
//
// Deliberadamente NO importa main.js: ese archivo pide la cámara apenas
// se carga, y esta página no debe pedir ningún permiso. Duplica el
// mínimo de lógica de datos (misma cantidad de bloques, misma fórmula)
// para que los números sean comparables 1:1 con los de la pieza.

const RUTA_CSV = "./assets/data/wesad_light.csv";
const SUJETO_POR_DEFECTO = "S2"; // el mismo que usa la pieza (main.js)
const BLOQUES_POR_SESION = 60;   // el mismo N que usa la pieza

const nombresCondicion = {
  baseline: "Baseline",
  stress: "Estrés",
  amusement: "Diversión",
};

// Mismo orden fijo de color en todos los gráficos de esta página —
// identidad de condición, no de variable.
const COLOR_CONDICION = {
  baseline: "#3987e5",
  stress: "#d95926",
  amusement: "#199e70",
};

let filas = [];
let sujetosOrdenados = [];

// ======================================================
// CSV → bloques (misma fórmula que main.js, con tiempo real agregado)
// ======================================================

function parsearCSV(texto) {
  const lineas = texto.trim().split("\n");
  const encabezados = lineas[0].split(",");
  return lineas.slice(1).map((linea) => {
    const valores = linea.split(",");
    const fila = {};
    encabezados.forEach((clave, i) => {
      fila[clave] =
        clave === "subject" || clave === "condition" ? valores[i] : Number(valores[i]);
    });
    return fila;
  });
}

function normalizarEda(fila, rango) {
  if (!rango || rango.max === rango.min) return 0.5;
  return (fila.eda_mean - rango.min) / (rango.max - rango.min);
}

function desviacionEstandar(valores) {
  if (valores.length === 0) return 0;
  const media = valores.reduce((acc, v) => acc + v, 0) / valores.length;
  const varianza = valores.reduce((acc, v) => acc + (v - media) ** 2, 0) / valores.length;
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
        conteoCondiciones[fila.condition] = (conteoCondiciones[fila.condition] || 0) + 1;
      });
      const condicionDominante = Object.entries(conteoCondiciones).sort(
        (a, b) => b[1] - a[1]
      )[0][0];

      const edaNorm =
        grupo.reduce((acc, fila) => acc + normalizarEda(fila, rangoEda), 0) / grupo.length;
      const edaCrudo = grupo.reduce((acc, fila) => acc + fila.eda_mean, 0) / grupo.length;
      const bvpStd = desviacionEstandar(grupo.map((fila) => fila.bvp_mean));
      const tempMean = grupo.reduce((acc, fila) => acc + fila.temp_mean, 0) / grupo.length;

      return {
        sujeto,
        indice,
        condicion: condicionDominante,
        edaNorm,
        edaCrudo,
        bvpStd,
        tempMean,
        // Tiempo real del bloque dentro de la sesión (para el eje X).
        tInicioMin: (tInicio + (indice / n) * duracion) / 60,
        tFinMin: (tInicio + ((indice + 1) / n) * duracion) / 60,
      };
    })
    .filter(Boolean);
}

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
    // Mismo mapeo invertido que usa la pieza para la aberración: temp
    // baja (vasoconstricción) → tempNorm bajo → separación alta.
    tempNorm: tempMax > tempMin ? (b.tempMean - tempMin) / (tempMax - tempMin) : 0.5,
  }));
}

// ======================================================
// GRÁFICOS SVG — un eje, un trazo, bandas de condición
// ======================================================

const ANCHO_GRAFICO = 720;
const ALTO_GRAFICO = 140;
const MARGEN = { arriba: 10, abajo: 24, izquierda: 34, derecha: 10 };

const SVG_NS = "http://www.w3.org/2000/svg";

function crearElementoSVG(tag, atributos) {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(atributos).forEach(([clave, valor]) => el.setAttribute(clave, valor));
  return el;
}

function dibujarGrafico(contenedor, bloques, campo, formatoValor) {
  contenedor.innerHTML = "";

  const anchoUtil = ANCHO_GRAFICO - MARGEN.izquierda - MARGEN.derecha;
  const altoUtil = ALTO_GRAFICO - MARGEN.arriba - MARGEN.abajo;

  const tMin = bloques[0].tInicioMin;
  const tMax = bloques[bloques.length - 1].tFinMin;
  const duracionMin = Math.max(0.01, tMax - tMin);

  const x = (min) => MARGEN.izquierda + ((min - tMin) / duracionMin) * anchoUtil;
  const y = (valor) => MARGEN.arriba + (1 - valor) * altoUtil;

  const svg = crearElementoSVG("svg", {
    viewBox: `0 0 ${ANCHO_GRAFICO} ${ALTO_GRAFICO}`,
    class: "grafico-svg",
    role: "img",
    "aria-label": `${campo} normalizado a lo largo de la sesión`,
  });

  // Bandas de condición (identidad, no la variable) — de fondo.
  bloques.forEach((bloque) => {
    svg.appendChild(
      crearElementoSVG("rect", {
        x: x(bloque.tInicioMin).toFixed(1),
        y: MARGEN.arriba,
        width: Math.max(0.5, x(bloque.tFinMin) - x(bloque.tInicioMin)).toFixed(1),
        height: altoUtil,
        fill: COLOR_CONDICION[bloque.condicion] ?? "#52514e",
        "fill-opacity": 0.16,
      })
    );
  });

  // Gridlines horizontales recesivas en 0 / 0.5 / 1.
  [0, 0.5, 1].forEach((marca) => {
    svg.appendChild(
      crearElementoSVG("line", {
        x1: MARGEN.izquierda,
        x2: ANCHO_GRAFICO - MARGEN.derecha,
        y1: y(marca).toFixed(1),
        y2: y(marca).toFixed(1),
        class: "gridline",
      })
    );
    const etiqueta = crearElementoSVG("text", {
      x: MARGEN.izquierda - 6,
      y: (y(marca) + 3).toFixed(1),
      class: "eje-texto",
      "text-anchor": "end",
    });
    etiqueta.textContent = marca.toFixed(1);
    svg.appendChild(etiqueta);
  });

  // Ticks de tiempo (minutos) en el eje X.
  const pasosX = 5;
  for (let i = 0; i <= pasosX; i++) {
    const minuto = tMin + (i / pasosX) * duracionMin;
    const etiqueta = crearElementoSVG("text", {
      x: x(minuto).toFixed(1),
      y: ALTO_GRAFICO - 6,
      class: "eje-texto",
      "text-anchor": i === 0 ? "start" : i === pasosX ? "end" : "middle",
    });
    etiqueta.textContent = `${Math.round(minuto)} min`;
    svg.appendChild(etiqueta);
  }

  // La línea: un solo trazo, color neutro — el color ya lo usan las bandas.
  // El CSV no es continuo: WESAD registra otras fases del protocolo
  // (lectura, cuestionarios, preparación) que este dataset no etiqueta,
  // así que hay huecos reales de varios minutos entre bloques. Conectar
  // esos huecos con una línea inventaría datos que no existen — se corta
  // el trazo cada vez que el siguiente bloque no es el consecutivo real.
  let segmento = [];
  const segmentos = [];
  bloques.forEach((bloque, i) => {
    const esContinuacion = i === 0 || bloque.indice === bloques[i - 1].indice + 1;
    if (!esContinuacion && segmento.length > 0) {
      segmentos.push(segmento);
      segmento = [];
    }
    const cx = (x(bloque.tInicioMin) + x(bloque.tFinMin)) / 2;
    segmento.push(`${cx.toFixed(1)},${y(bloque[campo]).toFixed(1)}`);
  });
  if (segmento.length > 0) segmentos.push(segmento);

  segmentos.forEach((puntos) => {
    svg.appendChild(
      crearElementoSVG("polyline", { points: puntos.join(" "), class: "linea-dato" })
    );
  });

  // Capa de hover: crosshair + tooltip, una franja invisible por bloque.
  const grupoHover = crearElementoSVG("g", { class: "capa-hover" });
  const crosshair = crearElementoSVG("line", {
    x1: 0, x2: 0, y1: MARGEN.arriba, y2: MARGEN.arriba + altoUtil,
    class: "crosshair",
  });
  crosshair.style.display = "none";
  svg.appendChild(crosshair);

  bloques.forEach((bloque) => {
    const franja = crearElementoSVG("rect", {
      x: x(bloque.tInicioMin).toFixed(1),
      y: MARGEN.arriba,
      width: Math.max(0.5, x(bloque.tFinMin) - x(bloque.tInicioMin)).toFixed(1),
      height: altoUtil,
      fill: "transparent",
      // fill="transparent" no pinta nada, y bajo pointer-events por
      // defecto (visiblePainted) un área sin pintar no recibe punteros.
      // Sin esto, el hover nunca dispara.
      "pointer-events": "all",
    });
    franja.addEventListener("pointerenter", () => {
      crosshair.style.display = "block";
      const cx = (x(bloque.tInicioMin) + x(bloque.tFinMin)) / 2;
      crosshair.setAttribute("x1", cx.toFixed(1));
      crosshair.setAttribute("x2", cx.toFixed(1));
      mostrarTooltip(contenedor, bloque, campo, formatoValor, cx);
    });
    franja.addEventListener("pointerleave", () => {
      crosshair.style.display = "none";
      ocultarTooltip(contenedor);
    });
    grupoHover.appendChild(franja);
  });
  svg.appendChild(grupoHover);

  contenedor.appendChild(svg);
}

function mostrarTooltip(contenedor, bloque, campo, formatoValor, cx) {
  let tooltip = contenedor.querySelector(".tooltip-grafico");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.className = "tooltip-grafico";
    contenedor.appendChild(tooltip);
  }

  const punto = document.createElement("strong");
  punto.textContent = bloque[campo].toFixed(2);
  const tiempo = document.createElement("span");
  tiempo.textContent = `${bloque.tInicioMin.toFixed(1)}–${bloque.tFinMin.toFixed(1)} min`;
  const condicion = document.createElement("span");
  condicion.className = "tooltip-condicion";
  condicion.style.setProperty("--dot", COLOR_CONDICION[bloque.condicion] ?? "#898781");
  condicion.textContent = nombresCondicion[bloque.condicion] ?? bloque.condicion;
  const crudo = document.createElement("span");
  crudo.textContent = formatoValor(bloque);

  tooltip.replaceChildren(punto, tiempo, condicion, crudo);

  const porcentajeX = Math.min(88, Math.max(4, (cx / ANCHO_GRAFICO) * 100));
  tooltip.style.left = `${porcentajeX}%`;
  tooltip.hidden = false;
}

function ocultarTooltip(contenedor) {
  const tooltip = contenedor.querySelector(".tooltip-grafico");
  if (tooltip) tooltip.hidden = true;
}

// ======================================================
// TABLA (vista alternativa, sin depender del hover)
// ======================================================

function poblarTabla(bloques) {
  const cuerpo = document.querySelector("#tabla-bloques tbody");
  cuerpo.innerHTML = "";

  bloques.forEach((bloque) => {
    const fila = document.createElement("tr");

    const celdas = [
      `${bloque.tInicioMin.toFixed(1)}–${bloque.tFinMin.toFixed(1)} min`,
      nombresCondicion[bloque.condicion] ?? bloque.condicion,
      bloque.edaNorm.toFixed(2),
      bloque.bvpStdNorm.toFixed(2),
      bloque.tempNorm.toFixed(2),
    ];

    celdas.forEach((texto, i) => {
      const celda = document.createElement("td");
      celda.textContent = texto;
      if (i === 1) celda.dataset.condicion = bloque.condicion;
      fila.appendChild(celda);
    });

    cuerpo.appendChild(fila);
  });
}

// ======================================================
// ORQUESTACIÓN
// ======================================================

function renderizarSujeto(sujeto) {
  const bloques = normalizarSesion(construirBloquesDeSujeto(sujeto, BLOQUES_POR_SESION));
  if (bloques.length === 0) return;

  dibujarGrafico(
    document.querySelector("#grafico-eda"),
    bloques,
    "edaNorm",
    (b) => `EDA cruda: ${b.edaCrudo.toFixed(2)} µS`
  );
  dibujarGrafico(
    document.querySelector("#grafico-bvp"),
    bloques,
    "bvpStdNorm",
    (b) => `desv. estándar cruda: ${b.bvpStd.toFixed(2)}`
  );
  dibujarGrafico(
    document.querySelector("#grafico-temp"),
    bloques,
    "tempNorm",
    (b) => `temp. cruda: ${b.tempMean.toFixed(2)} °C`
  );

  poblarTabla(bloques);
  document.querySelector("#duracion-label").textContent =
    `${bloques[0].tInicioMin.toFixed(0)}–${bloques[bloques.length - 1].tFinMin.toFixed(0)} min`;
}

function poblarSelectorSujetos() {
  const selector = document.querySelector("#selector-sujeto");
  sujetosOrdenados.forEach((sujeto) => {
    const opcion = document.createElement("option");
    opcion.value = sujeto;
    opcion.textContent = sujeto;
    selector.appendChild(opcion);
  });
  selector.value = SUJETO_POR_DEFECTO;
}

document.querySelector("#selector-sujeto").addEventListener("change", (event) => {
  renderizarSujeto(event.target.value);
});

async function iniciar() {
  const respuesta = await fetch(RUTA_CSV, { cache: "no-store" });
  const texto = await respuesta.text();
  filas = parsearCSV(texto);

  sujetosOrdenados = [...new Set(filas.map((fila) => fila.subject))].sort(
    (a, b) => Number(a.slice(1)) - Number(b.slice(1))
  );

  poblarSelectorSujetos();
  renderizarSujeto(SUJETO_POR_DEFECTO);
}

iniciar();
