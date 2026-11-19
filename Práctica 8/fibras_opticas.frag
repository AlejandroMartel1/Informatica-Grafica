// Fibras ópticas
// Haz de fibras horizontales que ondula, por las que viajan pulsos de luz
// con velocidad, sentido, color y número de pulsos aleatorios en cada fibra.

#ifdef GL_ES
precision mediump float;
#endif

uniform vec2 u_resolution;
uniform float u_time;

// Número de fibras
#define FILAS 18.0

// Aleatorio 1D: misma idea que la función random del guion, sobre un float
float random(float x) {
    return fract(sin(x * 12.9898) * 43758.5453);
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution;

    // Rejilla de filas: cada fila es una fibra.
    float y = st.y * FILAS + 0.4 * sin(st.x * 5.0 + u_time * 0.8);

    float fila = floor(y);               
    float d = abs(fract(y) - 0.5);       

    float r = random(fila);
    float sentido = r > 0.5 ? 1.0 : -1.0;
    float velocidad = 0.1 + r * 0.4;
    float pulsos = 1.0 + floor(r * 3.0); // de 1 a 3 pulsos por fibra

    // Brillo de la fibra: inversamente proporcional a la distancia al centro
    float fibra = 0.015 / (d + 0.001) * (1.0 - 2.0 * d);

    // Pulso: fract crea un diente de sierra que se desplaza con el tiempo.

    float p = fract(sentido * st.x * pulsos - u_time * velocidad + r * 10.0);
    float pulso = pow(p, 12.0);

    // Color de la fibra entre azul cian y magenta
    vec3 colorFibra = mix(vec3(0.0, 0.55, 1.0), vec3(1.0, 0.25, 0.7), r);

    // Fibra tenue siempre visible + pulso que la ilumina al pasar
    vec3 color = colorFibra * fibra * (0.15 + 4.0 * pulso);

    // Fondo azul muy oscuro
    color += vec3(0.01, 0.02, 0.05);

    gl_FragColor = vec4(color, 1.0);
}
