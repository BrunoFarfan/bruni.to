import { createElement, useEffect, useRef, useState } from "react";
import {
  type Particle,
  type Point,
  getTextTargets,
  lockParticlesToTargets,
  offsetTargets,
  reconcileParticlesToTargets,
} from "../lib/particles";
import { type RGB, createParticleRenderer } from "../lib/particleRenderer";

type Props = {
  introText: string;
  heroText: string;
  // Optional rapid text sequence the hero morphs through. The first entry is
  // what initially forms; the rest are stepped through quickly. Defaults to a
  // direct morph from introText to heroText.
  morphSteps?: string[];
  titleId?: string;
};

type MotionState =
  | "forming-domain"
  | "domain-settled"
  | "forming-hero"
  | "page-ready";

type PageTitleTarget = {
  element: HTMLElement;
  id: string;
  text: string;
  variant: "hero" | "section";
};

const SETTLE_DISTANCE = 0.75;
const SETTLE_SPEED = 0.08;
// How long the intro title ("bruni.to") rests before it automatically begins
// morphing into the hero name.
const HERO_MORPH_DELAY = 700;
// Total time spent stepping through the morph sequence.
const MORPH_SEQUENCE_DURATION = 1000;

function getCircleSpawn(width: number, height: number): Particle {
  const angle = Math.random() * Math.PI * 2;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.hypot(centerX, centerY) + 8;
  const speed = (1.8 + Math.random() * 3.2) * 15;
  const drift = (Math.random() - 0.5) * 1.6;

  return {
    x: centerX + Math.cos(angle) * radius,
    y: centerY + Math.sin(angle) * radius,
    vx: Math.sin(angle) * speed + Math.cos(angle) * drift,
    vy: -Math.cos(angle) * speed + Math.sin(angle) * drift,
    tx: 0,
    ty: 0,
    opacity: 1,
    scale: 1,
    mode: "active",
  };
}

function getScrollOffset() {
  return {
    x: window.scrollX,
    y: window.scrollY,
  };
}

function getPageCircleSpawn(width: number, height: number) {
  const scroll = getScrollOffset();
  const particle = getCircleSpawn(width, height);

  particle.x += scroll.x;
  particle.y += scroll.y;

  return particle;
}

function isVisible(rect: DOMRect) {
  return rect.bottom > 0 && rect.top < window.innerHeight;
}

function parsePixels(value: string, fallback: number) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function ParticleTitle({
  introText,
  heroText,
  morphSteps,
  titleId,
}: Props) {
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

    const renderer = createParticleRenderer(canvas);

    if (!renderer) {
      // No WebGL: reveal the static title instead of leaving it hidden behind
      // the "intro" reveal state set by the inline page script.
      document.documentElement.dataset.homeReveal = "ready";
      setIsEnhanced(false);
      return;
    }

    const particleCanvas = canvas;
    const particleHost = host;
    const particleRenderer = renderer;
    const targetCache = new Map<string, Point[]>();
    const colorCache = new Map<string, RGB>();

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
    let isPageTargetSettled = false;
    let state: MotionState = "forming-domain";
    let heroMorphTimer = 0;
    let morphStepTimers: number[] = [];
    let isFinalMorphReached = false;
    let settledFrames = 0;
    const heroSequence =
      morphSteps && morphSteps.length > 0 ? morphSteps : [introText, heroText];
    const colorParser = document.createElement("canvas");
    colorParser.width = 1;
    colorParser.height = 1;
    const colorParserContext = colorParser.getContext("2d", {
      willReadFrequently: true,
    });

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

    function getLocalTargetsForElement(target: PageTitleTarget) {
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
          ? getTextTargets(target.text, cacheWidth, cacheHeight, {
              align: "left",
              fontSize,
              fontWeight,
              lineHeight,
              variant: "section",
            })
          : getTextTargets(target.text, cacheWidth, cacheHeight, {
              variant: "hero",
            });

      targetCache.set(cacheKey, localTargets);
      return localTargets;
    }

    function getTargetsForElement(target: PageTitleTarget) {
      const rect = target.element.getBoundingClientRect();
      const scroll = getScrollOffset();
      return offsetTargets(
        getLocalTargetsForElement(target),
        rect.left + scroll.x,
        rect.top + scroll.y,
      );
    }

    function moveOffscreenParticlesToViewportEdges() {
      const scroll = getScrollOffset();
      const left = scroll.x;
      const top = scroll.y;
      const right = scroll.x + width;
      const bottom = scroll.y + height;
      const edgeInset = 2;

      particles.forEach((particle) => {
        const isInView =
          particle.x >= left &&
          particle.x <= right &&
          particle.y >= top &&
          particle.y <= bottom;

        if (isInView) {
          return;
        }

        particle.x = Math.min(
          Math.max(particle.x, left + edgeInset),
          right - edgeInset,
        );
        particle.y = Math.min(
          Math.max(particle.y, top + edgeInset),
          bottom - edgeInset,
        );
        particle.vx = 0;
        particle.vy = 0;
      });
    }

    function choosePageTarget() {
      const pageTargets = getPageTargets();
      const visibleTargets = pageTargets
        .map((target) => ({
          rect: target.element.getBoundingClientRect(),
          target,
        }))
        .filter(({ rect }) => isVisible(rect));

      if (width < 560) {
        const activationLine = height * 0.72;
        const activatedTargets = visibleTargets.filter(
          ({ rect }) => rect.top <= activationLine,
        );

        if (activatedTargets.length > 0) {
          activatedTargets.sort((a, b) => a.rect.top - b.rect.top);
          return activatedTargets[activatedTargets.length - 1].target;
        }

        return (
          pageTargets.find((target) => target.id === activePageTargetId) ??
          pageTargets[0]
        );
      }

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

      const nextTarget = choosePageTarget();
      const isSameTarget = nextTarget.id === activePageTargetId;
      const nextLocalTargets = getLocalTargetsForElement(nextTarget);

      if (nextLocalTargets.length === 0) {
        return;
      }

      const nextRect = nextTarget.element.getBoundingClientRect();
      const scroll = getScrollOffset();
      const nextTargets = offsetTargets(
        nextLocalTargets,
        nextRect.left + scroll.x,
        nextRect.top + scroll.y,
      );

      if (nextTargets.length === 0) {
        return;
      }

      if (isSameTarget && !force) {
        if (!isPageTargetSettled) {
          return;
        }

        draw();
        return;
      }

      activePageTargetId = nextTarget.id;
      isPageTargetSettled = false;
      settledFrames = 0;

      if (!force) {
        moveOffscreenParticlesToViewportEdges();
      }

      reconcileParticlesToTargets(particles, nextTargets, {
        force,
        shuffle: true,
      });

      if (force) {
        isPageTargetSettled = true;
      }

      scheduleTick();
    }

    function lockCurrentPageTarget() {
      if (
        state !== "page-ready" ||
        isPageTargetSettled ||
        particles.some((particle) => particle.mode !== "active")
      ) {
        return;
      }

      lockParticlesToTargets(particles);
      isPageTargetSettled = true;
    }

    function getHeroTargetsForText(text: string) {
      // The final step lands exactly on the hero page-target (so page-ready
      // scroll-tracking starts without a jump); intermediate steps are sized
      // and positioned identically, just with different text.
      if (text === heroText) {
        return heroTargets;
      }

      return getTargetsForElement({
        element: particleHost,
        id: "hero",
        text,
        variant: "hero",
      });
    }

    function startHeroMorph() {
      if (state === "forming-hero" || state === "page-ready") {
        return;
      }

      state = "forming-hero";
      document.documentElement.dataset.homeReveal = "morphing";
      settledFrames = 0;
      isFinalMorphReached = false;

      // The first entry of the sequence is already on screen, so step through
      // the rest quickly, spacing the transitions so the whole sequence lands
      // within MORPH_SEQUENCE_DURATION.
      const steps = heroSequence.slice(1);
      const interval = MORPH_SEQUENCE_DURATION / Math.max(1, steps.length);

      steps.forEach((text, index) => {
        const isFinalStep = index === steps.length - 1;
        const timer = window.setTimeout(
          () => {
            const targets = getHeroTargetsForText(text);

            if (targets.length === 0) {
              return;
            }

            if (isFinalStep) {
              isFinalMorphReached = true;
            }

            reconcileParticlesToTargets(particles, targets, { shuffle: true });
            scheduleTick();
          },
          Math.round(interval * index),
        );

        morphStepTimers.push(timer);
      });
    }

    function handleScroll() {
      retargetToPageTitle();

      if (state === "page-ready" && isPageTargetSettled) {
        draw();
      }
    }

    function parseColor(value: string): RGB {
      const cached = colorCache.get(value);

      if (cached) {
        return cached;
      }

      let rgb: RGB = [0.14, 0.12, 0.1];

      if (colorParserContext) {
        colorParserContext.clearRect(0, 0, 1, 1);
        colorParserContext.fillStyle = "#000";
        colorParserContext.fillStyle = value;
        colorParserContext.fillRect(0, 0, 1, 1);
        const [r, g, b] = colorParserContext.getImageData(0, 0, 1, 1).data;
        rgb = [r / 255, g / 255, b / 255];
      }

      colorCache.set(value, rgb);
      return rgb;
    }

    function handleThemeChange() {
      colorCache.clear();
      if (particles.length > 0) {
        draw();
      }
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
      particleRenderer.resize(width, height, pixelRatio);

      const heroTarget: PageTitleTarget = {
        element: particleHost,
        id: "hero",
        text: heroText,
        variant: "hero",
      };

      // Form the intro word at the hero's host position (same size/spot the
      // morph sequence lands on) instead of the center of the viewport, so it
      // never floats below the final landing position.
      const introTarget: PageTitleTarget = {
        element: particleHost,
        id: "hero",
        text: introText,
        variant: "hero",
      };

      domainTargets = getTargetsForElement(introTarget);

      if (domainTargets.length === 0) {
        domainTargets = offsetTargets(
          getTextTargets(introText, width, height, { variant: "hero" }),
          window.scrollX,
          window.scrollY,
        );
      }

      heroTargets = getTargetsForElement(heroTarget);

      if (heroTargets.length === 0) {
        heroTargets = getTextTargets(heroText, width, height, {
          variant: "hero",
        });
      }

      if (domainTargets.length === 0) {
        return;
      }

      if (particles.length === 0) {
        particles = Array.from({ length: domainTargets.length }, () =>
          getPageCircleSpawn(width, height),
        );
      }

      if (state === "page-ready") {
        retargetToPageTitle({ force: true });
        draw();
        return;
      }

      reconcileParticlesToTargets(
        particles,
        state === "forming-hero" ? heroTargets : domainTargets,
        { force: state === "domain-settled" },
      );

      if (state === "domain-settled") {
        draw();
        return;
      }

      scheduleTick();
    }

    function draw() {
      const scroll = getScrollOffset();
      const radius = width < 520 ? 1.35 : 1.65;

      particleRenderer.draw(particles, {
        scrollX: scroll.x,
        scrollY: scroll.y,
        baseRadius: radius,
        text: parseColor(readThemeColor("--color-text", "#241f1b")),
        accent: parseColor(readThemeColor("--color-accent-strong", "#343aa5")),
        gradientStart: { x: width * 0.16, y: height * 0.28 },
        gradientEnd: { x: width * 0.84, y: height * 0.76 },
      });
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
        const isSettled = distance < SETTLE_DISTANCE && speed < SETTLE_SPEED;

        if (isSettled) {
          particle.x = particle.tx;
          particle.y = particle.ty;
          particle.vx = 0;
          particle.vy = 0;
        }

        if (particle.mode === "born") {
          particle.opacity = Math.min(1, particle.opacity + 0.045);
          particle.scale = Math.min(1, particle.scale + 0.052);

          if (particle.opacity >= 1 && particle.scale >= 1) {
            particle.mode = "active";
          } else {
            hasLifecycleMotion = true;
          }
        } else if (particle.mode === "retiring") {
          if (distance < 9 || isSettled) {
            particle.opacity = Math.max(0, particle.opacity - 0.075);
            particle.scale = Math.max(0, particle.scale - 0.06);
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

      if (particles.length === 0) {
        return;
      }

      const settledRatio =
        settlingCount === 0 ? 1 : Math.min(1, settledCount / settlingCount);

      if (settledRatio > 0.96) {
        settledFrames += 1;
      } else {
        settledFrames = 0;
      }

      if (settledFrames > 12) {
        if (state === "forming-domain") {
          state = "domain-settled";
          settledFrames = 0;
          heroMorphTimer = window.setTimeout(startHeroMorph, HERO_MORPH_DELAY);
        } else if (state === "forming-hero" && isFinalMorphReached) {
          state = "page-ready";
          activePageTargetId = "hero";
          isPageTargetSettled = false;
          settledFrames = 0;
          document.documentElement.dataset.homeReveal = "ready";
          // Animate to whatever title is now in view (e.g. the user scrolled to
          // Work during the intro) instead of teleporting onto it.
          retargetToPageTitle();
        } else if (state === "page-ready") {
          lockCurrentPageTarget();
          settledFrames = 0;
        }
      }

      draw();

      const needsStateTransition =
        (state === "forming-domain" || state === "forming-hero") &&
        settledFrames <= 12;
      const needsPageLock =
        state === "page-ready" && !isPageTargetSettled && settledFrames <= 12;

      if (
        state !== "domain-settled" &&
        (needsStateTransition ||
          needsPageLock ||
          hasLifecycleMotion ||
          settledRatio < 1)
      ) {
        scheduleTick();
      }
    }

    resize();
    scheduleTick();

    window.addEventListener("resize", resize);
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("particle-theme-change", handleThemeChange);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(heroMorphTimer);
      morphStepTimers.forEach((timer) => window.clearTimeout(timer));
      delete document.documentElement.dataset.homeReveal;
      delete document.documentElement.dataset.particlePage;
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("particle-theme-change", handleThemeChange);
      particleRenderer.dispose();
    };
  }, [heroText, introText, morphSteps]);

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
