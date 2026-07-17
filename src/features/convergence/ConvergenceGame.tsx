import { useEffect, useRef, useState } from "react";
import { CONSTELLATIONS } from "./constellations";
import {
  HUMAN_PLAYER,
  advanceGame,
  createGame,
  getStar,
  sendParticles,
  type GameResult,
  type GameState,
  type Star,
} from "./game";
import {
  drawBoard,
  drawInteractionLayer,
  getViewTransform,
  type BoardPalette,
  type InteractionState,
} from "./draw";
import { chooseOpponentAction } from "./opponent";
import { createStreamRenderer } from "./streamRenderer";
import "./convergence.css";

const FIXED_STEP = 1 / 30;
const STAR_HIT_RADIUS = 27;
const TUTORIAL_STORAGE_KEY = "convergence:tutorial-complete";
const TUTORIAL_COPY = [
  "Drag from your violet signal to a nearby star.",
  "Sweep across two violet stars, then release on one target.",
] as const;

type StarView = {
  id: string;
  left: number;
  owner: Star["owner"];
  size: number;
  strength: number;
  top: number;
};

function hasCompletedTutorial() {
  try {
    return window.localStorage.getItem(TUTORIAL_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function completeTutorial() {
  try {
    window.localStorage.setItem(TUTORIAL_STORAGE_KEY, "true");
  } catch {
    // The tutorial still completes for this match when storage is unavailable.
  }
}

function getBoardPalette(): BoardPalette {
  const root = document.documentElement;
  const style = getComputedStyle(root);
  const isDark = root.dataset.theme === "dark";

  function read(name: string, fallback: string) {
    return style.getPropertyValue(name).trim() || fallback;
  }

  return {
    ambient: isDark ? "rgba(242, 236, 227, 0.24)" : "rgba(36, 31, 27, 0.2)",
    background: read("--color-bg", isDark ? "#18130f" : "#f5f1eb"),
    line: isDark ? "rgba(242, 236, 227, 0.2)" : "rgba(36, 31, 27, 0.24)",
    muted: read("--color-muted", isDark ? "#c2b7aa" : "#665f58"),
    text: read("--color-text", isDark ? "#f2ece3" : "#241f1b"),
  };
}

function createInteraction(): InteractionState {
  return {
    active: false,
    pointerX: 0,
    pointerY: 0,
    selected: new Set(),
    targetId: null,
  };
}

function TutorialHint({ active, step }: { active: boolean; step: number }) {
  const nextStep = Math.min(step, TUTORIAL_COPY.length - 1);
  const [displayedStep, setDisplayedStep] = useState(nextStep);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let revealFrame = 0;
    let transitionTimer = 0;

    if (!active) {
      setVisible(false);
      return;
    }

    if (displayedStep === nextStep) {
      revealFrame = window.requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      transitionTimer = window.setTimeout(
        () => {
          setDisplayedStep(nextStep);
          revealFrame = window.requestAnimationFrame(() => setVisible(true));
        },
        reduceMotion ? 0 : 240,
      );
    }

    return () => {
      window.cancelAnimationFrame(revealFrame);
      window.clearTimeout(transitionTimer);
    };
  }, [active, displayedStep, nextStep]);

  return (
    <aside
      className={`convergence__hint${visible ? " convergence__hint--visible" : ""}`}
      aria-hidden={!visible}
      aria-live="polite"
    >
      <span>{TUTORIAL_COPY[displayedStep]}</span>
    </aside>
  );
}

function distanceToSegment(
  point: { x: number; y: number },
  start: { x: number; y: number },
  end: { x: number; y: number },
) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const progress = Math.max(
    0,
    Math.min(
      1,
      ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared,
    ),
  );
  return Math.hypot(
    point.x - (start.x + dx * progress),
    point.y - (start.y + dy * progress),
  );
}

function findStarAt(
  game: GameState,
  point: { x: number; y: number },
  hitRadius: number,
) {
  let closest: Star | null = null;
  let closestDistance = hitRadius;

  for (const star of game.stars) {
    const distance = Math.hypot(point.x - star.x, point.y - star.y);

    if (distance <= closestDistance) {
      closest = star;
      closestDistance = distance;
    }
  }

  return closest;
}

export default function ConvergenceGame() {
  const boardCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const interactionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const tutorialRef = useRef(0);
  const [tutorialStep, setTutorialStep] = useState(0);
  const [starViews, setStarViews] = useState<StarView[]>([]);
  const [result, setResult] = useState<GameResult | null>(null);
  const [restartToken, setRestartToken] = useState(0);

  useEffect(() => {
    const boardCanvas = boardCanvasRef.current;
    const streamCanvas = streamCanvasRef.current;
    const interactionCanvas = interactionCanvasRef.current;

    if (!boardCanvas || !streamCanvas || !interactionCanvas) {
      return;
    }

    const boardContext = boardCanvas.getContext("2d");
    const interactionContext = interactionCanvas.getContext("2d");
    const streamRenderer = createStreamRenderer(streamCanvas);

    if (!boardContext || !interactionContext || !streamRenderer) {
      return;
    }

    const gameBoardCanvas = boardCanvas;
    const gameInteractionCanvas = interactionCanvas;
    const gameBoardContext = boardContext;
    const gameInteractionContext = interactionContext;
    const gameStreamRenderer = streamRenderer;
    const initialRect = gameInteractionCanvas.getBoundingClientRect();
    const game = createGame(
      CONSTELLATIONS,
      initialRect.height > initialRect.width ? "portrait" : "landscape",
    );
    const interaction = createInteraction();
    const opponentNextAction = { amber: 5.4, teal: 6.2 };
    const randomState = { value: 0x6c8e9cf5 };
    const resizeObserver = new ResizeObserver(resize);
    let animationFrame = 0;
    let cssWidth = 1;
    let cssHeight = 1;
    let pixelRatio = 1;
    let hitRadius = STAR_HIT_RADIUS;
    let accumulator = 0;
    let previousTime = window.performance.now();
    let previousPointer = { x: 0, y: 0 };
    let activePointerId: number | null = null;
    let publishedResult = false;
    let boardDirty = true;
    let streamsWereVisible = false;

    const tutorialCompleted = hasCompletedTutorial();
    tutorialRef.current = tutorialCompleted ? TUTORIAL_COPY.length : 0;
    setTutorialStep(tutorialRef.current);
    setResult(null);

    function random() {
      randomState.value += 0x6d2b79f5;
      let value = randomState.value;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    }

    function resize() {
      const rect = gameInteractionCanvas.getBoundingClientRect();
      cssWidth = Math.max(1, rect.width);
      cssHeight = Math.max(1, rect.height);
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const view = getViewTransform(
        cssWidth,
        cssHeight,
        game.boardWidth,
        game.boardHeight,
      );
      hitRadius = Math.max(STAR_HIT_RADIUS, 28 / view.scale);
      const physicalWidth = Math.round(cssWidth * pixelRatio);
      const physicalHeight = Math.round(cssHeight * pixelRatio);

      for (const canvas of [gameBoardCanvas, gameInteractionCanvas]) {
        if (
          canvas.width !== physicalWidth ||
          canvas.height !== physicalHeight
        ) {
          canvas.width = physicalWidth;
          canvas.height = physicalHeight;
        }
      }

      gameStreamRenderer.resize(cssWidth, cssHeight, pixelRatio);
      drawBoard(
        gameBoardContext,
        game,
        cssWidth,
        cssHeight,
        pixelRatio,
        getBoardPalette(),
      );
      publishStarViews();
      boardDirty = false;
      redrawInteraction();
    }

    function publishStarViews() {
      const view = getViewTransform(
        cssWidth,
        cssHeight,
        game.boardWidth,
        game.boardHeight,
      );
      const size = Math.max(46, Math.min(62, 52 * view.scale));

      setStarViews(
        game.stars.map((star) => ({
          id: star.id,
          left: star.x * view.scale + view.offsetX,
          owner: star.owner,
          size,
          strength: star.strength,
          top: star.y * view.scale + view.offsetY,
        })),
      );
    }

    function toBoardPoint(event: PointerEvent) {
      const rect = gameInteractionCanvas.getBoundingClientRect();
      const view = getViewTransform(
        rect.width,
        rect.height,
        game.boardWidth,
        game.boardHeight,
      );
      return {
        x: (event.clientX - rect.left - view.offsetX) / view.scale,
        y: (event.clientY - rect.top - view.offsetY) / view.scale,
      };
    }

    function addCrossedSources(
      from: { x: number; y: number },
      to: { x: number; y: number },
    ) {
      for (const star of game.stars) {
        if (
          star.owner === HUMAN_PLAYER &&
          distanceToSegment(star, from, to) <= hitRadius
        ) {
          interaction.selected.add(star.id);
        }
      }
    }

    function updateTarget(point: { x: number; y: number }) {
      const target = findStarAt(game, point, hitRadius);
      interaction.targetId = target?.id ?? null;
    }

    function pruneLostSources() {
      for (const sourceId of interaction.selected) {
        const source = getStar(game, sourceId);

        if (source?.owner !== HUMAN_PLAYER) {
          interaction.selected.delete(sourceId);
        }
      }
    }

    function redrawInteraction() {
      drawInteractionLayer(
        gameInteractionContext,
        game,
        interaction,
        cssWidth,
        cssHeight,
        pixelRatio,
        getBoardPalette(),
      );
    }

    function handlePointerDown(event: PointerEvent) {
      if (activePointerId !== null || game.result) {
        return;
      }

      activePointerId = event.pointerId;
      gameInteractionCanvas.setPointerCapture(event.pointerId);
      const point = toBoardPoint(event);
      previousPointer = point;
      interaction.active = true;
      interaction.pointerX = point.x;
      interaction.pointerY = point.y;
      interaction.selected.clear();
      addCrossedSources(point, point);
      updateTarget(point);
      redrawInteraction();
    }

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerId !== activePointerId) {
        return;
      }

      const point = toBoardPoint(event);
      addCrossedSources(previousPointer, point);
      previousPointer = point;
      interaction.pointerX = point.x;
      interaction.pointerY = point.y;
      updateTarget(point);
      redrawInteraction();
    }

    function finishPointer(event: PointerEvent, commit: boolean) {
      if (event.pointerId !== activePointerId) {
        return;
      }

      const releaseTarget = commit
        ? findStarAt(game, toBoardPoint(event), hitRadius)
        : null;
      const targetId = releaseTarget?.id ?? null;
      const sourceIds = Array.from(interaction.selected).filter((sourceId) => {
        const source = getStar(game, sourceId);
        return sourceId !== targetId && source?.owner === HUMAN_PLAYER;
      });
      const sent =
        commit &&
        targetId &&
        sendParticles(game, HUMAN_PLAYER, sourceIds, targetId);

      if (sent) {
        boardDirty = true;
      }

      if (sent && tutorialRef.current === 1 && sourceIds.length >= 2) {
        tutorialRef.current = TUTORIAL_COPY.length;
        setTutorialStep(TUTORIAL_COPY.length);
        completeTutorial();
      }

      if (gameInteractionCanvas.hasPointerCapture(event.pointerId)) {
        gameInteractionCanvas.releasePointerCapture(event.pointerId);
      }

      activePointerId = null;
      interaction.active = false;
      interaction.selected.clear();
      interaction.targetId = null;
      redrawInteraction();
    }

    function handlePointerUp(event: PointerEvent) {
      finishPointer(event, true);
    }

    function handlePointerCancel(event: PointerEvent) {
      finishPointer(event, false);
    }

    function runOpponent(player: "amber" | "teal") {
      const action = chooseOpponentAction(game, player, random);

      if (action) {
        boardDirty =
          sendParticles(game, player, action.sourceIds, action.targetId) ||
          boardDirty;
      }

      opponentNextAction[player] = game.time + 2.6 + random() * 1.8;
    }

    function updateTutorial() {
      if (
        tutorialRef.current === 0 &&
        game.stars.filter((star) => star.owner === HUMAN_PLAYER).length >= 2
      ) {
        tutorialRef.current = 1;
        setTutorialStep(1);
      }
    }

    function tick(now: number) {
      const elapsed = Math.min(0.1, (now - previousTime) / 1000);
      previousTime = now;
      accumulator += elapsed;

      while (accumulator >= FIXED_STEP) {
        boardDirty = advanceGame(game, FIXED_STEP) || boardDirty;
        accumulator -= FIXED_STEP;

        if (!game.result) {
          if (game.time >= opponentNextAction.amber) {
            runOpponent("amber");
          }

          if (game.time >= opponentNextAction.teal) {
            runOpponent("teal");
          }

          updateTutorial();
        }
      }

      if (interaction.active) {
        pruneLostSources();
        redrawInteraction();
      }

      if (boardDirty) {
        drawBoard(
          gameBoardContext,
          game,
          cssWidth,
          cssHeight,
          pixelRatio,
          getBoardPalette(),
        );
        publishStarViews();
        boardDirty = false;
      }

      if (game.streams.length > 0) {
        gameStreamRenderer.draw(
          game,
          getViewTransform(
            cssWidth,
            cssHeight,
            game.boardWidth,
            game.boardHeight,
          ),
        );
        streamsWereVisible = true;
      } else if (streamsWereVisible) {
        gameStreamRenderer.clear();
        streamsWereVisible = false;
      }

      if (game.result && !publishedResult) {
        publishedResult = true;
        gameStreamRenderer.clear();
        setResult(game.result);
        return;
      }

      animationFrame = window.requestAnimationFrame(tick);
    }

    function handleVisibilityChange() {
      previousTime = window.performance.now();
      accumulator = 0;
    }

    function handleThemeChange() {
      drawBoard(
        gameBoardContext,
        game,
        cssWidth,
        cssHeight,
        pixelRatio,
        getBoardPalette(),
      );
      redrawInteraction();
    }

    resize();
    resizeObserver.observe(gameInteractionCanvas);
    gameInteractionCanvas.addEventListener("pointerdown", handlePointerDown);
    gameInteractionCanvas.addEventListener("pointermove", handlePointerMove);
    gameInteractionCanvas.addEventListener("pointerup", handlePointerUp);
    gameInteractionCanvas.addEventListener(
      "pointercancel",
      handlePointerCancel,
    );
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("particle-theme-change", handleThemeChange);
    animationFrame = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      resizeObserver.disconnect();
      gameStreamRenderer.dispose();
      gameInteractionCanvas.removeEventListener(
        "pointerdown",
        handlePointerDown,
      );
      gameInteractionCanvas.removeEventListener(
        "pointermove",
        handlePointerMove,
      );
      gameInteractionCanvas.removeEventListener("pointerup", handlePointerUp);
      gameInteractionCanvas.removeEventListener(
        "pointercancel",
        handlePointerCancel,
      );
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("particle-theme-change", handleThemeChange);

      if (
        activePointerId !== null &&
        gameInteractionCanvas.hasPointerCapture(activePointerId)
      ) {
        gameInteractionCanvas.releasePointerCapture(activePointerId);
      }
    };
  }, [restartToken]);

  return (
    <section className="convergence" aria-label="Convergence">
      <header className="convergence__header">
        <a className="convergence__back" href="/">
          <span aria-hidden="true">←</span>
          <span>Portfolio</span>
        </a>
      </header>

      <canvas
        ref={boardCanvasRef}
        className="convergence__canvas convergence__canvas--board"
        aria-hidden="true"
      />
      <canvas
        ref={streamCanvasRef}
        className="convergence__canvas convergence__canvas--streams"
        aria-hidden="true"
      />
      <div className="convergence__stars" aria-hidden="true">
        {starViews.map((star) => {
          const owner = star.owner ?? "neutral";
          const style = {
            height: star.size,
            left: star.left,
            top: star.top,
            width: star.size,
          };

          return (
            <span
              className={`convergence__star convergence__star--${owner}`}
              key={star.id}
              style={style}
            >
              <img
                src="/images/convergence-star.gif"
                alt=""
                decoding="async"
                draggable="false"
              />
              <span className="convergence__star-strength">
                {star.strength}
              </span>
            </span>
          );
        })}
      </div>
      <canvas
        ref={interactionCanvasRef}
        className="convergence__canvas convergence__canvas--interaction"
        aria-label="Convergence strategy board. Drag across your violet stars and release over another star to send their particles."
      />

      {tutorialStep < TUTORIAL_COPY.length && !result && (
        <TutorialHint active step={tutorialStep} />
      )}

      {result && (
        <div
          className="convergence__result"
          role="dialog"
          aria-modal="true"
          aria-label={
            result.outcome === "won"
              ? "Your signal remains"
              : "Your signal has faded"
          }
        >
          <div className="convergence__result-content">
            <p
              className={`convergence__result-cue convergence__result-cue--${result.outcome}`}
            >
              {result.outcome === "won"
                ? "Your signal remains"
                : "Your signal has faded"}
            </p>
            <div className="convergence__result-actions">
              <a
                href="/"
                aria-label="Return to portfolio"
                title="Back to portfolio"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="m15 18-6-6 6-6" />
                </svg>
              </a>
              <button
                type="button"
                aria-label="Play again"
                title="Replay"
                onClick={() => setRestartToken((value) => value + 1)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20 4v7h-7" />
                  <path d="M20 11a8.1 8.1 0 1 0-2.37 5.73" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
