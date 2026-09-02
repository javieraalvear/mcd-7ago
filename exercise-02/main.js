// ======================================================
// 01 — CONFIGURACIÓN
// ======================================================
// Fuente: dato propio. Un registro por medición, guardado en
// localStorage del navegador (sin servidor, sin API externa).
// Cada registro: { momento: 'antes'|'despues', energia, autoimagen,
// autoestima, ansiedad, timestamp }.

const CLAVE_STORAGE = "autopercepcion-registros";

const EJES = [
  { clave: "energia", etiqueta: "Energía" },
  { clave: "autoimagen", etiqueta: "Autoimagen" },
  { clave: "autoestima", etiqueta: "Autoestima" },
  { clave: "ansiedad", etiqueta: "Ansiedad" },
];

const COLOR_MOMENTO = {
  antes: "rgba(124, 139, 153, 0.55)",   // gris azulado — estado previo
  despues: "rgba(193, 68, 59, 0.55)",   // rojo — estado posterior al estímulo
};

const canvas = document.querySelector("#lienzo");
const ctx = canvas.getContext("2d");
const centro = { x: canvas.width / 2, y: canvas.height / 2 };
const radioMax = Math.min(canvas.width, canvas.height) / 2 - 60;

// ======================================================
// 02 — PERSISTENCIA
// ======================================================

function leerRegistros() {
  const crudo = localStorage.getItem(CLAVE_STORAGE);
  return crudo ? JSON.parse(crudo) : [];
}

function guardarRegistro(momento) {
  const registros = leerRegistros();

  registros.push({
    momento,
    energia: Number(document.querySelector("#energia").value),
    autoimagen: Number(document.querySelector("#autoimagen").value),
    autoestima: Number(document.querySelector("#autoestima").value),
    ansiedad: Number(document.querySelector("#ansiedad").value),
    timestamp: Date.now(),
  });

  localStorage.setItem(CLAVE_STORAGE, JSON.stringify(registros));
  actualizarPanel();
  dibujar();
}

function borrarRegistros() {
  localStorage.removeItem(CLAVE_STORAGE);
  actualizarPanel();
  dibujar();
}

// ======================================================
// 03 — REGLAS: VALOR (0-100) → PUNTO EN EL RADAR
// ======================================================

function puntoDeEje(indiceEje, valor) {
  const angulo = (Math.PI * 2 * indiceEje) / EJES.length - Math.PI / 2;
  const radio = (valor / 100) * radioMax;
  return {
    x: centro.x + Math.cos(angulo) * radio,
    y: centro.y + Math.sin(angulo) * radio,
  };
}

function dibujarPoligono(registro) {
  ctx.beginPath();
  EJES.forEach((eje, indice) => {
    const punto = puntoDeEje(indice, registro[eje.clave]);
    if (indice === 0) ctx.moveTo(punto.x, punto.y);
    else ctx.lineTo(punto.x, punto.y);
  });
  ctx.closePath();

  ctx.fillStyle = COLOR_MOMENTO[registro.momento] ?? "rgba(200,200,200,0.4)";
  ctx.fill();
  ctx.strokeStyle = COLOR_MOMENTO[registro.momento] ?? "#ccc";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function dibujarEjes() {
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "12px sans-serif";
  ctx.textAlign = "center";

  EJES.forEach((eje, indice) => {
    const extremo = puntoDeEje(indice, 100);
    ctx.beginPath();
    ctx.moveTo(centro.x, centro.y);
    ctx.lineTo(extremo.x, extremo.y);
    ctx.stroke();

    const etiquetaPos = puntoDeEje(indice, 118);
    ctx.fillText(eje.etiqueta, etiquetaPos.x, etiquetaPos.y);
  });

  // anillos de referencia cada 25%
  [25, 50, 75, 100].forEach((porcentaje) => {
    ctx.beginPath();
    EJES.forEach((_, indice) => {
      const punto = puntoDeEje(indice, porcentaje);
      if (indice === 0) ctx.moveTo(punto.x, punto.y);
      else ctx.lineTo(punto.x, punto.y);
    });
    ctx.closePath();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.stroke();
  });
}

function dibujar() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  dibujarEjes();
  leerRegistros().forEach(dibujarPoligono);
}

// ======================================================
// 04 — INTERFAZ
// ======================================================

EJES.forEach((eje) => {
  const input = document.querySelector(`#${eje.clave}`);
  const output = document.querySelector(`#${eje.clave}-valor`);
  input.addEventListener("input", () => {
    output.value = input.value;
  });
});

document.querySelector("#guardar-antes").addEventListener("click", () => {
  guardarRegistro("antes");
});

document.querySelector("#guardar-despues").addEventListener("click", () => {
  guardarRegistro("despues");
});

document.querySelector("#borrar").addEventListener("click", () => {
  if (confirm("¿Borrar todos los registros guardados?")) borrarRegistros();
});

function actualizarPanel() {
  const registros = leerRegistros();
  document.querySelector("#conteo-label").textContent = registros.length;

  const ultimoAntes = [...registros].reverse().find((r) => r.momento === "antes");
  const ultimoDespues = [...registros].reverse().find((r) => r.momento === "despues");

  const formatear = (r) =>
    r ? new Date(r.timestamp).toLocaleString("es-CL", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" }) : "—";

  document.querySelector("#ultimos-label").textContent =
    `${formatear(ultimoAntes)} / ${formatear(ultimoDespues)}`;
}

// ======================================================
// 05 — ARRANQUE
// ======================================================

actualizarPanel();
dibujar();
