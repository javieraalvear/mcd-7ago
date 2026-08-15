<style>
.ja-archive {
  position: relative;
  min-height: 100vh;
  background: #0d0d0c;
  color: #1a1a1a;
  font-family: "Newsreader", serif;
  overflow: hidden;
}

.ja-archive__portrait {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(180deg, rgba(10,10,9,0.15) 0%, rgba(10,10,9,0.65) 100%),
    url("../assets/images/javiaraña.png");
  background-size: cover;
  background-position: center 20%;
  filter: grayscale(0.6) contrast(1.05);
}

.ja-archive__thread {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 2;
  pointer-events: none;
}
.ja-archive__thread line {
  stroke: #b3261e;
  stroke-width: 1.5;
  opacity: 0.75;
}

/* ===== Etiqueta / logotipo, tipo tag de kraft prendido con un pin ===== */
.ja-archive__label {
  position: absolute;
  top: 6%;
  left: 6%;
  z-index: 3;
  background: #cbb994;
  color: #1a1a1a;
  padding: 1.1rem 1.6rem;
  transform: rotate(-4deg);
  box-shadow: 3px 4px 10px rgba(0,0,0,0.4);
  font-family: "Newsreader", serif;
  font-style: italic;
  font-weight: 500;
}
.ja-archive__label h1 {
  margin: 0;
  font-size: clamp(1.6rem, 3vw, 2.4rem);
  line-height: 1;
}
.ja-archive__label span {
  display: block;
  font-family: "IBM Plex Mono", monospace;
  font-style: normal;
  font-size: 0.65rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-top: 0.4rem;
  color: #4a4231;
}
.ja-archive__pin {
  position: absolute;
  top: -6px;
  left: 50%;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #b3261e;
  box-shadow: 0 1px 2px rgba(0,0,0,0.5);
}

/* ===== Piezas de archivo (cards) ===== */
.ja-card {
  position: absolute;
  z-index: 3;
  background: #f2ede1;
  padding: 1.1rem 1.3rem;
  width: 230px;
  box-shadow: 4px 6px 14px rgba(0,0,0,0.45);
}
.ja-card__eyebrow {
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.65rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #b3261e;
  margin: 0 0 0.4rem;
}
.ja-card p, .ja-card li {
  font-size: 0.92rem;
  line-height: 1.45;
  margin: 0;
}
.ja-card ul { padding-left: 1.1rem; margin: 0; }
.ja-card a { color: #7a2b23; }

/* piezas individuales: posición + rotación + tipo de recorte */
.ja-card--ticket   { top: 26%; left: 4%;  transform: rotate(-3deg); clip-path: polygon(0 8%,100% 0,100% 92%,0 100%); }
.ja-card--sticky    { top: 8%;  left: 68%; transform: rotate(3deg); }
.ja-card--torn      { top: 40%; left: 62%; transform: rotate(-2deg); }
.ja-card--polaroid  { top: 58%; left: 6%;  transform: rotate(4deg); padding-bottom: 2.2rem; }
.ja-card--tag       { top: 66%; left: 66%; transform: rotate(-5deg); }
.ja-card--specimen  { top: 4%;  left: 34%; transform: rotate(1deg); width: 260px; }

.ja-card--polaroid .ja-card__quote {
  font-style: italic;
  font-family: "Newsreader", serif;
}
.ja-card--polaroid::after {
  content: "fig. 04 — pregunta";
  position: absolute;
  bottom: 0.6rem;
  left: 1.3rem;
  font-family: "IBM Plex Mono", monospace;
  font-size: 0.6rem;
  color: #8a8478;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.ja-card--specimen model-viewer {
  width: 100%;
  aspect-ratio: 4/3;
  --poster-color: transparent;
}

@media (max-width: 900px) {
  .ja-archive { min-height: auto; }
  .ja-archive__portrait { position: relative; height: 60vh; }
  .ja-archive__thread { display: none; }
  .ja-card, .ja-archive__label {
    position: static;
    transform: none !important;
    width: auto;
    margin: 1rem 5%;
    clip-path: none !important;
  }
}
</style>
<script type="module" src="https://ajax.googleapis.com/ajax/libs/model-viewer/3.5.0/model-viewer.min.js"></script>
<section class="ja-archive">
  <div class="ja-archive__portrait"></div>

  <svg class="ja-archive__thread" viewBox="0 0 100 100" preserveAspectRatio="none">
    <line x1="50" y1="35" x2="15" y2="30" vector-effect="non-scaling-stroke"></line>
    <line x1="50" y1="35" x2="72" y2="14" vector-effect="non-scaling-stroke"></line>
    <line x1="50" y1="35" x2="66" y2="44" vector-effect="non-scaling-stroke"></line>
    <line x1="50" y1="35" x2="15" y2="62" vector-effect="non-scaling-stroke"></line>
    <line x1="50" y1="35" x2="70" y2="70" vector-effect="non-scaling-stroke"></line>
    <line x1="50" y1="35" x2="45" y2="10" vector-effect="non-scaling-stroke"></line>
  </svg>

  <div class="ja-archive__label">
    <span class="ja-archive__pin"></span>
    <h1>Javiera<br>Alvear S.</h1>
    <span>Diseñadora industrial</span>
  </div>

  <div class="ja-card ja-card--ticket">
    <p class="ja-card__eyebrow">Hoy_</p>
    <p>Docente y coordinación académica, diseño gráfico, Facultad de Diseño.</p>
  </div>

  <div class="ja-card ja-card--sticky">
    <p class="ja-card__eyebrow">Quiero aprender_</p>
    <p>Plataformas reactivas a estímulos externos. Cámara → audio → sonido.</p>
  </div>

  <div class="ja-card ja-card--torn">
    <p class="ja-card__eyebrow">Intereses_</p>
    <ul>
      <li>Dirección creativa</li>
      <li>Moda y contracultura. Música y cine.</li>
      <li>Inmersividad y experiencias sensoriales</li>
    </ul>
  </div>

  <div class="ja-card ja-card--polaroid">
    <p class="ja-card__eyebrow">Pregunta_</p>
    <p class="ja-card__quote">¿Cómo se deforma una geometría facial capturada por cámara cuando se le aplica ruido proporcional a la variación de un sonido ambiental, simulando la degradación del afecto al pasar de cuerpo a dato a imagen?</p>
  </div>

  <div class="ja-card ja-card--tag">
    <p class="ja-card__eyebrow">Inspira / links_</p>
    <p><a href="https://www.youtube.com/watch?v=AoXtsHzalfg" target="_blank" rel="noopener">McQueen — Plato's Atlantis</a></p>
    <p><a href="https://www.lozano-hemmer.com/pulse_room.php" target="_blank" rel="noopener">Lozano-Hemmer — Pulse Room</a></p>
    <p><a href="https://learn.ml5js.org/#/reference/facemesh" target="_blank" rel="noopener">ml5.js — FaceMesh</a></p>
  </div>

  <div class="ja-card ja-card--specimen">
    <p class="ja-card__eyebrow">Objeto_</p>
    <model-viewer
      src="../assets/models/spider.glb"
      alt="Modelo 3D de referencia"
      camera-controls
      auto-rotate
      shadow-intensity="1">
    </model-viewer>
  </div>
</section>

