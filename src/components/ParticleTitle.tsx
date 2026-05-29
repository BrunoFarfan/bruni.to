import { createElement, useEffect, useRef, useState } from "react";

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
  | "page-ready";

type TextVariant = "domain" | "hero" | "section";

type TextTargetOptions = {
  align?: CanvasTextAlign;
  fontSize?: number;
  fontWeight?: string;
  lineHeight?: number;
  variant: TextVariant;
};

type PageTitleTarget = {
  element: HTMLElement;
  id: string;
  text: string;
  variant: "hero" | "section";
};

const SETTLE_DISTANCE = 0.75;
const SETTLE_SPEED = 0.08;
const POST_DOMAIN_INPUT_DELAY = 350;
const FONT_FAMILY =
  'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

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

function getAutoFontSize(
  context: CanvasRenderingContext2D,
  text: string,
  width: number,
  height: number,
  variant: TextVariant,
) {
  const maxTextWidth =
    width * (variant === "domain" ? 0.84 : variant === "hero" ? 0.88 : 1);
  const maxTextHeight =
    height * (variant === "domain" ? 0.5 : variant === "hero" ? 0.66 : 1);
  const maxFontSize = Math.min(
    variant === "domain" ? 178 : variant === "hero" ? 118 : 112,
    width / (variant === "domain" ? 3.6 : variant === "hero" ? 6.4 : 5.4),
    height * (variant === "domain" ? 0.38 : variant === "hero" ? 0.24 : 0.86),
  );
  const minFontSize = variant === "domain" ? 52 : 34;
  let fontSize = maxFontSize;
  let lines: string[] = [text];

  while (fontSize > minFontSize) {
    context.font = `780 ${fontSize}px ${FONT_FAMILY}`;
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

function getTextTargets(
  text: string,
  width: number,
  height: number,
  desiredCount: number,
  options: TextTargetOptions,
) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) {
    return [];
  }

  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));

  const fontWeight = options.fontWeight ?? "780";
  const presetFontSize = options.fontSize;
  const autoText = presetFontSize
    ? (() => {
        context.font = `${fontWeight} ${presetFontSize}px ${FONT_FAMILY}`;
        return {
          fontSize: presetFontSize,
          lines: getLines(context, text, width),
        };
      })()
    : getAutoFontSize(context, text, width, height, options.variant);
  const fontSize = autoText.fontSize;
  const lineHeight = options.lineHeight ?? fontSize * 0.98;
  const lines = autoText.lines;

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#000";
  context.font = `${fontWeight} ${fontSize}px ${FONT_FAMILY}`;
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
  if (targets.length === 0) {
    return;
  }

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

function isVisible(rect: DOMRect) {
  return rect.bottom > 0 && rect.top < window.innerHeight;
}

function parsePixels(value: string, fallback: number) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
    const targetCache = new Map<string, Point[]>();

    document.documentElement.dataset.homeReveal = "intro";
    document.documentElement.dataset.particlePage = "enhanced";
    setIsEnhanced(true);

    let animationFrame = 0;
    let width = 1;
    let height = 1;
    let pixelRatio = 1;
    let particles: Particle[] = [];
    let domainTargets: Point[] = [];
    let heroTargets: Point[] = [];
    let activePageTargetId = "hero";
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

    function getPageTargets(): PageTitleTarget[] {
      const sectionTargets = Array.from(
        document.querySelectorAll<HTMLElement>("[data-particle-title]"),
      ).map((element, index) => ({
        element,
        id: element.id || `section-${index}`,
        text: element.dataset.particleTitle || element.textContent || "",
        variant: "section" as const,
      }));

      return [
        {
          element: particleHost,
          id: "hero",
          text: heroText,
          variant: "hero",
        },
        ...sectionTargets,
      ];
    }

    function getLocalTargetsForElement(target: PageTitleTarget, count: number) {
      const rect = target.element.getBoundingClientRect();
      const computedStyle = getComputedStyle(target.element);
      const cacheWidth = Math.max(1, Math.round(rect.width));
      const cacheHeight = Math.max(1, Math.round(rect.height));
      const fontSize = parsePixels(
        computedStyle.fontSize,
        target.variant === "hero" ? 118 : 96,
      );
      const lineHeight = parsePixels(computedStyle.lineHeight, fontSize * 1.02);
      const fontWeight =
        computedStyle.fontWeight === "normal"
          ? "780"
          : computedStyle.fontWeight;
      const cacheKey = [
        target.id,
        target.text,
        cacheWidth,
        cacheHeight,
        count,
        fontSize,
        lineHeight,
        fontWeight,
        target.variant,
      ].join(":");
      const cachedTargets = targetCache.get(cacheKey);

      if (cachedTargets) {
        return cachedTargets;
      }

      const localTargets =
        target.variant === "section"
          ? getTextTargets(target.text, cacheWidth, cacheHeight, count, {
              align: "left",
              fontSize,
              fontWeight,
              lineHeight,
              variant: "section",
            })
          : getTextTargets(target.text, cacheWidth, cacheHeight, count, {
              variant: "hero",
            });

      targetCache.set(cacheKey, localTargets);
      return localTargets;
    }

    function getTargetsForElement(target: PageTitleTarget, count: number) {
      const rect = target.element.getBoundingClientRect();
      return offsetTargets(
        getLocalTargetsForElement(target, count),
        rect.left,
        rect.top,
      );
    }

    function choosePageTarget() {
      const pageTargets = getPageTargets();
      const visibleTargets = pageTargets
        .map((target) => ({
          rect: target.element.getBoundingClientRect(),
          target,
        }))
        .filter(({ rect }) => isVisible(rect));

      if (visibleTargets.length > 0) {
        visibleTargets.sort((a, b) => a.rect.top - b.rect.top);
        return visibleTargets[visibleTargets.length - 1].target;
      }

      return (
        pageTargets.find((target) => target.id === activePageTargetId) ??
        pageTargets[0]
      );
    }

    function retargetToPageTitle({ force = false } = {}) {
      if (state !== "page-ready") {
        return;
      }

      const count = getParticleCount(width);
      const nextTarget = choosePageTarget();
      const nextTargets = getTargetsForElement(nextTarget, count);

      if (nextTargets.length === 0) {
        return;
      }

      activePageTargetId = nextTarget.id;
      assignTargets(particles, nextTargets);

      if (force) {
        lockParticlesToTargets(particles);
      }

      scheduleTick();
    }

    function startHeroMorph() {
      if (state === "forming-hero" || state === "page-ready") {
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
      if (state === "page-ready") {
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

    function handleScroll() {
      retargetToPageTitle();
    }

    function resize() {
      width = window.innerWidth;
      height = window.innerHeight;
      pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      targetCache.clear();

      particleCanvas.width = Math.floor(width * pixelRatio);
      particleCanvas.height = Math.floor(height * pixelRatio);
      particleCanvas.style.width = `${width}px`;
      particleCanvas.style.height = `${height}px`;

      const count = getParticleCount(width);
      const heroTarget: PageTitleTarget = {
        element: particleHost,
        id: "hero",
        text: heroText,
        variant: "hero",
      };

      domainTargets = getTextTargets(introText, width, height, count, {
        variant: "domain",
      });
      heroTargets = getTargetsForElement(heroTarget, count);

      if (heroTargets.length === 0) {
        heroTargets = getTextTargets(heroText, width, height, count, {
          variant: "hero",
        });
      }

      if (domainTargets.length === 0) {
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

      if (state === "page-ready") {
        retargetToPageTitle({ force: true });
        draw();
        return;
      }

      assignTargets(
        particles,
        state === "forming-hero" ? heroTargets : domainTargets,
      );

      if (state === "domain-settled") {
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
      const spring = state === "forming-domain" ? 0.014 : 0.018;
      const damping = state === "forming-domain" ? 0.878 : 0.865;

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
          state = "page-ready";
          activePageTargetId = "hero";
          document.documentElement.dataset.homeReveal = "ready";
          retargetToPageTitle({ force: true });
        }
      }

      draw();

      const settledRatio = settledCount / particles.length;
      const needsStateTransition =
        (state === "forming-domain" || state === "forming-hero") &&
        settledFrames <= 12;

      if (
        state !== "domain-settled" &&
        (needsStateTransition || settledRatio < 1)
      ) {
        scheduleTick();
      }
    }

    resize();
    scheduleTick();

    window.addEventListener("resize", resize);
    window.addEventListener("scroll", handleScroll, { passive: true });
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
      delete document.documentElement.dataset.particlePage;
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("wheel", handleIntentInput);
      window.removeEventListener("touchmove", handleIntentInput);
      window.removeEventListener("pointerdown", handleIntentInput);
      window.removeEventListener("keydown", handleIntentInput);
    };
  }, [heroText, introText]);

  return createElement(
    "div",
    {
      className: `particle-title ${isEnhanced ? "particle-title--enhanced" : ""}`,
    },
    createElement("canvas", {
      "aria-hidden": "true",
      className: "particle-title__canvas",
      ref: canvasRef,
    }),
    createElement(
      "h1",
      {
        className: "particle-title__fallback",
        id: titleId,
      },
      heroText,
    ),
  );
}
