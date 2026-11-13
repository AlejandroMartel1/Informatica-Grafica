import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { GUI } from "three/examples/jsm/libs/dat.gui.module.js";

let scene, renderer;
let camera;
let camcontrols;
let clock;
let objetos = [];

let tierra, halo;
const R = 1;
const ALT_CABLE = 1.004;
const ALT_PULSO = 1.006;

// Datos
let info = {};
let cables = [];
let pulsos = [];
let anioMin = 1990,
  anioMax = new Date().getFullYear();

// Selección
let raycaster = new THREE.Raycaster();
let ratonPulsado = { x: 0, y: 0 };
let lineaSeleccion = null;
let haz = null;
const COLA = 14;
let escala = 1;

// Interfaz
let hud, panelInfo;
let controladorAnio;

const canarias = { minlat: 27.4, maxlat: 29.6, minlon: -18.4, maxlon: -13.2 };

const params = {
  anio: anioMax,
  animarAnios: false,
  pulsos: true,
  velocidadPulsos: 8,
  soloCanarias: false,
  rotacion: false,
  verAmarres: true,
};

const TEX_TIERRA = ["src/earth-dark.jpg"];

init();
animationLoop();

function init() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x02030a);

  camera = new THREE.PerspectiveCamera(
    35,
    window.innerWidth / window.innerHeight,
    0.01,
    1000
  );

  camera.position.copy(latLon2Vec(28.3, -15.5, 3.4));
  scene.add(camera);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  camcontrols = new OrbitControls(camera, renderer.domElement);
  camcontrols.enableDamping = true;
  camcontrols.enablePan = false;
  camcontrols.zoomSpeed = 0.3;
  camcontrols.minDistance = 1.2;
  camcontrols.maxDistance = 10;
  camcontrols.autoRotateSpeed = 0.6;

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const luz = new THREE.DirectionalLight(0xffffff, 1.2);
  luz.position.set(1, 1, 2);
  camera.add(luz);

  CreaInterfaz();

  clock = new THREE.Clock();

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  renderer.domElement.addEventListener("pointerdown", (e) => {
    ratonPulsado = { x: e.clientX, y: e.clientY };
  });
  renderer.domElement.addEventListener("pointerup", (e) => {
    if (
      Math.hypot(e.clientX - ratonPulsado.x, e.clientY - ratonPulsado.y) < 5
    ) {
      SeleccionaCable(e.clientX, e.clientY);
    }
  });
  CargaTierra();
}

function CargaTextura(rutas, callback) {
  const loader = new THREE.TextureLoader();
  const intenta = (i) => {
    if (i >= rutas.length) return callback(null);
    loader.load(rutas[i], callback, undefined, () => intenta(i + 1));
  };
  intenta(0);
}

function CargaTierra() {
  CargaTextura(TEX_TIERRA, function (texture) {
    const material = new THREE.MeshPhongMaterial({
      color: texture ? 0xffffff : 0x0b1830,
      specular: 0x222222,
      shininess: 12,
    });
    if (texture) material.map = texture;
    tierra = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 96), material);
    scene.add(tierra);

    halo = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.035, 64, 64),
      new THREE.MeshBasicMaterial({
        color: 0x3a8dde,
        transparent: true,
        opacity: 0.12,
        side: THREE.BackSide,
      })
    );
    scene.add(halo);

    CargaInfo();
  });
}

function CargaInfo() {
  const loader = new THREE.FileLoader();
  loader.load(
    "src/cables_info.json",
    function (text) {
      info = JSON.parse(text);
      console.log("Info de cables: " + Object.keys(info).length);
      CargaCables();
    },
    undefined,
    function () {
      console.log(
        "Sin cables_info.json: no habrá línea temporal ni fichas completas"
      );
      CargaCables();
    }
  );
}

function CargaCables() {
  const loader = new THREE.FileLoader();
  loader.load("src/cable-geo.json", function (text) {
    const geo = JSON.parse(text);

    for (let f of geo.features) {
      const p = f.properties || {};
      const id = p.id || p.feature_id || p.name;
      const extra = info[id] || {};
      const lineas =
        f.geometry.type === "MultiLineString"
          ? f.geometry.coordinates
          : [f.geometry.coordinates];

      const cable = {
        id,
        nombre: p.name || extra.name || id,
        color: new THREE.Color(p.color || "#4cc9f0"),
        anio: extra.rfs_year || 0,
        extra,
        lineas: [],
        tramos: [],
        canarias: false,
        visible: true,
      };
      const indice = cables.length;

      for (let linea of lineas) {
        if (linea.length < 2) continue;
        for (let [lon, lat] of linea) {
          if (EnCanarias(lat, lon)) cable.canarias = true;
        }
        const pts = SigueCurvatura(linea, ALT_CABLE);
        const line = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({
            color: cable.color,
            transparent: true,
            opacity: 0.85,
          })
        );
        line.userData.cable = indice;
        scene.add(line);
        cable.lineas.push(line);
        cable.tramos.push(pts);
      }
      if (cable.lineas.length > 0) cables.push(cable);
    }

    const anios = cables.map((c) => c.anio).filter((a) => a > 0);
    if (anios.length > 0) {
      anioMin = Math.min(...anios);
      anioMax = Math.max(...anios);
    }
    params.anio = anioMax;
    if (controladorAnio)
      controladorAnio.min(anioMin).max(anioMax).updateDisplay();

    CreaPulsos();
    AplicaFiltros();
    console.log("Cables cargados: " + cables.length);

    CargaAmarres();
  });
}

function CargaAmarres() {
  const loader = new THREE.FileLoader();
  loader.load("src/landing-point-geo.json", function (text) {
    const geo = JSON.parse(text);
    for (let f of geo.features) {
      const [lon, lat] = f.geometry.coordinates;
      const v = latLon2Vec(lat, lon, ALT_CABLE);
      if (EnCanarias(lat, lon)) {
        Esfera(v.x, v.y, v.z, 0.006, 12, 12, 0xffa62b);
      } else {
        Esfera(v.x, v.y, v.z, 0.0025, 6, 6, 0xffffff);
      }
    }
    console.log("Puntos de amarre: " + geo.features.length);
  });
}

function EnCanarias(lat, lon) {
  return (
    lat >= canarias.minlat &&
    lat <= canarias.maxlat &&
    lon >= canarias.minlon &&
    lon <= canarias.maxlon
  );
}

function latLon2Vec(lat, lon, radio = R) {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  return new THREE.Vector3(
    -radio * Math.sin(phi) * Math.cos(theta),
    radio * Math.cos(phi),
    radio * Math.sin(phi) * Math.sin(theta)
  );
}

function SigueCurvatura(coords, radio) {
  const pts = [];
  for (let i = 0; i < coords.length; i++) {
    let [lon2, lat2] = coords[i];
    if (i === 0) {
      pts.push(latLon2Vec(lat2, lon2, radio));
      continue;
    }
    const [lon1, lat1] = coords[i - 1];

    if (lon2 - lon1 > 180) lon2 -= 360;
    if (lon2 - lon1 < -180) lon2 += 360;

    const n = Math.max(
      1,
      Math.ceil(Math.max(Math.abs(lat2 - lat1), Math.abs(lon2 - lon1)))
    );
    for (let k = 1; k <= n; k++) {
      const lat = lat1 + ((lat2 - lat1) * k) / n;
      const lon = lon1 + ((lon2 - lon1) * k) / n;
      pts.push(latLon2Vec(lat, lon, radio));
    }
  }
  return pts;
}

function PuntoEnTramo(pts, avance, out) {
  const i = Math.floor(avance);
  const f = avance - i;
  return out.lerpVectors(pts[i], pts[i + 1], f);
}

function TramoMasLargo(c) {
  let largo = c.tramos[0];
  for (let pts of c.tramos) {
    if (pts.length > largo.length) largo = pts;
  }
  return largo;
}

function CreaPulsos() {
  const geometria = new THREE.SphereGeometry(0.004, 6, 6);

  cables.forEach((c, ci) => {
    const pts = TramoMasLargo(c);
    if (pts.length < 2) return;
    const material = new THREE.MeshBasicMaterial({
      color: c.color.clone().lerp(new THREE.Color(0xffffff), 0.5),
    });

    const n = Math.max(1, Math.round(pts.length / 30));
    for (let k = 0; k < n; k++) {
      const mesh = new THREE.Mesh(geometria, material);
      scene.add(mesh);
      pulsos.push({
        mesh,
        cable: ci,
        pts,
        desfase: (k / n) * (pts.length - 1),
      });
    }
  });
  console.log("Pulsos: " + pulsos.length);
}

function ActualizaPulsos(t) {
  for (let pu of pulsos) {
    pu.mesh.visible = params.pulsos && cables[pu.cable].visible;
    if (!pu.mesh.visible) continue;

    const avance =
      (t * params.velocidadPulsos + pu.desfase) % (pu.pts.length - 1);
    PuntoEnTramo(pu.pts, avance, pu.mesh.position).multiplyScalar(
      ALT_PULSO / ALT_CABLE
    );
    pu.mesh.scale.setScalar(escala);
  }
}

function AplicaFiltros() {
  const anio = Math.floor(params.anio);
  const apagado = new THREE.Color(0x1c2a3d);
  let nVisibles = 0;

  for (let c of cables) {
    const porAnio = c.anio === 0 || c.anio <= anio;
    const porZona = !params.soloCanarias || c.canarias;
    c.visible = porAnio && porZona;
    if (c.visible) nVisibles++;

    for (let line of c.lineas) {
      line.visible = porAnio;
      line.material.color.copy(porZona ? c.color : apagado);
    }
  }
  ActualizaHUD(nVisibles);
}

function SeleccionaCable(cx, cy) {
  if (!tierra || cables.length === 0) return;
  const raton = new THREE.Vector2(
    (cx / window.innerWidth) * 2 - 1,
    -(cy / window.innerHeight) * 2 + 1
  );
  raycaster.setFromCamera(raton, camera);
  raycaster.params.Line.threshold = 0.012 * camera.position.length();

  const candidatos = [tierra];
  for (let c of cables) {
    if (c.visible) candidatos.push(...c.lineas);
  }

  const hits = raycaster.intersectObjects(candidatos, false);
  let elegido = -1;
  for (let h of hits) {
    if (h.object === tierra) break;
    if (h.object.userData.cable !== undefined) {
      elegido = h.object.userData.cable;
      break;
    }
  }
  MarcaCable(elegido);
}

function MarcaCable(ci) {
  if (lineaSeleccion) {
    scene.remove(lineaSeleccion);
    lineaSeleccion.traverse((o) => o.geometry && o.geometry.dispose());
    lineaSeleccion = null;
  }
  if (ci < 0) {
    BorraHaz();
    panelInfo.style.display = "none";
    return;
  }
  const c = cables[ci];
  lineaSeleccion = new THREE.Group();
  for (let pts of c.tramos) {
    const elevados = pts.map((p) => p.clone().multiplyScalar(1.002));
    lineaSeleccion.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(elevados),
        new THREE.LineBasicMaterial({ color: 0xffffff })
      )
    );
  }
  scene.add(lineaSeleccion);
  CreaHaz(c);

  const e = c.extra;
  let html = `<div style="font-size:16px;color:${
    "#" + c.color.getHexString()
  }">${c.nombre}</div>`;
  if (e.rfs) html += `<div>En servicio: ${e.rfs}</div>`;
  else if (c.anio) html += `<div>En servicio: ${c.anio}</div>`;
  if (e.length) html += `<div>Longitud: ${e.length}</div>`;
  if (e.owners) html += `<div>Propietarios: ${e.owners}</div>`;
  if (e.landing_points && e.landing_points.length)
    html += `<div style="margin-top:6px;opacity:.8">Amarres: ${e.landing_points.join(
      " · "
    )}</div>`;
  if (c.canarias)
    html += `<div style="margin-top:6px;color:#ffa62b">Pasa por Canarias</div>`;
  panelInfo.innerHTML = html;
  panelInfo.style.display = "block";
}

function CreaHaz(c) {
  BorraHaz();
  const pts = TramoMasLargo(c);
  if (pts.length < 2) return;
  const grupo = new THREE.Group();

  for (let i = 0; i < COLA; i++) {
    const f = 1 - i / COLA;
    const col = c.color.clone().lerp(new THREE.Color(0xffffff), f);
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.002 + 0.007 * f, 8, 8),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: f })
    );
    grupo.add(m);
  }

  const luz = new THREE.PointLight(0x9fdcff, 2, 0.4);
  grupo.add(luz);

  scene.add(grupo);
  haz = { grupo, pts, luz, t0: clock.elapsedTime };
}

function BorraHaz() {
  if (haz) {
    scene.remove(haz.grupo);
    haz.grupo.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
    haz = null;
  }
}

function ActualizaHaz(t) {
  if (!haz) return;
  const velocidad = 35;
  const ultimo = haz.pts.length - 1;
  const avance = ((t - haz.t0) * velocidad) % ultimo;

  for (let i = 0; i < COLA; i++) {
    const m = haz.grupo.children[i];
    const ai = avance - i * 0.8;
    m.visible = ai >= 0;
    if (ai >= 0) {
      PuntoEnTramo(haz.pts, ai, m.position).multiplyScalar(1.004 / ALT_CABLE);
      m.scale.setScalar(escala);
    }
  }
  haz.luz.position.copy(haz.grupo.children[0].position);
}

function CreaInterfaz() {
  hud = document.createElement("div");
  hud.style.cssText =
    "position:fixed;top:14px;left:16px;color:#e6eefc;font:14px/1.5 sans-serif;" +
    "text-shadow:0 0 6px #000;pointer-events:none;";
  document.body.appendChild(hud);

  panelInfo = document.createElement("div");
  panelInfo.style.cssText =
    "position:fixed;bottom:16px;left:16px;max-width:360px;padding:10px 14px;display:none;" +
    "background:rgba(5,10,25,.75);border:1px solid rgba(120,160,220,.35);border-radius:8px;" +
    "color:#e6eefc;font:13px/1.5 sans-serif;";
  document.body.appendChild(panelInfo);

  const gui = new GUI();
  controladorAnio = gui
    .add(params, "anio", anioMin, anioMax, 1)
    .name("Año")
    .listen()
    .onChange(AplicaFiltros);
  gui
    .add(params, "animarAnios")
    .name("Animar años")
    .listen()
    .onChange((v) => {
      if (v && params.anio >= anioMax) params.anio = anioMin; // vuelve a empezar
    });
  gui.add(params, "soloCanarias").name("Solo Canarias").onChange(AplicaFiltros);
  gui.add(params, "pulsos").name("Pulsos de datos");
  gui.add(params, "velocidadPulsos", 1, 30, 1).name("Velocidad pulsos");
  gui.add(params, "verAmarres").name("Puntos de amarre");
  gui.add(params, "rotacion").name("Rotación automática");

  ActualizaHUD(0);
}

function ActualizaHUD(n) {
  if (!hud) return;
  const hayAnios = Object.keys(info).length > 0;
  hud.innerHTML =
    `<div style="font-size:20px">Cables submarinos de internet</div>` +
    (hayAnios
      ? `<div style="font-size:28px">${Math.floor(params.anio)}</div>`
      : "") +
    `<div>${n} cables visibles. Haz clic sobre un cable para cononcer su información</div>`;
}

function Esfera(px, py, pz, radio, nx, ny, col) {
  let geometry = new THREE.SphereGeometry(radio, nx, ny);
  let material = new THREE.MeshBasicMaterial({ color: col });
  let mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(px, py, pz);
  scene.add(mesh);
  objetos.push(mesh);
}

function animationLoop() {
  requestAnimationFrame(animationLoop);

  const dt = Math.min(clock ? clock.getDelta() : 0, 0.1);
  const t = clock ? clock.elapsedTime : 0;

  if (params.animarAnios && cables.length > 0) {
    params.anio += dt * 3;
    if (params.anio >= anioMax) {
      params.anio = anioMax;
      params.animarAnios = false;
    }
    AplicaFiltros();
  }

  escala = THREE.MathUtils.clamp((camera.position.length() - R) / 2.4, 0.04, 1);
  objetos.forEach((o) => {
    o.visible = params.verAmarres;
    o.scale.setScalar(escala);
  });

  ActualizaPulsos(t);
  ActualizaHaz(t);

  camcontrols.autoRotate = params.rotacion;
  camcontrols.update();
  renderer.render(scene, camera);
}
