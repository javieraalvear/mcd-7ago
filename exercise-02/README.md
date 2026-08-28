# Ejercicio 02 — La imagen es el dato

Campo visual sobre **canvas 2D**: una fotografía propia se corrompe en
vivo con los datos de una sesión de WESAD. No hay geometría 3D ni
gráfico de por medio — la distorsión de la imagen **es** la
visualización.

## Fuente

`assets/data/wesad_light.csv`, el mismo dataset propio derivado de
WESAD (Schmidt et al. 2018) usado en el resto del curso: EDA, BVP y
temperatura de muñeca de 15 sujetos, agregados en ventanas de 5s.

## Imagen

Coloca un retrato propio en `assets/images/retrato.jpg` (o `.jpeg`
/ `.png`). Si no existe, la app dibuja una silueta de referencia por
código para poder seguir probando las técnicas sin bloquear el
desarrollo.

## Mapeos (uno por variable, cada uno con su propia lógica)

| Variable | Técnica | Lógica |
|---|---|---|
| EDA (normalizado por sujeto) | **pixel sorting** | ordena píxeles por brillo dentro de filas/columnas; el largo de la corrida escala con el arousal |
| bvp_std (variabilidad de pulso, calculada por bloque) | **frame bleed** | mezcla el frame anterior sobre el actual con una opacidad que sube con la variabilidad, con un leve desplazamiento que simula compensación de movimiento |
| temp_mean | **aberración cromática (mapeo invertido)** | temperatura baja (vasoconstricción / estrés) separa los canales R/B más; temperatura alta los mantiene alineados |

`bvp_std` no viene en el CSV: se calcula como la desviación estándar
de `bvp_mean` de las ventanas de 5s que caen dentro de cada bloque
temporal — variabilidad real derivada del dato crudo.

## Las condiciones son gramática, no color

baseline / stress / amusement no cambian el tono de nada: activan las
tres técnicas con pesos y modos de modulación distintos (ver
`GRAMATICA` en `main.js`). Amusement, en particular, desactiva por
completo la aberración cromática y usa una modulación rítmica del
frame bleed — una textura de ruptura distinta a la de estrés, no una
versión "más suave" de la misma.

## Reproducción

`construirBloquesDeSujeto(sujeto, n)` agrupa la sesión de un sujeto en
`n` bloques temporales. El botón de reproducción recorre esos bloques
en orden, interpolando entre bloques consecutivos para que la
intensidad cambie de forma continua; la condición activa (para
verificar durante el desarrollo) se muestra en el panel lateral.

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
    ├── data/wesad_light.csv
    └── images/retrato.jpg   (lo agregas tú)
```
