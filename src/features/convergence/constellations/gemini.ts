import type { ConstellationDefinition } from "./types";

export const GEMINI: ConstellationDefinition = {
  id: "gemini",
  name: "Gemini",
  stars: [
    { id: "propus", x: 0.08, y: 0.4954 },
    { id: "tejat", x: 0.1551, y: 0.4951 },
    { id: "mebsuta", x: 0.3499, y: 0.3895 },
    { id: "tau", x: 0.6026, y: 0.1831 },
    { id: "castor", x: 0.8204, y: 0.1168 },
    { id: "pollux", x: 0.92, y: 0.2727 },
    { id: "upsilon", x: 0.8328, y: 0.3183 },
    { id: "wasat", x: 0.686, y: 0.5165 },
    { id: "mekbuda", x: 0.5373, y: 0.5735 },
    { id: "alhena", x: 0.2921, y: 0.7418 },
    { id: "alzirr", x: 0.3625, y: 0.8832 },
    { id: "lambda", x: 0.6671, y: 0.7361 },
  ],
  lines: [
    ["propus", "tejat"],
    ["tejat", "mebsuta"],
    ["mebsuta", "tau"],
    ["tau", "castor"],
    ["castor", "pollux"],
    ["pollux", "upsilon"],
    ["upsilon", "wasat"],
    ["wasat", "mekbuda"],
    ["mekbuda", "alhena"],
    ["alhena", "alzirr"],
    ["wasat", "lambda"],
  ],
};
