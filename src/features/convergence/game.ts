import type { ConstellationDefinition } from "./constellations";

export const HUMAN_PLAYER = "human";
export const NEUTRAL_CAP = 10;
export const STAR_CAPACITY = 50;

export type BoardOrientation = "landscape" | "portrait";
export type PlayerId = "human" | "amber" | "teal";

export type BoardLine = {
  from: string;
  to: string;
};

export type Star = {
  id: string;
  x: number;
  y: number;
  owner: PlayerId | null;
  strength: number;
  productionProgress: number;
};

export type Stream = {
  id: number;
  owner: PlayerId;
  sourceId: string;
  targetId: string;
  count: number;
  startedAt: number;
  travelTime: number;
};

export type GameResult = {
  outcome: "won" | "lost";
};

export type GameState = {
  time: number;
  boardWidth: number;
  boardHeight: number;
  stars: Star[];
  lines: BoardLine[];
  streams: Stream[];
  nextStreamId: number;
  result: GameResult | null;
};

export type TransferAllocation = {
  sourceId: string;
  count: number;
  travelTime: number;
};

export type TransferPlan = {
  allocations: TransferAllocation[];
  total: number;
};

type Placement = {
  constellation: ConstellationDefinition;
  x: number;
  y: number;
  width: number;
  height: number;
  seedStar: string;
  seedOwner: PlayerId;
};

const PRODUCTION_PER_SECOND = 0.5;
const PARTICLE_SPEED = 175;

function requireConstellation(
  constellations: ConstellationDefinition[],
  id: string,
) {
  const constellation = constellations.find((candidate) => candidate.id === id);

  if (!constellation) {
    throw new Error(`Missing required constellation: ${id}`);
  }

  return constellation;
}

export function createGame(
  constellations: ConstellationDefinition[],
  orientation: BoardOrientation = "landscape",
): GameState {
  const leo = requireConstellation(constellations, "leo");
  const aquarius = requireConstellation(constellations, "aquarius");
  const sagittarius = requireConstellation(constellations, "sagittarius");
  const isPortrait = orientation === "portrait";
  const boardWidth = isPortrait ? 760 : 1200;
  const boardHeight = isPortrait ? 1200 : 760;
  const placements: Placement[] = isPortrait
    ? [
        {
          constellation: leo,
          x: 100,
          y: 105,
          width: 560,
          height: 260,
          seedStar: "regulus",
          seedOwner: "human",
        },
        {
          constellation: aquarius,
          x: 100,
          y: 460,
          width: 560,
          height: 295,
          seedStar: "sadalmelik",
          seedOwner: "teal",
        },
        {
          constellation: sagittarius,
          x: 95,
          y: 845,
          width: 570,
          height: 230,
          seedStar: "ascella",
          seedOwner: "amber",
        },
      ]
    : [
        {
          constellation: leo,
          x: 85,
          y: 110,
          width: 405,
          height: 295,
          seedStar: "regulus",
          seedOwner: "human",
        },
        {
          constellation: aquarius,
          x: 710,
          y: 70,
          width: 390,
          height: 315,
          seedStar: "sadalmelik",
          seedOwner: "teal",
        },
        {
          constellation: sagittarius,
          x: 390,
          y: 445,
          width: 425,
          height: 245,
          seedStar: "ascella",
          seedOwner: "amber",
        },
      ];

  const stars: Star[] = [];
  const lines: BoardLine[] = [];

  for (const placement of placements) {
    const idMap = new Map<string, string>();

    for (const star of placement.constellation.stars) {
      const id = `${placement.constellation.id}:${star.id}`;
      idMap.set(star.id, id);
      const isSeed = star.id === placement.seedStar;
      stars.push({
        id,
        x: placement.x + star.x * placement.width,
        y: placement.y + star.y * placement.height,
        owner: isSeed ? placement.seedOwner : null,
        strength: NEUTRAL_CAP,
        productionProgress: 0,
      });
    }

    for (const [from, to] of placement.constellation.lines) {
      lines.push({ from: idMap.get(from)!, to: idMap.get(to)! });
    }
  }

  return {
    time: 0,
    boardWidth,
    boardHeight,
    stars,
    lines,
    streams: [],
    nextStreamId: 1,
    result: null,
  };
}

export function getStar(game: GameState, id: string) {
  return game.stars.find((star) => star.id === id);
}

export function getSendableStrength(star: Star) {
  return Math.max(0, star.strength - 1);
}

function getStarCapacity(star: Star) {
  return star.owner === null ? NEUTRAL_CAP : STAR_CAPACITY;
}

function advanceStarProduction(star: Star, delta: number) {
  const capacity = getStarCapacity(star);

  if (star.strength >= capacity) {
    const wasOverCapacity = star.strength > capacity;
    star.strength = capacity;
    star.productionProgress = 0;
    return wasOverCapacity;
  }

  star.productionProgress += delta * PRODUCTION_PER_SECOND;
  const produced = Math.floor(star.productionProgress);

  if (produced === 0) {
    return false;
  }

  const previousStrength = star.strength;
  star.strength = Math.min(capacity, star.strength + produced);

  if (star.strength === capacity) {
    star.productionProgress = 0;
  } else {
    star.productionProgress -= produced;
  }

  return star.strength !== previousStrength;
}

function resolveArrival(star: Star, owner: PlayerId, count: number) {
  if (star.owner === owner) {
    star.strength = Math.min(STAR_CAPACITY, star.strength + count);

    if (star.strength === STAR_CAPACITY) {
      star.productionProgress = 0;
    }

    return;
  }

  if (star.strength > count) {
    star.strength -= count;
    return;
  }

  if (star.strength === count) {
    star.owner = null;
    star.strength = 0;
    star.productionProgress = 0;
    return;
  }

  const survivingStrength = count - star.strength;
  star.owner = owner;
  star.strength = Math.min(STAR_CAPACITY, survivingStrength);
  star.productionProgress = 0;
}

function predictStarAt(game: GameState, target: Star, predictionTime: number) {
  const predicted = { ...target };
  let currentTime = game.time;
  const arrivals = game.streams
    .filter(
      (stream) =>
        stream.targetId === target.id &&
        stream.startedAt + stream.travelTime <= predictionTime,
    )
    .map((stream) => ({
      stream,
      arrivalTime: stream.startedAt + stream.travelTime,
    }))
    .sort(
      (left, right) =>
        left.arrivalTime - right.arrivalTime ||
        left.stream.id - right.stream.id,
    );

  for (const arrival of arrivals) {
    advanceStarProduction(
      predicted,
      Math.max(0, arrival.arrivalTime - currentTime),
    );
    resolveArrival(predicted, arrival.stream.owner, arrival.stream.count);
    currentTime = Math.max(currentTime, arrival.arrivalTime);
  }

  advanceStarProduction(predicted, Math.max(0, predictionTime - currentTime));
  return predicted;
}

export function planTransfer(
  game: GameState,
  owner: PlayerId,
  sourceIds: Iterable<string>,
  targetId: string,
): TransferPlan | null {
  if (game.result) {
    return null;
  }

  const target = getStar(game, targetId);

  if (!target) {
    return null;
  }

  const candidates = Array.from(new Set(sourceIds)).flatMap(
    (sourceId, index) => {
      const source = getStar(game, sourceId);

      if (!source || source.id === targetId || source.owner !== owner) {
        return [];
      }

      const available = getSendableStrength(source);

      if (available === 0) {
        return [];
      }

      const distance = Math.hypot(target.x - source.x, target.y - source.y);
      return [
        { source, available, travelTime: distance / PARTICLE_SPEED, index },
      ];
    },
  );

  if (candidates.length === 0) {
    return null;
  }

  const totalAvailable = candidates.reduce(
    (total, candidate) => total + candidate.available,
    0,
  );
  const latestTravelTime = Math.max(
    ...candidates.map((candidate) => candidate.travelTime),
  );
  const predictedTarget = predictStarAt(
    game,
    target,
    game.time + latestTravelTime,
  );
  const usefulStrength =
    predictedTarget.owner === owner
      ? STAR_CAPACITY - predictedTarget.strength
      : predictedTarget.strength + STAR_CAPACITY;
  const total = Math.min(totalAvailable, Math.max(0, usefulStrength));

  if (total === 0) {
    return null;
  }

  const shares = candidates.map((candidate) => {
    const exact = (candidate.available / totalAvailable) * total;
    const count = Math.floor(exact);
    return { candidate, count, remainder: exact - count };
  });
  let unallocated = total - shares.reduce((sum, share) => sum + share.count, 0);

  const remainderOrder = [...shares].sort(
    (left, right) =>
      right.remainder - left.remainder ||
      left.candidate.index - right.candidate.index,
  );

  for (const share of remainderOrder) {
    if (unallocated === 0) {
      break;
    }

    if (share.count < share.candidate.available) {
      share.count += 1;
      unallocated -= 1;
    }
  }

  return {
    allocations: shares
      .filter((share) => share.count > 0)
      .map((share) => ({
        sourceId: share.candidate.source.id,
        count: share.count,
        travelTime: share.candidate.travelTime,
      })),
    total,
  };
}

export function sendParticles(
  game: GameState,
  owner: PlayerId,
  sourceIds: Iterable<string>,
  targetId: string,
) {
  const plan = planTransfer(game, owner, sourceIds, targetId);

  if (!plan) {
    return false;
  }

  for (const allocation of plan.allocations) {
    const source = getStar(game, allocation.sourceId);

    if (!source || source.owner !== owner) {
      continue;
    }

    source.strength -= allocation.count;
    game.streams.push({
      id: game.nextStreamId,
      owner,
      sourceId: source.id,
      targetId,
      count: allocation.count,
      startedAt: game.time,
      travelTime: allocation.travelTime,
    });
    game.nextStreamId += 1;
  }

  return true;
}

export function advanceGame(game: GameState, delta: number) {
  if (game.result) {
    return false;
  }

  let changed = false;
  game.time += delta;

  for (const star of game.stars) {
    if (advanceStarProduction(star, delta)) {
      changed = true;
    }
  }

  const arrivals: Array<{ arrivalTime: number; stream: Stream }> = [];

  for (const stream of game.streams) {
    const arrivalTime = stream.startedAt + stream.travelTime;

    if (arrivalTime <= game.time) {
      arrivals.push({ arrivalTime, stream });
    }
  }

  if (arrivals.length === 0) {
    return changed;
  }

  arrivals.sort(
    (left, right) =>
      left.arrivalTime - right.arrivalTime || left.stream.id - right.stream.id,
  );

  for (const arrival of arrivals) {
    const target = getStar(game, arrival.stream.targetId);

    if (target) {
      resolveArrival(target, arrival.stream.owner, arrival.stream.count);
      changed = true;
    }
  }

  const arrivedStreamIds = new Set(
    arrivals.map((arrival) => arrival.stream.id),
  );
  game.streams = game.streams.filter(
    (stream) => !arrivedStreamIds.has(stream.id),
  );

  const players: PlayerId[] = ["human", "amber", "teal"];
  const alive = players.filter((player) => isPlayerAlive(game, player));

  if (!isPlayerAlive(game, HUMAN_PLAYER)) {
    game.result = { outcome: "lost" };
    changed = true;
  } else if (alive.length === 1) {
    game.result = { outcome: "won" };
    changed = true;
  }

  return changed;
}

export function isPlayerAlive(game: GameState, player: PlayerId) {
  return (
    game.stars.some((star) => star.owner === player) ||
    game.streams.some((stream) => stream.owner === player)
  );
}

export function getStreamProgress(stream: Stream, time: number) {
  return Math.max(
    0,
    Math.min(1, (time - stream.startedAt) / stream.travelTime),
  );
}
