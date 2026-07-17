# Convergence

## Experience brief

Convergence is a short, polished strategy minigame connected to
[bruni.to](https://bruni.to). It appears as a final experiment at the end of the
portfolio and opens on a dedicated game page.

The game should demonstrate personality, interaction design, and visual polish
without overshadowing the professional portfolio. It is one complete match,
lasting approximately two or three minutes—not the beginning of a campaign or
an unfinished commercial game.

The mechanical foundation is inspired by the immediate territorial strategy of
State.io. Its atmosphere draws loosely from Stellaris: an astronomical map,
signals expanding through space, and a restrained sense of cosmic scale. It
does not inherit Stellaris's menus, lore, diplomacy, research, or complexity.

## Core fantasy

The player controls a luminous signal propagating through neighboring zodiac
constellations. Stars act as territories, and particles represent the strength
of the signal occupying or attacking them.

Every star has the same inherent production potential. There are no capitals,
special stars, hidden bonuses, upgrades, or objectively superior territory.
Strategic value emerges only from position, ownership, distance, and timing.

## Match shape

- A match contains two, three, or four symmetric signals.
- Three signals are the default because they create less predictable growth
  than a mirrored duel while remaining visually readable.
- One signal belongs to the visitor; the others are computer-controlled.
- Each signal begins with one owned seed star in a different starting region.
- All other stars begin neutral, including the stars near each seed.
- Every signal follows exactly the same production, movement, and capture
  rules.
- Signals receive no special powers, hidden advantages, or production bonuses.
- The match ends immediately when the visitor is eliminated, or when the
  visitor is the only signal left.
- A signal is eliminated only when it owns no stars and has no particles still
  in flight. This exact rule applies equally to the visitor and opponents. A
  final transfer may therefore keep a signal alive by capturing a star.

The game has no progression system, currency, upgrades, unlocks, avatars,
research, diplomacy, level selection, extensive lore, or monetization-style UI.
A replay may use another generated board, but the experience should feel
complete after one match.

## Stars and production

Controlled stars continuously generate particles at one constant rate for the
entire match. Every controlled star has a maximum capacity of 50 particles:
production stops at 50 and no arrival can raise its stored strength above 50.

Neutral stars follow a special rule:

- Every neutral star begins with exactly 10 particles.
- A neutral star produces at the same rate as a controlled star.
- Neutral production stops at 10 particles.
- An unsuccessful attack with fewer than 10 particles temporarily weakens a
  neutral star, after which it regenerates toward 10.
- A star left at exactly zero with no surviving claimant becomes neutral and
  begins producing toward 10.

Every star displays its exact current strength. Production rates are not shown;
their consistency should make them learnable through play.

## Movement

Any owned star can target any other star. Movement is not restricted by
constellation lines, adjacency, or faction boundaries.

Distance is a soft strategic constraint:

- Nearby transfers arrive relatively quickly.
- Long-distance transfers remain possible but take more time.
- Stars within one constellation are generally closer together.
- Transfers between constellations remain fully available but stay exposed in
  flight for longer.

This preserves freedom of movement while making the spatial composition
strategically meaningful.

## Primary interaction

The defining interaction is a continuous drag gesture that combines multiple
source stars into one action:

1. The player begins dragging across the board.
2. Every owned star crossed by the gesture becomes selected.
3. A single selected source is valid; crossing additional sources extends the
   same interaction naturally.
4. Crossing an already selected source again does not deselect it.
5. The player continues dragging toward a destination.
6. Releasing over a friendly, neutral, or rival star commits the transfer.
7. The game predicts the target's state when the selected transfers should
   arrive and sends no more than the amount that can produce a strength of 50.
8. The capped amount is distributed proportionally across the selected source
   stars. Every source still keeps at least one particle, and any particles not
   needed remain at their source.
9. Releasing over empty space cancels the action without punishment or an
   intrusive message.

Dropping on a friendly star reinforces it. Dropping on a neutral or rival star
attempts to capture it. The interaction should work identically in spirit with
a mouse or a finger.

### Drag feedback

During a drag:

- Selection is communicated by the outgoing intent arrow rather than an extra
  ring around each source star.
- A wide, translucent temporary arrow extends from each source toward the
  pointer or finger.
- The arrows move continuously with the gesture.
- Over a valid target, the arrows converge on its center.
- The target subtly confirms that it will receive the action.
- The target previews the actual capped number of particles about to be sent.

The prediction accounts for constant production and already-visible incoming
transfers. It remains a release-time estimate rather than a guaranteed combat
result because opponents may commit new transfers afterward.

On release, the arrows fade and one compact, faction-colored particle group
leaves each source. The group displays up to 10 particles in a circular cluster
as though held together by gravity. Larger logical batches retain their full
strength while using the same visual cap, preventing oversized blobs. It
travels as one bulk transfer rather than a long emission tail. Arrows represent
intent; moving particle groups represent committed actions.

## Combat and capture

Transfers resolve as compact bulk packets, strictly in packet arrival order:

- A packet arriving at a star held by the same signal reinforces it up to the
  50-particle capacity.
- A hostile packet subtracts its strength one-for-one from the current force.
- If both strengths are equal, the star is left neutral at zero.
- If the packet is larger, its surviving strength captures the star.
- Later packets resolve against whichever signal holds the star at that moment.
- Arrival resolution always enforces the 50-particle capacity as a final safety
  invariant, even when the board changes after a transfer was dispatched.

Travel time therefore matters even when two signals dispatch equal forces. An
earlier packet may capture a star, begin producing, and defend against the later
packet. There is no deferred comparison of all dispatched forces: the visible
packet arrival sequence is the battle.

Packets with exactly identical arrival timestamps require a deterministic,
faction-neutral ordering rule. The exact tie-breaking mechanism is an
implementation detail, but it must never privilege the human or a particular
opponent.

## Constellations and board composition

Boards are assembled from recognizable representations of:

- Aries
- Taurus
- Gemini
- Cancer
- Leo
- Virgo
- Libra
- Scorpius
- Sagittarius
- Capricornus
- Aquarius
- Pisces
- Ophiuchus

Each constellation may appear at most once on a board. Its recognizable shape
and conventional internal connections should be preserved, although the whole
shape may be rotated, scaled, and positioned to produce a balanced composition.
Every figure is stored independently in normalized unit-square coordinates,
with its celestial aspect ratio preserved so board placement can transform it
without rebuilding or distorting its defining geometry.

Constellations are visual and spatial groupings, not permanent faction
territories. Thin, straight, faint lines connect stars inside each
constellation. These lines make the astronomical shapes recognizable and help
communicate local proximity, but they do not restrict movement. There are no
permanent lines between separate constellations.

Boards are generated from these constellation building blocks. Starting
regions may contain different numbers of constellations: one large
constellation can be balanced by two or more smaller constellations placed near
another seed. These regions describe comparable opening access only; their
neutral stars do not initially belong to the nearby player.

### Initial fairness rule

Generation may be random, but clearly uneven arrangements should be rejected
and regenerated. The first version only needs to compare three properties
around each seed:

- The number of neutral stars reachable within a common travel-time radius.
- The average travel time to those stars.
- The total neutral strength required to capture them.

These values should be reasonably close across starting regions. Equal star
counts alone are insufficient because tightly grouped stars are easier to reach
and defend than widely dispersed ones.

An initial density target is approximately 24 to 36 stars across a three-signal
board, with roughly 30 as the center. This is a starting point for readability
testing rather than a permanent rule.

## Computer-controlled signals

The initial opponent should use a simple, reactive, understandable strategy. It
periodically evaluates a small set of actions in this order:

1. Reinforce a threatened owned star when help can arrive before capture.
2. Capture an affordable neutral star, favoring short travel and a safe
   expected surplus.
3. Capture a vulnerable rival star when the arriving force should clearly
   exceed its expected defense.
4. Reinforce a weak frontier star when no immediate capture is attractive.
5. Wait and accumulate when every available transfer would be wasteful.

The opponent must:

- Use only information visible to the player.
- Account for particles already in flight.
- Follow the same send-all-but-one transfer rule.
- Evaluate every rival identically rather than targeting the human.
- React after a small, slightly variable delay.
- Prefer actions with a safety margin instead of frame-perfect victories.
- Vary its choice slightly among similarly valuable actions so multiple
  opponents do not behave in lockstep.
- Never coordinate secretly with another opponent.
- Never alter production, movement speed, capture math, or any other rule.

This is deliberately a starting behavior, not a final difficulty model.
Thresholds, timing, and priorities can be tuned after observing real matches.

## Opening tutorial

The drag interaction is taught inside the opening rather than through a
separate tutorial or modal:

1. The player's seed begins producing.
2. One nearby neutral star is softly suggested.
3. A short drag trace demonstrates source-to-target movement.
4. The prominent top-screen prompt fades away as soon as the player performs
   the action.
5. After the first capture, the first prompt fades out and a second prompt
   fades in to demonstrate crossing multiple owned stars before choosing one
   destination.

The same gesture is therefore learned first with one source and then extended
to the game's signature converging transfer. Completion is remembered locally,
so returning players and replayed matches do not repeat the tutorial.

## Visual direction

The presentation should be minimal, calm, and strategic:

- The same light and dark background colors as the portfolio, controlled by
  the portfolio's corner theme switcher.
- Large areas of negative space.
- Animated luminous star artwork with strong faction tinting and no additional
  enclosing node border.
- Exact but restrained strength numbers.
- Thin, understated constellation lines.
- Soft faction-colored influence fields around controlled stars.
- Organically merged influence fields around nearby stars with shared
  ownership.
- Faction-colored particle streams using the landing page's consistent-opacity
  circular particle aesthetic, without rotating during travel.
- Subtle background particles that never compete with gameplay.

The player's signal uses the portfolio's blue-violet accent. Opponents use
clearly distinguishable amber, teal, coral, or similarly restrained colors.
Colors must remain unmistakable during play; subtle aesthetics should refine
the palette, not compromise identification.

Ownership also receives a consistent secondary cue, such as a ring or shape
treatment, so it never depends on color alone.

Avoid excessive glow, detailed planets, spaceships, explosions, large HUD
panels, rigid territorial borders, and mobile-game visual clutter. Influence
fields are atmospheric ownership cues, not movement boundaries or additional
territory rules.

The intended hierarchy is:

1. Selection and targeting feedback.
2. Active particle movement.
3. Controlled stars and influence fields.
4. Neutral stars.
5. Constellation shapes and lines.
6. Decorative background particles.

Constellation lines, selection arrows, and committed streams must remain
visually distinct:

- Constellation lines are straight, faint, and permanent.
- Selection arrows are curved, wide, translucent, solid, and temporary.
- Committed transfers are compact, animated, faction-colored circular groups
  showing one visible particle per transmitted unit up to a cap of 10.

## Portfolio integration

The portfolio invitation may read:

> A final experiment
>
> Compete for control of a living zodiac.
>
> Convergence is a short strategy game built from the particles of this
> website.
>
> Play Convergence →

The dedicated game page preserves the portfolio's typography and visual
identity while giving most of the screen to the board. A small route back to
the portfolio remains available at all times. Regular portfolio navigation and
the footer should not compete with the game.

## Desired emotional tone

Convergence should feel clean, strategic, calm, deliberate, fair, immediately
legible, and visually satisfying when several streams meet.

It should not feel frantic, militaristic, heavily gamified, or visually noisy.
Its preferred rhythm is to act, watch the consequences unfold, reconsider, and
act again—not to drag continuously as quickly as possible.

## Purpose of the next phase

This document defines the intended experience and current product decisions. A
separate technical assessment can now examine the existing portfolio codebase
and explore how to realize the experience without silently changing these
rules or expanding its scope.

The main variables expected to evolve through prototyping are tuning variables,
not missing product systems:

- Overall board density.
- Production and movement speeds.
- Opponent reaction cadence and scoring thresholds.
- Procedural-board fairness tolerances.
- Visual intensity and readability under several simultaneous streams.
- Match duration and the amount of endgame cleanup produced by elimination.
