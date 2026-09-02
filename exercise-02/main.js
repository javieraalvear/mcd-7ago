import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

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
  1: new THREE.Color(0x6f9bd1), // hombre
  2: new THREE.Color(0xd97a97), // mujer
  3: new THREE.Color(0xd9a441), // otro
};
const NOMBRE_GENERO = { 1: "Hombre", 2: "Mujer", 3: "Otro" };

const filtros = {
  edadMin: 15,
  edadMax: 70,
  generos: new Set([1, 2, 3]),
};

let personas = []; // { edad, puntaje, genero }
let personasVisibles = [];

// ======================================================
// 02 — ESCENA 3D
// ======================================================

const viewport = document.querySelector("#viewport");
const escena = new THREE.Scene();
escena.background = new THREE.Color(0x0b0b0c);

const camara = new THREE.PerspectiveCamera(
  45,
  viewport.clientWidth / viewport.clientHeight,
  0.1,
  200
);
camara.position.set(26, 22, 32);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
viewport.appendChild(renderer.domElement);

const controlesOrbita = new OrbitControls(camara, renderer.domElement);
controlesOrbita.enableDamping = true;
controlesOrbita.target.set(0, 6, 0);

const suelo = new THREE.GridHelper(44, 22, 0x34383d, 0x1e2024);
suelo.position.y = 0;
escena.add(suelo);

// Rejilla vertical de referencia para leer el puntaje (eje Y) sin
// tener que orbitar hasta quedar de perfil.
const rejillaVertical = new THREE.GridHelper(44, 22, 0x24272c, 0x1a1c1f);
rejillaVertical.rotation.x = Math.PI / 2;
rejillaVertical.position.z = -22;
escena.add(rejillaVertical);

let nubeDePuntos = null;

// ======================================================
// 03 — CARGA Y PARSEO
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
// 04 — FILTROS
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

  construirNubeDePuntos();
}

// ======================================================
// 05 — REGLAS: DATO → POSICIÓN 3D
// ======================================================
// Los mismos dos ejes que la versión 2D (edad → X, puntaje → Y), más
// un tercero que en 2D solo existía como color: género → profundidad.
// El género queda codificado dos veces (posición Z Y color) a
// propósito — en una nube de puntos el color solo no alcanza para
// distinguir grupos cuando la escena rota.

const EJE_EDAD = { min: 10, max: 90, min3D: -18, max3D: 18 };
const EJE_PUNTAJE = { min: 10, max: 40, min3D: 0, max3D: 14 };
const BANDA_GENERO = { 1: -7, 2: 0, 3: 7 }; // hombre / mujer / otro
const JITTER_Z = 2.6; // dispersión dentro de la banda, para que se vea como nube y no como 3 planos

function xDeEdad(edad) {
  const t = (edad - EJE_EDAD.min) / (EJE_EDAD.max - EJE_EDAD.min);
  return EJE_EDAD.min3D + t * (EJE_EDAD.max3D - EJE_EDAD.min3D);
}

function yDePuntaje(puntaje) {
  const t = (puntaje - EJE_PUNTAJE.min) / (EJE_PUNTAJE.max - EJE_PUNTAJE.min);
  return EJE_PUNTAJE.min3D + t * (EJE_PUNTAJE.max3D - EJE_PUNTAJE.min3D);
}

function zDeGenero(genero, semilla) {
  // jitter determinístico (no Math.random) para que la nube no salte
  // de forma al reconstruirse con el mismo conjunto de personas.
  const pseudoAleatorio = Math.sin(semilla * 12.9898) * 43758.5453;
  const ruido = (pseudoAleatorio - Math.floor(pseudoAleatorio)) * 2 - 1; // -1..1
  return BANDA_GENERO[genero] + ruido * JITTER_Z;
}

// ======================================================
// 06 — NUBE DE PUNTOS
// ======================================================

function construirNubeDePuntos() {
  if (nubeDePuntos) {
    escena.remove(nubeDePuntos);
    nubeDePuntos.geometry.dispose();
    nubeDePuntos.material.dispose();
  }

  const n = personasVisibles.length;
  const posiciones = new Float32Array(n * 3);
  const colores = new Float32Array(n * 3);

  personasVisibles.forEach((persona, i) => {
    posiciones[i * 3] = xDeEdad(persona.edad);
    posiciones[i * 3 + 1] = yDePuntaje(persona.puntaje);
    posiciones[i * 3 + 2] = zDeGenero(persona.genero, i);

    const color = COLOR_GENERO[persona.genero];
    colores[i * 3] = color.r;
    colores[i * 3 + 1] = color.g;
    colores[i * 3 + 2] = color.b;
  });

  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.BufferAttribute(posiciones, 3));
  geometria.setAttribute("color", new THREE.BufferAttribute(colores, 3));

  const material = new THREE.PointsMaterial({
    size: 0.32,
    vertexColors: true,
    transparent: true,
    opacity: 0.75,
    sizeAttenuation: true,
    depthWrite: false,
  });

  nubeDePuntos = new THREE.Points(geometria, material);
  escena.add(nubeDePuntos);
}

// ======================================================
// 07 — INTERACCIÓN: HOVER (raycasting sobre la nube)
// ======================================================

const raycaster = new THREE.Raycaster();
raycaster.params.Points.threshold = 0.45;
const puntero = new THREE.Vector2();

renderer.domElement.addEventListener("pointermove", (evento) => {
  const rect = renderer.domElement.getBoundingClientRect();
  puntero.x = ((evento.clientX - rect.left) / rect.width) * 2 - 1;
  puntero.y = -((evento.clientY - rect.top) / rect.height) * 2 + 1;

  const tooltip = document.querySelector("#tooltip");

  if (!nubeDePuntos) {
    tooltip.textContent = "Pasa el mouse sobre un punto para ver el detalle.";
    return;
  }

  raycaster.setFromCamera(puntero, camara);
  const intersecciones = raycaster.intersectObject(nubeDePuntos);

  if (intersecciones.length > 0) {
    const persona = personasVisibles[intersecciones[0].index];
    tooltip.textContent =
      `${NOMBRE_GENERO[persona.genero]} · ${persona.edad} años · puntaje ${persona.puntaje}/40`;
  } else {
    tooltip.textContent = "Pasa el mouse sobre un punto para ver el detalle.";
  }
});

// ======================================================
// 08 — CONTROLES
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
// 09 — ANIMACIÓN + RESPONSIVE
// ======================================================

function animar() {
  requestAnimationFrame(animar);
  controlesOrbita.update();
  renderer.render(escena, camara);
}

function ajustarVentana() {
  const ancho = viewport.clientWidth;
  const altura = viewport.clientHeight;

  camara.aspect = ancho / altura;
  camara.updateProjectionMatrix();
  renderer.setSize(ancho, altura);
}

window.addEventListener("resize", ajustarVentana);

// ======================================================
// 10 — ARRANQUE
// ======================================================

cargarDatos();
animar();
