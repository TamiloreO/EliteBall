import { makeRng } from "./rng.js";
import { PITCH, goalFor, xgAt, distance, clamp, speedFactor, passFactor, shotFactor } from "./model.js";

// A match is a chain of possessions, not a physics problem. Each second a side
// in possession may pass, carry or shoot; the rates below are the calibration.
// That keeps the event counts plausible and makes the model impossible to
// deadlock, which a continuous ball simulation kept doing.

export const DT = 0.1;
export const MATCH_SECONDS = 90 * 60;

const DECISION_RATE = 0.22;
const PASS_SHARE = 0.78;

export function simulate({ home, away, seed = 1, duration = MATCH_SECONDS }) {
  const rng = makeRng(seed);
  const teams = { home, away };
  const players = [];

  for (const side of ["home", "away"]) {
    for (const p of teams[side].players) {
      const base = side === "home" ? p.base : { x: PITCH.length - p.base.x, y: PITCH.width - p.base.y };
      players.push({
        id: `${side}-${p.num}`,
        side,
        num: p.num,
        name: p.name,
        role: p.role,
        attrs: p.attrs,
        condition: p.condition ?? { fitness: 0.85, sharpness: 0.8, morale: 0, distraction: 0.15 },
        rumour: p.rumour ?? null,
        base,
        pos: { ...base },
        stamina: 1,
      });
    }
  }

  const bySide = { home: players.filter((p) => p.side === "home"), away: players.filter((p) => p.side === "away") };
  const stats = { home: blank(), away: blank() };
  const events = [];
  const frames = [];

  const state = {
    ball: { x: PITCH.length / 2, y: PITCH.width / 2, side: "home", target: { x: PITCH.length / 2, y: PITCH.width / 2 } },
    carrier: null,
  };
  state.carrier = nearest(state.ball, bySide.home);

  function nearest(point, list) {
    return list.reduce((best, p) => (distance(p.pos, point) < distance(best.pos, point) ? p : best), list[0]);
  }

  function record(t, type, side, player, detail = {}) {
    events.push({
      t: Math.round(t * 10) / 10,
      type,
      side,
      player: player ? player.num : null,
      x: Math.round(state.ball.x * 10) / 10,
      y: Math.round(state.ball.y * 10) / 10,
      ...detail,
    });
  }

  function turnover(toSide, t, kind = "turnover") {
    state.ball.side = toSide;
    state.carrier = nearest(state.ball, bySide[toSide]);
    state.ball.target = { x: state.ball.x, y: state.ball.y };
    if (kind === "tackle") stats[toSide].tackles += 1;
    record(t, kind, toSide, state.carrier);
  }

  let swapped = false;

  function attackDir(side) {
    const dir = side === "home" ? 1 : -1;
    return swapped ? -dir : dir;
  }

  function goalPoint(side) {
    return { x: attackDir(side) > 0 ? PITCH.length : 0, y: PITCH.width / 2 };
  }

  function inFinalThird(side) {
    const goal = goalPoint(side);
    return distance(state.ball, goal) < 32;
  }

  function decide(t, side) {
    const carrier = state.carrier;
    const dir = attackDir(side);
    const pressure = bySide[side === "home" ? "away" : "home"].filter((p) => distance(p.pos, state.ball) < 8).length;
    const tempo = teams[side].tactics.tempo;

    // Shooting is a zone decision, and the further in, the likelier it is.
    if (inFinalThird(side)) {
      const gap = distance(state.ball, goalPoint(side));
      const shootChance = gap < 18 ? 0.05 : 0.02;
      if (rng.chance(shootChance * (0.7 + carrier.attrs.shooting / 200))) {
        shoot(t, side, carrier);
        return;
      }
    }

    const passShare = PASS_SHARE - tempo * 0.1;
    if (rng.chance(passShare)) {
      const mates = bySide[side].filter((p) => p !== carrier);
      const target = mates.reduce((best, p) => {
        const gain = (p.pos.x - state.ball.x) * dir;
        return gain > (best.pos.x - state.ball.x) * dir ? p : best;
      }, mates[0]);

      const chance = clamp(0.9 - pressure * 0.06 + carrier.attrs.passing / 900 + passFactor(carrier), 0.45, 0.96);
      const success = rng.chance(chance);
      stats[side].passes += 1;
      if (success) stats[side].completed += 1;
      record(t, "pass", side, carrier, { to: target.num, success });

      if (!success) {
        turnover(side === "home" ? "away" : "home", t);
        return;
      }

      const reach = rng.range(8, 24) * dir;
      state.ball.x = clamp(state.ball.x + reach, 2, PITCH.length - 2);
      state.ball.y = clamp(target.pos.y + rng.range(-4, 4), 2, PITCH.width - 2);
      state.carrier = nearest(state.ball, bySide[side]);
      state.ball.target = { x: state.ball.x, y: state.ball.y };
      return;
    }

    // Carry: the carrier drives forward and the ball goes with them.
    const carry = rng.range(4, 12) * (0.85 + carrier.attrs.dribbling / 330) * dir;
    state.ball.x = clamp(state.ball.x + carry, 2, PITCH.length - 2);
    state.ball.y = clamp(state.ball.y + rng.range(-3, 3), 2, PITCH.width - 2);
    state.ball.target = { x: state.ball.x, y: state.ball.y };
  }

  function shoot(t, side, shooter) {
    const xg = xgAt(state.ball.x, state.ball.y, side, attackDir(side)) * (0.94 + shooter.attrs.positioning / 825);
    const conversion = clamp(xg * (0.5 + shooter.attrs.shooting / 350) * shotFactor(shooter), 0.01, 0.9);
    stats[side].shots += 1;
    stats[side].xg += xg;
    record(t, "shot", side, shooter, { xg: round(xg) });

    if (rng.chance(conversion)) {
      stats[side].goals += 1;
      record(t, "goal", side, shooter, { xg: round(xg) });
      record(t, "restart", side === "home" ? "away" : "home", null, { kind: "kickoff" });
      state.ball = { x: PITCH.length / 2, y: PITCH.width / 2, side: side === "home" ? "away" : "home", target: { x: PITCH.length / 2, y: PITCH.width / 2 } };
      state.carrier = nearest(state.ball, bySide[state.ball.side]);
      return;
    }

    // Saved or off target: the defending side restarts from deep.
    const other = side === "home" ? "away" : "home";
    record(t, "restart", other, null, { kind: "goalkick" });
    state.ball.side = other;
    state.ball.x = attackDir(other) > 0 ? 5.5 : PITCH.length - 5.5;
    state.ball.y = PITCH.width / 2;
    state.ball.target = { x: state.ball.x, y: state.ball.y };
    state.carrier = bySide[other].find((p) => p.role === "GK");
  }

  function movePlayers(dt) {
    for (let index = 0; index < players.length; index += 1) {
      const p = players[index];
      const tactics = teams[p.side].tactics;
      const attack = attackDir(p.side);
      const inPossession = p.side === state.ball.side;
      const ballShift = state.ball.y - PITCH.width / 2;
      const advance = (state.ball.x - PITCH.length / 2) * 0.35;
      const sway = Math.sin(clock * 0.9 + index * 1.7) * 1.6;
      const jockey = Math.cos(clock * 1.25 + index * 2.3) * 1.2;
      let tx;
      let ty;

      if (p.role === "GK") {
        tx = attackDir(p.side) > 0 ? 3 : PITCH.length - 3;
        ty = clamp(PITCH.width / 2 + ballShift * 0.35 + jockey * 0.6, 26, 42);
      } else if (p === state.carrier) {
        tx = state.ball.x + 1.2 * attack + sway * 0.3;
        ty = state.ball.y + jockey * 0.3;
      } else if (inPossession) {
        if (p.role === "FW") {
          tx = p.base.x + advance * 1.15 + 6 * attack + sway;
          ty = p.base.y + ballShift * 0.22 + jockey * 2.2;
        } else if (p.role === "MF") {
          tx = p.base.x + advance * 0.85 - 2 * attack + sway * 0.8;
          ty = p.base.y + ballShift * 0.32 + jockey * 1.4;
        } else {
          tx = p.base.x + advance * 0.55 + (tactics.lineHeight - 0.5) * 10 * attack + sway * 0.6;
          ty = p.base.y + ballShift * 0.18 + jockey;
        }
      } else {
        const gap = distance(p.pos, state.ball);
        const pressRadius = 6 + tactics.press * 12 + (p.attrs.pressing / 99) * 3;
        if (gap < pressRadius) {
          tx = state.ball.x + 1.4 * attack;
          ty = state.ball.y + jockey;
        } else {
          tx = p.base.x + (state.ball.x - p.base.x) * 0.22 + sway;
          ty = p.base.y + (state.ball.y - p.base.y) * 0.3 + jockey;
          if (p.role === "DF") tx += (tactics.lineHeight - 0.5) * 10 * attack;
        }
      }

      const dx = tx - p.pos.x;
      const dy = ty - p.pos.y;
      const len = Math.hypot(dx, dy);
      if (!Number.isFinite(len) || len < 0.02) continue;
      const baseSpeed = 3.1 + (p.attrs.pace / 99) * 3.6;
      const urgency = len > 10 ? 1.35 : len > 5 ? 1.15 : 1;
      const speed = baseSpeed * urgency * (0.72 + 0.28 * p.stamina) * speedFactor(p) * (p.role === "GK" ? 0.55 : 1);
      const step = Math.min(speed * dt, len);
      const before = { ...p.pos };
      p.pos.x = clamp(p.pos.x + (dx / len) * step, 0.4, PITCH.length - 0.4);
      p.pos.y = clamp(p.pos.y + (dy / len) * step, 0.4, PITCH.width - 0.4);
      stats[p.side].distance += distance(before, p.pos);
      p.stamina = clamp(p.stamina - dt * 0.00005 * (1 + tactics.press) * (1.4 - p.attrs.stamina / 99 * 0.8), 0.6, 1);
    }
  }

  let clock = 0;
  const totalTicks = Math.round(duration / DT);

  for (let tick = 0; tick < totalTicks; tick += 1) {
    clock = tick * DT;

    // Teams change ends at half time: bases and positions mirror, and the
    // side that did not kick off starts the second half.
    if (!swapped && clock >= duration / 2) {
      swapped = true;
      for (const p of players) {
        p.base = { x: PITCH.length - p.base.x, y: PITCH.width - p.base.y };
        p.pos = { x: PITCH.length - p.pos.x, y: PITCH.width - p.pos.y };
      }
      state.ball = {
        x: PITCH.length / 2,
        y: PITCH.width / 2,
        side: "away",
        target: { x: PITCH.length / 2, y: PITCH.width / 2 },
      };
      state.carrier = nearest(state.ball, bySide.away);
      record(clock, "restart", "away", null, { kind: "secondhalf" });
    }

    const side = state.ball.side;

    // Ball travels toward its target, and the nearest player takes it on.
    const dx = state.ball.target.x - state.ball.x;
    const dy = state.ball.target.y - state.ball.y;
    const len = Math.hypot(dx, dy);
    if (len > 0.5) {
      const step = Math.min(24 * DT, len);
      state.ball.x += (dx / len) * step;
      state.ball.y += (dy / len) * step;
    }
    if (!state.carrier || distance(state.carrier.pos, state.ball) > 12) {
      state.carrier = nearest(state.ball, bySide[side]);
    }

    const tempo = teams[side].tactics.tempo;
    if (rng.chance(DECISION_RATE * DT * (0.8 + tempo * 0.4))) {
      decide(clock, side);
    }

    // A high press forces the odd turnover even without a pass going astray.
    const press = teams[side === "home" ? "away" : "home"].tactics.press;
    if (rng.chance(0.004 * DT * (0.5 + press))) {
      turnover(side === "home" ? "away" : "home", clock, "tackle");
    }

    stats[state.ball.side].possession += DT;
    movePlayers(DT);

    const frame = new Float32Array(2 + players.length * 2);
    frame[0] = state.ball.x;
    frame[1] = state.ball.y;
    players.forEach((p, i) => {
      frame[2 + i * 2] = p.pos.x;
      frame[3 + i * 2] = p.pos.y;
    });
    frames.push(frame);
  }

  const total = stats.home.possession + stats.away.possession || 1;
  for (const side of ["home", "away"]) {
    stats[side].possession = round((stats[side].possession / total) * 100);
    stats[side].xg = round(stats[side].xg);
    stats[side].distance = Math.round(stats[side].distance);
    stats[side].passAccuracy = stats[side].passes ? round((stats[side].completed / stats[side].passes) * 100) : 0;
  }

  return {
    seed,
    duration,
    frameRate: 1 / DT,
    teams: {
      home: { name: home.name, formation: home.formation, tactics: home.tactics },
      away: { name: away.name, formation: away.formation, tactics: away.tactics },
    },
    players: players.map((p) => ({ id: p.id, side: p.side, num: p.num, name: p.name, role: p.role, condition: p.condition, rumour: p.rumour })),
    score: { home: stats.home.goals, away: stats.away.goals },
    stats,
    events,
    frames,
  };
}

function blank() {
  return { possession: 0, passes: 0, completed: 0, passAccuracy: 0, shots: 0, goals: 0, xg: 0, tackles: 0, distance: 0 };
}

function round(n) {
  return Math.round(n * 100) / 100;
}
