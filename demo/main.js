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
  goals: document.getElementById("goals"),
  setupBody: document.getElementById("setup-body"),
  setupToggle: document.getElementById("setup-toggle"),
  shuffle: document.getElementById("shuffle"),
  homeSheet: document.getElementById("home-sheet"),
  awaySheet: document.getElementById("away-sheet"),
};

const COLORS = { home: "#f08a2c", away: "#4f8df7" };
const MARGIN = 4;
const view = { scale: 1, ox: 0, oy: 0 };

let match = null;
let squadPack = null;
let teams = null;
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

  const seconds = frame / match.frameRate;
  const recent = match.events.find(
    (event) => event.type === "goal" && seconds >= event.t && seconds <= event.t + 1.6,
  );

  let ballX = mix(a[0], b[0]);
  let ballY = mix(a[1], b[1]);
  if (recent) {
    ballX = recent.side === "home" ? PITCH.length - 0.7 : 0.7;
    ballY = PITCH.width / 2;
  }

  const bx = px(ballX);
  const by = py(ballY);
  ctx.beginPath();
  ctx.arc(bx, by, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.6)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  const restart = match.events.find(
    (event) => event.type === "restart" && seconds >= event.t && seconds <= event.t + 1.4,
  );

  if (!recent && restart) {
    const text = restart.kind === "kickoff" ? "KICK OFF" : "GOAL KICK";
    ctx.fillStyle = "rgba(9, 20, 13, 0.82)";
    ctx.fillRect(bx - 46, by - 34, 92, 20);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 10px Helvetica, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, bx, by - 24);
  }

  if (recent) {
    const scorer = match.players.find((p) => p.side === recent.side && p.num === recent.player);
    const label = `GOAL  ${Math.floor(recent.t / 60)}'  ${recent.player} ${scorer ? initials(scorer.name) : ""}`;

    ctx.fillStyle = "rgba(9, 20, 13, 0.82)";
    ctx.fillRect(canvas.width / 2 - 130, 18, 260, 38);
    ctx.fillStyle = "#ffffff";
    ctx.font = "700 15px Helvetica, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, canvas.width / 2, 38);

    ctx.fillStyle = "rgba(255, 255, 255, 0.12)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
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

  let home = 0;
  let away = 0;
  for (const event of match.events) {
    if (event.type !== "goal" || event.t > seconds) continue;
    if (event.side === "home") home += 1;
    else away += 1;
  }
  ui.homeScore.textContent = String(home);
  ui.awayScore.textContent = String(away);
  ui.scrub.value = String(Math.round((frame / (match.frames.length - 1)) * 1000));

}

function statsRow(label, home, away) {
  const tr = document.createElement("tr");
  tr.innerHTML = `<td>${home}</td><td>${label}</td><td>${away}</td>`;
  return tr;
}

function renderGoals() {
  const goals = match.events.filter((event) => event.type === "goal");
  const label = document.createElement("span");
  label.className = "label";
  label.textContent = goals.length ? `Goals ${goals.length}` : "Goals";
  const items = [label];

  if (!goals.length) {
    const none = document.createElement("span");
    none.className = "none";
    none.textContent = "No goals";
    items.push(none);
  }

  for (const goal of goals) {
    const player = match.players.find((p) => p.side === goal.side && p.num === goal.player);
    const minute = Math.floor(goal.t / 60);
    const chip = document.createElement("button");
    chip.className = `goal-chip ${goal.side}`;
    chip.innerHTML = `<span class="minute">${minute}'</span><span class="num">${goal.player}</span><span class="who">${player ? initials(player.name) : ""}</span>`;
    chip.title = `Jump to ${minute}:${String(Math.floor(goal.t % 60)).padStart(2, "0")}`;
    chip.addEventListener("click", () => {
      frame = Math.max(0, Math.min((goal.t + 0.2) * match.frameRate, match.frames.length - 1));
      playing = false;
      ui.play.textContent = "Play";
      for (const other of ui.goals.querySelectorAll(".goal-chip")) other.classList.remove("active");
      chip.classList.add("active");
      drawFrame();
      updateHud();
    });
    items.push(chip);
  }

  ui.goals.replaceChildren(...items);
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

let defaultSetup = null;

function snapshotSetup() {
  if (!teams) return null;
  const copy = {};
  for (const side of ["home", "away"]) {
    copy[side] = {
      tactics: { ...teams[side].tactics },
      players: teams[side].players.map((p) => ({ num: p.num, attrs: { ...p.attrs }, condition: { ...p.condition } })),
    };
  }
  return copy;
}

function resetSetup() {
  if (!defaultSetup || !teams) return;
  for (const side of ["home", "away"]) {
    const team = teams[side];
    Object.assign(team.tactics, defaultSetup[side].tactics);
    for (const player of team.players) {
      const base = defaultSetup[side].players.find((p) => p.num === player.num);
      if (base) {
        Object.assign(player.attrs, base.attrs);
        Object.assign(player.condition, base.condition);
      }
    }
  }
}

function buildTeams() {
  return squadPack
    ? { home: teamFromPack("home", squadPack.home), away: teamFromPack("away", squadPack.away) }
    : { home: makeTeam("Rovers", "pressers", "4-3-3"), away: makeTeam("Athletic", "blockers", "4-4-2") };
}

const SETUP_KEY = "eliteball.setup.v1";
const EDIT_ATTRS = [
  ["pace", "PAC", "Top speed. 50 is average, 99 is elite. Each 10 points adds about 0.36 m/s."],
  ["passing", "PAS", "Pass completion. Each 10 points adds about 1.1 points of completion under pressure."],
  ["dribbling", "DRI", "Carry distance under pressure. Each 10 points adds about 3 percent."],
  ["shooting", "SHO", "Shot frequency and conversion. Each 10 points adds about 0.03 to the conversion multiplier."],
  ["pressing", "PRS", "Closing down. Each 10 points adds about 0.3 m to the press radius."],
  ["positioning", "POS", "Quality of positions taken. Each 10 points adds about 1.2 percent to expected goals."],
  ["stamina", "STA", "Resistance to fatigue. Each 10 points makes tiredness about 8 percent slower."],
];

const EDIT_CONDITIONS = [
  ["fitness", "FIT", "Fitness. 100 is fully fit; 70 costs about 5 percent of top speed."],
  ["sharpness", "SHP", "Touch. Each 10 points adds about 0.8 points of pass completion."],
  ["morale", "MOR", "Confidence. Each 0.1 adds about 1.2 percent to conversion."],
  ["distraction", "DIS", "Off-field noise. Each 0.1 costs about 0.4 points of pass completion."],
];

function saveSetup() {
  if (!teams) return;
  try {
    const pack = {};
    for (const side of ["home", "away"]) {
      pack[side] = {
        name: teams[side].name,
        tactics: { ...teams[side].tactics },
        players: teams[side].players.map((p) => ({ num: p.num, attrs: { ...p.attrs }, condition: { ...p.condition } })),
      };
    }
    localStorage.setItem(SETUP_KEY, JSON.stringify(pack));
  } catch {
    // Storage can be unavailable; the editor still works for this session.
  }
}

function loadSetup() {
  if (!teams) return;
  try {
    const raw = localStorage.getItem(SETUP_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    for (const side of ["home", "away"]) {
      const team = teams[side];
      const entry = saved[side];
      if (!entry || entry.name !== team.name) continue;
      Object.assign(team.tactics, entry.tactics ?? {});
      for (const player of team.players) {
        const match = (entry.players ?? []).find((p) => p.num === player.num);
        if (match) {
          Object.assign(player.attrs, match.attrs ?? {});
          Object.assign(player.condition, match.condition ?? {});
        }
      }
    }
  } catch {
    // A corrupt saved setup should not stop the demo.
  }
}

function onSetupInput(event) {
  const input = event.target;
  const team = teams[input.dataset.side];
  if (!team) return;

  if (input.dataset.tactic) {
    team.tactics[input.dataset.tactic] = Math.max(0, Math.min(1, Number(input.value) / 100));
    const value = input.parentElement.querySelector("span");
    if (value) value.textContent = input.value;
  } else {
    const player = team.players[Number(input.dataset.index)];
    if (!player) return;
    if (input.dataset.condition) {
      const key = input.dataset.condition;
      const raw = Number(input.value) / 100;
      player.condition[key] = key === "morale" ? Math.max(-1, Math.min(1, raw)) : Math.max(0, Math.min(1, raw));
    } else if (input.dataset.attr) {
      player.attrs[input.dataset.attr] = Math.max(1, Math.min(99, Number(input.value) || 1));
    }
  }
  saveSetup();
}

function renderSetup() {
  if (!teams || !ui.setupBody) return;

  const editors = ["home", "away"].map((side) => {
    const team = teams[side];
    const el = document.createElement("div");
    el.className = "team-editor";

    const tactics = [
      ["lineHeight", "Line"], ["press", "Press"], ["width", "Width"], ["tempo", "Tempo"],
    ].map(([key, label]) => {
      const value = Math.round((team.tactics[key] ?? 0.5) * 100);
      const tip = {
        lineHeight: "How high the back line holds. Higher squeezes the pitch and risks space behind.",
        press: "How far players close down. Higher wins the ball sooner and tires the squad faster.",
        width: "How wide the team stretches in possession.",
        tempo: "Speed of decisions. Higher means more passes and shots, and more turnovers.",
      }[key];
      return `<label title="${tip}">${label}<input type="range" min="0" max="100" value="${value}" data-side="${side}" data-tactic="${key}"><span>${value}</span></label>`;
    }).join("");

    const rows = team.players.map((player, index) => `
      <tr>
        <td class="num">${player.num}</td>
        <td class="who"><b>${initials(player.name)}</b> <span>${player.role}</span></td>
        ${EDIT_ATTRS.map(([key, , tip]) => `<td><input type="number" min="1" max="99" title="${tip}" value="${player.attrs[key]}" data-side="${side}" data-index="${index}" data-attr="${key}"></td>`).join("")}
        ${EDIT_CONDITIONS.map(([key, , tip]) => {
          const raw = key === "morale" ? player.condition[key] * 100 : player.condition[key] * 100;
          const min = key === "morale" ? -100 : key === "fitness" ? 30 : 0;
          return `<td><input type="number" min="${min}" max="100" title="${tip}" value="${Math.round(raw)}" data-side="${side}" data-index="${index}" data-condition="${key}"></td>`;
        }).join("")}
      </tr>`).join("");

    el.innerHTML = `
      <div class="editor-head"><h3>${team.name}</h3><span>${team.formation}</span></div>
      <div class="tactics">${tactics}</div>
      <div class="table-wrap">
        <table class="edit">
          <thead><tr><th>#</th><th>Player</th>${EDIT_ATTRS.map(([, label, tip]) => `<th title="${tip}">${label}</th>`).join("")}${EDIT_CONDITIONS.map(([, label, tip]) => `<th title="${tip}">${label}</th>`).join("")}</tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    return el;
  });

  const grid = document.createElement("div");
  grid.className = "setup-grid";
  grid.append(...editors);

  const actions = document.createElement("div");
  actions.className = "setup-actions";
  actions.innerHTML = '<button data-reset>Reset to defaults</button><button data-run class="primary">Run with these values</button>';

  ui.setupBody.replaceChildren(grid, actions);
  ui.setupBody.querySelectorAll("input").forEach((input) => input.addEventListener("input", onSetupInput));
}

function boot() {
  const seed = Number(ui.seed.value) || 1;
  if (!teams) teams = buildTeams();
  const home = teams.home;
  const away = teams.away;

  match = simulate({ home, away, seed, duration: 90 * 60 });
  frame = 0;
  playing = true;
  ui.play.textContent = "Pause";

  ui.homeScore.textContent = "0";
  ui.awayScore.textContent = "0";
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
  renderGoals();
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

ui.setupToggle.addEventListener("click", () => {
  const hidden = ui.setupBody.hasAttribute("hidden");
  if (hidden) ui.setupBody.removeAttribute("hidden");
  else ui.setupBody.setAttribute("hidden", "");
  ui.setupToggle.textContent = hidden ? "Hide values" : "Edit values";
});

ui.setupBody.addEventListener("click", (event) => {
  if (event.target.matches("[data-run]")) boot();
  if (event.target.matches("[data-reset]")) {
    resetSetup();
    renderSetup();
    saveSetup();
    boot();
  }
});

ui.shuffle.addEventListener("click", () => {
  ui.seed.value = String(Math.floor(Math.random() * 9999) + 1);
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
  teams = buildTeams();
  defaultSetup = snapshotSetup();
  loadSetup();
  fit();
  boot();
  renderSetup();
  requestAnimationFrame(tick);
}

start();
