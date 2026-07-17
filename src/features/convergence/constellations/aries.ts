import type { ConstellationDefinition } from "./types";

export const ARIES: ConstellationDefinition = {
  id: "aries",
  name: "Aries",
  stars: [
    { id: "bharani", x: 0.92, y: 0.243 },
    { id: "hamal", x: 0.283, y: 0.4881 },
    { id: "sheratan", x: 0.0965, y: 0.6593 },
    { id: "mesarthim", x: 0.08, y: 0.757 },
  ],
  lines: [
    ["bharani", "hamal"],
    ["hamal", "sheratan"],
    ["sheratan", "mesarthim"],
  ],
};
