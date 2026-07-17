import type { ConstellationDefinition } from "./types";

export const LEO: ConstellationDefinition = {
  id: "leo",
  name: "Leo",
  stars: [
    { id: "regulus", x: 0.2335, y: 0.7026 },
    { id: "al-jabhah", x: 0.2265, y: 0.5642 },
    { id: "algieba", x: 0.3126, y: 0.4753 },
    { id: "zosma", x: 0.6817, y: 0.4556 },
    { id: "denebola", x: 0.92, y: 0.6274 },
    { id: "chertan", x: 0.6826, y: 0.6027 },
    { id: "adhafera", x: 0.2903, y: 0.3721 },
    { id: "rasalas", x: 0.1271, y: 0.2974 },
    { id: "algenubi", x: 0.08, y: 0.3618 },
  ],
  lines: [
    ["regulus", "al-jabhah"],
    ["al-jabhah", "algieba"],
    ["algieba", "zosma"],
    ["zosma", "denebola"],
    ["denebola", "chertan"],
    ["chertan", "regulus"],
    ["algieba", "adhafera"],
    ["adhafera", "rasalas"],
    ["rasalas", "algenubi"],
  ],
};
