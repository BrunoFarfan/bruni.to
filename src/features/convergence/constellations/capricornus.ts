import type { ConstellationDefinition } from "./types";

export const CAPRICORNUS: ConstellationDefinition = {
  id: "capricornus",
  name: "Capricornus",
  stars: [
    { id: "prima-giedi", x: 0.08, y: 0.2141 },
    { id: "dabih", x: 0.1116, y: 0.3043 },
    { id: "rho", x: 0.1854, y: 0.4246 },
    { id: "wei", x: 0.3473, y: 0.7205 },
    { id: "omega", x: 0.4011, y: 0.7859 },
    { id: "yen", x: 0.7286, y: 0.607 },
    { id: "deneb-algedi", x: 0.92, y: 0.3577 },
    { id: "nashira", x: 0.8547, y: 0.3789 },
    { id: "iota", x: 0.687, y: 0.3858 },
    { id: "theta", x: 0.5339, y: 0.4016 },
  ],
  lines: [
    ["prima-giedi", "dabih"],
    ["dabih", "rho"],
    ["rho", "wei"],
    ["wei", "omega"],
    ["omega", "yen"],
    ["yen", "deneb-algedi"],
    ["deneb-algedi", "nashira"],
    ["nashira", "iota"],
    ["iota", "theta"],
    ["theta", "prima-giedi"],
  ],
};
