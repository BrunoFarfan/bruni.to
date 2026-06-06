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

type InteractionHintPattern = "sweep" | "orbit";

const SETTLE_DISTANCE = 0.75;
const SETTLE_SPEED = 0.08;
const POINTER_REPULSION_RADIUS = 86;
const POINTER_REPULSION_FORCE = 3.8;
// Wall-clock pacing keeps hover interaction from blocking the loading sequence.
const HERO_MORPH_DELAY = 2750;
// Total time spent stepping through the morph sequence.
const MORPH_SEQUENCE_DURATION = 1000;
const PAGE_REVEAL_DELAY = MORPH_SEQUENCE_DURATION + 500;
const PARTICLE_INTERACTION_HINT_INITIAL_DELAY = 3000;
const PARTICLE_INTERACTION_HINT_FOLLOWUP_DELAY = 3000;
const PARTICLE_INTERACTION_SWEEP_DURATION = 1150;
const PARTICLE_INTERACTION_ORBIT_DURATION = 1900;

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
    let pageRevealTimer = 0;
    let interactionHintTimer = 0;
    let morphStepTimers: number[] = [];
    let settledFrames = 0;
    let hasStartedIntroAnimation = false;
    const pointer = {
      active: false,
      clientX: 0,
      clientY: 0,
      isContact: false,
      pointerId: null as number | null,
      touchId: null as number | null,
      x: 0,
      y: 0,
    };
    const interactionHint = {
      active: false,
      canceled: false,
      centerX: 0,
      centerY: 0,
      endX: 0,
      nextPattern: "sweep" as InteractionHintPattern | null,
      pattern: "sweep" as InteractionHintPattern,
      radius: 0,
      startX: 0,
      startedAt: 0,
      x: 0,
      y: 0,
    };
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
      const heroOffsetY =
        target.id === "hero" && target.variant === "hero" && width > 560
          ? Math.min(34, Math.max(22, height * 0.032))
          : 0;

      return offsetTargets(
        getLocalTargetsForElement(target),
        rect.left + scroll.x,
        rect.top + scroll.y + heroOffsetY,
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
      stopInteractionHint();

      if (!force) {
        moveOffscreenParticlesToViewportEdges();
      }

      reconcileParticlesToTargets(particles, nextTargets, {
        force,
        shuffle: true,
      });

      if (force) {
        isPageTargetSettled = true;
        scheduleInteractionHint();
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
      scheduleInteractionHint();
    }

    function clearInteractionHintTimer() {
      if (interactionHintTimer === 0) {
        return;
      }

      window.clearTimeout(interactionHintTimer);
      interactionHintTimer = 0;
    }

    function stopInteractionHint() {
      const wasActive = interactionHint.active;

      interactionHint.active = false;
      clearInteractionHintTimer();

      if (wasActive) {
        scheduleTick();
      }
    }

    function cancelInteractionHint() {
      interactionHint.canceled = true;
      interactionHint.nextPattern = null;
      stopInteractionHint();
    }

    function getInteractionHintDelay(pattern: InteractionHintPattern) {
      return pattern === "sweep"
        ? PARTICLE_INTERACTION_HINT_INITIAL_DELAY
        : PARTICLE_INTERACTION_HINT_FOLLOWUP_DELAY;
    }

    function getInteractionHintDuration(pattern: InteractionHintPattern) {
      return pattern === "sweep"
        ? PARTICLE_INTERACTION_SWEEP_DURATION
        : PARTICLE_INTERACTION_ORBIT_DURATION;
    }

    function getRepulsionRadius() {
      return width < 520
        ? POINTER_REPULSION_RADIUS * 0.72
        : POINTER_REPULSION_RADIUS;
    }

    function getActiveParticleTargetBounds() {
      let left = Number.POSITIVE_INFINITY;
      let top = Number.POSITIVE_INFINITY;
      let right = Number.NEGATIVE_INFINITY;
      let bottom = Number.NEGATIVE_INFINITY;

      for (const particle of particles) {
        if (particle.mode === "retiring") {
          continue;
        }

        left = Math.min(left, particle.tx);
        top = Math.min(top, particle.ty);
        right = Math.max(right, particle.tx);
        bottom = Math.max(bottom, particle.ty);
      }

      if (
        !Number.isFinite(left) ||
        !Number.isFinite(top) ||
        !Number.isFinite(right) ||
        !Number.isFinite(bottom)
      ) {
        return null;
      }

      return { bottom, left, right, top };
    }

    function isPointNearParticleTargets(x: number, y: number) {
      const bounds = getActiveParticleTargetBounds();

      if (!bounds) {
        return false;
      }

      const radius = getRepulsionRadius();

      return (
        x >= bounds.left - radius &&
        x <= bounds.right + radius &&
        y >= bounds.top - radius &&
        y <= bounds.bottom + radius
      );
    }

    function cancelInteractionHintIfPointerIsNearParticles() {
      if (!pointer.active || !isPointNearParticleTargets(pointer.x, pointer.y)) {
        return;
      }

      cancelInteractionHint();
    }

    function startInteractionHint() {
      interactionHintTimer = 0;

      if (
        interactionHint.active ||
        interactionHint.canceled ||
        !interactionHint.nextPattern ||
        state !== "page-ready" ||
        !isPageTargetSettled
      ) {
        return;
      }

      const bounds = getActiveParticleTargetBounds();

      if (!bounds) {
        return;
      }

      const padding = width < 520 ? 34 : 46;
      const textWidth = Math.max(1, bounds.right - bounds.left);
      const pattern = interactionHint.nextPattern;

      interactionHint.active = true;
      interactionHint.pattern = pattern;
      interactionHint.startedAt = window.performance.now();

      if (pattern === "sweep") {
        interactionHint.startX = bounds.left - padding;
        interactionHint.endX = bounds.right + padding;
        interactionHint.x = interactionHint.startX;
        interactionHint.y = (bounds.top + bounds.bottom) / 2;
      } else {
        interactionHint.radius = textWidth / 2;
        interactionHint.centerX = (bounds.left + bounds.right) / 2;
        interactionHint.centerY = bounds.top + interactionHint.radius;
        interactionHint.x = interactionHint.centerX - interactionHint.radius;
        interactionHint.y = interactionHint.centerY;
      }

      scheduleTick();
    }

    function scheduleInteractionHint() {
      if (
        interactionHintTimer !== 0 ||
        interactionHint.active ||
        interactionHint.canceled ||
        !interactionHint.nextPattern ||
        state !== "page-ready" ||
        !isPageTargetSettled
      ) {
        return;
      }

      interactionHintTimer = window.setTimeout(
        startInteractionHint,
        getInteractionHintDelay(interactionHint.nextPattern),
      );
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

    function scheduleHeroMorph() {
      if (heroMorphTimer !== 0 || state !== "forming-domain") {
        return;
      }

      heroMorphTimer = window.setTimeout(() => {
        heroMorphTimer = 0;
        startHeroMorph();
      }, HERO_MORPH_DELAY);
    }

    function startHeroMorph() {
      if (state === "forming-hero" || state === "page-ready") {
        return;
      }

      window.clearTimeout(heroMorphTimer);
      heroMorphTimer = 0;
      state = "forming-hero";
      document.documentElement.dataset.homeReveal = "morphing";
      settledFrames = 0;
      window.clearTimeout(pageRevealTimer);
      pageRevealTimer = window.setTimeout(() => {
        pageRevealTimer = 0;
        revealPageContent();
      }, PAGE_REVEAL_DELAY);

      // The first entry of the sequence is already on screen, so step through
      // the rest quickly, spacing the transitions so the whole sequence lands
      // within MORPH_SEQUENCE_DURATION.
      const steps = heroSequence.slice(1);
      const interval = MORPH_SEQUENCE_DURATION / Math.max(1, steps.length);

      steps.forEach((text, index) => {
        const timer = window.setTimeout(
          () => {
            const targets = getHeroTargetsForText(text);

            if (targets.length === 0) {
              return;
            }

            reconcileParticlesToTargets(particles, targets, { shuffle: true });
            scheduleTick();
          },
          Math.round(interval * index),
        );

        morphStepTimers.push(timer);
      });

      if (steps.length === 0 && heroTargets.length > 0) {
        reconcileParticlesToTargets(particles, heroTargets, { shuffle: true });
      }

      scheduleTick();
    }

    function revealPageContent() {
      if (state !== "forming-hero") {
        return;
      }

      state = "page-ready";
      activePageTargetId = "hero";
      isPageTargetSettled = false;
      settledFrames = 0;
      document.documentElement.dataset.homeReveal = "ready";
      // Animate to whatever title is now in view (e.g. the user scrolled to
      // Work during the intro) instead of teleporting onto it.
      retargetToPageTitle();
      scheduleTick();
    }

    function handleScroll() {
      stopInteractionHint();
      syncPointerWithScroll();

      if (state === "forming-domain" || state === "domain-settled") {
        startHeroMorph();
      }

      retargetToPageTitle();

      if (state === "page-ready" && isPageTargetSettled) {
        draw();
        scheduleInteractionHint();
      }
    }

    function syncPointerWithScroll() {
      if (!pointer.active) {
        return;
      }

      pointer.x = pointer.clientX + window.scrollX;
      pointer.y = pointer.clientY + window.scrollY;
    }

    function updatePointerPosition(clientX: number, clientY: number) {
      pointer.active = true;
      pointer.clientX = clientX;
      pointer.clientY = clientY;
      syncPointerWithScroll();
      cancelInteractionHintIfPointerIsNearParticles();
      scheduleTick();
    }

    function updatePointerFromEvent(event: PointerEvent) {
      updatePointerPosition(event.clientX, event.clientY);
    }

    function handlePointerDown(event: PointerEvent) {
      if (event.pointerType === "mouse" || event.pointerType === "touch") {
        return;
      }

      pointer.isContact = true;
      pointer.pointerId = event.pointerId;
      pointer.touchId = null;
      updatePointerFromEvent(event);
    }

    function handlePointerMove(event: PointerEvent) {
      if (event.pointerType === "mouse") {
        pointer.isContact = false;
        pointer.pointerId = null;
        pointer.touchId = null;
        updatePointerFromEvent(event);
        return;
      }

      if (event.pointerType === "touch") {
        return;
      }

      if (!pointer.isContact || pointer.pointerId !== event.pointerId) {
        return;
      }

      updatePointerFromEvent(event);
    }

    function clearPointer() {
      if (!pointer.active) {
        return;
      }

      pointer.active = false;
      pointer.isContact = false;
      pointer.pointerId = null;
      pointer.touchId = null;
      scheduleTick();
    }

    function clearContactPointer(event: PointerEvent) {
      if (!pointer.isContact || pointer.pointerId !== event.pointerId) {
        return;
      }

      clearPointer();
    }

    function findTrackedTouch(touches: TouchList) {
      if (pointer.touchId === null) {
        return touches[0] ?? null;
      }

      for (let index = 0; index < touches.length; index += 1) {
        const touch = touches.item(index);

        if (touch?.identifier === pointer.touchId) {
          return touch;
        }
      }

      return null;
    }

    function updatePointerFromTouch(touch: Touch) {
      pointer.isContact = true;
      pointer.pointerId = null;
      pointer.touchId = touch.identifier;
      updatePointerPosition(touch.clientX, touch.clientY);
    }

    function handleTouchStart(event: TouchEvent) {
      const touch = findTrackedTouch(event.touches);

      if (!touch) {
        return;
      }

      updatePointerFromTouch(touch);
    }

    function handleTouchMove(event: TouchEvent) {
      const touch = findTrackedTouch(event.touches);

      if (!touch) {
        clearPointer();
        return;
      }

      updatePointerFromTouch(touch);
    }

    function clearTouchPointer(event: TouchEvent) {
      if (pointer.touchId === null) {
        return;
      }

      const touch = findTrackedTouch(event.touches);

      if (touch) {
        updatePointerFromTouch(touch);
        return;
      }

      clearPointer();
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
      if (hasStartedIntroAnimation) {
        stopInteractionHint();
      }

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

      if (!hasStartedIntroAnimation) {
        hasStartedIntroAnimation = true;
        scheduleHeroMorph();
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
      let hasPointerMotion = false;
      const spring = state === "forming-domain" ? 0.014 : 0.018;
      const damping = state === "forming-domain" ? 0.878 : 0.865;
      const repulsionRadius = getRepulsionRadius();
      let repulsionPointer: { active: boolean; x: number; y: number } = pointer;

      if (interactionHint.active) {
        const progress = Math.min(
          1,
          (window.performance.now() - interactionHint.startedAt) /
            getInteractionHintDuration(interactionHint.pattern),
        );
        const easedProgress = 0.5 - Math.cos(progress * Math.PI) / 2;

        if (interactionHint.pattern === "sweep") {
          interactionHint.x =
            interactionHint.startX +
            (interactionHint.endX - interactionHint.startX) * easedProgress;
        } else {
          const angle = Math.PI - Math.PI * 2 * easedProgress;

          interactionHint.x =
            interactionHint.centerX + Math.cos(angle) * interactionHint.radius;
          interactionHint.y =
            interactionHint.centerY + Math.sin(angle) * interactionHint.radius;
        }

        if (progress >= 1) {
          interactionHint.nextPattern =
            interactionHint.pattern === "sweep" ? "orbit" : null;
          interactionHint.active = false;
          scheduleInteractionHint();
        } else {
          repulsionPointer = interactionHint;
        }
      }

      for (const particle of particles) {
        const dx = particle.tx - particle.x;
        const dy = particle.ty - particle.y;
        let nextVx = particle.vx + dx * spring;
        let nextVy = particle.vy + dy * spring;
        let wasRepelled = false;

        if (repulsionPointer.active && particle.mode !== "retiring") {
          const pointerDx = particle.x - repulsionPointer.x;
          const pointerDy = particle.y - repulsionPointer.y;
          const pointerDistance = Math.hypot(pointerDx, pointerDy);

          if (pointerDistance > 0.001 && pointerDistance < repulsionRadius) {
            const falloff = 1 - pointerDistance / repulsionRadius;
            const force = falloff * falloff * POINTER_REPULSION_FORCE;

            nextVx += (pointerDx / pointerDistance) * force;
            nextVy += (pointerDy / pointerDistance) * force;
            wasRepelled = true;
            hasPointerMotion = true;
          }
        }

        particle.vx = nextVx * damping;
        particle.vy = nextVy * damping;
        particle.x += particle.vx;
        particle.y += particle.vy;

        const distance = Math.hypot(
          particle.tx - particle.x,
          particle.ty - particle.y,
        );
        const speed = Math.hypot(particle.vx, particle.vy);
        const isSettled =
          !wasRepelled && distance < SETTLE_DISTANCE && speed < SETTLE_SPEED;

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
      const needsPointerReturn =
        state === "domain-settled" && (hasPointerMotion || settledRatio < 1);
      const needsInteractionHint = interactionHint.active;

      if (
        needsPointerReturn ||
        (state !== "domain-settled" &&
          (needsStateTransition ||
            needsPageLock ||
            needsInteractionHint ||
            hasLifecycleMotion ||
            hasPointerMotion ||
            settledRatio < 1))
      ) {
        scheduleTick();
      }
    }

    resize();
    scheduleTick();

    window.addEventListener("resize", resize);
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("pointerdown", handlePointerDown, {
      passive: true,
    });
    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    window.addEventListener("pointerup", clearContactPointer);
    window.addEventListener("pointercancel", clearContactPointer);
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("touchend", clearTouchPointer);
    window.addEventListener("touchcancel", clearTouchPointer);
    window.addEventListener("pointerleave", clearPointer);
    window.addEventListener("blur", clearPointer);
    window.addEventListener("particle-theme-change", handleThemeChange);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(heroMorphTimer);
      window.clearTimeout(pageRevealTimer);
      window.clearTimeout(interactionHintTimer);
      morphStepTimers.forEach((timer) => window.clearTimeout(timer));
      delete document.documentElement.dataset.homeReveal;
      delete document.documentElement.dataset.particlePage;
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", clearContactPointer);
      window.removeEventListener("pointercancel", clearContactPointer);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", clearTouchPointer);
      window.removeEventListener("touchcancel", clearTouchPointer);
      window.removeEventListener("pointerleave", clearPointer);
      window.removeEventListener("blur", clearPointer);
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
