import type { Particle } from "./particles";

export type RGB = [number, number, number];

export type ParticleDrawOptions = {
  scrollX: number;
  scrollY: number;
  baseRadius: number;
  accent: RGB;
  text: RGB;
  gradientStart: { x: number; y: number };
  gradientEnd: { x: number; y: number };
};

export type ParticleRenderer = {
  resize: (cssWidth: number, cssHeight: number, pixelRatio: number) => void;
  draw: (particles: Particle[], options: ParticleDrawOptions) => void;
  dispose: () => void;
};

const VERTEX_SHADER = `
precision highp float;

attribute vec2 aPosition;
attribute float aSize;
attribute float aAlpha;

uniform vec2 uResolution;
uniform float uPixelRatio;
uniform vec2 uGradientStart;
uniform vec2 uGradientEnd;
uniform vec3 uAccent;
uniform vec3 uText;

varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 clip = (aPosition / uResolution) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = aSize * uPixelRatio;

  vec2 axis = uGradientEnd - uGradientStart;
  float lengthSquared = max(dot(axis, axis), 0.0001);
  float t = clamp(dot(aPosition - uGradientStart, axis) / lengthSquared, 0.0, 1.0);

  // Mirrors the canvas gradient: accent -> text (stop 0.46) -> accent.
  vColor = t < 0.46
    ? mix(uAccent, uText, t / 0.46)
    : mix(uText, uAccent, (t - 0.46) / 0.54);
  vAlpha = aAlpha;
}
`;

const FRAGMENT_SHADER = `
precision mediump float;

varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 offset = gl_PointCoord - vec2(0.5);
  float distance = length(offset);
  // Antialiased circular sprite with a fixed soft edge (no derivatives,
  // so this compiles on every WebGL1 implementation).
  float mask = 1.0 - smoothstep(0.42, 0.5, distance);

  if (mask <= 0.0) {
    discard;
  }

  gl_FragColor = vec4(vColor, vAlpha * mask);
}
`;

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
) {
  const shader = gl.createShader(type);

  if (!shader) {
    return null;
  }

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

export function createParticleRenderer(
  canvas: HTMLCanvasElement,
): ParticleRenderer | null {
  const glOrNull = (canvas.getContext("webgl", {
    alpha: true,
    antialias: true,
    premultipliedAlpha: false,
  }) ||
    canvas.getContext("experimental-webgl", {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
    })) as WebGLRenderingContext | null;

  if (!glOrNull) {
    return null;
  }

  const gl: WebGLRenderingContext = glOrNull;

  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

  if (!vertexShader || !fragmentShader) {
    return null;
  }

  const program = gl.createProgram();

  if (!program) {
    return null;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  gl.useProgram(program);

  const buffer = gl.createBuffer();
  const aPosition = gl.getAttribLocation(program, "aPosition");
  const aSize = gl.getAttribLocation(program, "aSize");
  const aAlpha = gl.getAttribLocation(program, "aAlpha");
  const uResolution = gl.getUniformLocation(program, "uResolution");
  const uPixelRatio = gl.getUniformLocation(program, "uPixelRatio");
  const uGradientStart = gl.getUniformLocation(program, "uGradientStart");
  const uGradientEnd = gl.getUniformLocation(program, "uGradientEnd");
  const uAccent = gl.getUniformLocation(program, "uAccent");
  const uText = gl.getUniformLocation(program, "uText");

  // Interleaved layout per particle: x, y, size, alpha.
  const STRIDE = 4;
  let vertexData = new Float32Array(0);
  let cssWidth = 1;
  let cssHeight = 1;
  let pixelRatio = 1;

  gl.clearColor(0, 0, 0, 0);
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  function resize(
    nextCssWidth: number,
    nextCssHeight: number,
    nextPixelRatio: number,
  ) {
    cssWidth = Math.max(1, nextCssWidth);
    cssHeight = Math.max(1, nextCssHeight);
    pixelRatio = nextPixelRatio;
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function draw(particles: Particle[], options: ParticleDrawOptions) {
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    if (particles.length === 0) {
      return;
    }

    if (vertexData.length < particles.length * STRIDE) {
      vertexData = new Float32Array(particles.length * STRIDE);
    }

    let count = 0;

    for (const particle of particles) {
      const particleRadius = options.baseRadius * particle.scale;

      if (particle.opacity <= 0.02 || particleRadius <= 0.05) {
        continue;
      }

      const offset = count * STRIDE;
      vertexData[offset] = particle.x - options.scrollX;
      vertexData[offset + 1] = particle.y - options.scrollY;
      // Diameter in CSS pixels.
      vertexData[offset + 2] = particleRadius * 2;
      vertexData[offset + 3] = 0.94 * particle.opacity;
      count += 1;
    }

    if (count === 0) {
      return;
    }

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      vertexData.subarray(0, count * STRIDE),
      gl.DYNAMIC_DRAW,
    );

    const bytesPerFloat = 4;
    const stride = STRIDE * bytesPerFloat;

    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(aSize);
    gl.vertexAttribPointer(aSize, 1, gl.FLOAT, false, stride, 2 * bytesPerFloat);
    gl.enableVertexAttribArray(aAlpha);
    gl.vertexAttribPointer(
      aAlpha,
      1,
      gl.FLOAT,
      false,
      stride,
      3 * bytesPerFloat,
    );

    gl.uniform2f(uResolution, cssWidth, cssHeight);
    gl.uniform1f(uPixelRatio, pixelRatio);
    gl.uniform2f(uGradientStart, options.gradientStart.x, options.gradientStart.y);
    gl.uniform2f(uGradientEnd, options.gradientEnd.x, options.gradientEnd.y);
    gl.uniform3f(uAccent, options.accent[0], options.accent[1], options.accent[2]);
    gl.uniform3f(uText, options.text[0], options.text[1], options.text[2]);

    gl.drawArrays(gl.POINTS, 0, count);
  }

  function dispose() {
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
  }

  return { resize, draw, dispose };
}
