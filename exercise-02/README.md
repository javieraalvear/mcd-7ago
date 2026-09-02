# Ejercicio 02 — Silueta de partículas

Sistema en **canvas 2D puro** (sin librerías): un cuerpo humano
paramétrico, muestreado como una nube de partículas de ruido, pulsa
en anillos concéntricos según datos reales de autoestima.

## Idea central

> **Los datos no tienen una forma visual predeterminada. Diseñar una representación significa decidir qué información conservar, cómo relacionarla y cómo hacerla visible.**

## Fuente

`assets/data/rse.csv` — mismo dataset real de la Rosenberg
Self-Esteem Scale (openpsychometrics.org) usado en la versión 3D
anterior de este ejercicio. `calcularPersona()` reduce las 10
respuestas crudas a un puntaje 10–40 por persona, igual que antes.

`construirPromediosPorEdad()` agrupa esas personas en bins de 5 años
× género (hombre/mujer — "otro" no tiene silueta convencional que
dibujar, se deja fuera a propósito) y calcula el promedio real de
autoestima de cada grupo. Si un bin tiene muestra insuficiente
(`n < 30` — edades muy bajas o muy altas están poco representadas),
`promedioParaEdad()` busca el bin confiable más cercano en vez de
mostrar un promedio ruidoso.

## La silueta no es una cámara

No hay `getUserMedia`. La figura es un cuerpo paramétrico dibujado
por código (`dibujarFiguraEnLienzoAuxiliar`): cabeza, torso, brazos y
piernas como polígonos, cuya altura y proporciones cambian con los
controles:

| Control | → | Efecto |
|---|---|---|
| edad (slider) | → | altura de la figura (`alturaFactor`) |
| género (hombre/mujer) | → | proporción hombros/caderas (`proporcionesGenero`) |

`alturaFactor` es una curva de crecimiento **ilustrativa** (rápida de
niño a adolescente, plana en la adultez, leve retracción en edad
avanzada) — el CSV no trae dato de estatura, así que esto no es una
medición, y el código lo dice explícitamente.

## Silueta de ruido, no imagen continua

El cuerpo se dibuja sólido en un lienzo auxiliar oculto. Una grilla
de 6px lo muestrea (`construirParticulas`): cada celda se convierte
en partícula solo si su brillo supera un umbral, y aun así con un
22% de descarte aleatorio — eso es lo que la hace leer como ruido
técnico y no como una imagen rellena. La posición base de cada
partícula queda fija a su celda; el pulso nunca la reemplaza, solo le
suma un offset temporal.

## La única regla de animación

El sistema recibe una variable normalizada 0–1 (el promedio de
autoestima de la edad/género activos) más un evento puntual (cada vez
que se mueve un control). Un anillo concéntrico viaja desde el centro
de la figura hacia afuera y de vuelta:

- **Amplitud** = variable de entrada + un impulso que decae ~1.4s
  tras el último evento.
- **Velocidad del ciclo** = más rápida cuanto más seguido llegan los
  eventos (arrastrar el slider rápido acelera el pulso); se calma
  sola a los ~4.5s sin interacción.

Nada más anima el sistema — ni las capas fijas (línea horizontal,
marcadores triangulares) ni el texto se mueven.

## UI

Botón reproducir/pausar, slider de edad, toggle hombre/mujer, y un
indicador de texto (`AUTOESTIMA PROM. · EDAD · GÉNERO · n=`) en la
esquina — sin panel de mapeos ni leyenda adicional.

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
