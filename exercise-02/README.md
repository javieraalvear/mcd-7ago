# Ejercicio 02 — Silueta de partículas

Sistema en **canvas 2D puro** (sin librerías, proyección 3D→2D hecha
a mano): dos cuerpos humanos paramétricos — hombre y mujer,
simultáneos — muestreados como nubes de partículas de ruido, giran
en 3D mientras un anillo (una capa aparte del cuerpo) pulsa según
datos reales de autoestima.

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

No hay `getUserMedia`. Cada cuerpo es una nube de puntos 3D generada
por código (`construirCuerpo`): tronco+cabeza como un sólido de
revolución (`radioTroncoEnHu` define el radio en cada altura, se
muestrea alrededor del eje vertical), más brazos y piernas como
cilindros angostos con su propio eje. La altura y las proporciones
cambian con edad/género:

| Control | → | Efecto |
|---|---|---|
| edad (slider, comparte ambas figuras) | → | altura de los dos cuerpos (`alturaFactor`) |
| género | → | proporción hombros/caderas (`proporcionesGenero`) — hombre y mujer se muestran siempre juntos, no hay que elegir |

`alturaFactor` es una curva de crecimiento **ilustrativa** (rápida de
niño a adolescente, plana en la adultez, leve retracción en edad
avanzada) — el CSV no trae dato de estatura, así que esto no es una
medición, y el código lo dice explícitamente.

## Ruido, no imagen continua — y en 3D real

`muestrearRevolucion` genera los puntos directamente sobre la
superficie de cada sólido (nada de dibujar-y-samplear un canvas 2D),
con un 30-35% de descarte aleatorio y ruido radial leve — eso es lo
que lee como ruido técnico y no como una superficie lisa. La posición
base (x, y, z) de cada partícula queda fija; lo único que se le
aplica encima es una **rotación** (`anguloRotacion`, una vuelta
completa cada 18s) proyectada a 2D a mano (`FOCAL / (FOCAL + zRot)`,
perspectiva simple) — por eso la silueta no está fija, se ve desde
todos los ángulos con el tiempo, pero nunca deja de ser la misma
figura.

## La única regla de animación — y por qué el cuerpo nunca se deforma

El pulso **no toca ni un punto del cuerpo**. Es un anillo horizontal
aparte (`puntosAnillo`), a la altura del pecho, que crece y se
contrae — si el pulso desplazara los puntos del propio cuerpo hacia
afuera, la silueta se ve como si "engordara" en vez de pulsar; separar
la capa del anillo evita justamente eso.

Cada figura recibe su propia variable normalizada 0–1 (el promedio
real de autoestima de su edad/género) más un evento puntual cada vez
que se mueve el slider de edad:

- **Amplitud del anillo** = variable de entrada + un impulso que
  decae ~1.4s tras el último evento.
- **Velocidad del ciclo** = más rápida cuanto más seguido llegan los
  eventos (arrastrar el slider rápido acelera el pulso); se calma
  sola a los ~4.5s sin interacción.

Como hombre y mujer casi siempre tienen promedios distintos a la
misma edad, sus anillos laten con amplitudes distintas — la
comparación entre los dos anillos es, en sí misma, la brecha real de
autoestima entre géneros a esa edad. Nada más anima el sistema — ni
el giro de las capas fijas (línea horizontal, marcadores
triangulares) ni el texto se mueven.

## UI

Botón reproducir/pausar (congela giro y pulso), slider de edad
(comparte ambas figuras), y un indicador de texto con ambos promedios
(`EDAD · HOMBRE ·/40 (n=) · MUJER ·/40 (n=)`) en la esquina — sin
panel de mapeos ni leyenda adicional.

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
