import {
  HUMAN_PLAYER,
  getStar,
  planTransfer,
  type GameState,
  type PlayerId,
} from "./game";

export type ViewTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export type BoardPalette = {
  ambient: string;
  background: string;
  line: string;
  muted: string;
  text: string;
};

export type InteractionState = {
  active: boolean;
  pointerX: number;
  pointerY: number;
  selected: Set<string>;
  targetId: string | null;
};

const COLORS: Record<PlayerId, string> = {
  human: "#7f79ff",
  amber: "#f2ad55",
  teal: "#62d7d1",
};

export function getViewTransform(
  width: number,
  height: number,
  boardWidth: number,
  boardHeight: number,
): ViewTransform {
  const scale = Math.min(width / boardWidth, height / boardHeight);
  return {
    scale,
    offsetX: (width - boardWidth * scale) / 2,
    offsetY: (height - boardHeight * scale) / 2,
  };
}

function drawAmbientStars(
  context: CanvasRenderingContext2D,
  boardWidth: number,
  boardHeight: number,
  palette: BoardPalette,
) {
  context.save();
  context.fillStyle = palette.ambient;

  for (let index = 0; index < 170; index += 1) {
    const x = (index * 83.37) % boardWidth;
    const y = (index * index * 17.13 + index * 31) % boardHeight;
    const radius = index % 11 === 0 ? 0.9 : 0.45;
    context.globalAlpha = 0.18 + ((index * 13) % 32) / 100;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

function drawInfluenceFields(
  context: CanvasRenderingContext2D,
  game: GameState,
) {
  context.save();

  for (const star of game.stars) {
    if (!star.owner) {
      continue;
    }

    const color = COLORS[star.owner];
    const gradient = context.createRadialGradient(
      star.x,
      star.y,
      10,
      star.x,
      star.y,
      76,
    );
    gradient.addColorStop(0, `${color}20`);
    gradient.addColorStop(0.52, `${color}0d`);
    gradient.addColorStop(1, `${color}00`);
    context.fillStyle = gradient;
    context.beginPath();
    context.arc(star.x, star.y, 76, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

function drawConstellations(
  context: CanvasRenderingContext2D,
  game: GameState,
  palette: BoardPalette,
) {
  context.save();
  context.lineWidth = 1;
  context.strokeStyle = palette.line;

  for (const line of game.lines) {
    const from = getStar(game, line.from);
    const to = getStar(game, line.to);

    if (!from || !to) {
      continue;
    }

    context.beginPath();
    context.moveTo(from.x, from.y);
    context.lineTo(to.x, to.y);
    context.stroke();
  }

  context.restore();
}

function drawStreamRoutes(context: CanvasRenderingContext2D, game: GameState) {
  context.save();
  context.lineWidth = 0.9;
  context.setLineDash([1, 7]);

  for (const stream of game.streams) {
    const source = getStar(game, stream.sourceId);
    const target = getStar(game, stream.targetId);

    if (!source || !target) {
      continue;
    }

    const control = getCurveControl(
      source.x,
      source.y,
      target.x,
      target.y,
      ((stream.id % 3) - 1) * 18,
    );
    context.strokeStyle = COLORS[stream.owner];
    context.globalAlpha = 0.12;
    context.beginPath();
    context.moveTo(source.x, source.y);
    context.quadraticCurveTo(control.x, control.y, target.x, target.y);
    context.stroke();
  }

  context.restore();
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

function getNaturalCurveControl(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  boardWidth: number,
  boardHeight: number,
  bend: number,
) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const length = Math.max(1, Math.hypot(dx, dy));
  const midpointX = (fromX + toX) / 2;
  const midpointY = (fromY + toY) / 2;
  const normalX = -dy / length;
  const normalY = dx / length;
  const centerSide =
    normalX * (boardWidth / 2 - midpointX) +
    normalY * (boardHeight / 2 - midpointY);
  const transitionWidth = Math.min(boardWidth, boardHeight) * 0.12;
  const direction = -Math.tanh(centerSide / transitionWidth);

  return {
    x: midpointX + normalX * bend * direction,
    y: midpointY + normalY * bend * direction,
  };
}

function drawInteraction(
  context: CanvasRenderingContext2D,
  game: GameState,
  interaction: InteractionState,
  viewScale: number,
  palette: BoardPalette,
) {
  if (!interaction.active || interaction.selected.size === 0) {
    return;
  }

  const target = interaction.targetId
    ? getStar(game, interaction.targetId)
    : undefined;
  const end = target ?? {
    x: interaction.pointerX,
    y: interaction.pointerY,
  };
  const starRadius = Math.max(23, Math.min(31, 26 * viewScale)) / viewScale;
  const lineWidth = 8 / viewScale;
  const arrowLength = 14 / viewScale;
  const arrowHalfWidth = 8 / viewScale;

  for (const sourceId of interaction.selected) {
    const source = getStar(game, sourceId);

    if (
      !source ||
      source.owner !== HUMAN_PLAYER ||
      source.id === interaction.targetId
    ) {
      continue;
    }

    if (Math.hypot(end.x - source.x, end.y - source.y) < starRadius) {
      continue;
    }

    const control = getNaturalCurveControl(
      source.x,
      source.y,
      end.x,
      end.y,
      game.boardWidth,
      game.boardHeight,
      26,
    );
    const startTangent = normalizeVector(
      control.x - source.x,
      control.y - source.y,
    );
    const endTangent = normalizeVector(end.x - control.x, end.y - control.y);
    const start = {
      x: source.x + startTangent.x * starRadius,
      y: source.y + startTangent.y * starRadius,
    };
    const targetGap = target ? starRadius + 5 / viewScale : 0;
    const tip = {
      x: end.x - endTangent.x * targetGap,
      y: end.y - endTangent.y * targetGap,
    };
    const arrowBase = {
      x: tip.x - endTangent.x * arrowLength,
      y: tip.y - endTangent.y * arrowLength,
    };
    const gradient = context.createLinearGradient(
      start.x,
      start.y,
      tip.x,
      tip.y,
    );
    gradient.addColorStop(0, "rgba(127, 121, 255, 0.1)");
    gradient.addColorStop(
      1,
      target ? "rgba(127, 121, 255, 0.36)" : "rgba(127, 121, 255, 0.24)",
    );

    context.save();
    context.strokeStyle = gradient;
    context.lineWidth = lineWidth;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(start.x, start.y);
    context.quadraticCurveTo(control.x, control.y, arrowBase.x, arrowBase.y);
    context.stroke();

    context.fillStyle = target
      ? "rgba(127, 121, 255, 0.42)"
      : "rgba(127, 121, 255, 0.3)";
    context.beginPath();
    context.moveTo(tip.x, tip.y);
    context.lineTo(
      arrowBase.x - endTangent.y * arrowHalfWidth,
      arrowBase.y + endTangent.x * arrowHalfWidth,
    );
    context.lineTo(
      arrowBase.x + endTangent.y * arrowHalfWidth,
      arrowBase.y - endTangent.x * arrowHalfWidth,
    );
    context.closePath();
    context.fill();
    context.restore();
  }

  if (target) {
    const plan = planTransfer(
      game,
      HUMAN_PLAYER,
      interaction.selected,
      target.id,
    );
    const total = plan?.total ?? 0;

    if (total > 0) {
      context.save();
      context.fillStyle = palette.text;
      context.font = "600 13px ui-monospace, SFMono-Regular, Menlo, monospace";
      context.textAlign = "left";
      context.fillText(`+${total}`, target.x + 24, target.y - 22);
      context.restore();
    }
  }
}

function normalizeVector(x: number, y: number) {
  const length = Math.max(1, Math.hypot(x, y));
  return { x: x / length, y: y / length };
}

function drawTargetRing(
  context: CanvasRenderingContext2D,
  game: GameState,
  interaction: InteractionState,
  viewScale: number,
  palette: BoardPalette,
) {
  const starSize = Math.max(46, Math.min(62, 52 * viewScale));
  const nodeRadius = starSize / 2 / viewScale;

  for (const star of game.stars) {
    const targeted = interaction.targetId === star.id;

    if (!targeted) {
      continue;
    }

    const color = star.owner ? COLORS[star.owner] : palette.muted;
    context.save();
    context.strokeStyle = color;
    context.globalAlpha = 0.72;
    context.lineWidth = 1.6;
    context.beginPath();
    context.arc(star.x, star.y, nodeRadius + 7 / viewScale, 0, Math.PI * 2);
    context.stroke();
    context.restore();
  }
}

export function drawBoard(
  context: CanvasRenderingContext2D,
  game: GameState,
  cssWidth: number,
  cssHeight: number,
  pixelRatio: number,
  palette: BoardPalette,
) {
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, cssWidth, cssHeight);

  context.fillStyle = palette.background;
  context.fillRect(0, 0, cssWidth, cssHeight);

  const view = getViewTransform(
    cssWidth,
    cssHeight,
    game.boardWidth,
    game.boardHeight,
  );
  context.setTransform(
    pixelRatio * view.scale,
    0,
    0,
    pixelRatio * view.scale,
    pixelRatio * view.offsetX,
    pixelRatio * view.offsetY,
  );
  drawAmbientStars(context, game.boardWidth, game.boardHeight, palette);
  drawInfluenceFields(context, game);
  drawConstellations(context, game, palette);
  drawStreamRoutes(context, game);
}

export function drawInteractionLayer(
  context: CanvasRenderingContext2D,
  game: GameState,
  interaction: InteractionState,
  cssWidth: number,
  cssHeight: number,
  pixelRatio: number,
  palette: BoardPalette,
) {
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  context.clearRect(0, 0, cssWidth, cssHeight);

  if (!interaction.active) {
    return;
  }

  const view = getViewTransform(
    cssWidth,
    cssHeight,
    game.boardWidth,
    game.boardHeight,
  );
  context.setTransform(
    pixelRatio * view.scale,
    0,
    0,
    pixelRatio * view.scale,
    pixelRatio * view.offsetX,
    pixelRatio * view.offsetY,
  );
  drawInteraction(context, game, interaction, view.scale, palette);
  drawTargetRing(context, game, interaction, view.scale, palette);
}
