# Ejercicio 02 — Autoestima, ¿cambia con la edad?

Nube de puntos en **Three.js**: cada punto es una persona real que
respondió la Rosenberg Self-Esteem Scale (openpsychometrics.org).

## Idea central

> **Los datos no tienen una forma visual predeterminada. Diseñar una representación significa decidir qué información conservar, cómo relacionarla y cómo hacerla visible.**

## Fuente

`assets/data/rse.csv` — ~46.000 respuestas reales a la Rosenberg
Self-Esteem Scale (Rosenberg, 1965), publicadas por
openpsychometrics.org. Cada fila trae las 10 respuestas crudas
(Q1–Q10, escala 1–4), género y edad.

```text
Q1-Q10: 1=muy en desacuerdo .. 4=muy de acuerdo, 0=sin respuesta.
Ítems invertidos del Rosenberg original: Q3, Q5, Q8, Q9, Q10.
gender: 1=hombre, 2=mujer, 3=otro.
```

`calcularPersona()` reduce las 10 respuestas a un único puntaje
10–40 (más alto = más autoestima), invirtiendo los ítems que
corresponde.

## Reglas de representación

| Dato | → | Posición |
|---|---|---|
| edad | → | X |
| puntaje Rosenberg (10–40) | → | Y (altura) |
| género | → | Z (profundidad) **+** color |

El género queda codificado dos veces a propósito: color solo no
alcanza para distinguir grupos en una nube de puntos que rota — la
posición en profundidad lo hace legible incluso de perfil.

## Filtros

Rango etario (edad mínima/máxima) y género, ambos re-filtran
`personasVisibles` y reconstruyen la nube de puntos
(`construirNubeDePuntos()`) sin recargar el CSV.

## Interacción

Arrastra para orbitar la escena (OrbitControls) · rueda para
acercar/alejar · pasa el mouse sobre un punto para ver su detalle
(raycasting sobre la nube, `THREE.Points`).

## Cómo ejecutarlo

Usa VS Code + Live Server: click derecho sobre `index.html` → *Open
with Live Server*.

## Archivos

```text
exercise-02/
├── index.html
├── styles.css
├── main.js
├── README.md
└── assets/
    └── data/rse.csv
```
