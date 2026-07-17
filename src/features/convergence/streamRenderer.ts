import { getStreamProgress, type GameState, type PlayerId } from "./game";
import type { ViewTransform } from "./draw";

type RGB = [number, number, number];

const COLORS: Record<PlayerId, RGB> = {
  human: [0.498, 0.475, 1],
  amber: [0.949, 0.678, 0.333],
  teal: [0.384, 0.843, 0.82],
};

const VERTEX_SHADER = `
precision highp float;

attribute vec2 aPosition;
attribute float aSize;
attribute vec3 aColor;
attribute float aAlpha;

uniform vec2 uResolution;
uniform float uPixelRatio;

varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 clip = (aPosition / uResolution) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  gl_PointSize = aSize * uPixelRatio;
  vColor = aColor;
  vAlpha = aAlpha;
}
`;

const FRAGMENT_SHADER = `
precision mediump float;

varying vec3 vColor;
varying float vAlpha;

void main() {
  float distance = length(gl_PointCoord - vec2(0.5));
  float mask = 1.0 - smoothstep(0.42, 0.5, distance);

  if (mask <= 0.0) {
    discard;
  }

  gl_FragColor = vec4(vColor, vAlpha * mask);
}
`;

const FLOATS_PER_PARTICLE = 7;
const BYTES_PER_FLOAT = 4;
const GOLDEN_ANGLE = 2.3999632297;
const MAX_VISIBLE_PARTICLES_PER_STREAM = 10;

export type StreamRenderer = {
  clear: () => void;
  dispose: () => void;
  draw: (game: GameState, view: ViewTransform) => void;
  resize: (width: number, height: number, pixelRatio: number) => void;
};

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

function getCurveControl(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  bend: number,
) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const length = Math.max(1, Math.hypot(dx, dy));
  return {
    x: (fromX + toX) / 2 - (dy / length) * bend,
    y: (fromY + toY) / 2 + (dx / length) * bend,
  };
}

function quadraticPoint(
  start: { x: number; y: number },
  control: { x: number; y: number },
  end: { x: number; y: number },
  progress: number,
) {
  const inverse = 1 - progress;
  return {
    x:
      inverse * inverse * start.x +
      2 * inverse * progress * control.x +
      progress * progress * end.x,
    y:
      inverse * inverse * start.y +
      2 * inverse * progress * control.y +
      progress * progress * end.y,
  };
}

export function createStreamRenderer(
  canvas: HTMLCanvasElement,
): StreamRenderer | null {
  const glOrNull = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: false,
    powerPreference: "high-performance",
  });

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
  const buffer = gl.createBuffer();

  if (!program || !buffer) {
    return null;
  }

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  const aPosition = gl.getAttribLocation(program, "aPosition");
  const aSize = gl.getAttribLocation(program, "aSize");
  const aColor = gl.getAttribLocation(program, "aColor");
  const aAlpha = gl.getAttribLocation(program, "aAlpha");
  const uResolution = gl.getUniformLocation(program, "uResolution");
  const uPixelRatio = gl.getUniformLocation(program, "uPixelRatio");
  const stride = FLOATS_PER_PARTICLE * BYTES_PER_FLOAT;
  let width = 1;
  let height = 1;
  let pixelRatio = 1;
  let capacity = 0;
  let vertexData = new Float32Array(0);
  let starsReference: GameState["stars"] | null = null;
  let starsById = new Map<string, GameState["stars"][number]>();
  const clusterCache = new Map<number, Float32Array>();

  gl.clearColor(0, 0, 0, 0);
  gl.disable(gl.DEPTH_TEST);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
  gl.useProgram(program);
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(aSize);
  gl.vertexAttribPointer(
    aSize,
    1,
    gl.FLOAT,
    false,
    stride,
    2 * BYTES_PER_FLOAT,
  );
  gl.enableVertexAttribArray(aColor);
  gl.vertexAttribPointer(
    aColor,
    3,
    gl.FLOAT,
    false,
    stride,
    3 * BYTES_PER_FLOAT,
  );
  gl.enableVertexAttribArray(aAlpha);
  gl.vertexAttribPointer(
    aAlpha,
    1,
    gl.FLOAT,
    false,
    stride,
    6 * BYTES_PER_FLOAT,
  );

  function ensureCapacity(particleCount: number) {
    if (particleCount <= capacity) {
      return;
    }

    capacity = Math.max(256, 2 ** Math.ceil(Math.log2(particleCount)));
    vertexData = new Float32Array(capacity * FLOATS_PER_PARTICLE);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertexData.byteLength, gl.DYNAMIC_DRAW);
  }

  function clear() {
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  function getCluster(count: number) {
    const cached = clusterCache.get(count);

    if (cached) {
      return cached;
    }

    const cluster = new Float32Array(count * 2);

    for (let index = 0; index < count; index += 1) {
      const angle = index * GOLDEN_ANGLE;
      const distance = 0.82 * Math.sqrt((index + 0.5) / Math.max(1, count));
      cluster[index * 2] = Math.cos(angle) * distance;
      cluster[index * 2 + 1] = Math.sin(angle) * distance;
    }

    clusterCache.set(count, cluster);
    return cluster;
  }

  function resize(
    nextWidth: number,
    nextHeight: number,
    nextPixelRatio: number,
  ) {
    width = Math.max(1, nextWidth);
    height = Math.max(1, nextHeight);
    pixelRatio = nextPixelRatio;
    const physicalWidth = Math.round(width * pixelRatio);
    const physicalHeight = Math.round(height * pixelRatio);

    if (canvas.width !== physicalWidth || canvas.height !== physicalHeight) {
      canvas.width = physicalWidth;
      canvas.height = physicalHeight;
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    clear();
  }

  function draw(game: GameState, view: ViewTransform) {
    const particleCount = game.streams.reduce(
      (total, stream) =>
        total + Math.min(stream.count, MAX_VISIBLE_PARTICLES_PER_STREAM),
      0,
    );

    clear();

    if (particleCount === 0) {
      return;
    }

    ensureCapacity(particleCount);

    if (starsReference !== game.stars) {
      starsReference = game.stars;
      starsById = new Map(game.stars.map((star) => [star.id, star]));
    }

    let offset = 0;

    for (const stream of game.streams) {
      const source = starsById.get(stream.sourceId);
      const target = starsById.get(stream.targetId);

      if (!source || !target) {
        continue;
      }

      const bend = ((stream.id % 3) - 1) * 18;
      const control = getCurveControl(
        source.x,
        source.y,
        target.x,
        target.y,
        bend,
      );
      const packet = quadraticPoint(
        source,
        control,
        target,
        getStreamProgress(stream, game.time),
      );
      const centerX = packet.x * view.scale + view.offsetX;
      const centerY = packet.y * view.scale + view.offsetY;
      const visibleCount = Math.min(
        stream.count,
        MAX_VISIBLE_PARTICLES_PER_STREAM,
      );
      const clusterRadius = 7 + Math.sqrt(visibleCount) * 5;
      const pointSize = Math.max(9, view.scale * 8);
      const color = COLORS[stream.owner];
      const cluster = getCluster(visibleCount);

      for (let index = 0; index < visibleCount; index += 1) {
        const clusterX = cluster[index * 2] * clusterRadius;
        const clusterY = cluster[index * 2 + 1] * clusterRadius;

        vertexData[offset] = centerX + clusterX;
        vertexData[offset + 1] = centerY + clusterY;
        vertexData[offset + 2] = pointSize;
        vertexData[offset + 3] = color[0];
        vertexData[offset + 4] = color[1];
        vertexData[offset + 5] = color[2];
        vertexData[offset + 6] = 0.94;
        offset += FLOATS_PER_PARTICLE;
      }
    }

    const count = offset / FLOATS_PER_PARTICLE;

    if (count === 0) {
      return;
    }

    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      vertexData.subarray(0, count * FLOATS_PER_PARTICLE),
    );
    gl.uniform2f(uResolution, width, height);
    gl.uniform1f(uPixelRatio, pixelRatio);
    gl.drawArrays(gl.POINTS, 0, count);
  }

  function dispose() {
    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
  }

  return { clear, dispose, draw, resize };
}
