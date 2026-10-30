import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { FlyControls } from "three/examples/jsm/controls/FlyControls.js";
import GUI from "three/examples/jsm/libs/lil-gui.module.min.js";

let scene, renderer;
let camera, cameraNave, camaraActiva;
let info;
let camcontrols, flyControls;
let luzSol, luzAmb;
let estrella, cinturon;
let cuerpos = {};
let objetivo = null;
const posObjetivo = new THREE.Vector3();
const actual = new THREE.Vector3();
const delta = new THREE.Vector3();
let Planetas = [];
let Lunas = [];
let Etiquetas = [];
let llamaradas = [];
let tiempo = 0;
let ultimo = 0;

const params = {
  velocidad: 1,
  pausa: false,
  vista: "General",
  irA: "—",
  acompanar: true,
  etiquetas: true,
  llamaradas: true,
};

const INTENSIDAD_SOL = parseInt(THREE.REVISION) >= 155 ? 3 : 1;
const AYUDA =
  "En la vista general el ratón permite girar y hacer zoom · Nave: W A S D mover, R F subir/bajar, Q E rodar, arrastrar para mirar";

init();
animationLoop();

function init() {
  info = document.createElement("div");
  info.style.position = "absolute";
  info.style.top = "30px";
  info.style.width = "100%";
  info.style.textAlign = "center";
  info.style.color = "#fff";
  info.style.fontWeight = "bold";
  info.style.backgroundColor = "transparent";
  info.style.zIndex = "2";
  info.style.fontFamily = "Monospace";
  info.style.pointerEvents = "none";
  document.body.appendChild(info);
  mostrarInfo();

  scene = new THREE.Scene();

  camera = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    3000
  );
  camera.position.set(0, 30, 45);

  cameraNave = new THREE.PerspectiveCamera(
    60,
    window.innerWidth / window.innerHeight,
    0.1,
    3000
  );
  cameraNave.position.set(0, 4, 24);
  cameraNave.lookAt(0, 0, 0);
  scene.add(cameraNave);

  camaraActiva = camera;

  const faroNave = new THREE.SpotLight(0xffffff, 2, 80, Math.PI / 6, 0.5, 1);
  cameraNave.add(faroNave);
  cameraNave.add(faroNave.target);
  faroNave.target.position.set(0, 0, -1);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.body.appendChild(renderer.domElement);

  camcontrols = new OrbitControls(camera, renderer.domElement);
  camcontrols.maxDistance = 400;

  flyControls = new FlyControls(cameraNave, renderer.domElement);
  flyControls.dragToLook = true;
  flyControls.movementSpeed = 8;
  flyControls.rollSpeed = 0.6;
  flyControls.enabled = false;

  luzAmb = new THREE.AmbientLight(0xffffff, 0.25);
  scene.add(luzAmb);

  luzSol = new THREE.PointLight(0xffffff, INTENSIDAD_SOL, 0, 0);
  luzSol.castShadow = true;
  luzSol.shadow.mapSize.set(2048, 2048);
  luzSol.shadow.camera.far = 100;
  luzSol.shadow.bias = -0.0005;
  scene.add(luzSol);

  Cielo(cargarTextura("src/stars_milkyway.jpg"));
  Estrella(2.5, cargarTextura("src/sun_surface.jpg"));

  Planeta(
    "Mercurio",
    0.3,
    5.5,
    0.8,
    0.9,
    0.004,
    cargarTextura("src/mercury_surface.jpg")
  );
  Planeta(
    "Venus",
    0.5,
    7.5,
    0.6,
    0.98,
    -0.002,
    cargarTextura("src/venus_surface.jpg")
  );

  const tierra = Planeta(
    "Tierra",
    0.55,
    10,
    0.5,
    0.98,
    0.02,
    cargarTextura("src/earth_surface.jpg")
  );
  Luna(
    tierra,
    0.15,
    1.1,
    0.03,
    0xffffff,
    cargarTextura("src/moon_surface.jpg")
  );

  Planeta(
    "Marte",
    0.4,
    12.5,
    0.4,
    0.95,
    0.018,
    cargarTextura("src/mars_surface.jpg")
  );

  Cinturon(400, 13.8, 15.8, cargarTextura("src/moon_surface.jpg"));

  const jupiter = Planeta(
    "Júpiter",
    1.3,
    19,
    0.22,
    0.97,
    0.04,
    cargarTextura("src/jupiter_surface.jpg")
  );

  const saturno = Planeta(
    "Saturno",
    1.1,
    22,
    0.16,
    0.97,
    0.035,
    cargarTextura("src/saturn_surface.jpg")
  );
  Anillos(
    saturno.userData.malla,
    1.5,
    2.6,
    cargarTextura("src/saturn_ring.png")
  );

  Planeta(
    "Urano",
    0.8,
    26,
    0.12,
    0.98,
    -0.03,
    cargarTextura("src/uranus_surface.jpg")
  );
  Planeta(
    "Neptuno",
    0.8,
    30,
    0.09,
    0.99,
    0.03,
    cargarTextura("src/neptune_surface.jpg")
  );
  Planeta(
    "Plutón",
    0.2,
    36,
    0.06,
    0.85,
    0.01,
    cargarTextura("src/moon_surface.jpg")
  );

  crearGUI();

  window.addEventListener("resize", () => {
    const W = window.innerWidth;
    const H = window.innerHeight;
    renderer.setSize(W, H);
    camera.aspect = W / H;
    camera.updateProjectionMatrix();
    cameraNave.aspect = W / H;
    cameraNave.updateProjectionMatrix();
  });

  ultimo = performance.now();
}

/* ---------- Funciones de creación ---------- */

function cargarTextura(ruta, esColor = true) {
  const tex = new THREE.TextureLoader().load(ruta, undefined, undefined, () =>
    console.warn("No se encuentra la textura: " + ruta)
  );
  if (esColor) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function Esfera(
  padre,
  px,
  py,
  pz,
  radio,
  nx,
  ny,
  col,
  texture = undefined,
  texbump = undefined,
  texspec = undefined,
  texalpha = undefined,
  sombra = false
) {
  const geometry = new THREE.SphereGeometry(radio, nx, ny);
  const material = new THREE.MeshPhongMaterial({ color: col });

  if (texture != undefined) {
    material.map = texture;
  }
  if (texbump != undefined) {
    material.bumpMap = texbump;
    material.bumpScale = 0.5;
  }
  if (texspec != undefined) {
    material.specularMap = texspec;
    material.specular = new THREE.Color("grey");
  }
  if (texalpha != undefined) {
    material.alphaMap = texalpha;
    material.transparent = true;
    material.side = THREE.DoubleSide;
    material.opacity = 1.0;
  }

  const mesh = new THREE.Mesh(geometry, material);
  if (sombra) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
  }
  mesh.position.set(px, py, pz);
  padre.add(mesh);
  return mesh;
}

function Cielo(texture) {
  const geometry = new THREE.SphereGeometry(1500, 32, 32);
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    side: THREE.BackSide,
  });
  scene.add(new THREE.Mesh(geometry, material));
}

function Estrella(radio, texture) {
  const geometry = new THREE.SphereGeometry(radio, 40, 40);
  const material = new THREE.MeshBasicMaterial({ map: texture });
  estrella = new THREE.Mesh(geometry, material);
  estrella.userData.radio = radio;
  scene.add(estrella);
  cuerpos["Sol"] = estrella;
  Etiqueta(estrella, "Sol", radio + 0.8);
  Llamaradas(estrella, radio, texture);
}

function Llamaradas(padre, radioSol, texturaSol) {
  const geometry = new THREE.SphereGeometry(radioSol * 0.15, 16, 16);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    map: texturaSol,
    transparent: true,
    opacity: 0.85,
  });

  for (let i = 0; i < 15; i++) {
    const malla = new THREE.Mesh(geometry, material);

    const angX = Math.random() * Math.PI * 2;
    const angY = Math.random() * Math.PI * 2;
    malla.position.set(
      Math.cos(angX) * Math.sin(angY) * radioSol,
      Math.cos(angY) * radioSol,
      Math.sin(angX) * Math.sin(angY) * radioSol
    );

    malla.lookAt(0, 0, 0);

    padre.add(malla);
    llamaradas.push({ obj: malla, fase: Math.random() * Math.PI * 2 });
  }
}

function Planeta(nombre, radio, dist, vel, f2, rot, texture, texbump, texspec) {
  const grupo = new THREE.Object3D();
  grupo.userData = {
    dist: dist,
    vel: vel,
    f1: 1.0,
    f2: f2,
    rot: rot,
    radio: radio,
  };

  const malla = Esfera(
    grupo,
    0,
    0,
    0,
    radio,
    40,
    40,
    0xffffff,
    texture,
    texbump,
    texspec,
    undefined,
    true
  );
  grupo.userData.malla = malla;

  grupo.position.set(dist, 0, 0);
  scene.add(grupo);

  Orbita(dist, f2);
  Etiqueta(grupo, nombre, radio + 0.9);

  Planetas.push(grupo);
  cuerpos[nombre] = grupo;
  return grupo;
}

function Luna(planeta, radio, dist, vel, col, texture = undefined) {
  const pivote = new THREE.Object3D();
  pivote.userData.vel = vel;
  planeta.add(pivote);
  Esfera(
    pivote,
    dist,
    0,
    0,
    radio,
    20,
    20,
    col,
    texture,
    undefined,
    undefined,
    undefined,
    true
  );
  Lunas.push(pivote);
}

function Anillos(padre, interior, exterior, txColor, txAlpha) {
  const geometry = new THREE.RingGeometry(interior, exterior, 64);

  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    uv.setXY(i, (v.length() - interior) / (exterior - interior), 0.5);
  }

  const material = new THREE.MeshPhongMaterial({
    map: txColor,
    alphaMap: txAlpha,
    transparent: true,
    side: THREE.DoubleSide,
  });
  const anillo = new THREE.Mesh(geometry, material);
  anillo.rotation.x = -Math.PI / 2;
  anillo.receiveShadow = true;
  padre.add(anillo);
}

function Orbita(dist, f2) {
  const geometry = new THREE.RingGeometry(dist - 0.03, dist + 0.03, 128);
  const material = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.25,
  });
  const orbita = new THREE.Mesh(geometry, material);
  orbita.rotation.x = -Math.PI / 2;
  orbita.scale.set(1, f2, 1);
  scene.add(orbita);
}

function Cinturon(n, rMin, rMax, texturaRoca) {
  cinturon = new THREE.Object3D();

  const geoCaja = new THREE.BoxGeometry(1, 1, 1);
  const geoEsferaBaja = new THREE.SphereGeometry(1, 4, 4);
  const geometrias = [geoCaja, geoEsferaBaja];

  const material = new THREE.MeshPhongMaterial({
    color: 0xbbbbbb,
    map: texturaRoca,
    shininess: 5,
    flatShading: true,
  });

  for (let i = 0; i < n; i++) {
    const geoElegida = geometrias[Math.floor(Math.random() * 2)];
    const roca = new THREE.Mesh(geoElegida, material);

    const ang = Math.random() * Math.PI * 2;
    const r = rMin + Math.random() * (rMax - rMin);
    roca.position.set(
      Math.cos(ang) * r,
      (Math.random() - 0.5) * 0.6,
      Math.sin(ang) * r
    );

    roca.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    );

    const s = 0.04 + Math.random() * 0.08;
    roca.scale.set(
      s,
      s * (0.6 + Math.random() * 0.8),
      s * (0.6 + Math.random() * 0.8)
    );

    cinturon.add(roca);
  }
  scene.add(cinturon);
}

function Etiqueta(padre, nombre, y) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.font = "30pt Arial";
  ctx.fillStyle = "white";
  ctx.textAlign = "center";
  ctx.fillText(nombre, 128, 46);

  const tex = new THREE.Texture(canvas);
  tex.needsUpdate = true;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
  sprite.scale.set(6, 1.5, 1);
  sprite.position.set(0, y, 0);
  padre.add(sprite);
  Etiquetas.push(sprite);
}

/* ---------- Interfaz ---------- */

function mostrarInfo() {
  info.innerHTML =
    "Sistema solar<br><span style='font-size:11px;font-weight:normal;opacity:.75'>" +
    AYUDA +
    "</span>";
}

function irA(nombre) {
  if (nombre === "—") {
    objetivo = null;
    return;
  }

  const obj = cuerpos[nombre];
  const p = new THREE.Vector3();
  obj.getWorldPosition(p);
  objetivo = obj;
  posObjetivo.copy(p);

  const dir =
    p.lengthSq() > 0 ? p.clone().normalize() : new THREE.Vector3(0, 0, -1);
  const pos = p.clone().sub(dir.multiplyScalar(obj.userData.radio * 5 + 2));
  pos.y += obj.userData.radio;

  cameraNave.position.copy(pos);
  cameraNave.lookAt(p);
}

function crearGUI() {
  const gui = new GUI();

  gui.add(params, "velocidad", 0, 5, 0.1).name("Velocidad");
  gui.add(params, "pausa").name("Pausa");

  gui
    .add(params, "vista", ["General", "Nave"])
    .name("Vista")
    .onChange((valor) => {
      camaraActiva = valor === "Nave" ? cameraNave : camera;
      camcontrols.enabled = valor !== "Nave";
      flyControls.enabled = valor === "Nave";
    });

  gui
    .add(params, "etiquetas")
    .name("Nombres")
    .onChange((valor) => {
      Etiquetas.forEach((e) => (e.visible = valor));
    });

  gui
    .add(params, "llamaradas")
    .name("Modo Llamaradas")
    .onChange((valor) => {
      llamaradas.forEach((ll) => (ll.obj.visible = valor));
    });

  const fNave = gui.addFolder("Nave");
  fNave
    .add(params, "irA", ["—"].concat(Object.keys(cuerpos)))
    .name("Ir a")
    .onChange(irA);
  fNave.add(params, "acompanar").name("Acompañar al cuerpo");
  fNave.add(flyControls, "movementSpeed", 1, 40, 1).name("Velocidad nave");
  fNave
    .add(cameraNave, "fov", 20, 120, 1)
    .name("Campo de visión")
    .onChange(() => cameraNave.updateProjectionMatrix());
  fNave.open();

  const fLuces = gui.addFolder("Luces");
  fLuces.add(luzSol, "intensity", 0, 6, 0.25).name("Luz del Sol");
  fLuces.add(luzAmb, "intensity", 0, 1, 0.05).name("Luz ambiente");
  fLuces.add(luzSol, "castShadow").name("Sombras");
  fLuces.open();
}

/* ---------- Bucle de animación ---------- */

function animationLoop() {
  requestAnimationFrame(animationLoop);

  const ahora = performance.now();
  const dt = Math.min((ahora - ultimo) / 1000, 0.1);
  ultimo = ahora;

  const v = params.pausa ? 0 : params.velocidad;
  tiempo += dt * v;

  estrella.rotation.y += 0.002 * v;
  cinturon.rotation.y += 0.0006 * v;

  Planetas.forEach(function (planeta) {
    const d = planeta.userData;
    planeta.position.x = Math.cos(tiempo * d.vel) * d.dist * d.f1;
    planeta.position.z = Math.sin(tiempo * d.vel) * d.dist * d.f2;
    d.malla.rotation.y += d.rot * v;
  });

  Lunas.forEach(function (pivote) {
    pivote.rotation.y += pivote.userData.vel * v;
  });

  if (params.llamaradas) {
    llamaradas.forEach((ll) => {
      const onda1 = Math.sin(tiempo * 4 + ll.fase);
      const onda2 = Math.cos(tiempo * 7 + ll.fase * 2);

      const escZ = 1.5 + onda1 * 1.2 + onda2 * 0.5;
      const escX = 0.5 + Math.sin(tiempo * 3 + ll.fase) * 0.2;
      const escY = 0.5 + Math.cos(tiempo * 5 + ll.fase) * 0.3;

      ll.obj.scale.set(escX, escY, Math.max(0.1, escZ));
      ll.obj.rotation.z += 0.03 + onda1 * 0.01;
    });
  }

  if (objetivo) {
    objetivo.getWorldPosition(actual);
    delta.copy(actual).sub(posObjetivo);
    if (params.acompanar) cameraNave.position.add(delta);
    posObjetivo.copy(actual);
  }

  if (params.vista === "Nave") {
    flyControls.update(dt);
  } else {
    camcontrols.update();
  }

  renderer.render(scene, camaraActiva);
}
