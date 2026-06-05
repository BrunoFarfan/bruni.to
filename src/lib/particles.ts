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

type MaskSample = Point & {
  alpha: number;
  key: string;
  weight: number;
};

type MaskCell = {
  cellX: number;
  cellY: number;
  samples: MaskSample[];
  weight: number;
  weightedX: number;
  weightedY: number;
};

export const DEFAULT_PARTICLE_FONT_FAMILY =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const EDGE_ALPHA_THRESHOLD = 32;
const CORE_ALPHA_THRESHOLD = 80;
const BEST_CANDIDATE_COUNT = 24;

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

function createSeed(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createSeededRandom(seed: number) {
  let state = seed;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function makePointKey(x: number, y: number) {
  return `${x}:${y}`;
}

function buildMaskCells(samples: MaskSample[], cellSize: number) {
  const cells = new Map<string, MaskCell>();

  for (const sample of samples) {
    const cellX = Math.floor(sample.x / cellSize);
    const cellY = Math.floor(sample.y / cellSize);
    const cellKey = `${cellX}:${cellY}`;
    const cell = cells.get(cellKey);

    if (cell) {
      cell.samples.push(sample);
      cell.weight += sample.weight;
      cell.weightedX += sample.x * sample.weight;
      cell.weightedY += sample.y * sample.weight;
    } else {
      cells.set(cellKey, {
        cellX,
        cellY,
        samples: [sample],
        weight: sample.weight,
        weightedX: sample.x * sample.weight,
        weightedY: sample.y * sample.weight,
      });
    }
  }

  return Array.from(cells.values());
}

function pickCoverageRepresentative(cell: MaskCell) {
  const centroidX = cell.weightedX / cell.weight;
  const centroidY = cell.weightedY / cell.weight;
  let bestSample = cell.samples[0];
  let bestScore = Number.POSITIVE_INFINITY;

  for (const sample of cell.samples) {
    const dx = sample.x - centroidX;
    const dy = sample.y - centroidY;
    const score = dx * dx + dy * dy - sample.weight * 0.01;

    if (score < bestScore) {
      bestSample = sample;
      bestScore = score;
    }
  }

  return bestSample;
}

function getSpatialCellKey(sample: Point, cellSize: number) {
  return `${Math.floor(sample.x / cellSize)}:${Math.floor(sample.y / cellSize)}`;
}

function addSpatialSample(
  sample: MaskSample,
  cellSize: number,
  spatialCells: Map<string, MaskSample[]>,
) {
  const cellKey = getSpatialCellKey(sample, cellSize);
  const cell = spatialCells.get(cellKey);

  if (cell) {
    cell.push(sample);
  } else {
    spatialCells.set(cellKey, [sample]);
  }
}

function getNearestDistanceSquared(
  sample: MaskSample,
  cellSize: number,
  spatialCells: Map<string, MaskSample[]>,
) {
  const cellX = Math.floor(sample.x / cellSize);
  const cellY = Math.floor(sample.y / cellSize);
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let radius = 0; radius <= 4; radius += 1) {
    for (let y = cellY - radius; y <= cellY + radius; y += 1) {
      for (let x = cellX - radius; x <= cellX + radius; x += 1) {
        const cell = spatialCells.get(`${x}:${y}`);

        if (!cell) {
          continue;
        }

        for (const otherSample of cell) {
          const dx = sample.x - otherSample.x;
          const dy = sample.y - otherSample.y;
          const distance = dx * dx + dy * dy;

          if (distance < bestDistance) {
            bestDistance = distance;
          }
        }
      }
    }

    if (bestDistance < Number.POSITIVE_INFINITY) {
      return bestDistance;
    }
  }

  return cellSize * cellSize * 25;
}

function selectBlueNoiseSamples(
  candidates: MaskSample[],
  targetCount: number,
  seed: number,
  nominalSpacing: number,
  initialSamples: MaskSample[] = [],
) {
  const random = createSeededRandom(seed);
  const selectedSamples: MaskSample[] = [];
  const selectedKeys = new Set<string>();
  const spatialCellSize = Math.max(1, nominalSpacing);
  const spatialCells = new Map<string, MaskSample[]>();

  function selectSample(sample: MaskSample) {
    selectedSamples.push(sample);
    selectedKeys.add(sample.key);
    addSpatialSample(sample, spatialCellSize, spatialCells);
  }

  for (const sample of initialSamples) {
    if (selectedSamples.length >= targetCount) {
      break;
    }

    if (!selectedKeys.has(sample.key)) {
      selectSample(sample);
    }
  }

  if (selectedSamples.length === 0 && candidates.length > 0) {
    selectSample(candidates[Math.floor(random() * candidates.length)]);
  }

  while (
    selectedSamples.length < targetCount &&
    selectedKeys.size < candidates.length
  ) {
    let bestCandidate: MaskSample | undefined;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let index = 0; index < BEST_CANDIDATE_COUNT; index += 1) {
      const candidate = candidates[Math.floor(random() * candidates.length)];

      if (selectedKeys.has(candidate.key)) {
        continue;
      }

      const nearestDistance = getNearestDistanceSquared(
        candidate,
        spatialCellSize,
        spatialCells,
      );
      const score = nearestDistance * (0.75 + candidate.weight * 0.25);

      if (score > bestScore) {
        bestCandidate = candidate;
        bestScore = score;
      }
    }

    if (!bestCandidate) {
      bestCandidate = candidates.find(
        (candidate) => !selectedKeys.has(candidate.key),
      );
    }

    if (!bestCandidate) {
      break;
    }

    selectSample(bestCandidate);
  }

  return selectedSamples;
}

function jitterSelectedSamples(
  samples: MaskSample[],
  eligibleKeys: Set<string>,
  nominalSpacing: number,
  seed: number,
) {
  const random = createSeededRandom(seed);
  const jitterAmount = Math.min(0.35, nominalSpacing * 0.14);

  if (jitterAmount <= 0) {
    return samples.map(({ x, y }) => ({ x, y }));
  }

  return samples.map((sample) => {
    const x = sample.x + (random() - 0.5) * jitterAmount;
    const y = sample.y + (random() - 0.5) * jitterAmount;
    const roundedKey = makePointKey(Math.round(x), Math.round(y));

    if (!eligibleKeys.has(roundedKey)) {
      return {
        x: sample.x,
        y: sample.y,
      };
    }

    return { x, y };
  });
}

function sampleMaskBlueNoisePoints(
  samples: MaskSample[],
  targetCount: number,
  weightedInkPixels: number,
  seed: number,
) {
  if (samples.length <= targetCount) {
    const eligibleKeys = new Set(samples.map((sample) => sample.key));
    const nominalSpacing = Math.sqrt(
      Math.max(1, weightedInkPixels / Math.max(1, targetCount)),
    );

    return jitterSelectedSamples(samples, eligibleKeys, nominalSpacing, seed);
  }

  const nominalSpacing = Math.sqrt(
    Math.max(1, weightedInkPixels / Math.max(1, targetCount)),
  );
  const coverageCellSize = Math.max(2, nominalSpacing * 1.35);
  const coverageRepresentatives = buildMaskCells(samples, coverageCellSize)
    .sort((a, b) => a.cellY - b.cellY || a.cellX - b.cellX)
    .map(pickCoverageRepresentative);
  const selectedSamples =
    coverageRepresentatives.length > targetCount
      ? selectBlueNoiseSamples(
          coverageRepresentatives,
          targetCount,
          seed,
          nominalSpacing,
        )
      : selectBlueNoiseSamples(
          samples,
          targetCount,
          seed,
          nominalSpacing,
          coverageRepresentatives,
        );
  const eligibleKeys = new Set(samples.map((sample) => sample.key));

  return jitterSelectedSamples(
    selectedSamples,
    eligibleKeys,
    nominalSpacing,
    seed ^ 0x9e3779b9,
  );
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

  let widestLine = 0;

  lines.forEach((line, index) => {
    const x =
      options.align === "left"
        ? 0
        : options.align === "right"
          ? width
          : width / 2;
    widestLine = Math.max(widestLine, context.measureText(line).width);
    context.fillText(line, x, firstBaseline + index * lineHeight);
  });

  // Only scan the rectangle the text actually occupies instead of the whole
  // viewport-sized canvas — getImageData and the per-pixel loop dominate the
  // one-time cost, and the ink covers a small fraction of the canvas.
  const horizontalPad = fontSize * 0.4;
  const verticalPad = fontSize * 0.3;
  const inkLeft =
    options.align === "left"
      ? 0
      : options.align === "right"
        ? width - widestLine
        : width / 2 - widestLine / 2;
  const lastBaseline = firstBaseline + (lines.length - 1) * lineHeight;
  const scanLeft = Math.max(0, Math.floor(inkLeft - horizontalPad));
  const scanRight = Math.min(
    canvas.width,
    Math.ceil(inkLeft + widestLine + horizontalPad),
  );
  const scanTop = Math.max(0, Math.floor(firstBaseline - ascent - verticalPad));
  const scanBottom = Math.min(
    canvas.height,
    Math.ceil(lastBaseline + descent + verticalPad),
  );
  const scanWidth = Math.max(1, scanRight - scanLeft);
  const scanHeight = Math.max(1, scanBottom - scanTop);

  const pixels = context.getImageData(
    scanLeft,
    scanTop,
    scanWidth,
    scanHeight,
  ).data;
  const samples: MaskSample[] = [];
  let coreInkPixels = 0;
  let weightedInkPixels = 0;

  for (let row = 0; row < scanHeight; row += 1) {
    const y = scanTop + row;

    for (let col = 0; col < scanWidth; col += 1) {
      const x = scanLeft + col;
      const alpha = pixels[(row * scanWidth + col) * 4 + 3];

      if (alpha > CORE_ALPHA_THRESHOLD) {
        coreInkPixels += 1;
      }

      if (alpha >= EDGE_ALPHA_THRESHOLD) {
        const weight = alpha / 255;

        samples.push({
          alpha,
          key: makePointKey(x, y),
          weight,
          x,
          y,
        });
        weightedInkPixels += weight;
      }
    }
  }

  if (samples.length === 0) {
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
  const rawTargetCount = Math.round(
    Math.max(coreInkPixels, weightedInkPixels) / inkPixelsPerParticle,
  );
  const targetCount = clampCount(
    rawTargetCount,
    Math.min(minimumCount, samples.length),
    Math.min(maximumCount, samples.length),
  );

  if (targetCount <= 0) {
    return [];
  }

  const targetSeed = createSeed(
    [
      text,
      width,
      height,
      options.variant,
      options.align ?? "center",
      fontSize,
      fontWeight,
      lineHeight,
      inkPixelsPerParticle,
      minimumCount,
      maximumCount,
      targetCount,
    ].join(":"),
  );

  return sampleMaskBlueNoisePoints(
    samples,
    targetCount,
    Math.max(1, weightedInkPixels),
    targetSeed,
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
    opacity: 1,
    scale: 1,
    mode: "active",
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
        opacity: 1,
        scale: 1,
        mode: "active",
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
      particle.opacity = 1;
      particle.scale = 1;
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
