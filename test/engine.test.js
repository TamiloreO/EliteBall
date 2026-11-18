import test from "node:test";
import assert from "node:assert/strict";

import { simulate, DT } from "../src/engine.js";
import { makeTeam, xgAt, PITCH } from "../src/model.js";

const teams = () => ({
  home: makeTeam("Rovers", "pressers", "4-3-3"),
  away: makeTeam("Athletic", "blockers", "4-4-2"),
});

const shortMatch = (seed = 7) => simulate({ ...teams(), seed, duration: 15 * 60 });

test("a seed reproduces the same match", () => {
  const a = shortMatch(11);
  const b = shortMatch(11);
  assert.deepEqual(a.score, b.score);
  assert.equal(a.events.length, b.events.length);
  assert.deepEqual(a.stats.home, b.stats.home);
  assert.deepEqual(a.stats.away, b.stats.away);
});

test("a different seed plays a different match", () => {
  const a = shortMatch(11);
  const b = shortMatch(12);
  const sameEvents = JSON.stringify(a.events) === JSON.stringify(b.events);
  assert.equal(sameEvents, false);
});

test("both squads are complete and distinct", () => {
  const match = shortMatch();
  assert.equal(match.players.length, 22);
  assert.equal(match.players.filter((p) => p.side === "home").length, 11);
  assert.equal(match.players.filter((p) => p.side === "away").length, 11);
  assert.equal(new Set(match.players.map((p) => p.id)).size, 22);
});

test("nobody leaves the pitch", () => {
  const match = shortMatch();
  for (const frame of match.frames) {
    for (let i = 2; i < frame.length; i += 2) {
      assert.ok(frame[i] >= 0 && frame[i] <= PITCH.length, `x ${frame[i]}`);
      assert.ok(frame[i + 1] >= 0 && frame[i + 1] <= PITCH.width, `y ${frame[i + 1]}`);
    }
  }
});

test("possession adds up to a hundred", () => {
  const match = shortMatch();
  const total = match.stats.home.possession + match.stats.away.possession;
  assert.ok(Math.abs(total - 100) < 0.5, `got ${total}`);
});

test("the score matches the goal events", () => {
  const match = shortMatch(3);
  const homeGoals = match.events.filter((e) => e.type === "goal" && e.side === "home").length;
  const awayGoals = match.events.filter((e) => e.type === "goal" && e.side === "away").length;
  assert.equal(match.score.home, homeGoals);
  assert.equal(match.score.away, awayGoals);
});

test("every shot has an xG between zero and one", () => {
  const match = shortMatch(5);
  const shots = match.events.filter((e) => e.type === "shot" || e.type === "goal");
  assert.ok(shots.length > 0, "a 15 minute match should produce shots");
  for (const shot of shots) {
    assert.ok(shot.xg >= 0 && shot.xg <= 1, `xg ${shot.xg}`);
  }
});

test("a full match runs the right number of frames", () => {
  const match = simulate({ ...teams(), seed: 2, duration: 90 * 60 });
  assert.equal(match.frames.length, Math.round((90 * 60) / DT));
  assert.equal(match.frameRate, 5);
});

test("a full match produces a plausible scoreline", () => {
  const match = simulate({ ...teams(), seed: 9, duration: 90 * 60 });
  assert.ok(match.score.home < 12 && match.score.away < 12, JSON.stringify(match.score));
  assert.ok(match.stats.home.shots > 0);
  assert.ok(match.stats.home.passes > 20, `passes ${match.stats.home.passes}`);
  for (const side of ["home", "away"]) {
    assert.ok(match.stats[side].passAccuracy >= 0 && match.stats[side].passAccuracy <= 100);
  }
});

test("xG falls with distance and stays bounded", () => {
  const near = xgAt(100, 34, "home");
  const mid = xgAt(85, 34, "home");
  const far = xgAt(60, 34, "home");
  assert.ok(near > mid && mid > far, `${near} ${mid} ${far}`);
  assert.ok(far >= 0 && near <= 1);
  const wide = xgAt(100, 6, "home");
  assert.ok(wide < near, "a tight angle is worth less");
});

test("tactics change the match", () => {
  const base = teams();
  const high = { ...base, home: { ...base.home, tactics: { ...base.home.tactics, lineHeight: 0.95, press: 0.95 } } };
  const low = { ...base, home: { ...base.home, tactics: { ...base.home.tactics, lineHeight: 0.1, press: 0.1 } } };
  const a = simulate({ ...high, seed: 4, duration: 20 * 60 });
  const b = simulate({ ...low, seed: 4, duration: 20 * 60 });
  const differs =
    a.stats.home.possession !== b.stats.home.possession ||
    a.stats.home.shots !== b.stats.home.shots ||
    a.events.length !== b.events.length;
  assert.ok(differs, "pressing higher should change the game");
});
