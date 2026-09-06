import type { ConstellationDefinition } from "./types";

export const AQUARIUS: ConstellationDefinition = {
  id: "aquarius",
  name: "Aquarius",
  stars: [
    { id: "albali", x: 0.08, y: 0.4922 },
    { id: "sadalsuud", x: 0.2917, y: 0.4157 },
    { id: "sadalmelik", x: 0.4569, y: 0.3133 },
    { id: "eta", x: 0.5996, y: 0.3093 },
    { id: "hydor", x: 0.6828, y: 0.4548 },
    { id: "psi-two", x: 0.8049, y: 0.4861 },
    { id: "c-two", x: 0.7641, y: 0.7198 },
    { id: "iota", x: 0.46, y: 0.5774 },
    { id: "ancha", x: 0.5102, y: 0.4588 },
    { id: "a-two", x: 0.92, y: 0.6544 },
  ],
  lines: [
    ["albali", "sadalsuud"],
    ["sadalsuud", "sadalmelik"],
    ["sadalmelik", "eta"],
    ["eta", "hydor"],
    ["hydor", "psi-two"],
    ["psi-two", "c-two"],
    ["sadalsuud", "iota"],
    ["sadalmelik", "ancha"],
    ["psi-two", "a-two"],
  ],
};
