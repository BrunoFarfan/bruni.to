export type ConstellationDefinition = {
  id: string;
  name: string;
  stars: Array<{ id: string; x: number; y: number }>;
  lines: Array<[string, string]>;
};
