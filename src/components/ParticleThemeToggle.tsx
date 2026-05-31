import { createElement, useEffect, useRef, useState } from "react";
import {
  type Particle,
  type Point,
  getTextTargets,
  lockParticlesToTargets,
  reconcileParticlesToTargets,
} from "../lib/particles";

type Theme = "light" | "dark";

const ICON_SIZE = 58;
const SETTLE_DISTANCE = 0.4;
const SETTLE_SPEED = 0.05;
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
      inkPixelsPerParticle: theme === "light" ? 0.76 : 1.42,
      maximumCount: theme === "light" ? 1000 : 540,
      minimumCount: theme === "light" ? 410 : 200,
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

    setTheme(activeTheme);

    function readThemeColor(name: string, fallback: string) {
      return (
        getComputedStyle(document.documentElement)
          .getPropertyValue(name)
          .trim() || fallback
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

    function applyTheme(nextTheme: Theme) {
      activeTheme = nextTheme;
      document.documentElement.dataset.theme = nextTheme;
      window.localStorage.setItem("theme", nextTheme);
      window.dispatchEvent(
        new CustomEvent("particle-theme-change", {
          detail: { theme: nextTheme },
        }),
      );
      setTheme(nextTheme);
    }

    function runFallbackWave(nextTheme: Theme, x: number, y: number) {
      const overlay = document.createElement("div");
      const radius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y),
      );

      overlay.className = "theme-wave";
      overlay.style.background = getThemeBackground(nextTheme);
      overlay.style.clipPath = `circle(0 at ${x}px ${y}px)`;
      document.body.append(overlay);
      applyTheme(nextTheme);

      const animation = overlay.animate(
        [
          { clipPath: `circle(0 at ${x}px ${y}px)` },
          { clipPath: `circle(${radius}px at ${x}px ${y}px)` },
        ],
        {
          duration: 720,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        },
      );

      animation.addEventListener("finish", () => {
        overlay.remove();
      });
    }

    function applyThemeWithWave(nextTheme: Theme) {
      const rect = buttonRef.current?.getBoundingClientRect();
      const x = rect ? rect.left + rect.width / 2 : window.innerWidth - 36;
      const y = rect ? rect.top + rect.height / 2 : 36;

      if (motionQuery.matches) {
        applyTheme(nextTheme);
        return;
      }

      if ("startViewTransition" in document) {
        const radius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y),
        );
        const transition = (
          document as Document & {
            startViewTransition: (callback: () => void) => {
              ready: Promise<void>;
            };
          }
        ).startViewTransition(() => {
          applyTheme(nextTheme);
        });

        transition.ready.then(() => {
          document.documentElement.animate(
            [
              { clipPath: `circle(0 at ${x}px ${y}px)` },
              { clipPath: `circle(${radius}px at ${x}px ${y}px)` },
            ],
            {
              duration: 720,
              easing: "cubic-bezier(0.22, 1, 0.36, 1)",
              pseudoElement: "::view-transition-new(root)",
            } as KeyframeAnimationOptions,
          );
        });
        return;
      }

      runFallbackWave(nextTheme, x, y);
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
          particle.opacity = Math.min(1, particle.opacity + 0.07);
          particle.scale = Math.min(1, particle.scale + 0.08);

          if (particle.opacity >= 1 && particle.scale >= 1) {
            particle.mode = "active";
          } else {
            hasLifecycleMotion = true;
          }
        } else if (particle.mode === "retiring") {
          if (distance < 5 || isSettled) {
            particle.opacity = Math.max(0, particle.opacity - 0.1);
            particle.scale = Math.max(0, particle.scale - 0.085);
          }

          if (particle.opacity > 0.02 && particle.scale > 0.04) {
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

      if (settledRatio > 0.96) {
        settledFrames += 1;
      } else {
        settledFrames = 0;
      }

      if (settledFrames > 8 && !hasLifecycleMotion) {
        lockParticlesToTargets(particles);
      }

      draw();

      if (settledFrames <= 8 || hasLifecycleMotion || settledRatio < 1) {
        scheduleTick();
      }
    }

    function handleClick() {
      const nextTheme = getThemeTarget(activeTheme);

      retarget(nextTheme);
      applyThemeWithWave(nextTheme);
    }

    resize();

    const button = buttonRef.current;
    button?.addEventListener("click", handleClick);
    window.addEventListener("resize", resize);

    return () => {
      button?.removeEventListener("click", handleClick);
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
