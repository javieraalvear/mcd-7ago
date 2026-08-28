# Ejercicio 02 — El cuerpo del observador actual

Campo visual sobre **canvas 2D**: la cámara de quien mira la pantalla
—su reflejo en vivo, espejado— se corrompe en tiempo real con los
datos de una sesión de WESAD. No hay geometría 3D, no hay gráfico, y
no hay foto de stock ni retrato propio de por medio: la fuente visual
es siempre el presente de quien está frente a la pantalla.

## Posición dentro de la cadena de observadores

La reacción biométrica que decide la distorsión —EDA, variabilidad de
pulso, temperatura de muñeca— fue grabada en *otro* cuerpo, en *otro*
momento, en un laboratorio (WESAD, Schmidt et al. 2018). Quien mira
esta pantalla no ve un dato ajeno representado: se ve a **sí mismo**
deformado por una respuesta psicosomática que no le pertenece. El
teléfono descompuesto deja de ser una metáfora y se vuelve la
estructura literal del sistema.

## Fuente de datos

`assets/data/wesad_light.csv`, el mismo dataset propio derivado de
WESAD usado en el resto del curso: EDA, BVP y temperatura de muñeca de
15 sujetos, agregados en ventanas de 5s. Es un solo CSV, no dos bases
que se cruzan — la columna `subject` (S2, S3… S17) simplemente marca a
qué persona pertenece cada fila.

La pieza usa un único sujeto fijo (`SUJETO_FIJO` en `main.js`, por
defecto `S2`), no un selector: la idea es "un cuerpo ajeno", no un
comparador de personas. `construirBloquesDeSujeto(sujeto, n)` filtra
ese sujeto dentro del mismo CSV y agrupa sus filas en `n` bloques
temporales — ese filtro es todo el "cruce" que hay entre sujetos y
base de datos.

## Fuente visual

`getUserMedia()` (cámara frontal). Si no hay permiso o no hay cámara
disponible, la app cae a una silueta de referencia generada por
código, para poder seguir probando las técnicas sin bloquear el
desarrollo — pero el caso principal, y el que sostiene la idea del
ejercicio, es la cámara en vivo.

Requiere contexto seguro (`localhost` vía Live Server sirve; abrir
`index.html` como `file://` no activa `getUserMedia`).

## Mapeos (uno por variable, cada uno con su propia lógica)

| Variable | Técnica | Lógica |
|---|---|---|
| EDA (normalizado por sujeto) | **pixel sorting** | ordena píxeles por brillo dentro de filas/columnas; el largo de la corrida escala con el arousal |
| bvp_std (variabilidad de pulso, calculada por bloque) | **frame bleed** | mezcla el frame anterior sobre el actual con una opacidad que sube con la variabilidad, con un leve desplazamiento que simula compensación de movimiento |
| temp_mean | **aberración cromática (mapeo invertido)** | temperatura baja (vasoconstricción / estrés) separa los canales R/B más; temperatura alta los mantiene alineados |

`bvp_std` no viene en el CSV: se calcula como la desviación estándar
de `bvp_mean` de las ventanas de 5s que caen dentro de cada bloque
temporal — variabilidad real derivada del dato crudo.

Cada ciclo de corrupción parte de un frame *nuevo* de la cámara, no de
una imagen fija: la fuente cambia todo el tiempo, igual que quien está
frente a ella.

## Las condiciones son gramática, no color

baseline / stress / amusement no cambian el tono de nada: activan las
tres técnicas con pesos y modos de modulación distintos (ver
`GRAMATICA` en `main.js`). Amusement, en particular, desactiva por
completo la aberración cromática y usa una modulación rítmica del
frame bleed — una textura de ruptura distinta a la de estrés, no una
versión "más suave" de la misma.

## Reproducción

La pieza no espera ningún click: apenas hay cámara (o silueta) y CSV
cargado, arranca sola y recorre en loop los `n` bloques temporales de
la sesión de `SUJETO_FIJO`, interpolando entre bloques consecutivos
para que la intensidad cambie de forma continua. El botón solo sirve
para pausar. Sin sesión activa, el lienzo es un espejo limpio — la
corrupción solo entra cuando la biometría de otro cuerpo está
corriendo.

## Cruce en vivo (dato → técnica)

El panel lateral muestra, actualizado en cada ciclo de recálculo, el
valor normalizado (0–1) de cada variable del bloque activo junto al
número que esa técnica efectivamente aplicó sobre el frame de cámara
de ese instante (% de corrida de sorting, % de opacidad de bleed, px
de aberración). Es la forma de hacer visible el cruce entre el dato
ajeno y tu imagen sin necesidad de un gráfico aparte.

## Cómo ejecutarlo

Usa VS Code + Live Server: click derecho sobre `index.html` → *Open
with Live Server*. El navegador pedirá permiso de cámara al cargar.

## Archivos

```text
exercise-02/
├── index.html
├── styles.css
├── main.js
├── README.md
└── assets/
    └── data/wesad_light.csv
```
