import type { ConstellationDefinition } from "./types";

export const LIBRA: ConstellationDefinition = {
  id: "libra",
  name: "Libra",
  stars: [
    { id: "brachium", x: 0.3969, y: 0.7348 },
    { id: "zubenelgenubi", x: 0.2697, y: 0.3543 },
    { id: "zubeneschamali", x: 0.5216, y: 0.08 },
    { id: "zubenelhakrabi", x: 0.7001, y: 0.3027 },
    { id: "upsilon", x: 0.7146, y: 0.8523 },
    { id: "tau", x: 0.7303, y: 0.92 },
  ],
  lines: [
    ["brachium", "zubenelgenubi"],
    ["zubenelgenubi", "zubeneschamali"],
    ["zubeneschamali", "zubenelhakrabi"],
    ["zubenelhakrabi", "upsilon"],
    ["upsilon", "tau"],
    ["zubenelgenubi", "zubenelhakrabi"],
  ],
};
