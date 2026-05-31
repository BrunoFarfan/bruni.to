export type Point = {
  x: number;
  y: number;
};

export type ParticleMode = "active" | "born" | "retiring";

export type Particle = Point & {
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  opacity: number;
  scale: number;
  mode: ParticleMode;
};

export type TextVariant = "domain" | "hero" | "section" | "icon";

export type TextTargetDensity = {
  inkPixelsPerParticle?: number | ((width: number) => number);
  maximumCount?: number | ((width: number) => number);
  minimumCount?: number | ((width: number) => number);
};

export type TextTargetOptions = {
  align?: CanvasTextAlign;
  density?: TextTargetDensity;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  lineHeight?: number;
  variant: TextVariant;
};

export const DEFAULT_PARTICLE_FONT_FAMILY =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export function clampCount(count: number, min: number, max: number) {
  return Math.max(min, Math.min(max, count));
}

export function jitterPoint(point: Point, amount: number) {
  return {
    x: point.x + (Math.random() - 0.5) * amount,
    y: point.y + (Math.random() - 0.5) * amount,
  };
}

function resolveDensityValue(
  value: number | ((width: number) => number) | undefined,
  width: number,
  fallback: number,
) {
  return typeof value === "function" ? value(width) : (value ?? fallback);
}

function getDefaultInkPixelsPerParticle(width: number) {
  return width < 520 ? 7 : 10;
}

function getDefaultMinimumParticleCount(_width: number) {
  return 1;
}

function getDefaultMaximumParticleCount(_width: number) {
  return 8000;
}

export function sampleStratifiedPoints(
  points: Point[],
  targetCount: number,
  width: number,
  step: number,
  inkPixelsPerParticle = getDefaultInkPixelsPerParticle(width),
) {
  if (points.length <= targetCount) {
    return points.map((point) => jitterPoint(point, step));
  }

  const cellSize = Math.max(step, Math.sqrt(inkPixelsPerParticle));
  const cells = new Map<string, Point[]>();

  for (const point of points) {
    const cellX = Math.floor(point.x / cellSize);
    const cellY = Math.floor(point.y / cellSize);
    const cellKey = `${cellX}:${cellY}`;
    const cellPoints = cells.get(cellKey);

    if (cellPoints) {
      cellPoints.push(point);
    } else {
      cells.set(cellKey, [point]);
    }
  }

  const shuffledCells = Array.from(cells.values());

  for (let index = shuffledCells.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffledCells[index], shuffledCells[swapIndex]] = [
      shuffledCells[swapIndex],
      shuffledCells[index],
    ];
  }

  const sampledPoints: Point[] = [];
  const unusedPoints: Point[] = [];

  for (const cellPoints of shuffledCells) {
    const selectedIndex = Math.floor(Math.random() * cellPoints.length);
    sampledPoints.push(jitterPoint(cellPoints[selectedIndex], 0.55));

    for (let index = 0; index < cellPoints.length; index += 1) {
      if (index !== selectedIndex) {
        unusedPoints.push(cellPoints[index]);
      }
    }
  }

  if (sampledPoints.length > targetCount) {
    return sampledPoints.slice(0, targetCount);
  }

  while (sampledPoints.length < targetCount && unusedPoints.length > 0) {
    const selectedIndex = Math.floor(Math.random() * unusedPoints.length);
    const [point] = unusedPoints.splice(selectedIndex, 1);
    sampledPoints.push(jitterPoint(point, 0.45));
  }

  return sampledPoints;
}

function getLines(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;

    if (currentLine && context.measureText(nextLine).width > maxWidth) {
      lines.push(currentLine);
      currentLine = word;
      continue;
    }

    currentLine = nextLine;
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function getAutoFontSize(
  context: CanvasRenderingContext2D,
  text: string,
  width: number,
  height: number,
  variant: TextVariant,
  fontFamily: string,
) {
  const maxTextWidth =
    width * (variant === "domain" ? 0.84 : variant === "hero" ? 0.88 : 1);
  const maxTextHeight =
    height * (variant === "domain" ? 0.5 : variant === "hero" ? 0.66 : 1);
  const maxFontSize = Math.min(
    variant === "domain"
      ? 178
      : variant === "hero"
        ? 118
        : variant === "icon"
          ? 44
          : 112,
    width /
      (variant === "domain"
        ? 3.6
        : variant === "hero"
          ? 6.4
          : variant === "icon"
            ? 1.6
            : 5.4),
    height *
      (variant === "domain"
        ? 0.38
        : variant === "hero"
          ? 0.24
          : variant === "icon"
            ? 0.82
            : 0.86),
  );
  const minFontSize = variant === "domain" ? 52 : variant === "icon" ? 22 : 34;
  let fontSize = maxFontSize;
  let lines: string[] = [text];

  while (fontSize > minFontSize) {
    context.font = `780 ${fontSize}px ${fontFamily}`;
    lines = getLines(context, text, maxTextWidth);

    const widestLine = Math.max(
      ...lines.map((line) => context.measureText(line).width),
    );
    const textHeight = lines.length * fontSize * 0.98;

    if (widestLine <= maxTextWidth && textHeight <= maxTextHeight) {
      break;
    }

    fontSize -= 2;
  }

  return { fontSize, lines };
}

export function getTextTargets(
  text: string,
  width: number,
  height: number,
  options: TextTargetOptions,
) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return [];
  }

  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));

  const fontFamily = options.fontFamily ?? DEFAULT_PARTICLE_FONT_FAMILY;
  const fontWeight = options.fontWeight ?? "780";
  const presetFontSize = options.fontSize;
  const autoText = presetFontSize
    ? (() => {
        context.font = `${fontWeight} ${presetFontSize}px ${fontFamily}`;
        return {
          fontSize: presetFontSize,
          lines: getLines(context, text, width),
        };
      })()
    : getAutoFontSize(
        context,
        text,
        width,
        height,
        options.variant,
        fontFamily,
      );
  const fontSize = autoText.fontSize;
  const lineHeight = options.lineHeight ?? fontSize * 0.98;
  const lines = autoText.lines;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#000";
  context.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  context.textAlign = options.align ?? "center";
  context.textBaseline = "alphabetic";

  const metrics = context.measureText(lines[0] ?? text);
  const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.78;
  const descent = metrics.actualBoundingBoxDescent || fontSize * 0.22;
  const textHeight = (lines.length - 1) * lineHeight + ascent + descent;
  const firstBaseline = height / 2 - textHeight / 2 + ascent;

  lines.forEach((line, index) => {
    const x =
      options.align === "left"
        ? 0
        : options.align === "right"
          ? width
          : width / 2;
    context.fillText(line, x, firstBaseline + index * lineHeight);
  });

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const points: Point[] = [];
  const step = 1;

  for (let y = 0; y < canvas.height; y += step) {
    for (let x = 0; x < canvas.width; x += step) {
      const alpha = pixels[(y * canvas.width + x) * 4 + 3];

      if (alpha > 80) {
        points.push({ x, y });
      }
    }
  }

  if (points.length === 0) {
    return [];
  }

  const inkPixelsPerParticle = resolveDensityValue(
    options.density?.inkPixelsPerParticle,
    width,
    getDefaultInkPixelsPerParticle(width),
  );
  const minimumCount = resolveDensityValue(
    options.density?.minimumCount,
    width,
    getDefaultMinimumParticleCount(width),
  );
  const maximumCount = resolveDensityValue(
    options.density?.maximumCount,
    width,
    getDefaultMaximumParticleCount(width),
  );
  const targetCount = clampCount(
    Math.round(points.length / inkPixelsPerParticle),
    Math.min(minimumCount, points.length),
    maximumCount,
  );

  return sampleStratifiedPoints(
    points,
    targetCount,
    width,
    step,
    inkPixelsPerParticle,
  );
}

export function cloneParticle(particle: Particle): Particle {
  const angle = Math.random() * Math.PI * 2;
  const distance = 0.8 + Math.random() * 2.2;

  return {
    x: particle.x + Math.cos(angle) * distance,
    y: particle.y + Math.sin(angle) * distance,
    vx: particle.vx + (Math.random() - 0.5) * 0.9,
    vy: particle.vy + (Math.random() - 0.5) * 0.9,
    tx: particle.tx,
    ty: particle.ty,
    opacity: 0,
    scale: 0.18,
    mode: "born",
  };
}

export function shuffleParticles(particles: Particle[]) {
  for (let index = particles.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [particles[index], particles[swapIndex]] = [
      particles[swapIndex],
      particles[index],
    ];
  }
}

export function reconcileParticlesToTargets(
  particles: Particle[],
  targets: Point[],
  { force = false, shuffle = false } = {},
) {
  if (targets.length === 0) {
    return;
  }

  if (force && particles.length > targets.length) {
    particles.length = targets.length;
  }

  while (particles.length < targets.length) {
    const source =
      particles[Math.floor(Math.random() * particles.length)] ??
      ({
        x: targets[particles.length].x,
        y: targets[particles.length].y,
        vx: 0,
        vy: 0,
        tx: targets[particles.length].x,
        ty: targets[particles.length].y,
        opacity: force ? 1 : 0,
        scale: force ? 1 : 0.18,
        mode: force ? "active" : "born",
      } satisfies Particle);

    particles.push(force ? { ...source } : cloneParticle(source));
  }

  if (shuffle && !force) {
    shuffleParticles(particles);
  }

  particles.forEach((particle, index) => {
    const target =
      index < targets.length ? targets[index] : targets[index % targets.length];

    particle.tx = target.x;
    particle.ty = target.y;

    if (index >= targets.length) {
      particle.mode = "retiring";
      return;
    }

    if (force) {
      particle.x = target.x;
      particle.y = target.y;
      particle.vx = 0;
      particle.vy = 0;
      particle.opacity = 1;
      particle.scale = 1;
    }

    if (particle.mode === "retiring") {
      particle.mode = "active";
      particle.opacity = Math.max(particle.opacity, 0.35);
      particle.scale = Math.max(particle.scale, 0.55);
    }
  });
}

export function lockParticlesToTargets(particles: Particle[]) {
  particles.forEach((particle) => {
    particle.x = particle.tx;
    particle.y = particle.ty;
    particle.vx = 0;
    particle.vy = 0;
    particle.opacity = 1;
    particle.scale = 1;
    particle.mode = "active";
  });
}

export function offsetTargets(
  targets: Point[],
  offsetX: number,
  offsetY: number,
) {
  return targets.map((target) => ({
    x: target.x + offsetX,
    y: target.y + offsetY,
  }));
}
