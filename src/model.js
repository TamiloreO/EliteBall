// Teams are assessed values, not names. Ability is 1-99, but the engine also
// reads the soft inputs: fitness, sharpness, morale and the distraction a
// player carries in from outside the pitch. Every value is either set by hand
// or derived from a stated rumour, never scraped from a real person.

export const PITCH = { length: 105, width: 68 };

export const FORMATIONS = {
  "4-3-3": [
    ["GK", 0.05, 0.5],
    ["DF", 0.24, 0.14], ["DF", 0.22, 0.38], ["DF", 0.22, 0.62], ["DF", 0.24, 0.86],
    ["MF", 0.44, 0.26], ["MF", 0.40, 0.5], ["MF", 0.44, 0.74],
    ["FW", 0.68, 0.16], ["FW", 0.72, 0.5], ["FW", 0.68, 0.84],
  ],
  "4-4-2": [
    ["GK", 0.05, 0.5],
    ["DF", 0.24, 0.14], ["DF", 0.22, 0.38], ["DF", 0.22, 0.62], ["DF", 0.24, 0.86],
    ["MF", 0.46, 0.14], ["MF", 0.42, 0.38], ["MF", 0.42, 0.62], ["MF", 0.46, 0.86],
    ["FW", 0.70, 0.4], ["FW", 0.70, 0.6],
  ],
  "3-5-2": [
    ["GK", 0.05, 0.5],
    ["DF", 0.22, 0.28], ["DF", 0.20, 0.5], ["DF", 0.22, 0.72],
    ["MF", 0.44, 0.1], ["MF", 0.40, 0.32], ["MF", 0.38, 0.5], ["MF", 0.40, 0.68], ["MF", 0.44, 0.9],
    ["FW", 0.70, 0.4], ["FW", 0.70, 0.6],
  ],
};

// Two fictional squads with different styles and different problems.
export const PRESETS = {
  pressers: {
    label: "High press, quick",
    tactics: { lineHeight: 0.72, press: 0.8, width: 0.6, tempo: 0.72 },
    attrs: { pace: 76, passing: 72, dribbling: 74, shooting: 70, pressing: 82, positioning: 70, stamina: 74 },
    condition: { fitness: 0.86, sharpness: 0.78, morale: 0.15, distraction: 0.2 },
    rumours: [],
  },
  blockers: {
    label: "Low block, patient",
    tactics: { lineHeight: 0.3, press: 0.35, width: 0.45, tempo: 0.4 },
    attrs: { pace: 72, passing: 78, dribbling: 70, shooting: 76, pressing: 62, positioning: 80, stamina: 78 },
    condition: { fitness: 0.9, sharpness: 0.82, morale: 0.05, distraction: 0.15 },
    rumours: [],
  },
};

const ROLE_OFFSETS = {
  GK: { shooting: -40, pace: -20, dribbling: -30 },
  DF: { shooting: -20, passing: -4 },
  MF: { shooting: -6 },
  FW: { shooting: 10, pressing: -8 },
};

// Names are invented. A rumour carries a sentiment from -1 to 1 and a weight,
// and the weighted average becomes the distraction the engine uses.
const SQUADS = {
  pressers: [
    { name: "A. Okafor", shirt: 1, rumour: null },
    { name: "B. Lindqvist", shirt: 2, rumour: null },
    { name: "C. Mensah", shirt: 5, rumour: null },
    { name: "D. Ferreira", shirt: 4, rumour: null },
    { name: "E. Novak", shirt: 3, rumour: null },
    { name: "F. Adeyemi", shirt: 6, rumour: null },
    { name: "G. Rossi", shirt: 8, rumour: { text: "linked with a move away", sentiment: -0.5, weight: 0.8 } },
    { name: "H. Tanaka", shirt: 10, rumour: null },
    { name: "I. Petrov", shirt: 7, rumour: { text: "contract talks stalled", sentiment: -0.3, weight: 0.6 } },
    { name: "J. Silva", shirt: 9, rumour: null },
    { name: "K. Andersen", shirt: 11, rumour: null },
  ],
  blockers: [
    { name: "L. Moreau", shirt: 1, rumour: null },
    { name: "M. Haddad", shirt: 2, rumour: null },
    { name: "N. Kowalski", shirt: 6, rumour: null },
    { name: "O. Bassey", shirt: 5, rumour: null },
    { name: "P. Iversen", shirt: 3, rumour: null },
    { name: "Q. Duarte", shirt: 4, rumour: null },
    { name: "R. Nakamura", shirt: 8, rumour: { text: "praised by the manager", sentiment: 0.6, weight: 0.5 } },
    { name: "S. Achterberg", shirt: 10, rumour: null },
    { name: "T. Osei", shirt: 7, rumour: null },
    { name: "U. Vargas", shirt: 9, rumour: null },
    { name: "V. Sokolov", shirt: 11, rumour: null },
  ],
};

export function makeTeam(name, presetKey, formation = "4-3-3") {
  const preset = PRESETS[presetKey];
  const shape = FORMATIONS[formation];
  const squad = SQUADS[presetKey];

  const players = shape.map(([role, fx, fy], index) => {
    const attrs = {};
    for (const [key, value] of Object.entries(preset.attrs)) {
      attrs[key] = clamp(value + (ROLE_OFFSETS[role][key] ?? 0), 20, 99);
    }

    const rumour = squad[index].rumour;
    const baseCondition = preset.condition;
    const distraction = rumour
      ? clamp(baseCondition.distraction + Math.max(0, -rumour.sentiment) * rumour.weight, 0, 1)
      : baseCondition.distraction;

    return {
      id: `${name}-${index + 1}`,
      num: squad[index].shirt ?? index + 1,
      name: squad[index].name,
      role,
      attrs,
      condition: {
        fitness: clamp(baseCondition.fitness + (role === "GK" ? 0.05 : 0), 0, 1),
        sharpness: baseCondition.sharpness,
        morale: clamp(baseCondition.morale + (rumour ? rumour.sentiment * rumour.weight * 0.6 : 0), -1, 1),
        distraction,
      },
      rumour,
      base: { x: fx * PITCH.length, y: fy * PITCH.width },
    };
  });

  return { name, preset: presetKey, formation, tactics: { ...preset.tactics }, players };
}

export function goalFor(side) {
  return side === "home" ? { x: PITCH.length, y: PITCH.width / 2 } : { x: 0, y: PITCH.width / 2 };
}

// A simple expected-goals curve. Central and close is worth more than wide and
// far, and the shape is monotonic in distance, which the tests check.
export function xgAt(x, y, side) {
  const goal = goalFor(side);
  const dx = Math.abs(goal.x - x);
  const dy = Math.abs(goal.y - y);
  const distance = Math.hypot(dx, dy);
  const angleFactor = Math.max(0.08, 1 - dy / 42);
  const value = 0.55 * Math.exp(-distance / 9.5) * angleFactor;
  return clamp(value, 0.005, 0.92);
}

export function speedFactor(player) {
  const { fitness } = player.condition;
  return 0.82 + 0.18 * fitness;
}

export function passFactor(player) {
  const { sharpness, distraction } = player.condition;
  return (sharpness - 0.5) * 0.08 - distraction * 0.04;
}

export function shotFactor(player) {
  const { morale } = player.condition;
  return 0.92 + 0.12 * morale;
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}
