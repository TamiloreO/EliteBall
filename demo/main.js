import { simulate } from "../src/engine.js";
import { makeTeam, PITCH, FORMATIONS } from "../src/model.js";

const canvas = document.getElementById("pitch");
const ctx = canvas.getContext("2d");

const ui = {
  homeName: document.getElementById("home-name"),
  awayName: document.getElementById("away-name"),
  homeFormation: document.getElementById("home-formation"),
  awayFormation: document.getElementById("away-formation"),
  homeScore: document.getElementById("home-score"),
  awayScore: document.getElementById("away-score"),
  clock: document.getElementById("clock"),
  play: document.getElementById("play"),
  scrub: document.getElementById("scrub"),
  seed: document.getElementById("seed"),
  simulate: document.getElementById("simulate"),
  statsBody: document.getElementById("stats-body"),
  homeCol: document.getElementById("home-col"),
  awayCol: document.getElementById("away-col"),
  finePrint: document.getElementById("fine-print"),
  facts: document.getElementById("facts"),
  homeSheet: document.getElementById("home-sheet"),
  awaySheet: document.getElementById("away-sheet"),
};

const COLORS = { home: "#f08a2c", away: "#4f8df7" };
const MARGIN = 4;
const view = { scale: 1, ox: 0, oy: 0 };

let match = null;
let squadPack = null;
let frame = 0;
let playing = true;
let speed = 4;
let lastTime = 0;

function initials(name) {
  return name
    .replace(/\./g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function fit() {
  const w = canvas.width;
  const h = canvas.height;
  const sx = w / (PITCH.length + MARGIN * 2);
  const sy = h / (PITCH.width + MARGIN * 2);
  view.scale = Math.min(sx, sy);
  view.ox = (w - PITCH.length * view.scale) / 2;
  view.oy = (h - PITCH.width * view.scale) / 2;
}

const px = (x) => view.ox + x * view.scale;
const py = (y) => view.oy + y * view.scale;

function drawPitch() {
  ctx.fillStyle = "#1d5c34";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Mown stripes.
  const stripes = 10;
  for (let i = 0; i < stripes; i += 1) {
    if (i % 2 === 0) continue;
    ctx.fillStyle = "rgba(255,255,255,0.03)";
    const x = px((i * PITCH.length) / stripes);
    ctx.fillRect(x, py(0), (PITCH.length / stripes) * view.scale, PITCH.width * view.scale);
  }

  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(px(0), py(0), PITCH.length * view.scale, PITCH.width * view.scale);

  ctx.beginPath();
  ctx.moveTo(px(PITCH.length / 2), py(0));
  ctx.lineTo(px(PITCH.length / 2), py(PITCH.width));
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(px(PITCH.length / 2), py(PITCH.width / 2), 9.15 * view.scale, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(px(PITCH.length / 2), py(PITCH.width / 2), 0.4 * view.scale, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fill();

  // Penalty and six yard boxes at both ends.
  const boxDepth = 16.5;
  const boxWidth = 40.32;
  const sixDepth = 5.5;
  const sixWidth = 18.32;
  for (const side of [0, 1]) {
    const x0 = side === 0 ? 0 : PITCH.length - boxDepth;
    const x1 = side === 0 ? 0 : PITCH.length - sixDepth;
    ctx.strokeRect(px(x0), py((PITCH.width - boxWidth) / 2), boxDepth * view.scale, boxWidth * view.scale);
    ctx.strokeRect(px(x1), py((PITCH.width - sixWidth) / 2), sixDepth * view.scale, sixWidth * view.scale);
  }

  // Goals.
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  for (const side of [0, 1]) {
    const x = side === 0 ? 0 : PITCH.length;
    ctx.beginPath();
    ctx.moveTo(px(x), py(PITCH.width / 2 - 3.66));
    ctx.lineTo(px(x), py(PITCH.width / 2 + 3.66));
    ctx.stroke();
  }
}

function drawFrame() {
  drawPitch();
  if (!match) return;

  const last = match.frames.length - 1;
  const i0 = Math.max(0, Math.min(last, Math.floor(frame)));
  const i1 = Math.min(i0 + 1, last);
  const t = Math.max(0, Math.min(1, frame - i0));
  const a = match.frames[i0];
  const b = match.frames[i1];
  const mix = (u, v) => u + (v - u) * t;
  const count = match.players.length;

  for (let i = 0; i < count; i += 1) {
    const player = match.players[i];
    const x = px(mix(a[2 + i * 2], b[2 + i * 2]));
    const y = py(mix(a[3 + i * 2], b[3 + i * 2]));
    const colour = COLORS[player.side];

    // A short trail from the recent past gives a sense of direction.
    const prev = match.frames[Math.max(0, i0 - 4)];
    if (prev) {
      ctx.strokeStyle = colour;
      ctx.globalAlpha = 0.16;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(px(prev[2 + i * 2]), py(prev[3 + i * 2]));
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fillStyle = colour;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = "#10130f";
    ctx.font = "600 9px Helvetica, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(player.num), x, y + 0.5);

    // Initials only where there is room for them to stay legible.
    if (canvas.clientWidth >= 760) {
      ctx.font = "600 8px Helvetica, Arial, sans-serif";
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = "rgba(9, 26, 14, 0.75)";
      ctx.strokeText(initials(player.name), x, y + 18);
      ctx.fillStyle = "#f4f7ef";
      ctx.fillText(initials(player.name), x, y + 18);
    }
  }

  const bx = px(mix(a[0], b[0]));
  const by = py(mix(a[1], b[1]));
  ctx.beginPath();
  ctx.arc(bx, by, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 1.2;
  ctx.stroke();
}

function formatClock(seconds) {
  const s = Math.max(0, Math.min(seconds, 90 * 60));
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function updateHud() {
  if (!match) return;
  const seconds = frame / match.frameRate;
  ui.clock.textContent = formatClock(seconds);
  ui.scrub.value = String(Math.round((frame / (match.frames.length - 1)) * 1000));

}

function statsRow(label, home, away) {
  const tr = document.createElement("tr");
  tr.innerHTML = `<td>${home}</td><td>${label}</td><td>${away}</td>`;
  return tr;
}

function renderFacts() {
  const { home, away } = match.stats;
  const tiles = [
    { label: "Result", value: `${home.goals}<span class="sep">:</span>${away.goals}`, sub: "full time" },
    { label: "Expected goals", value: `${home.xg.toFixed(2)}<span class="sep">:</span>${away.xg.toFixed(2)}`, sub: "chance quality" },
    { label: "Shots", value: `${home.shots}<span class="sep">:</span>${away.shots}`, sub: "attempts at goal" },
    {
      label: "Possession",
      value: `${home.possession.toFixed(1)}%<span class="sep">:</span>${away.possession.toFixed(1)}%`,
      sub: "share of the ball",
      split: true,
    },
  ];

  ui.facts.replaceChildren(
    ...tiles.map((tile) => {
      const div = document.createElement("div");
      div.className = "fact";
      div.innerHTML = `
        <span class="label">${tile.label}</span>
        <span class="value">${tile.value}</span>
        <span class="sub">${tile.sub}</span>
        ${tile.split ? `<span class="split"><span class="h" style="width:${home.possession}%"></span><span class="a" style="width:${away.possession}%"></span></span>` : ""}
      `;
      return div;
    }),
  );
}

function renderStats() {
  const { home, away } = match.stats;
  ui.statsBody.replaceChildren(
    statsRow("Possession %", home.possession, away.possession),
    statsRow("Shots", home.shots, away.shots),
    statsRow("Expected goals", home.xg.toFixed(2), away.xg.toFixed(2)),
    statsRow("Passes", home.passes, away.passes),
    statsRow("Pass accuracy %", home.passAccuracy, away.passAccuracy),
    statsRow("Tackles", home.tackles, away.tackles),
    statsRow("Passes completed", home.completed, away.completed),
  );
}

function sheet(list, players) {
  list.replaceChildren();
  for (const player of players) {
    const li = document.createElement("li");
    const fitness = Math.round((player.condition?.fitness ?? 0.85) * 100);
    const sharpness = Math.round((player.condition?.sharpness ?? 0.8) * 100);
    const morale = player.condition?.morale ?? 0;
    const moraleColour = morale > 0.15 ? "#2f7d32" : morale < -0.15 ? "#b3261e" : "#8a8f83";

    li.innerHTML = `
      <span class="jersey">${player.num}</span>
      <span class="who"><span class="initials">${initials(player.name)}</span><span class="role">${player.role}</span></span>
      <span class="bars">
        <span class="bar" title="Fitness ${fitness}%"><span style="width:${fitness}%"></span></span>
        <span class="bar" title="Sharpness ${sharpness}%"><span style="width:${sharpness}%"></span></span>
        <span class="morale" title="Morale ${morale.toFixed(2)}" style="background:${moraleColour}"></span>
      </span>
      ${player.rumour ? `<span class="rumour">${player.rumour.text}</span>` : ""}
    `;
    list.appendChild(li);
  }
}

function teamFromPack(side, pack) {
  const formation = pack.formation ?? "4-3-3";
  const shape = FORMATIONS[formation];
  return {
    name: pack.name,
    formation,
    tactics: pack.tactics,
    players: pack.players.map((p, index) => ({
      id: `${side}-${p.num}`,
      num: p.num,
      name: p.name,
      role: shape[index][0],
      attrs: p.attrs,
      condition: p.condition ?? { fitness: 0.9, sharpness: 0.82, morale: 0.05, distraction: 0.05 },
      rumour: null,
      base: { x: shape[index][1] * PITCH.length, y: shape[index][2] * PITCH.width },
    })),
  };
}

function boot() {
  const seed = Number(ui.seed.value) || 1;
  const home = squadPack ? teamFromPack("home", squadPack.home) : makeTeam("Rovers", "pressers", "4-3-3");
  const away = squadPack ? teamFromPack("away", squadPack.away) : makeTeam("Athletic", "blockers", "4-4-2");

  match = simulate({ home, away, seed, duration: 90 * 60 });
  frame = 0;
  playing = true;
  ui.play.textContent = "Pause";

  ui.homeScore.textContent = String(match.score.home);
  ui.awayScore.textContent = String(match.score.away);
  ui.homeName.textContent = home.name;
  ui.homeCol.textContent = home.name;
  ui.awayCol.textContent = away.name;
  if (squadPack && ui.finePrint) {
    ui.finePrint.textContent = "Local squad pack loaded. Real names, numbers and clubs stay on this machine and out of the repository.";
  }
  ui.awayName.textContent = away.name;
  ui.homeFormation.textContent = home.formation;
  ui.awayFormation.textContent = away.formation;

  renderStats();
  renderFacts();
  sheet(ui.homeSheet, match.players.filter((p) => p.side === "home"));
  sheet(ui.awaySheet, match.players.filter((p) => p.side === "away"));
  drawFrame();
  updateHud();
}

function tick(time) {
  if (playing && match) {
    const dt = lastTime ? (time - lastTime) / 1000 : 0;
    lastTime = time;
    frame += dt * match.frameRate * speed;
    if (frame >= match.frames.length - 1) {
      frame = match.frames.length - 1;
      playing = false;
      ui.play.textContent = "Play";
    }
    drawFrame();
    updateHud();
  } else {
    lastTime = time;
  }
  requestAnimationFrame(tick);
}

ui.play.addEventListener("click", () => {
  if (frame >= match.frames.length - 1) frame = 0;
  playing = !playing;
  ui.play.textContent = playing ? "Pause" : "Play";
});

ui.simulate.addEventListener("click", () => {
  boot();
});

ui.scrub.addEventListener("input", () => {
  if (!match) return;
  frame = (Number(ui.scrub.value) / 1000) * (match.frames.length - 1);
  drawFrame();
  updateHud();
});

for (const button of document.querySelectorAll(".speed")) {
  button.addEventListener("click", () => {
    speed = Number(button.dataset.speed);
    for (const other of document.querySelectorAll(".speed")) other.classList.toggle("active", other === button);
  });
}

async function start() {
  try {
    const response = await fetch("../data/squads.json", { cache: "no-store" });
    if (response.ok) squadPack = await response.json();
  } catch {
    // No local pack: the invented squads are the default.
  }
  fit();
  boot();
  requestAnimationFrame(tick);
}

start();
