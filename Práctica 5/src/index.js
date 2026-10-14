import * as dat from "dat.gui";
import { mat4 } from "gl-matrix";

// Vertex shader source 
const vertexShaderSource = `#version 300 es
precision mediump float;

      in vec3 aCoordinates;
      in vec3 aVertexNormals;
      uniform mat4 uModelMatrix;
      uniform mat4 uViewMatrix;
      out vec3 vNormal;
      out vec3 vEyeVector;
      out vec3 vLightDirection;

      void main(void) {
        // saving vertex after transformations BEFORE PERSPECTIVE
        vec4 vertex = uModelMatrix * vec4(aCoordinates, 1.0);
        gl_Position = uViewMatrix * vertex;
        // compute normal vector
        vNormal = vec3(uModelMatrix * vec4(aVertexNormals, 0.0));
        // compute vector from vertex to viewer
        vEyeVector = -vertex.xyz;
        // compute vector from vertex to light
        // Fixed light (not anchored to the objects): every cube has its own
        // modelMatrix, so uModelMatrix * light would give each cube its own light
        vec4 light = vec4(10,10,10,1);
        vLightDirection = light.xyz - vertex.xyz;
      }
`;

// Fragment shader source
const fragmentShaderSource = `#version 300 es
precision mediump float;

out vec4 fragColor;
uniform vec4 uColor; // diffuse material of the object being drawn

in vec3 vNormal;
in vec3 vEyeVector;
in vec3 vLightDirection;

void main(void) {
  // computing diffuse component
  vec3 N = normalize(vNormal);
  vec3 L = normalize(vLightDirection);
  vec3 diffuseMaterial = uColor.rgb;
  float diffuse = max(dot(N, L), 0.0);
  vec4 Idif = vec4(diffuse*diffuseMaterial,1);

  // compute specular component
  float NL = dot(N,L);
  vec4 Ispec = vec4(0,0,0,1);
  if (NL>0.0) {
    vec3 R = 2.0*N*NL-L;
    float shininess = 10.0;
    vec3 specularMaterial = vec3(0.3,0.3,0.3);
    vec3 V = normalize(vEyeVector);
    float specular = pow(max(dot(R, V), 0.0), shininess);
    Ispec = vec4(specular * specularMaterial, 1);
  }

  // computing ambient component
  vec4 Iamb = vec4(0.3*diffuseMaterial,1);

  // calculamos color final
  fragColor = Iamb + Idif + Ispec;
  fragColor = min(fragColor, vec4(1,1,1,1));
}
`;

var canvas, gl;
var colorLocation;
var vertex_buffer;
var modelMatrixLoc;
var modelMatrix;
var index_buffer;
var rotateX = 0,
  rotateY = 0;
var mouseX, mouseY;
var zoomFactor = 1;
var viewMatrixLoc;
var normalsLoc;
var normal_buffer;

// Map of the maze implementation, each character represents a part of the map:  '#' = wall, 'o' = blue cube, '.' = free
const MAP = [
  "###############",
  "#.....#.......#",
  "#.###.#.#####.#",
  "#.#...#.....#.#",
  "#.#.#####.#.#.#",
  "#...#..o..#...#",
  "###.#.#######.#",
  "#...#..o....#.#",
  "#.#######.#.#.#",
  "#...o...#.#...#",
  "#.#####.#.###.#",
  "#o#...#...#...#",
  "#.#.#.#####.###",
  "#...#.........#",
  "###############",
];

const MAP_CELLS = MAP.length; // 15x15
const CELL_SIZE = 2;
const WORLD_SIZE = MAP_CELLS * CELL_SIZE; // floor length (30)
const WALL_HEIGHT = 2.5;
const CUBE_HEIGHT = 1;
const WALL_COLOR = [0.2, 0.4, 0.2, 1];
const CUBE_COLOR = [0.3, 0.5, 1, 1];

// Player definition
const EYE_HEIGHT = 0.9;
const START_ROW = 13,
  START_COL = 1;
var player = {
  x: (START_COL - (MAP_CELLS - 1) / 2) * CELL_SIZE,
  y: EYE_HEIGHT,
  z: (START_ROW - (MAP_CELLS - 1) / 2) * CELL_SIZE,
  ori: -Math.PI / 2,
  feet: 0,
  vy: 0,
  onGround: true,
};
const PLAYER_RADIUS = 0.3;
const MOVE_SPEED = 4;
const ROT_SPEED = 2; // rad/s (angular speed)
var fov = (70 * Math.PI) / 180;
const FOV_MIN = (30 * Math.PI) / 180;
const FOV_MAX = (100 * Math.PI) / 180;

// Jumping constants
const GRAVITY = 14.6;
const JUMP_SPEED = 7.5;
const EPS = 0.01;

// saves the state of keys and movement
const keys = {};

var matrixStack = [];
function glPushMatrix() {
  const matrix = mat4.create();
  mat4.copy(matrix, modelMatrix);
  matrixStack.push(matrix);
}

function glPopMatrix() {
  modelMatrix = matrixStack.pop();
}

function init() {
  // ============ STEP 1: Creating a canvas=================
  canvas = document.getElementById("my_Canvas");
  gl = canvas.getContext("webgl2");

  //========== STEP 2: Create and compile shaders ==========

  // Create a vertex shader object
  const vertShader = gl.createShader(gl.VERTEX_SHADER);

  // Attach vertex shader source code
  gl.shaderSource(vertShader, vertexShaderSource);

  // Compile the vertex shader
  gl.compileShader(vertShader);
  if (!gl.getShaderParameter(vertShader, gl.COMPILE_STATUS)) {
    console.log("vertShader: " + gl.getShaderInfoLog(vertShader));
  }

  // Create fragment shader object
  const fragShader = gl.createShader(gl.FRAGMENT_SHADER);

  // Attach fragment shader source code
  gl.shaderSource(fragShader, fragmentShaderSource);

  // Compile the fragmentt shader
  gl.compileShader(fragShader);
  if (!gl.getShaderParameter(fragShader, gl.COMPILE_STATUS)) {
    console.log("fragShader: " + gl.getShaderInfoLog(fragShader));
  }

  const shaderProgram = gl.createProgram();

  // Attach a vertex shader
  gl.attachShader(shaderProgram, vertShader);

  // Attach a fragment shader
  gl.attachShader(shaderProgram, fragShader);

  // Link both programs
  gl.linkProgram(shaderProgram);

  // Use the combined shader program object
  gl.useProgram(shaderProgram);

  //======== STEP 3: Create buffer objects and associate shaders ========

  // Create an empty buffer object to store the vertex buffer
  vertex_buffer = gl.createBuffer();

  // create index buffer
  index_buffer = gl.createBuffer();

  // create normals buffer
  normal_buffer = gl.createBuffer();

  // Bind vertex buffer object
  gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);

  // Get the attribute location
  const coordLocation = gl.getAttribLocation(shaderProgram, "aCoordinates");

  // Point an attribute to the currently bound VBO
  gl.vertexAttribPointer(coordLocation, 3, gl.FLOAT, false, 0, 0);

  // Enable the attribute
  gl.enableVertexAttribArray(coordLocation);

  // Unbind the buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  // look up uniform locations
  colorLocation = gl.getUniformLocation(shaderProgram, "uColor");

  modelMatrixLoc = gl.getUniformLocation(shaderProgram, "uModelMatrix");
  viewMatrixLoc = gl.getUniformLocation(shaderProgram, "uViewMatrix");
  normalsLoc = gl.getAttribLocation(shaderProgram, "aVertexNormals");

  // point the normals attribute to the normals buffer
  gl.bindBuffer(gl.ARRAY_BUFFER, normal_buffer);
  gl.vertexAttribPointer(normalsLoc, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(normalsLoc);

  gl.enable(gl.DEPTH_TEST);
  // pushes the floor triangles slightly back so the grid lines stay visible
  gl.enable(gl.POLYGON_OFFSET_FILL);
  gl.polygonOffset(1, 1);
}

function renderCube(color = CUBE_COLOR) {
  glPushMatrix();
  mat4.translate(modelMatrix, modelMatrix, [-0.5, 0, -0.5]);
  gl.uniformMatrix4fv(modelMatrixLoc, false, modelMatrix);

  // create vertices (same triangles as the old face indices)
  const arrayV = new Float32Array([
    1,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
    1,
    0,
    0,
    0,
    1,
    0,
    1,
    1,
    0, // cara trasera
    0,
    0,
    1,
    1,
    0,
    1,
    1,
    1,
    1,
    0,
    0,
    1,
    1,
    1,
    1,
    0,
    1,
    1, // cara delantera
    0,
    1,
    1,
    1,
    1,
    1,
    1,
    1,
    0,
    0,
    1,
    1,
    1,
    1,
    0,
    0,
    1,
    0, // cara superior
    0,
    0,
    0,
    1,
    0,
    0,
    1,
    0,
    1,
    0,
    0,
    0,
    1,
    0,
    1,
    0,
    0,
    1, // cara inferior
    1,
    0,
    1,
    1,
    0,
    0,
    1,
    1,
    0,
    1,
    0,
    1,
    1,
    1,
    0,
    1,
    1,
    1, // cara derecha
    0,
    0,
    0,
    0,
    0,
    1,
    0,
    1,
    1,
    0,
    0,
    0,
    0,
    1,
    1,
    0,
    1,
    0, // cara izquierda
  ]);

  // create normals
  const normals = new Float32Array([
    0,
    0,
    -1,
    0,
    0,
    -1,
    0,
    0,
    -1,
    0,
    0,
    -1,
    0,
    0,
    -1,
    0,
    0,
    -1, // cara trasera
    0,
    0,
    1,
    0,
    0,
    1,
    0,
    0,
    1,
    0,
    0,
    1,
    0,
    0,
    1,
    0,
    0,
    1, // cara delantera
    0,
    1,
    0,
    0,
    1,
    0,
    0,
    1,
    0,
    0,
    1,
    0,
    0,
    1,
    0,
    0,
    1,
    0, // cara superior
    0,
    -1,
    0,
    0,
    -1,
    0,
    0,
    -1,
    0,
    0,
    -1,
    0,
    0,
    -1,
    0,
    0,
    -1,
    0, // cara inferior
    1,
    0,
    0,
    1,
    0,
    0,
    1,
    0,
    0,
    1,
    0,
    0,
    1,
    0,
    0,
    1,
    0,
    0, // cara derecha
    -1,
    0,
    0,
    -1,
    0,
    0,
    -1,
    0,
    0,
    -1,
    0,
    0,
    -1,
    0,
    0,
    -1,
    0,
    0, // cara izquierda
  ]);

  // pass data to GPU
  gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
  gl.bufferData(gl.ARRAY_BUFFER, arrayV, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, normal_buffer);
  gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);

  // draw solid cube without indices
  gl.uniform4fv(colorLocation, color);
  gl.drawArrays(gl.TRIANGLES, 0, 36);
  glPopMatrix();
}

// paint a cube in the position (x, y, z) in a scale (sx, sy, sz)
function drawCubeAt(x, y, z, sx, sy, sz, color) {
  glPushMatrix();
  mat4.translate(modelMatrix, modelMatrix, [x, y, z]);
  mat4.scale(modelMatrix, modelMatrix, [sx, sy, sz]);
  renderCube(color);
  glPopMatrix();
}

// paint the map
function renderMap() {
  const half = (MAP_CELLS - 1) / 2;
  for (var r = 0; r < MAP.length; r++) {
    for (var c = 0; c < MAP[r].length; c++) {
      const x = (c - half) * CELL_SIZE;
      const z = (r - half) * CELL_SIZE;
      if (MAP[r][c] === "#")
        drawCubeAt(x, 0, z, CELL_SIZE, WALL_HEIGHT, CELL_SIZE, WALL_COLOR);
      else if (MAP[r][c] === "o")
        drawCubeAt(x, 0, z, CELL_SIZE, CUBE_HEIGHT, CELL_SIZE, CUBE_COLOR);
    }
  }
}

// colissions at height
function cellHeight(x, z) {
  const c = Math.floor(x / CELL_SIZE + MAP_CELLS / 2);
  const r = Math.floor(z / CELL_SIZE + MAP_CELLS / 2);
  if (r < 0 || r >= MAP.length || c < 0 || c >= MAP[r].length) return Infinity;
  switch (MAP[r][c]) {
    case "#":
      return WALL_HEIGHT;
    case "o":
      return CUBE_HEIGHT;
    default:
      return 0;
  }
}

// Maximun height under a cube
function maxHeightUnder(x, z, radius) {
  return Math.max(
    cellHeight(x - radius, z - radius),
    cellHeight(x + radius, z - radius),
    cellHeight(x - radius, z + radius),
    cellHeight(x + radius, z + radius)
  );
}

// horizontal movement
function tryMove(obj, dx, dz, radius) {
  if (maxHeightUnder(obj.x + dx, obj.z, radius) <= obj.feet + EPS) obj.x += dx;
  if (maxHeightUnder(obj.x, obj.z + dz, radius) <= obj.feet + EPS) obj.z += dz;
}

// Updates the player in each frame
function updatePlayer(dt) {
  // Horizontal movement
  if (keys.ArrowLeft) player.ori -= ROT_SPEED * dt;
  if (keys.ArrowRight) player.ori += ROT_SPEED * dt;
  var f = 0,
    s = 0;
  if (keys.ArrowUp || keys.KeyW) f += 1;
  if (keys.ArrowDown || keys.KeyS) f -= 1;
  if (keys.KeyD) s += 1;
  if (keys.KeyA) s -= 1;

  // Eye direction
  const c = Math.cos(player.ori);
  const sn = Math.sin(player.ori);
  var dx = f * c - s * sn;
  var dz = f * sn + s * c;

  // Normalize diagonal movement so it isn't faster
  const len = Math.hypot(dx, dz);
  if (len > 0) {
    dx = (dx / len) * MOVE_SPEED * dt;
    dz = (dz / len) * MOVE_SPEED * dt;
    tryMove(player, dx, dz, PLAYER_RADIUS);
  }

  // Vertical movement: jumping and gravity
  if (keys.Space && player.onGround) {
    player.vy = JUMP_SPEED;
    player.onGround = false;
  }

  player.vy -= GRAVITY * dt; // gravity decelerates an object as it rises and accelerates it as it falls
  player.feet += player.vy * dt;

  // controls player ground position
  const ground = maxHeightUnder(player.x, player.z, PLAYER_RADIUS);
  if (player.feet <= ground) {
    player.feet = ground;
    player.vy = 0;
    player.onGround = true;
  } else {
    player.onGround = false;
  }
  player.y = player.feet + EYE_HEIGHT;
}

function drawScene() {
  renderFloor(WORLD_SIZE * 3);
  renderGround(WORLD_SIZE, MAP_CELLS + 1);
  renderMap();
}

function render() {
  // Time since last frame
  const dt = 1 / 30;
  updatePlayer(dt);

  // Bind appropriate array buffer to it
  gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index_buffer);

  // Set the view port
  gl.viewport(0, 0, canvas.width, canvas.height);

  // Clear the canvas
  gl.clearColor(0.55, 0.75, 0.95, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // perspective
  const viewMatrix = mat4.create();
  mat4.perspective(
    viewMatrix,
    fov, // 
    canvas.width / canvas.height, 
    0.05, // z-near
    60 // z-far
  );
  gl.uniformMatrix4fv(viewMatrixLoc, false, viewMatrix);

  // Set the model Matrix (transformación de vista con lookAt)
  modelMatrix = mat4.create();
  mat4.identity(modelMatrix);

  const eye = [player.x, player.y, player.z];
  const center = [
    player.x + Math.cos(player.ori),
    player.y,
    player.z + Math.sin(player.ori),
  ];
  mat4.lookAt(modelMatrix, eye, center, [0, 1, 0]);

  drawScene();

  // Unbind the buffers
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

  // start animation loop
  window.requestAnimationFrame(render);
}

function onMouseDown(e) {
  if (e.buttons == 1 && e.srcElement == canvas) {
    mouseX = e.pageX;
    mouseY = e.pageY;
  }
}

function onMouseMove(e) {
  if (e.buttons == 1 && e.srcElement == canvas) {
    rotateY = rotateY + (e.pageX - mouseX) * 0.01;
    rotateX = rotateX + (e.pageY - mouseY) * 0.01;
    mouseX = e.pageX;
    mouseY = e.pageY;
  }
}

// draw squared floor
function renderGround(size, n) {
  glPushMatrix();
  mat4.scale(modelMatrix, modelMatrix, [size, size, size]);
  mat4.translate(modelMatrix, modelMatrix, [-0.5, 0, -0.5]);
  gl.uniformMatrix4fv(modelMatrixLoc, false, modelMatrix);
  // creamos vector vértices
  var k = 0;
  const arrayV = new Float32Array(12 * n);
  for (var i = 0; i < n; i++) {
    arrayV[k++] = i / (n - 1);
    arrayV[k++] = 0;
    arrayV[k++] = 0;
    arrayV[k++] = i / (n - 1);
    arrayV[k++] = 0;
    arrayV[k++] = 1;
  }
  for (var i = 0; i < n; i++) {
    arrayV[k++] = 0;
    arrayV[k++] = 0;
    arrayV[k++] = i / (n - 1);
    arrayV[k++] = 1;
    arrayV[k++] = 0;
    arrayV[k++] = i / (n - 1);
  }

  // normals: all the grid points point up (0, 1, 0)
  const normals = new Float32Array(12 * n);
  for (var i = 0; i < 4 * n; i++) normals[3 * i + 1] = 1;

  // pass data to GPU
  gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
  gl.bufferData(gl.ARRAY_BUFFER, arrayV, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, normal_buffer);
  gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);

  gl.uniform4fv(colorLocation, [0, 0, 0, 1]);
  gl.drawArrays(gl.LINES, 0, 4 * n);
  glPopMatrix();
}

function renderFloor(size) {
  glPushMatrix();
  mat4.scale(modelMatrix, modelMatrix, [size, size, size]);
  mat4.translate(modelMatrix, modelMatrix, [-0.5, 0, -0.5]);
  gl.uniformMatrix4fv(modelMatrixLoc, false, modelMatrix);
  const arrayV = new Float32Array([
    0,
    0,
    0,
    1,
    0,
    0,
    1,
    0,
    1, // first triangle
    0,
    0,
    0,
    1,
    0,
    1,
    0,
    0,
    1, // second triangle
  ]);
  // normals: the floor always points up (0, 1, 0)
  const normals = new Float32Array([
    0,
    1,
    0,
    0,
    1,
    0,
    0,
    1,
    0, // first triangle
    0,
    1,
    0,
    0,
    1,
    0,
    0,
    1,
    0, // second triangle
  ]);

  // pass data to GPU
  gl.bindBuffer(gl.ARRAY_BUFFER, vertex_buffer);
  gl.bufferData(gl.ARRAY_BUFFER, arrayV, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, normal_buffer);
  gl.bufferData(gl.ARRAY_BUFFER, normals, gl.STATIC_DRAW);

  gl.uniform4fv(colorLocation, [0.75, 0.68, 0.5, 1]); // floor colour
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  glPopMatrix();
}

function zoom(e) {
  if (e.deltaY < 0) fov /= 1.1;
  else fov *= 1.1;
  fov = Math.min(FOV_MAX, Math.max(FOV_MIN, fov));
}

function onKeyDown(e) {
  keys[e.code] = true;
  if (e.code.startsWith("Arrow") || e.code === "Space") e.preventDefault();
}

function onKeyUp(e) {
  keys[e.code] = false;
}

function releaseAllKeys() {
  for (const k in keys) keys[k] = false;
}

// Main code
init();
render();

document.onwheel = zoom;
document.onkeydown = onKeyDown;
document.onkeyup = onKeyUp;
window.onblur = releaseAllKeys;
