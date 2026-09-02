// ======================================================
// 01 — CONFIGURACIÓN
// ======================================================
// Fuente: rse.csv, datos reales de openpsychometrics.org
// (Rosenberg Self-Esteem Scale). Cada fila es una persona real.
//
// Codebook confirmado:
// Q1-Q10: 1=muy en desacuerdo .. 4=muy de acuerdo, 0=sin respuesta.
// Ítems invertidos del Rosenberg original: Q3, Q5, Q8, Q9, Q10.
// gender: 1=hombre, 2=mujer, 3=otro (el codebook original tiene un
// error de tipeo aquí, se usa la convención estándar del dataset).
// age: 0 = respuesta no convertible a número entero.

const RUTA_CSV = "./assets/data/rse.csv";
const ITEMS_INVERTIDOS = new Set(["Q3", "Q5", "Q8", "Q9", "Q10"]);

const COLOR_GENERO = {
  1: "rgba(111, 155, 209, 0.45)", // hombre
  2: "rgba(217, 122, 151, 0.45)", // mujer
  3: "rgba(217, 164, 65, 0.45)",  // otro
};
const NOMBRE_GENERO = { 1: "Hombre", 2: "Mujer", 3: "Otro" };

const filtros = {
  edadMin: 15,
  edadMax: 70,
  generos: new Set([1, 2, 3]),
};

let personas = []; // { edad, puntaje, genero }
let personasVisibles = [];

const canvas = document.querySelector("#lienzo");
const ctx = canvas.getContext("2d");
const margen = { izq: 55, der: 20, arriba: 20, abajo: 45 };
const areaGrafico = {
  x: margen.izq,
  y: margen.arriba,
  ancho: canvas.width - margen.izq - margen.der,
  alto: canvas.height - margen.arriba - margen.abajo,
};

const ejeX = { min: 10, max: 90 };  // rango de edad mostrado en el eje
const ejeY = { min: 10, max: 40 };  // rango posible del puntaje Rosenberg

// ======================================================
// 02 — CARGA Y PARSEO
// ======================================================

async function cargarDatos() {
  try {
    const respuesta = await fetch(RUTA_CSV, { cache: "no-store" });
    if (!respuesta.ok) throw new Error("No se pudo leer rse.csv");
    const texto = await respuesta.text();

    personas = procesarCSV(texto);

    document.querySelector("#fuente-label").textContent =
      "Rosenberg Scale (openpsychometrics.org)";

    aplicarFiltros();
  } catch (error) {
    console.error(error);
    document.querySelector("#fuente-label").textContent = "Error cargando rse.csv";
  }
}

function procesarCSV(texto) {
  const lineas = texto.trim().split("\n");

  // el delimitador real varía según cómo se exportó el archivo;
  // probamos tab, luego coma, luego cualquier espacio.
  const delimitador = lineas[0].includes("\t")
    ? "\t"
    : lineas[0].includes(",")
    ? ","
    : /\s+/;

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

// REGLA: de las 10 respuestas crudas a un puntaje único 10-40,
// invirtiendo los ítems que corresponde según el Rosenberg original.
function calcularPersona(fila) {
  const edad = Number(fila.age);
  const genero = Number(fila.gender);

  if (!edad || edad < 5 || edad > 100) return null; // 0 = sin respuesta válida
  if (![1, 2, 3].includes(genero)) return null;

  let puntaje = 0;
  for (let i = 1; i <= 10; i++) {
    const clave = `Q${i}`;
    const valorCrudo = Number(fila[clave]);
    if (!valorCrudo || valorCrudo < 1 || valorCrudo > 4) return null; // excluye sin respuesta

    puntaje += ITEMS_INVERTIDOS.has(clave) ? 5 - valorCrudo : valorCrudo;
  }

  return { edad, puntaje, genero };
}

// ======================================================
// 03 — FILTROS
// ======================================================

function aplicarFiltros() {
  personasVisibles = personas.filter(
    (p) =>
      p.edad >= filtros.edadMin &&
      p.edad <= filtros.edadMax &&
      filtros.generos.has(p.genero)
  );

  document.querySelector("#conteo-label").textContent =
    personasVisibles.length.toLocaleString("es-CL");

  dibujar();
}

// ======================================================
// 04 — REGLAS: DATO → POSICIÓN EN PANTALLA
// ======================================================

function xDeEdad(edad) {
  const t = (edad - ejeX.min) / (ejeX.max - ejeX.min);
  return areaGrafico.x + t * areaGrafico.ancho;
}

function yDePuntaje(puntaje) {
  const t = (puntaje - ejeY.min) / (ejeY.max - ejeY.min);
  return areaGrafico.y + areaGrafico.alto - t * areaGrafico.alto;
}

// ======================================================
// 05 — DIBUJO
// ======================================================

function dibujarEjes() {
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.font = "11px sans-serif";

  ctx.beginPath();
  ctx.moveTo(areaGrafico.x, areaGrafico.y);
  ctx.lineTo(areaGrafico.x, areaGrafico.y + areaGrafico.alto);
  ctx.lineTo(areaGrafico.x + areaGrafico.ancho, areaGrafico.y + areaGrafico.alto);
  ctx.stroke();

  for (let edad = 10; edad <= 90; edad += 10) {
    const x = xDeEdad(edad);
    ctx.fillText(edad, x - 6, areaGrafico.y + areaGrafico.alto + 18);
  }
  ctx.textAlign = "right";
  for (let puntaje = 10; puntaje <= 40; puntaje += 10) {
    const y = yDePuntaje(puntaje);
    ctx.fillText(puntaje, areaGrafico.x - 8, y + 4);
  }
  ctx.textAlign = "left";
  ctx.fillText("edad →", areaGrafico.x + areaGrafico.ancho - 40, areaGrafico.y + areaGrafico.alto + 34);
  ctx.save();
  ctx.translate(14, areaGrafico.y + 10);
  ctx.rotate(Math.PI / 2);
  ctx.fillText("puntaje Rosenberg →", 0, 0);
  ctx.restore();
}

function dibujar() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  dibujarEjes();

  personasVisibles.forEach((persona) => {
    ctx.beginPath();
    ctx.arc(xDeEdad(persona.edad), yDePuntaje(persona.puntaje), 3, 0, Math.PI * 2);
    ctx.fillStyle = COLOR_GENERO[persona.genero];
    ctx.fill();
  });
}

// ======================================================
// 06 — INTERACCIÓN: HOVER
// ======================================================

canvas.addEventListener("mousemove", (evento) => {
  const rect = canvas.getBoundingClientRect();
  const mx = ((evento.clientX - rect.left) / rect.width) * canvas.width;
  const my = ((evento.clientY - rect.top) / rect.height) * canvas.height;

  let masCercano = null;
  let distanciaMinima = 10; // radio de detección en píxeles

  for (const persona of personasVisibles) {
    const px = xDeEdad(persona.edad);
    const py = yDePuntaje(persona.puntaje);
    const distancia = Math.hypot(px - mx, py - my);
    if (distancia < distanciaMinima) {
      distanciaMinima = distancia;
      masCercano = persona;
    }
  }

  const tooltip = document.querySelector("#tooltip");
  tooltip.textContent = masCercano
    ? `${NOMBRE_GENERO[masCercano.genero]} · ${masCercano.edad} años · puntaje ${masCercano.puntaje}/40`
    : "Pasa el mouse sobre un punto para ver el detalle.";
});

// ======================================================
// 07 — CONTROLES
// ======================================================

function conectarRango(idInput, idOutput, clave) {
  const input = document.querySelector(`#${idInput}`);
  const output = document.querySelector(`#${idOutput}`);
  input.addEventListener("input", () => {
    filtros[clave] = Number(input.value);
    output.value = input.value;
    aplicarFiltros();
  });
}

conectarRango("edad-min", "edad-min-valor", "edadMin");
conectarRango("edad-max", "edad-max-valor", "edadMax");

[1, 2, 3].forEach((genero) => {
  document.querySelector(`#genero-${genero}`).addEventListener("change", (evento) => {
    if (evento.target.checked) filtros.generos.add(genero);
    else filtros.generos.delete(genero);
    aplicarFiltros();
  });
});

document.querySelector("#reset").addEventListener("click", () => {
  filtros.edadMin = 15;
  filtros.edadMax = 70;
  filtros.generos = new Set([1, 2, 3]);

  document.querySelector("#edad-min").value = 15;
  document.querySelector("#edad-max").value = 70;
  document.querySelector("#edad-min-valor").value = 15;
  document.querySelector("#edad-max-valor").value = 70;
  [1, 2, 3].forEach((g) => (document.querySelector(`#genero-${g}`).checked = true));

  aplicarFiltros();
});

// ======================================================
// 08 — ARRANQUE
// ======================================================

cargarDatos();
