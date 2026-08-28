import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

// ======================================================
// 01 — CONFIGURACIÓN
// ======================================================
// Fuente: dataset propio, derivado de WESAD (Schmidt et al. 2018).
// wesad_light.csv fue generado preprocesando los .pkl originales de
// 15 sujetos: EDA/BVP/TEMP de la muñeca, agregados en ventanas de 5s,
// etiquetadas con la condición dominante en esa ventana.

const RUTA_CSV = "./assets/data/wesad_light.csv";

const COLOR_CONDICION = {
  baseline: 0x7c8b99,
  stress: 0xc1443b,
  amusement: 0xd9a441,
};

const parametros = {
  sujeto: "todos",
  condicion: "todas",
  modo: "temporal",
  escalaAltura: 1.2,
  escalaAncho: 1.0,
  bucketsPorSujeto: 20,
};

let filas = [];           // filas crudas del CSV
let sujetosOrdenados = [];
let rangoEdaPorSujeto = new Map(); // sujeto -> {min, max}
let bloques = [];         // buckets actualmente representados
let objetosBloque = [];

let reproduciendo = false;
let cursorTemporal = 0; // 0..1, posición del barrido

// ======================================================
// 02 — ESCENA
// ======================================================

const viewport = document.querySelector("#viewport");
const escena = new THREE.Scene();
escena.background = new THREE.Color(0x0b0b0c);

const camara = new THREE.PerspectiveCamera(
  42,
  viewport.clientWidth / viewport.clientHeight,
  0.1,
  400
);
camara.position.set(30, 52, 42);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewport.appendChild(renderer.domElement);

const controlesOrbita = new OrbitControls(camara, renderer.domElement);
controlesOrbita.enableDamping = true;
controlesOrbita.target.set(0, 2, 0);

escena.add(new THREE.HemisphereLight(0xf2eee4, 0x1f2228, 1.8));

const luzPrincipal = new THREE.DirectionalLight(0xffffff, 2.7);
luzPrincipal.position.set(18, 28, 14);
luzPrincipal.castShadow = true;
escena.add(luzPrincipal);

const suelo = new THREE.Mesh(
  new THREE.PlaneGeometry(140, 140),
  new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 1 })
);
suelo.rotation.x = -Math.PI / 2;
suelo.position.y = -0.02;
suelo.receiveShadow = true;
escena.add(suelo);

const grilla = new THREE.GridHelper(100, 50, 0x34383d, 0x1e2024);
grilla.position.y = 0.001;
escena.add(grilla);

const grupoBloques = new THREE.Group();
escena.add(grupoBloques);

// ======================================================
// 03 — DATOS: FETCH + PARSEO DE CSV
// ======================================================

async function cargarDatos() {
  actualizarEstadoConexion("cargando");

  try {
    const respuesta = await fetch(RUTA_CSV, { cache: "no-store" });
    if (!respuesta.ok) throw new Error("No se pudo leer el CSV.");

    const texto = await respuesta.text();
    filas = parsearCSV(texto);

    prepararSujetosYRangos();
    poblarSelectorSujetos();

    actualizarEstadoConexion("listo");
    document.querySelector("#fuente-label").textContent =
      "WESAD · dataset propio (CSV)";

    generarRepresentacion();
  } catch (error) {
    console.error("No fue posible cargar wesad_light.csv", error);
    actualizarEstadoConexion("error");
    document.querySelector("#fuente-label").textContent =
      "Error cargando el CSV";
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

function prepararSujetosYRangos() {
  sujetosOrdenados = [...new Set(filas.map((fila) => fila.subject))].sort(
    (a, b) => Number(a.slice(1)) - Number(b.slice(1))
  );

  rangoEdaPorSujeto = new Map();
  sujetosOrdenados.forEach((sujeto) => {
    const valoresEda = filas
      .filter((fila) => fila.subject === sujeto)
      .map((fila) => fila.eda_mean);

    rangoEdaPorSujeto.set(sujeto, {
      min: Math.min(...valoresEda),
      max: Math.max(...valoresEda),
    });
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
// 04 — REGLAS: INPUT → RELACIÓN → OUTPUT
// ======================================================

function normalizarEda(fila) {
  const rango = rangoEdaPorSujeto.get(fila.subject);
  if (!rango || rango.max === rango.min) return 0.5;
  return (fila.eda_mean - rango.min) / (rango.max - rango.min);
}

// Agrupa las filas de un sujeto en N bloques temporales,
// promediando las variables biométricas dentro de cada bloque.
// Esto es una decisión de diseño: no representamos cada ventana
// de 5s (miles de filas), sino una versión legible y comparable.
function construirBloquesDeSujeto(sujeto, n) {
  const filasSujeto = filas
    .filter((fila) => fila.subject === sujeto)
    .sort((a, b) => a.window_start_s - b.window_start_s);

  if (filasSujeto.length === 0) return [];

  const tInicio = filasSujeto[0].window_start_s;
  const tFin = filasSujeto[filasSujeto.length - 1].window_start_s;
  const duracion = Math.max(1, tFin - tInicio);

  const bloques = Array.from({ length: n }, () => []);

  filasSujeto.forEach((fila) => {
    const posicion = (fila.window_start_s - tInicio) / duracion;
    const indice = Math.min(n - 1, Math.floor(posicion * n));
    bloques[indice].push(fila);
  });

  return bloques
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

      const edaNormPromedio =
        grupo.reduce((acc, fila) => acc + normalizarEda(fila), 0) /
        grupo.length;
      const edaCrudoPromedio =
        grupo.reduce((acc, fila) => acc + fila.eda_mean, 0) / grupo.length;
      const bvpStdPromedio =
        grupo.reduce((acc, fila) => acc + fila.bvp_std, 0) / grupo.length;

      return {
        sujeto,
        posicionTemporal: indice / (n - 1 || 1),
        condicion: condicionDominante,
        edaNorm: edaNormPromedio,
        edaCrudo: edaCrudoPromedio,
        bvpStd: bvpStdPromedio,
      };
    })
    .filter(Boolean);
}

function aplicarFiltros(listaBloques) {
  return listaBloques.filter((bloque) => {
    const pasaSujeto =
      parametros.sujeto === "todos" || bloque.sujeto === parametros.sujeto;
    const pasaCondicion =
      parametros.condicion === "todas" ||
      bloque.condicion === parametros.condicion;
    return pasaSujeto && pasaCondicion;
  });
}

function distribuirTemporalmente(listaBloques) {
  const sujetosVisibles =
    parametros.sujeto === "todos" ? sujetosOrdenados : [parametros.sujeto];
  const anchoLinea = 42;
  const separacionFilas = 2.6;

  return listaBloques.map((bloque) => {
    const filaSujeto = sujetosVisibles.indexOf(bloque.sujeto);
    return {
      ...bloque,
      x: (bloque.posicionTemporal - 0.5) * anchoLinea,
      z: (filaSujeto - sujetosVisibles.length / 2) * separacionFilas,
    };
  });
}

function distribuirPorCondicion(listaBloques) {
  const condiciones = ["baseline", "stress", "amusement"];
  const separacionZonas = 18;
  const separacionGrilla = 1.6;

  return condiciones.flatMap((condicion, indiceZona) => {
    const bloquesCondicion = listaBloques.filter(
      (bloque) => bloque.condicion === condicion
    );
    const columnas = Math.ceil(Math.sqrt(bloquesCondicion.length)) || 1;
    const offsetX = (indiceZona - 1) * separacionZonas;

    return bloquesCondicion.map((bloque, indice) => {
      const columna = indice % columnas;
      const fila = Math.floor(indice / columnas);
      return {
        ...bloque,
        x: offsetX + (columna - columnas / 2) * separacionGrilla,
        z: (fila - columnas / 2) * separacionGrilla,
      };
    });
  });
}

function generarRepresentacion() {
  limpiarRepresentacion();

  const sujetosAConstruir =
    parametros.sujeto === "todos" ? sujetosOrdenados : [parametros.sujeto];

  const bloquesCrudos = sujetosAConstruir.flatMap((sujeto) =>
    construirBloquesDeSujeto(sujeto, parametros.bucketsPorSujeto)
  );

  const filtrados = aplicarFiltros(bloquesCrudos);

  bloques =
    parametros.modo === "temporal"
      ? distribuirTemporalmente(filtrados)
      : distribuirPorCondicion(filtrados);

  bloques.forEach(crearModuloBloque);

  document.querySelector("#conteo-label").textContent =
    `${sujetosAConstruir.length} sujeto(s) · ${bloques.length} bloques`;
}

function crearModuloBloque(bloque) {
  // REGLA 1: EDA normalizado por sujeto → altura.
  const altura = 0.4 + bloque.edaNorm * parametros.escalaAltura * 3;

  // REGLA 2: variabilidad de BVP → ancho.
  // bvpStd no está acotado de forma natural; usamos una compresión
  // logarítmica suave para que valores atípicos no dominen el ancho.
  const anchoBase = Math.log(1 + bloque.bvpStd) * 0.6;
  const ancho = Math.max(0.35, Math.min(1.8, anchoBase)) * parametros.escalaAncho;

  const geometria = new THREE.BoxGeometry(ancho, altura, ancho);
  const material = new THREE.MeshStandardMaterial({
    color: COLOR_CONDICION[bloque.condicion] ?? 0x888888,
    roughness: 0.55,
  });

  const malla = new THREE.Mesh(geometria, material);
  malla.position.set(bloque.x, altura / 2, bloque.z);
  malla.castShadow = true;
  malla.userData.bloque = bloque;

  grupoBloques.add(malla);
  objetosBloque.push(malla);
}

function limpiarRepresentacion() {
  objetosBloque = [];

  while (grupoBloques.children.length > 0) {
    const objeto = grupoBloques.children[0];
    if (objeto.geometry) objeto.geometry.dispose();
    if (objeto.material) objeto.material.dispose();
    grupoBloques.remove(objeto);
  }
}

// ======================================================
// 05 — INTERFAZ + INSPECTOR
// ======================================================

const raycaster = new THREE.Raycaster();
const puntero = new THREE.Vector2();

renderer.domElement.addEventListener("pointerdown", (event) => {
  const rect = renderer.domElement.getBoundingClientRect();

  puntero.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  puntero.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  raycaster.setFromCamera(puntero, camara);

  const intersecciones = raycaster.intersectObjects(objetosBloque, false);

  if (intersecciones.length > 0) {
    mostrarBloque(intersecciones[0].object.userData.bloque);
  }
});

const nombresCondicion = {
  baseline: "Baseline",
  stress: "Estrés",
  amusement: "Diversión",
};

function mostrarBloque(bloque) {
  document.querySelector("#bloque-nombre").textContent =
    `${bloque.sujeto} · bloque temporal ${Math.round(bloque.posicionTemporal * 100)}%`;
  document.querySelector("#m-sujeto").textContent = bloque.sujeto;
  document.querySelector("#m-condicion").textContent =
    nombresCondicion[bloque.condicion] ?? bloque.condicion;
  document.querySelector("#m-eda").textContent = bloque.edaCrudo.toFixed(3);
  document.querySelector("#m-bvp").textContent = bloque.bvpStd.toFixed(3);
}

document.querySelector("#filtro-sujeto").addEventListener("change", (event) => {
  parametros.sujeto = event.target.value;
  generarRepresentacion();
});

document.querySelector("#filtro-condicion").addEventListener("change", (event) => {
  parametros.condicion = event.target.value;
  generarRepresentacion();
});

document.querySelector("#modo-distribucion").addEventListener("change", (event) => {
  parametros.modo = event.target.value;
  generarRepresentacion();
});

conectarSlider("escala-altura", "escala-altura-valor", "escalaAltura", 2);
conectarSlider("escala-ancho", "escala-ancho-valor", "escalaAncho", 2);
conectarSlider("buckets", "buckets-valor", "bucketsPorSujeto", 0);

function conectarSlider(idControl, idValor, parametro, decimales) {
  const control = document.querySelector(`#${idControl}`);
  const valor = document.querySelector(`#${idValor}`);

  control.addEventListener("input", (event) => {
    parametros[parametro] = Number(event.target.value);
    valor.value = parametros[parametro].toFixed(decimales);
    generarRepresentacion();
  });
}

document.querySelector("#reconstruir").addEventListener("click", () => {
  generarRepresentacion();
});

document.querySelector("#reproducir").addEventListener("click", (event) => {
  reproduciendo = !reproduciendo;
  event.target.textContent = reproduciendo
    ? "Detener barrido"
    : "Reproducir barrido temporal";
});

function actualizarEstadoConexion(tipo) {
  const estado = document.querySelector("#estado-label");

  if (tipo === "listo") {
    estado.innerHTML = '<i class="status-dot"></i> listo';
  } else if (tipo === "error") {
    estado.textContent = "error de carga";
  } else {
    estado.textContent = "cargando…";
  }
}

// ======================================================
// 06 — BARRIDO TEMPORAL
// ======================================================
// No hay API en vivo detrás de este dataset, así que la variación
// en el tiempo que pide el ejercicio se resuelve con una lectura
// activa: un cursor recorre la sesión de cada sujeto simultáneamente,
// como la aguja de un monitor, atenuando lo que queda fuera de foco.
// Solo tiene efecto visual en el modo "temporal".

function actualizarBarrido() {
  if (!reproduciendo) return;

  cursorTemporal = (cursorTemporal + 0.0025) % 1;

  if (parametros.modo !== "temporal") return;

  objetosBloque.forEach((malla) => {
    const distancia = Math.abs(malla.userData.bloque.posicionTemporal - cursorTemporal);
    const foco = Math.max(0.15, 1 - distancia * 6);
    malla.material.opacity = foco;
    malla.material.transparent = foco < 0.99;
  });
}

// ======================================================
// 07 — ANIMACIÓN + RESPONSIVE
// ======================================================

function animar() {
  requestAnimationFrame(animar);
  controlesOrbita.update();
  actualizarBarrido();
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

cargarDatos();
animar();
