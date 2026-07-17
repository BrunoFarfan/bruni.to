import type { ConstellationDefinition } from "./types";

export const TAURUS: ConstellationDefinition = {
  id: "taurus",
  name: "Taurus",
  stars: [
    { id: "tianguan", x: 0.92, y: 0.3267 },
    { id: "aldebaran", x: 0.5297, y: 0.4477 },
    { id: "chamukuy", x: 0.4838, y: 0.4643 },
    { id: "prima-hyadum", x: 0.4277, y: 0.4707 },
    { id: "secunda-hyadum", x: 0.4475, y: 0.4207 },
    { id: "ain", x: 0.4835, y: 0.3779 },
    { id: "elnath", x: 0.8482, y: 0.1318 },
    { id: "lambda", x: 0.3068, y: 0.5526 },
    { id: "xi", x: 0.0949, y: 0.6246 },
    { id: "nu", x: 0.3225, y: 0.7223 },
    { id: "omicron", x: 0.08, y: 0.643 },
    { id: "ten-tauri", x: 0.1563, y: 0.8682 },
  ],
  lines: [
    ["tianguan", "aldebaran"],
    ["aldebaran", "chamukuy"],
    ["chamukuy", "prima-hyadum"],
    ["prima-hyadum", "secunda-hyadum"],
    ["secunda-hyadum", "ain"],
    ["ain", "elnath"],
    ["prima-hyadum", "lambda"],
    ["lambda", "xi"],
    ["xi", "nu"],
    ["xi", "omicron"],
    ["omicron", "ten-tauri"],
  ],
};
