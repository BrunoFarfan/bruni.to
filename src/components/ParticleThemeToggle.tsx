import { createElement, useEffect, useRef, useState } from "react";
import {
  type Particle,
  type Point,
  getTextTargets,
  lockParticlesToTargets,
  reconcileParticlesToTargets,
} from "../lib/particles";
import {
  createParticleRenderer,
  type ParticleDrawOptions,
  type RGB,
} from "../lib/particleRenderer";

type Theme = "light" | "dark";

const ICON_SIZE = 58;
const SETTLE_DISTANCE = 0.4;
const SETTLE_SPEED = 0.05;
const THEME_TRANSITION_DURATION = 600;
const THEME_ICONS: Record<Theme, string> = {
  light: "☀️",
  dark: "☾",
};

function getCurrentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function getThemeTarget(theme: Theme) {
  return theme === "light" ? "dark" : "light";
}

function getThemeBackground(theme: Theme) {
  return theme === "dark" ? "#18130f" : "#f5f1eb";
}

function getWaveRadius(x: number, y: number) {
  const exactRadius = Math.hypot(
    Math.max(x, window.innerWidth - x),
    Math.max(y, window.innerHeight - y),
  );

  return Math.ceil(exactRadius) + 16;
}

function createParticleAtTarget(target: Point): Particle {
  return {
    x: target.x,
    y: target.y,
    vx: 0,
    vy: 0,
    tx: target.x,
    ty: target.y,
    opacity: 1,
    scale: 1,
    mode: "active",
  };
}

function getIconTargets(theme: Theme) {
  return getTextTargets(THEME_ICONS[theme], ICON_SIZE, ICON_SIZE, {
    density: {
      inkPixelsPerParticle: theme === "light" ? 0.9 : 1,
      maximumCount: theme === "light" ? 600 : 350,
      minimumCount: theme === "light" ? 350 : 100,
    },
    fontSize: theme === "light" ? 46 : 44,
    fontWeight: "760",
    variant: "icon",
  });
}

export default function ParticleThemeToggle() {
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const particleContext = context;
    const particleCanvas = canvas;
    const targetCache = new Map<Theme, Point[]>();

    let animationFrame = 0;
    let pixelRatio = 1;
    let particles: Particle[] = [];
    let activeTheme = getCurrentTheme();
    let settledFrames = 0;
    let themeColorTransitionUntil = 0;
    let activeWave: HTMLDivElement | null = null;
    let waveFrame = 0;
    let clearWaveListeners = () => {};

    setTheme(activeTheme);

    function readThemeColor(name: string, fallback: string) {
      return (
        activeWave?.style.getPropertyValue(name).trim() ||
        getComputedStyle(document.documentElement)
          .getPropertyValue(name)
          .trim() ||
        fallback
      );
    }

    function getTargets(themeTarget: Theme) {
      const cachedTargets = targetCache.get(themeTarget);

      if (cachedTargets) {
        return cachedTargets;
      }

      const targets = getIconTargets(themeTarget);
      targetCache.set(themeTarget, targets);
      return targets;
    }

    function applyTheme(nextTheme: Theme, transitionDuration = 0) {
      activeTheme = nextTheme;
      themeColorTransitionUntil = window.performance.now() + transitionDuration;
      document.documentElement.dataset.theme = nextTheme;
      window.localStorage.setItem("theme", nextTheme);
      window.dispatchEvent(
        new CustomEvent("particle-theme-change", {
          detail: { duration: transitionDuration, theme: nextTheme },
        }),
      );
      setTheme(nextTheme);
      scheduleTick();
    }

    function runThemeTransition(nextTheme: Theme) {
      if (activeWave) {
        return;
      }

      const button = buttonRef.current;
      const rect = button?.getBoundingClientRect();
      const x = rect ? rect.left + rect.width / 2 : window.innerWidth - 36;
      const y = rect ? rect.top + rect.height / 2 : 36;
      const radius = getWaveRadius(x, y);
      const root = document.documentElement;
      const wave = document.createElement("div");
      wave.className = "theme-wave";
      wave.setAttribute("aria-hidden", "true");
      wave.inert = true;
      wave.style.backgroundColor = getThemeBackground(nextTheme);
      const viewport = document.createElement("div");
      viewport.style.position = "absolute";
      viewport.style.width = `${window.innerWidth}px`;
      viewport.style.height = `${window.innerHeight}px`;
      wave.append(viewport);

      // Read the destination palette without painting or changing the live page.
      root.dataset.theme = nextTheme;
      const palette = getComputedStyle(root);
      for (const name of Array.from(palette)) {
        if (name.startsWith("--color-") || name === "--shadow-color") {
          wave.style.setProperty(name, palette.getPropertyValue(name));
        }
      }
      root.dataset.theme = activeTheme;

      const copy = document.body.cloneNode(true) as HTMLBodyElement;
      copy
        .querySelectorAll(
          "script, astro-dev-toolbar, .particle-theme-toggle, .theme-wave",
        )
        .forEach((node) => node.remove());
      // Clones are presentation only: never hydrate a second set of components.
      copy.querySelectorAll("astro-island").forEach((island) => {
        const container = document.createElement("div");
        container.style.display = "contents";
        container.append(...island.childNodes);
        island.replaceWith(container);
      });
      copy
        .querySelectorAll("[id]")
        .forEach((node) => node.removeAttribute("id"));
      copy.style.position = "absolute";
      copy.style.width = "100%";
      const alignCopy = () => {
        copy.style.top = `${-window.scrollY}px`;
        copy.style.left = `${-window.scrollX}px`;
      };
      alignCopy();
      viewport.append(copy);

      const sources = Array.from(
        document.querySelectorAll<HTMLCanvasElement>(
          "canvas:not(.particle-theme-toggle__canvas)",
        ),
      );
      const mirrors = Array.from(copy.querySelectorAll("canvas"));
      mirrors.forEach((mirror, index) => {
        const source = sources[index];
        if (!source) return;
        const bounds = source.getBoundingClientRect();
        viewport.append(mirror);
        Object.assign(mirror.style, {
          position: "absolute",
          inset: "auto",
          left: `${bounds.left}px`,
          top: `${bounds.top}px`,
          width: `${bounds.width}px`,
          height: `${bounds.height}px`,
          opacity: "1",
        });
      });
      const renderers = mirrors.map((mirror) => {
        const renderer = createParticleRenderer(mirror);
        renderer?.resize(
          window.innerWidth,
          window.innerHeight,
          Math.min(window.devicePixelRatio || 1, 2),
        );
        return renderer;
      });
      const destinationColors: { accent: RGB; text: RGB } =
        nextTheme === "dark"
          ? {
              accent: [216 / 255, 214 / 255, 1],
              text: [242 / 255, 236 / 255, 227 / 255],
            }
          : {
              accent: [52 / 255, 58 / 255, 165 / 255],
              text: [36 / 255, 31 / 255, 27 / 255],
            };
      const syncCanvases = (event: Event) => {
        const { particles, options } = (
          event as CustomEvent<{
            particles: Particle[];
            options: ParticleDrawOptions;
          }>
        ).detail;
        renderers.forEach((renderer) =>
          renderer?.draw(particles, { ...options, ...destinationColors }),
        );
      };
      window.addEventListener("particle-frame", syncCanvases);
      window.addEventListener("scroll", alignCopy, { passive: true });
      clearWaveListeners = () => {
        window.removeEventListener("particle-frame", syncCanvases);
        window.removeEventListener("scroll", alignCopy);
        renderers.forEach((renderer) => renderer?.dispose());
      };
      const setRadius = (currentRadius: number) => {
        // The actual circular element grows around the icon; its contents
        // stay aligned with the viewport instead of scaling with the circle.
        Object.assign(wave.style, {
          left: `${x - currentRadius}px`,
          top: `${y - currentRadius}px`,
          width: `${currentRadius * 2}px`,
          height: `${currentRadius * 2}px`,
        });
        viewport.style.left = `${currentRadius - x}px`;
        viewport.style.top = `${currentRadius - y}px`;
      };
      setRadius(0);
      document.body.append(wave);
      window.dispatchEvent(
        new CustomEvent("particle-theme-change", {
          detail: { duration: THEME_TRANSITION_DURATION },
        }),
      );

      activeWave = wave;
      retarget(nextTheme);
      draw();
      let startedAt: number | undefined;
      const advance = (now: number) => {
        startedAt ??= now;
        const progress = Math.min(
          1,
          (now - startedAt) / THEME_TRANSITION_DURATION,
        );
        setRadius(radius * progress);
        if (progress < 1) {
          waveFrame = requestAnimationFrame(advance);
          return;
        }
        // Paint full coverage before committing the destination underneath.
        waveFrame = requestAnimationFrame(() => {
          applyTheme(nextTheme);
          waveFrame = requestAnimationFrame(() => {
            wave.remove();
            clearWaveListeners();
            activeWave = null;
            waveFrame = 0;
          });
        });
      };
      waveFrame = requestAnimationFrame(advance);
    }

    function applyThemeWithWave(nextTheme: Theme) {
      if (motionQuery.matches) {
        applyTheme(nextTheme);
        const targets = getTargets(nextTheme);
        reconcileParticlesToTargets(particles, targets, { force: true });
        lockParticlesToTargets(particles);
        draw();
        return;
      }

      runThemeTransition(nextTheme);
    }

    function resize() {
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      particleCanvas.width = Math.floor(ICON_SIZE * pixelRatio);
      particleCanvas.height = Math.floor(ICON_SIZE * pixelRatio);
      particleCanvas.style.width = `${ICON_SIZE}px`;
      particleCanvas.style.height = `${ICON_SIZE}px`;
      targetCache.clear();

      const targets = getTargets(activeTheme);

      if (particles.length === 0) {
        particles = targets.map(createParticleAtTarget);
      } else {
        reconcileParticlesToTargets(particles, targets, { force: true });
      }

      lockParticlesToTargets(particles);
      draw();
    }

    function retarget(nextTheme: Theme) {
      const targets = getTargets(nextTheme);

      if (targets.length === 0) {
        return;
      }

      settledFrames = 0;
      reconcileParticlesToTargets(particles, targets, { shuffle: true });
      scheduleTick();
    }

    function draw() {
      particleContext.setTransform(1, 0, 0, 1, 0, 0);
      particleContext.clearRect(
        0,
        0,
        particleCanvas.width,
        particleCanvas.height,
      );
      particleContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      const textColor = readThemeColor("--color-text", "#241f1b");
      const accentColor = readThemeColor("--color-accent-strong", "#343aa5");
      const gradient = particleContext.createLinearGradient(
        6,
        8,
        ICON_SIZE - 8,
        ICON_SIZE - 4,
      );

      gradient.addColorStop(0, accentColor);
      gradient.addColorStop(0.48, textColor);
      gradient.addColorStop(1, accentColor);
      particleContext.fillStyle = gradient;

      for (const particle of particles) {
        const radius = 0.82 * particle.scale;

        if (particle.opacity <= 0.02 || radius <= 0.05) {
          continue;
        }

        particleContext.globalAlpha = 0.96 * particle.opacity;
        particleContext.beginPath();
        particleContext.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
        particleContext.fill();
      }

      particleContext.globalAlpha = 1;
    }

    function scheduleTick() {
      if (animationFrame === 0) {
        animationFrame = window.requestAnimationFrame(tick);
      }
    }

    function tick() {
      animationFrame = 0;

      if (particles.length === 0) {
        return;
      }

      let settledCount = 0;
      let settlingCount = 0;
      let hasLifecycleMotion = false;

      for (const particle of particles) {
        const dx = particle.tx - particle.x;
        const dy = particle.ty - particle.y;

        particle.vx = (particle.vx + dx * 0.034) * 0.8;
        particle.vy = (particle.vy + dy * 0.034) * 0.8;
        particle.x += particle.vx;
        particle.y += particle.vy;

        const distance = Math.hypot(dx, dy);
        const speed = Math.hypot(particle.vx, particle.vy);
        const isSettled = distance < SETTLE_DISTANCE && speed < SETTLE_SPEED;

        if (isSettled) {
          particle.x = particle.tx;
          particle.y = particle.ty;
          particle.vx = 0;
          particle.vy = 0;
        }

        if (particle.mode === "born") {
          particle.opacity = 1;
          particle.scale = 1;
          particle.mode = "active";
        } else if (particle.mode === "retiring") {
          if (isSettled) {
            particle.opacity = 0;
            particle.scale = 0;
          } else {
            hasLifecycleMotion = true;
          }
        }

        if (particle.mode !== "retiring") {
          settlingCount += 1;
        }

        if (isSettled && particle.mode !== "retiring") {
          settledCount += 1;
        }
      }

      particles = particles.filter(
        (particle) =>
          particle.mode !== "retiring" ||
          (particle.opacity > 0.02 && particle.scale > 0.04),
      );

      const settledRatio =
        settlingCount === 0 ? 1 : Math.min(1, settledCount / settlingCount);
      const needsThemeColorTransition =
        window.performance.now() < themeColorTransitionUntil;

      if (settledRatio > 0.96) {
        settledFrames += 1;
      } else {
        settledFrames = 0;
      }

      if (settledFrames > 8 && !hasLifecycleMotion) {
        lockParticlesToTargets(particles);
      }

      draw();

      if (
        settledFrames <= 8 ||
        hasLifecycleMotion ||
        settledRatio < 1 ||
        needsThemeColorTransition
      ) {
        scheduleTick();
      }
    }

    function handleClick() {
      const nextTheme = getThemeTarget(activeTheme);

      applyThemeWithWave(nextTheme);
    }

    resize();

    const button = buttonRef.current;
    button?.addEventListener("click", handleClick);
    window.addEventListener("resize", resize);

    return () => {
      button?.removeEventListener("click", handleClick);
      window.cancelAnimationFrame(waveFrame);
      clearWaveListeners();
      activeWave?.remove();
      activeWave = null;
      delete document.documentElement.dataset.themeTransitioning;
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return createElement(
    "button",
    {
      "aria-label": `Switch to ${getThemeTarget(theme)} theme`,
      className: "particle-theme-toggle",
      ref: buttonRef,
      type: "button",
    },
    createElement("canvas", {
      "aria-hidden": "true",
      className: "particle-theme-toggle__canvas",
      ref: canvasRef,
    }),
  );
}
