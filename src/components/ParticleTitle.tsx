import { useEffect, useRef, useState } from "react";

type Props = {
  introText: string;
  heroText: string;
  titleId?: string;
};

type Point = {
  x: number;
  y: number;
};

type Particle = Point & {
  vx: number;
  vy: number;
  tx: number;
  ty: number;
};

type MotionState =
  | "forming-domain"
  | "domain-settled"
  | "forming-hero"
  | "hero-settled";

const SETTLE_DISTANCE = 0.75;
const SETTLE_SPEED = 0.08;
const POST_DOMAIN_INPUT_DELAY = 350;

function getParticleCount(width: number) {
  if (width < 520) {
    return 1500;
  }

  if (width < 900) {
    return 2800;
  }

  return 4800;
}

function getEdgeSpawn(width: number, height: number): Particle {
  const edge = Math.floor(Math.random() * 4);
  const speed = 1.8 + Math.random() * 3.2;
  const drift = (Math.random() - 0.5) * 1.6;

  if (edge === 0) {
    return {
      x: Math.random() * width,
      y: -8,
      vx: speed * (Math.random() < 0.5 ? -1 : 1),
      vy: drift,
      tx: 0,
      ty: 0,
    };
  }

  if (edge === 1) {
    return {
      x: width + 8,
      y: Math.random() * height,
      vx: drift,
      vy: speed * (Math.random() < 0.5 ? -1 : 1),
      tx: 0,
      ty: 0,
    };
  }

  if (edge === 2) {
    return {
      x: Math.random() * width,
      y: height + 8,
      vx: speed * (Math.random() < 0.5 ? -1 : 1),
      vy: drift,
      tx: 0,
      ty: 0,
    };
  }

  return {
    x: -8,
    y: Math.random() * height,
    vx: drift,
    vy: speed * (Math.random() < 0.5 ? -1 : 1),
    tx: 0,
    ty: 0,
  };
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

function getTextTargets(
  text: string,
  width: number,
  height: number,
  desiredCount: number,
  variant: "domain" | "hero",
) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return [];
  }

  canvas.width = Math.max(1, Math.floor(width));
  canvas.height = Math.max(1, Math.floor(height));

  const maxTextWidth = width * (variant === "domain" ? 0.84 : 0.88);
  const maxTextHeight = height * (variant === "domain" ? 0.5 : 0.66);
  const maxFontSize = Math.min(
    variant === "domain" ? 178 : 118,
    width / (variant === "domain" ? 3.6 : 6.4),
    height * (variant === "domain" ? 0.38 : 0.24),
  );
  const minFontSize = variant === "domain" ? 52 : 34;
  let fontSize = maxFontSize;
  let lines: string[] = [text];
  const fontFamily =
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

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

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#000";
  context.font = `780 ${fontSize}px ${fontFamily}`;
  context.textAlign = "center";
  context.textBaseline = "middle";

  const lineHeight = fontSize * 0.98;
  const startY = height / 2 - ((lines.length - 1) * lineHeight) / 2;

  lines.forEach((line, index) => {
    context.fillText(line, width / 2, startY + index * lineHeight);
  });

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const points: Point[] = [];
  const step = width < 520 ? 2 : 1;

  for (let y = 0; y < canvas.height; y += step) {
    for (let x = 0; x < canvas.width; x += step) {
      const alpha = pixels[(y * canvas.width + x) * 4 + 3];

      if (alpha > 80) {
        points.push({
          x: x + (Math.random() - 0.5) * 0.8,
          y: y + (Math.random() - 0.5) * 0.8,
        });
      }
    }
  }

  if (points.length === 0) {
    return [];
  }

  if (points.length >= desiredCount) {
    const sampledPoints: Point[] = [];
    const stride = points.length / desiredCount;

    for (let index = 0; index < desiredCount; index += 1) {
      const sourceIndex = Math.min(
        points.length - 1,
        Math.floor(index * stride + stride * 0.5),
      );
      const point = points[sourceIndex];

      sampledPoints.push({
        x: point.x + (Math.random() - 0.5) * 0.45,
        y: point.y + (Math.random() - 0.5) * 0.45,
      });
    }

    return sampledPoints;
  }

  const filledPoints = [...points];

  while (filledPoints.length < desiredCount) {
    const point = points[Math.floor(Math.random() * points.length)];
    filledPoints.push({
      x: point.x + (Math.random() - 0.5) * step,
      y: point.y + (Math.random() - 0.5) * step,
    });
  }

  return filledPoints;
}

function assignTargets(particles: Particle[], targets: Point[]) {
  particles.forEach((particle, index) => {
    const target = targets[index % targets.length];
    particle.tx = target.x;
    particle.ty = target.y;
  });
}

function lockParticlesToTargets(particles: Particle[]) {
  particles.forEach((particle) => {
    particle.x = particle.tx;
    particle.y = particle.ty;
    particle.vx = 0;
    particle.vy = 0;
  });
}

function offsetTargets(targets: Point[], offsetX: number, offsetY: number) {
  return targets.map((target) => ({
    x: target.x + offsetX,
    y: target.y + offsetY,
  }));
}

export default function ParticleTitle({ introText, heroText, titleId }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isEnhanced, setIsEnhanced] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = canvas?.parentElement;

    if (!canvas || !host) {
      return;
    }

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (motionQuery.matches) {
      document.documentElement.dataset.homeReveal = "ready";
      setIsEnhanced(false);
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      setIsEnhanced(false);
      return;
    }

    const particleCanvas = canvas;
    const particleHost = host;
    const particleContext = context;

    document.documentElement.dataset.homeReveal = "intro";
    setIsEnhanced(true);

    let animationFrame = 0;
    let width = 1;
    let height = 1;
    let pixelRatio = 1;
    let particles: Particle[] = [];
    let domainTargets: Point[] = [];
    let heroTargets: Point[] = [];
    let state: MotionState = "forming-domain";
    let canTriggerHeroMorph = false;
    let domainSettledAt = 0;
    let triggerDelay = 0;
    let settledFrames = 0;

    function readThemeColor(name: string, fallback: string) {
      return (
        getComputedStyle(document.documentElement)
          .getPropertyValue(name)
          .trim() || fallback
      );
    }

    function startHeroMorph() {
      if (state === "forming-hero" || state === "hero-settled") {
        return;
      }

      state = "forming-hero";
      document.documentElement.dataset.homeReveal = "morphing";
      settledFrames = 0;
      assignTargets(particles, heroTargets);

      particles.forEach((particle) => {
        const angle =
          Math.atan2(particle.y - height / 2, particle.x - width / 2) +
          (Math.random() - 0.5) * 0.8;
        const force = 4.4 + Math.random() * 6.8;

        particle.vx += Math.cos(angle) * force;
        particle.vy += Math.sin(angle) * force;
      });

      scheduleTick();
    }

    function requestHeroMorphFromIntent() {
      if (
        state === "domain-settled" &&
        canTriggerHeroMorph &&
        performance.now() - domainSettledAt >= POST_DOMAIN_INPUT_DELAY
      ) {
        startHeroMorph();
      }
    }

    function handleIntentInput(event: Event) {
      if (state === "hero-settled") {
        return;
      }

      if (
        event instanceof KeyboardEvent &&
        (event.metaKey || event.ctrlKey || event.altKey)
      ) {
        return;
      }

      requestHeroMorphFromIntent();
    }

    function resize() {
      const rect = particleHost.getBoundingClientRect();
      const isOverlayCanvas = state !== "hero-settled";
      width = isOverlayCanvas ? window.innerWidth : Math.max(320, rect.width);
      height = isOverlayCanvas
        ? window.innerHeight
        : Math.max(260, rect.height);
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      particleCanvas.width = Math.floor(width * pixelRatio);
      particleCanvas.height = Math.floor(height * pixelRatio);
      particleCanvas.style.width = `${width}px`;
      particleCanvas.style.height = `${height}px`;

      const count = getParticleCount(width);
      domainTargets = getTextTargets(introText, width, height, count, "domain");
      heroTargets = isOverlayCanvas
        ? offsetTargets(
            getTextTargets(
              heroText,
              Math.max(320, rect.width),
              Math.max(260, rect.height),
              count,
              "hero",
            ),
            rect.left,
            rect.top,
          )
        : getTextTargets(heroText, width, height, count, "hero");

      if (domainTargets.length === 0 || heroTargets.length === 0) {
        return;
      }

      if (particles.length === 0) {
        particles = Array.from({ length: count }, () =>
          getEdgeSpawn(width, height),
        );
      } else if (particles.length > count) {
        particles = particles.slice(0, count);
      } else {
        while (particles.length < count) {
          particles.push(getEdgeSpawn(width, height));
        }
      }

      assignTargets(
        particles,
        state === "forming-hero" || state === "hero-settled"
          ? heroTargets
          : domainTargets,
      );

      if (state === "domain-settled" || state === "hero-settled") {
        lockParticlesToTargets(particles);
        draw();
        return;
      }

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
        width * 0.16,
        height * 0.28,
        width * 0.84,
        height * 0.76,
      );

      gradient.addColorStop(0, accentColor);
      gradient.addColorStop(0.46, textColor);
      gradient.addColorStop(1, accentColor);

      particleContext.fillStyle = gradient;
      particleContext.globalAlpha = 0.94;
      particleContext.beginPath();

      const radius = width < 520 ? 1.35 : 1.65;

      for (const particle of particles) {
        particleContext.moveTo(particle.x + radius, particle.y);
        particleContext.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
      }

      particleContext.fill();
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
      const spring = state === "forming-hero" ? 0.018 : 0.014;
      const damping = state === "forming-hero" ? 0.865 : 0.878;

      for (const particle of particles) {
        const dx = particle.tx - particle.x;
        const dy = particle.ty - particle.y;

        particle.vx = (particle.vx + dx * spring) * damping;
        particle.vy = (particle.vy + dy * spring) * damping;
        particle.x += particle.vx;
        particle.y += particle.vy;

        const distance = Math.hypot(dx, dy);
        const speed = Math.hypot(particle.vx, particle.vy);

        if (distance < SETTLE_DISTANCE && speed < SETTLE_SPEED) {
          particle.x = particle.tx;
          particle.y = particle.ty;
          particle.vx = 0;
          particle.vy = 0;
          settledCount += 1;
        }
      }

      if (settledCount / particles.length > 0.96) {
        settledFrames += 1;
      } else {
        settledFrames = 0;
      }

      if (settledFrames > 12) {
        if (state === "forming-domain") {
          state = "domain-settled";
          settledFrames = 0;
          domainSettledAt = performance.now();
          canTriggerHeroMorph = false;
          triggerDelay = window.setTimeout(() => {
            canTriggerHeroMorph = true;
          }, POST_DOMAIN_INPUT_DELAY);
        } else if (state === "forming-hero") {
          state = "hero-settled";
          resize();
          document.documentElement.dataset.homeReveal = "ready";
        }
      }

      draw();

      if (state !== "domain-settled" && state !== "hero-settled") {
        scheduleTick();
      }
    }

    resize();
    scheduleTick();

    window.addEventListener("resize", resize);
    window.addEventListener("wheel", handleIntentInput, { passive: true });
    window.addEventListener("touchmove", handleIntentInput, {
      passive: true,
    });
    window.addEventListener("pointerdown", handleIntentInput);
    window.addEventListener("keydown", handleIntentInput);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(triggerDelay);
      delete document.documentElement.dataset.homeReveal;
      window.removeEventListener("resize", resize);
      window.removeEventListener("wheel", handleIntentInput);
      window.removeEventListener("touchmove", handleIntentInput);
      window.removeEventListener("pointerdown", handleIntentInput);
      window.removeEventListener("keydown", handleIntentInput);
    };
  }, [heroText, introText]);

  return (
    <div
      className={`particle-title ${isEnhanced ? "particle-title--enhanced" : ""}`}
    >
      <canvas
        aria-hidden="true"
        className="particle-title__canvas"
        ref={canvasRef}
      />
      <h1 className="particle-title__fallback" id={titleId}>
        {heroText}
      </h1>
    </div>
  );
}
