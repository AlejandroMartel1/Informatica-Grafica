· Autor: [Alejandro José Martel Torres](https://github.com/AlejandroMartel1)     - Acceso directo al proyecto: [CodeSandbox](ENLACE_AL_PROYECTO) 

# Sistema solar 3D

En esta práctica construimos un sistema solar con *three.js*: un Sol, ocho planetas, Plutón, la Luna, los anillos de Saturno y un cinturón de asteroides. Se puede recorrer con una **vista general**, que se maneja con el ratón, y con una **vista subjetiva desde una nave**, que se maneja con el teclado, como se ve en las siguientes imágenes:

<table align="center">
  <tr>
    <td align="center">
      <img src="img/vista-general.png" height="290" alt="Vista general del sistema solar">
      <br>
      <em>Figura 1. Vista general del sistema solar.</em>
    </td>
    <td align="center">
      <img src="img/vista-nave.png" height="290" alt="Vista desde la nave junto a un planeta">
      <br>
      <em>Figura 2. Vista subjetiva desde la nave, junto a un planeta.</em>
    </td>
  </tr>
</table>

## Punto de partida

Partimos del ejemplo de una estrella y dos planetas en alambre que orbitan con `cos` y `sin`. Sobre esa base hemos añadido texturas, luces, sombras, una segunda cámara y un panel de control.

<p align="center">
  <img src="img/partida.png" width="50%" alt="Estrella y dos planetas en alambre">
  <br>
  <em>Figura 3. Punto de partida: una estrella y dos planetas en alambre.</em>
</p>

## Los cuerpos celestes

Cada planeta se crea con una llamada a `Planeta(...)`, indicando su radio, su distancia al Sol, su velocidad y su textura. Su posición en cada instante `t` se calcula como en el ejemplo de partida:

```
x = cos(t · vel) · dist
z = sin(t · vel) · dist · f2
```

Con `f2` menor que 1 la órbita queda elíptica. Los tamaños y las distancias **no están a escala real**, porque con la escala real los planetas serían invisibles.

Cada planeta es un `Object3D` que recorre su órbita, y su esfera gira sobre sí misma. De la esfera cuelgan las nubes de la Tierra y los anillos de Saturno, que se mueven de forma solidaria con ella. La Luna cuelga de un pivote situado en el centro de la Tierra: al girar el pivote, la Luna orbita.

## Decisiones de desarrollo

### Texturas y materiales

Los planetas usan `MeshPhongMaterial` con su textura en `map`. El Sol usa `MeshBasicMaterial`, porque no le afectan las luces: él es la luz. El cielo es una esfera enorme con la textura de estrellas, vista desde dentro (`side: THREE.BackSide`).

La Tierra se construye por capas, como en el ejemplo del guion: la esfera con relieve (`bumpMap`) y especular (`specularMap`), y encima una segunda esfera un 5 % mayor con las nubes, usando un mapa de transparencia (`alphaMap`). Como el mapa de transparencia asume que el blanco es opaco, se usa la versión invertida facilitada en el guion.

**Nota:** la IA ayudó a detectar que el mapa de transparencias de las nubes estaba invertido, al comprobar que era el negativo exacto del mapa de nubes.

Los anillos de Saturno son un `RingGeometry` con textura de color y mapa de transparencia. Hubo que reasignar sus coordenadas de textura para que la imagen vaya de dentro hacia fuera del anillo, en lugar de proyectarse en plano.

**Nota:** la IA se ha utilizado para resolver esta reasignación de coordenadas de textura, que no aparece en los ejemplos del guion.

<table align="center">
  <tr>
    <td align="center">
      <img src="img/tierra.png" height="260" alt="Tierra con relieve, especular y nubes">
      <br>
      <em>Figura 4. La Tierra con relieve, especular y capa de nubes.</em>
    </td>
    <td align="center">
      <img src="img/saturno.png" height="260" alt="Saturno con sus anillos y su sombra">
      <br>
      <em>Figura 5. Saturno, con sus anillos y su sombra sobre ellos.</em>
    </td>
  </tr>
</table>

### Iluminación y sombras

La escena usa tres tipos de luz:

- **Luz ambiente:** evita que las caras sin sol queden completamente negras.
- **Luz puntual:** está en el centro, dentro del Sol, y no pierde intensidad con la distancia, así que llega igual a Mercurio que a Plutón.
- **Luz focal:** es el faro de la nave. Cuelga de su cámara y apunta hacia delante.

Los planetas y las lunas proyectan y reciben sombra, y los anillos de Saturno solo la reciben, así se ve la sombra del planeta sobre ellos. Como indica el guion, las sombras suponen un coste importante, por eso las rocas del cinturón no proyectan sombra, y todas se pueden desactivar desde el panel.

**Nota:** el ajuste del mapa de sombras (`mapSize` y `bias`) se consultó con la IA, ya que sin él aparecían rayas en la superficie de los planetas.

### Cinturón de asteroides

Está formado por 400 rocas entre Marte y Júpiter. Para que no parezcan todas iguales se mezclan cubos y esferas de muy pocos segmentos, con una rotación y una escala aleatorias en cada una. Todas comparten un único material con la textura de la Luna, y cuelgan de un mismo `Object3D` que gira lentamente alrededor del Sol.

### Llamaradas solares

Para dar vida al Sol hemos añadido 15 llamaradas: esferas pequeñas con la textura del propio Sol, repartidas por su superficie y orientadas hacia el centro. En cada frame se estiran y se retuercen con senos y cosenos, con una fase aleatoria distinta para cada una, de modo que no se mueven a la vez. Se pueden activar y desactivar desde el panel.

<table align="center">
  <tr>
    <td align="center">
      <img src="img/cinturon.png" height="260" alt="Cinturón de asteroides entre Marte y Júpiter">
      <br>
      <em>Figura 6. Cinturón de asteroides entre Marte y Júpiter.</em>
    </td>
    <td align="center">
      <img src="img/llamaradas.png" height="260" alt="Llamaradas sobre la superficie del Sol">
      <br>
      <em>Figura 7. Llamaradas solares animadas.</em>
    </td>
  </tr>
</table>

### Vistas y control de la nave

Hay dos cámaras y se alterna entre ellas con el control *Vista* del panel:

- **General:** `OrbitControls`, para girar alrededor del sistema y acercarse o alejarse con el ratón.
- **Nave:** una segunda cámara con `FlyControls`, para moverla libremente por el sistema.

<div align="center">

| Tecla | Acción |
|---|---|
| `W` / `S` | Avanzar / retroceder |
| `A` / `D` | Desplazamiento lateral |
| `R` / `F` | Subir / bajar |
| `Q` / `E` | Rodar |
| Arrastrar con el ratón | Mirar a otro lado |

</div>

El control *Ir a* coloca la nave junto a un cuerpo, entre el Sol y él, para ver su cara iluminada. Como los planetas se mueven, con *Acompañar al cuerpo* activado la nave se desplaza con el cuerpo elegido, y se puede volar libremente a su alrededor.

**Nota:** la IA se ha utilizado para plantear el sistema de seguimiento de la nave y el control de las dos vistas.

### Interfaz e información didáctica

La interfaz es un panel con `lil-gui`, y arriba se muestra siempre una línea de ayuda con los controles, así que no hace falta documentación para manejarla. Permite:

- Cambiar la velocidad de la animación y pausarla.
- Cambiar de vista, y mostrar u ocultar los nombres de los cuerpos y las llamaradas.
- Manejar la nave: *Ir a*, *Acompañar al cuerpo*, velocidad y campo de visión.
- Ajustar la luz del Sol y la luz ambiente, y activar o desactivar las sombras.

Al elegir un cuerpo en *Ir a*, se muestra bajo el título una ficha con su tipo, su diámetro, la duración de su año y algún dato destacado.

<p align="center">
  <img src="img/panel.png" width="40%" alt="Panel de control y ficha informativa">
  <br>
  <em>Figura 8. Panel de control y ficha informativa de un cuerpo.</em>
</p>

## Cumplimiento de la tarea

<div align="center">

| Requisito del guion | Cómo se cumple |
|---|---|
| Al menos cinco planetas y alguna luna | Ocho planetas, Plutón y la Luna |
| Iluminación y texturas | Luces ambiente, puntual y focal, con sombras; mapas difuso, de relieve, especular y de transparencia |
| Dos vistas: general y subjetiva desde una nave | Alternables desde el panel |
| Extras | Nave controlable de forma interactiva, interfaz con ayuda en pantalla y fichas informativas |

</div>

## Vídeo de captura

Vídeo con la ejecución de la tarea: [ENLACE_AL_VIDEO](ENLACE_AL_VIDEO)

## Uso de herramientas de IA

Durante el desarrollo de esta práctica se ha utilizado **Claude** (Anthropic) como asistente de programación, para proponer y revisar código a partir de los ejemplos del guion, depurar errores y ajustar parámetros. Las partes en las que su ayuda fue más relevante se han señalado con una nota en cada apartado. También se ha usado para redactar este README, que ha sido revisado.

- Conversación con la IA: [ENLACE_A_LA_CONVERSACIÓN](ENLACE_A_LA_CONVERSACIÓN)

<!-- Si se usó otra herramienta de IA (por ejemplo, para las llamaradas o el cinturón de asteroides), añadirla aquí con su enlace. -->

## Fuentes de referencia o consulta

- Guion de la asignatura y ejemplos del profesor:
  - [script_11_luces.js](https://github.com/otsedom/otsedom.github.io/blob/main/IG/S7/code/script_11_luces.js)
  - [script_12_lucesysombras](https://github.com/otsedom/otsedom.github.io/blob/main/IG/S7/code/script_12_lucesysombras)
  - [script_13_texturabasica.js](https://github.com/otsedom/otsedom.github.io/blob/main/IG/S7/code/script_13_texturabasica.js)
  - [script_15_texplaneta.js](https://github.com/otsedom/otsedom.github.io/blob/main/IG/S7/code/script_15_texplaneta.js)
- Documentación de *three.js*: [PointLight](https://threejs.org/docs/#api/en/lights/PointLight), [SpotLight](https://threejs.org/docs/#api/en/lights/SpotLight), [WebGLRenderer.shadowMap](https://threejs.org/docs/#api/en/renderers/WebGLRenderer.shadowMap), [MeshPhongMaterial](https://threejs.org/docs/#api/en/materials/MeshPhongMaterial) y [FlyControls](https://threejs.org/docs/#examples/en/controls/FlyControls)
- Texturas:
  - Planetas y Luna: [Planet Pixel Emporium](https://planetpixelemporium.com/planets.html) (© James Hastings-Trew), obtenidas a través del repositorio [threex.planets](https://github.com/jeromeetienne/threex.planets)
  - Relieve, especular y nubes de la Tierra: facilitadas por el profesor, con la fuente indicada en el [ejemplo del guion](https://gis.humboldt.edu/Archive/GISData/2019/WGS84_Geographic/3DTextures)
  - Sol, cielo de estrellas y mapa diurno de la Tierra: [COMPLETAR ORIGEN]
- Datos de las fichas de los cuerpos (diámetros, duración del año...): [COMPLETAR FUENTE]
