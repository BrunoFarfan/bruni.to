# Convergence — Milestone 1

## Outcome

The first playable vertical slice of Convergence is available at
`/convergence`.

This milestone establishes the complete match loop on one fixed board. It is
deliberately a small foundation: the rules, interaction, rendering, responsive
composition, and initial opponents are present without introducing procedural
generation, a general game framework, or additional dependencies.

## Implemented experience

- A dedicated immersive game route without the portfolio footer, while keeping
  the portfolio's corner theme control and light/dark background tokens.
- A dedicated Convergence ring favicon without a competing visible page title.
- A full-screen Canvas 2D board with restrained portfolio-aligned typography,
  color, glow, background particles, constellation lines, and ownership fields.
- Three signals: the human blue-violet signal and amber and teal opponents.
- Every signal begins with 10 particles on its seed star.
- A fixed board built from recognizable Leo, Aquarius, and Sagittarius
  asterisms.
- A complete reusable asset library for Aries, Taurus, Gemini, Cancer, Leo,
  Virgo, Libra, Scorpius, Sagittarius, Capricornus, Aquarius, Pisces, and
  Ophiuchus. Each definition has normalized coordinates and conventional line
  connections in its own file.
- Separate landscape and portrait board compositions selected from the canvas
  aspect ratio when a match starts.
- Screen-space-aware node sizes and a minimum gesture hit area on small screens.
- Exact strength numbers on every star.
- Neutral stars that begin at 10 and regenerate toward a cap of 10.
- Controlled stars with continuous production up to a capacity of 50.
- A deliberately calm production rate of one particle every two seconds.
- Distance-based transfer travel time.
- Predictively capped transfers: the target is projected through production and
  already-visible arrivals, then only the amount needed to reach at most 50 is
  distributed proportionally across the selected sources. Unused strength
  remains at those sources, which always keep at least one particle.
- Compact bulk-transfer visuals displaying up to 10 particles per logical
  packet regardless of its larger strength.
- One-for-one bulk combat on arrival, including neutral zero-strength ties,
  capture with surviving strength, reinforcement, deterministic arrival
  ordering, and a hard 50-particle arrival cap.
- Elimination only when a signal owns no stars and has no transfer in flight.
- Immediate match completion when the human is eliminated, using the same
  alive-state predicate used for opponents.
- A minimal result overlay with floating back and replay buttons plus a subtle
  signal-state cue.
- Animated star artwork with strong violet, amber, or teal tinting for owned
  stars and a quieter grayscale treatment for neutral stars.
- Constellation geometry without visible constellation names.

## Interaction

The canvas uses Pointer Events so the same gesture works with a mouse, stylus,
or touch:

1. Press and begin dragging anywhere on the board.
2. Cross one or more owned stars to select them.
3. Continue to a friendly, neutral, or rival destination.
4. Release to send one compact particle group from every selected source.
5. Release over empty space to cancel safely.

Crossing an already selected source is idempotent. Wide, translucent, curved
intent arrows converge on a valid target, and the target previews the total
strength that will be committed. The arrow itself communicates source
selection, so no additional outer selection ring is drawn around source stars.

An owned star under the release point is treated as the destination rather
than another outgoing source, allowing reinforcement with the same gesture.
If ownership of a selected source changes during a drag, that source is removed
from the selection while every still-owned source remains eligible to send.

The opening tutorial is integrated into play:

- The first prompt teaches a single-source transfer.
- After the first capture, the second prompt teaches a multi-source sweep.
- Completing the multi-source gesture dismisses the tutorial.
- Completion is stored in `localStorage`, so later matches omit the tutorial.

## Opponents

The initial opponents use one small reactive utility function. At a modest,
variable cadence they:

1. Reinforce an owned star threatened by visible incoming particle groups.
2. Prefer affordable nearby neutral stars.
3. Attack a rival star when they can send a safe surplus.
4. Wait when no candidate is worthwhile.

They read only public match state, use the same transfer function as the human,
evaluate all rivals identically, and receive no rule or production advantage.
Their opening actions are delayed and later decisions are spaced apart to
preserve the intended calm rhythm.

## Code organization

```text
src/
├── pages/
│   └── convergence.astro
└── features/
    └── convergence/
        ├── ConvergenceGame.tsx
        ├── constellations/
        │   ├── index.ts
        │   ├── types.ts
        │   └── one normalized file per constellation
        ├── convergence.css
        ├── draw.ts
        ├── game.ts
        ├── opponent.ts
        └── streamRenderer.ts
```

- `ConvergenceGame.tsx` owns the React lifecycle, fixed-step loop, resize
  handling, pointer gesture, tutorial state, and overlays.
- `constellations/` contains all 13 independently normalized constellation
  definitions, their shared type, source notes, and retained dataset license.
- `game.ts` contains board creation and all match rules.
- `opponent.ts` chooses an action but cannot apply rules independently.
- `draw.ts` renders the infrequently changing board and temporary interaction
  feedback with Canvas 2D.
- `streamRenderer.ts` batches every visible moving particle into one WebGL draw
  call.
- `convergence.css` styles the immersive shell and HTML overlays.

The live simulation is mutable and remains outside React render state. React is
only updated for UI-level changes such as tutorial progress and match results.

## Rendering rebuild

The initial particle-group implementation drew every moving particle as a
separate Canvas 2D path with its own shadow blur. It also repainted the entire
full-screen board on every animation frame. That approach scaled linearly in
expensive Canvas operations and was replaced.

The rebuilt renderer uses four deliberately narrow layers:

1. A Canvas 2D board layer redraws only when ownership, strength, routes, or
   viewport dimensions change.
2. A WebGL stream layer writes all visible particles into one reusable typed
   buffer and renders them in one GPU draw call.
3. Browser-managed animated GIF elements display star artwork and strength
   without forcing Canvas redraws for animation.
4. A transparent Canvas 2D interaction layer redraws only while the pointer or
   touch gesture changes.

Particle groups remain bulk game-state objects. The renderer derives their
individual visible points without creating one simulation object per particle.
Cluster geometry is cached by group size, GPU buffers grow geometrically and
are reused, the simulation runs at 30 fixed updates per second, and the
animation loop stops after the match result is published. Individual stream
particles reuse the landing page's antialiased circular mask and constant
opacity, display at most 10 points per logical batch, and retain a fixed cluster
orientation while traveling.

## Verification performed

- `just lint`: Prettier and `astro check` complete with zero diagnostics.
- `just build`: the static production build completes and generates
  `/convergence/index.html`.
- After the rendering rebuild, both checks were repeated successfully. A
  bounded incremental renderer check from 25 through 250 particles retained
  stable frame timing without long frames.
- Brave, controlled through Playwright:
  - route and accessible HTML shell load correctly;
  - no browser console errors are produced;
  - single-source dragging commits a transfer;
  - the source retains one particle;
  - a compact circular group displays up to 10 particles;
  - bulk arrival subtracts neutral defense and captures with the surplus;
  - the tutorial advances after capture;
  - its completion flag suppresses the tutorial after reload;
  - animated stars, ownership tinting, and the dedicated favicon load;
  - multi-source crossing and target convergence are functional;
  - portrait layout and touch-sized hit areas are present at a 390 × 844
    viewport.
- An OS-level screenshot of the Brave window was also inspected to confirm the
  actual headed-browser presentation.

## Intentionally deferred

- Procedural constellation selection, placement, and fairness rejection.
- Authored board variations and four-player matches.
- Final influence-field merging and visual polish.
- Sound and audio controls.
- Keyboard gameplay controls.
- Deeper opponent tuning and difficulty options.
- Automated simulation tests and match-balance sampling.

These are follow-up layers. None requires replacing the current constellation,
simulation, opponent, or rendering boundaries.
