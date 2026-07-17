import type { ConstellationDefinition } from "./types";

export const CANCER: ConstellationDefinition = {
  id: "cancer",
  name: "Cancer",
  stars: [
    { id: "acubens", x: 0.7142, y: 0.8054 },
    { id: "asellus-australis", x: 0.5733, y: 0.5352 },
    { id: "asellus-borealis", x: 0.559, y: 0.393 },
    { id: "iota", x: 0.5935, y: 0.08 },
    { id: "tarf", x: 0.2858, y: 0.92 },
  ],
  lines: [
    ["acubens", "asellus-australis"],
    ["asellus-australis", "asellus-borealis"],
    ["asellus-borealis", "iota"],
    ["asellus-australis", "tarf"],
  ],
};
