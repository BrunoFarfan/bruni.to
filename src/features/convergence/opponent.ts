import {
  getSendableStrength,
  type GameState,
  type PlayerId,
  type Star,
} from "./game";

export type OpponentAction = {
  sourceIds: string[];
  targetId: string;
};

function distance(left: Star, right: Star) {
  return Math.hypot(left.x - right.x, left.y - right.y);
}

function getSourcesForTarget(
  owned: Star[],
  target: Star,
  requiredStrength: number,
) {
  const candidates = owned
    .filter((star) => star.id !== target.id && getSendableStrength(star) >= 3)
    .sort((left, right) => distance(left, target) - distance(right, target));
  const sourceIds: string[] = [];
  let strength = 0;

  for (const source of candidates) {
    sourceIds.push(source.id);
    strength += getSendableStrength(source);

    if (strength >= requiredStrength) {
      return { sourceIds, strength };
    }
  }

  return { sourceIds: [], strength };
}

export function chooseOpponentAction(
  game: GameState,
  player: Exclude<PlayerId, "human">,
  random: () => number,
): OpponentAction | null {
  if (game.result) {
    return null;
  }

  const owned = game.stars.filter((star) => star.owner === player);

  if (owned.length === 0) {
    return null;
  }

  const threatened = owned
    .map((star) => {
      const hostileIncoming = game.streams
        .filter(
          (stream) => stream.targetId === star.id && stream.owner !== player,
        )
        .reduce((total, stream) => total + stream.count, 0);
      return { star, deficit: hostileIncoming - star.strength };
    })
    .filter(({ deficit }) => deficit >= -2)
    .sort((left, right) => right.deficit - left.deficit);

  for (const { star, deficit } of threatened) {
    const support = getSourcesForTarget(owned, star, Math.max(4, deficit + 4));

    if (support.sourceIds.length > 0) {
      return { sourceIds: support.sourceIds, targetId: star.id };
    }
  }

  const candidates = game.stars
    .filter((star) => star.owner !== player)
    .map((target) => {
      const requiredStrength = target.strength + (target.owner ? 5 : 3);
      const sources = getSourcesForTarget(owned, target, requiredStrength);
      const nearestDistance = Math.min(
        ...owned.map((source) => distance(source, target)),
      );
      const neutralPreference = target.owner === null ? 120 : 0;
      const surplus = sources.strength - requiredStrength;
      const score = neutralPreference - nearestDistance + surplus * 2;
      return { target, sources, score: score + random() * 24 };
    })
    .filter(({ sources }) => sources.sourceIds.length > 0)
    .sort((left, right) => right.score - left.score);

  const best = candidates[0];

  if (!best || best.score < -520) {
    return null;
  }

  return { sourceIds: best.sources.sourceIds, targetId: best.target.id };
}
