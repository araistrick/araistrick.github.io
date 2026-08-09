const slots = ["top", "right", "bottom", "left"];
const defaultColors = ["#e9e6de", "#d94a3b", "#26a6a6", "#e7bc3c"];
const defaultOrientations = [180, -90, 0, 90];
const orientationOptions = [0, 90, 180, -90];
const durationSteps = [...Array.from({ length: 13 }, (_, index) => index * 10), 150, 180, 210, 240, 270, 300, 360, 420, 480, 540, 600];
const durationControls = ["starting-time", "delay", "increment", "gift"];
const defaults = { players: 4, starting: 600, delay: 0, increment: 0, gift: 0, colors: defaultColors, orientations: defaultOrientations, order: [0, 1, 2, 3], durationFormat: "seconds" };
const storedSettings = JSON.parse(localStorage.getItem("game-timer-settings") || "{}");
if (storedSettings.durationFormat !== "seconds" && storedSettings.starting) storedSettings.starting *= 60;
let settings = { ...defaults, ...storedSettings, colors: storedSettings.colors || defaultColors, orientations: storedSettings.orientations || defaultOrientations };
settings.order = storedSettings.order || defaults.order.slice(0, settings.players);
let state = { running: false, active: 0, elapsed: 0, lastTick: 0, turnStarted: 0, time: [] };
let drag = null;
let playerOrder = [];
let rowDrag = null;
let alertTimer;
let wakeLock;
let keepAwake = false;

const $ = (id) => document.getElementById(id);
const timerSections = [...document.querySelectorAll(".timer")];

function formatTime(milliseconds) {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function formatDuration(seconds) {
  return formatTime(seconds * 1000);
}

function orientationLabel(orientation) {
  return { 0: "bottom", 90: "left", 180: "top", "-90": "right" }[orientation];
}

function nearestDurationStep(seconds) {
  return durationSteps.reduce((closest, step) => Math.abs(step - seconds) < Math.abs(closest - seconds) ? step : closest, durationSteps[0]);
}

function parseDuration(value) {
  const match = value.trim().match(/^(?:(\d+):)?(\d+)(?:s)?$/i);
  if (!match) return null;
  const seconds = match[1] ? +match[1] * 60 + +match[2] : +match[2];
  return nearestDurationStep(seconds);
}

function parseExactDuration(value) {
  const match = value.trim().match(/^(?:(\d+):)?(\d+)(?:s)?$/i);
  if (!match) return null;
  return match[1] ? +match[1] * 60 + +match[2] : +match[2];
}

function setDurationControl(name, seconds) {
  const snapped = nearestDurationStep(seconds);
  $(name).value = String(durationSteps.indexOf(snapped));
  $(`${name}-output`).value = formatDuration(snapped);
}

function getDurationControl(name) {
  return durationSteps[+$(name).value];
}

function commitDuration(name) {
  const output = $(`${name}-output`);
  const seconds = parseDuration(output.value);
  setDurationControl(name, seconds ?? getDurationControl(name));
}

function resetClock() {
  const time = Array(4).fill(0);
  settings.order.forEach((player) => { time[player] = settings.starting * 1000; });
  state = { running: false, activeId: settings.order[0], elapsed: 0, lastTick: 0, turnStarted: 0, time, laps: [] };
  render();
}

function buzz() {
  const audio = new AudioContext();
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  const tremolo = audio.createOscillator();
  const tremoloGain = audio.createGain();
  oscillator.type = "sawtooth";
  oscillator.frequency.value = 180;
  tremolo.type = "square";
  tremolo.frequency.value = 13;
  gain.gain.setValueAtTime(.02, audio.currentTime);
  gain.gain.linearRampToValueAtTime(.19, audio.currentTime + .03);
  gain.gain.setValueAtTime(.19, audio.currentTime + 1.05);
  gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + 1.25);
  tremoloGain.gain.value = .06;
  tremolo.connect(tremoloGain).connect(gain.gain);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(); tremolo.start();
  oscillator.stop(audio.currentTime + 1.25); tremolo.stop(audio.currentTime + 1.25);
}

function delayChime() {
  const audio = new AudioContext();
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(540, audio.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(360, audio.currentTime + .2);
  gain.gain.setValueAtTime(.001, audio.currentTime);
  gain.gain.exponentialRampToValueAtTime(.16, audio.currentTime + .015);
  gain.gain.exponentialRampToValueAtTime(.001, audio.currentTime + .22);
  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(); oscillator.stop(audio.currentTime + .22);
}

async function requestWakeLock() {
  if (!keepAwake || !("wakeLock" in navigator) || document.visibilityState !== "visible") return;
  try {
    wakeLock = await navigator.wakeLock.request("screen");
    wakeLock.addEventListener("release", () => { wakeLock = null; });
  } catch {}
}

function keepScreenAwake() {
  keepAwake = true;
  requestWakeLock();
}

function flashOutOfTime() {
  const alert = $("overtime-alert");
  alert.classList.remove("is-active");
  void alert.offsetWidth;
  alert.classList.add("is-active");
  clearTimeout(alertTimer);
  alertTimer = setTimeout(() => alert.classList.remove("is-active"), 1000);
}

function tick(now) {
  if (state.running) {
    const delta = now - state.lastTick;
    state.elapsed += delta;
    const spentTurn = now - state.turnStarted;
    const previousSpentTurn = state.lastTick - state.turnStarted;
    const delayEndsAt = settings.delay * 1000;
    if (delayEndsAt && previousSpentTurn < delayEndsAt && spentTurn >= delayEndsAt) delayChime();
    const countingFrom = Math.max(state.lastTick, state.turnStarted + delayEndsAt);
    state.time[state.activeId] -= Math.max(0, now - countingFrom);
    if (state.time[state.activeId] <= 0) {
      buzz();
      flashOutOfTime();
      state.time[state.activeId] = settings.gift * 1000;
      if (!settings.gift) state.running = false;
      state.turnStarted = now;
    }
    state.lastTick = now;
    render();
  }
  requestAnimationFrame(tick);
}

function render() {
  const activeElapsed = performance.now() - state.turnStarted;
  timerSections.forEach((section, index) => {
    const player = Number(section.querySelector("button").dataset.player);
    const orderIndex = settings.order.indexOf(player);
    const visible = orderIndex !== -1;
    const active = state.running && player === state.activeId;
    const delayRemaining = Math.max(0, settings.delay * 1000 - activeElapsed);
    const isDelayed = active && delayRemaining > 0;
    const isCritical = active && !isDelayed && state.time[player] <= 15000;
    const displayedTime = isDelayed ? delayRemaining : state.time[player];
    section.style.display = "block";
    section.dataset.active = String(active);
    section.dataset.delay = String(isDelayed);
    section.dataset.critical = String(isCritical);
    section.dataset.empty = String(!visible);
    section.style.setProperty("--color", settings.colors[player] || defaultColors[player]);
    const button = section.querySelector("button");
    button.style.setProperty("--orientation", `${settings.orientations[player] ?? defaultOrientations[player]}deg`);
    button.style.display = visible ? "block" : "none";
    if (!visible) return;
    if (!button.firstElementChild) button.innerHTML = '<span class="timer__content"><span class="name"></span><span class="time"></span><span class="timer__helper"></span><span class="hint"></span></span>';
    button.querySelector(".name").textContent = `PLAYER #${orderIndex + 1}`;
    button.querySelector(".time").textContent = formatTime(displayedTime);
    button.querySelector(".timer__helper").textContent = isDelayed ? "(before timebank starts)" : "(timebank remaining)";
    button.querySelector(".hint").textContent = active ? "TAP TO END TURN" : "HOLD TO MOVE";
  });
  const elapsed = formatTime(state.elapsed);
  const banked = formatTime(settings.order.reduce((sum, player) => sum + state.time[player], 0));
  $("elapsed-time").textContent = elapsed;
  $("elapsed-time-opposite").textContent = elapsed;
  $("sum-time").textContent = banked;
  $("sum-time-opposite").textContent = banked;
  let lapStart = 0;
  $("laps").innerHTML = state.laps.length ? `<span>LAPS</span><ol>${state.laps.map((duration) => {
    const lapEnd = lapStart + duration;
    const entry = `<li>${formatTime(duration)} (${formatTime(lapStart)}–${formatTime(lapEnd)})</li>`;
    lapStart = lapEnd;
    return entry;
  }).join("")}</ol>` : "LAPS —";
}

function endTurn(player) {
  if (player !== state.activeId && state.running) return;
  const now = performance.now();
  if (!state.running) { keepScreenAwake(); state.activeId = player; state.running = true; state.lastTick = now; state.turnStarted = now; render(); return; }
  state.time[player] += settings.increment * 1000;
  const currentOrder = settings.order.indexOf(player);
  state.activeId = settings.order[(currentOrder + 1) % settings.order.length];
  state.lastTick = now;
  state.turnStarted = now;
  render();
}

function syncOutputs() {
  $("player-count-output").textContent = $("player-count").value;
  durationControls.forEach((name) => { $(`${name}-output`).value = formatDuration(getDurationControl(name)); });
}

function renderColorPickers() {
  const count = +$("player-count").value;
  if (playerOrder.length !== count) playerOrder = Array.from({ length: count }, (_, index) => index);
  $("player-color-fields").innerHTML = playerOrder.map((player, index) => {
    const color = settings.colors[player] || defaultColors[player];
    const clock = formatDuration(Math.ceil((state.time[player] ?? settings.starting * 1000) / 1000));
    const orientation = settings.orientations[player] ?? defaultOrientations[player];
    return `<div class="player-row" data-player="${player}"><button class="drag-handle" type="button" aria-label="Move Player #${index + 1}">⠿</button><span class="player-row__name">Player #${index + 1}</span><button class="orientation-button" type="button" data-orientation="${orientation}" aria-label="Change Player #${index + 1} text facing">Faces ${orientationLabel(orientation)}</button><div class="player-time-controls"><button type="button" data-adjust="-10" aria-label="Decrease Player #${index + 1} clock">−</button><input class="player-clock" inputmode="numeric" aria-label="Player #${index + 1} clock" value="${clock}" /><button type="button" data-adjust="10" aria-label="Increase Player #${index + 1} clock">+</button></div><input type="color" aria-label="Player #${index + 1} color" value="${color}" /></div>`;
  }).join("");
  $("player-color-fields").querySelectorAll(".drag-handle").forEach((handle) => {
    handle.addEventListener("pointerdown", startRowDrag);
    handle.addEventListener("pointermove", moveRowDrag);
    handle.addEventListener("pointerup", endRowDrag);
    handle.addEventListener("pointercancel", endRowDrag);
    handle.addEventListener("lostpointercapture", endRowDrag);
  });
  $("player-color-fields").querySelectorAll("[data-adjust]").forEach((button) => button.addEventListener("click", adjustPlayerClock));
  $("player-color-fields").querySelectorAll(".orientation-button").forEach((button) => button.addEventListener("click", cycleOrientation));
  $("player-color-fields").querySelectorAll(".player-clock").forEach((input) => {
    input.addEventListener("blur", normalizePlayerClock);
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter") return;
      event.preventDefault();
      normalizePlayerClock(event);
      input.blur();
    });
  });
}

function cycleOrientation(event) {
  const button = event.currentTarget;
  const current = +button.dataset.orientation;
  const next = orientationOptions[(orientationOptions.indexOf(current) + 1) % orientationOptions.length];
  button.dataset.orientation = String(next);
  button.textContent = `Faces ${orientationLabel(next)}`;
}

function normalizePlayerClock(event) {
  const input = event.currentTarget;
  const seconds = parseExactDuration(input.value);
  input.value = formatDuration(Math.max(0, seconds ?? 0));
}

function adjustPlayerClock(event) {
  const input = event.currentTarget.parentElement.querySelector(".player-clock");
  const seconds = parseExactDuration(input.value) ?? 0;
  input.value = formatDuration(Math.max(0, seconds + +event.currentTarget.dataset.adjust));
}

function startRowDrag(event) {
  event.preventDefault();
  const row = event.currentTarget.closest(".player-row");
  event.currentTarget.setPointerCapture(event.pointerId);
  rowDrag = row;
  row.classList.add("is-dragging");
}

function moveRowDrag(event) {
  if (!rowDrag) return;
  const target = document.elementFromPoint(event.clientX, event.clientY)?.closest(".player-row");
  if (!target || target === rowDrag) return;
  const afterTarget = event.clientY > target.getBoundingClientRect().top + target.clientHeight / 2;
  target.parentElement.insertBefore(rowDrag, afterTarget ? target.nextSibling : target);
}

function endRowDrag() {
  if (!rowDrag) return;
  rowDrag.classList.remove("is-dragging");
  playerOrder = [...$("player-color-fields").children].map((row) => +row.dataset.player);
  [...$("player-color-fields").children].forEach((row, index) => {
    row.querySelector(".player-row__name").textContent = `Player #${index + 1}`;
    row.querySelector(".drag-handle").setAttribute("aria-label", `Move Player #${index + 1}`);
    row.querySelector(".orientation-button").setAttribute("aria-label", `Change Player #${index + 1} text facing`);
    row.querySelector(".player-clock").setAttribute("aria-label", `Player #${index + 1} clock`);
    row.querySelector('[data-adjust="-10"]').setAttribute("aria-label", `Decrease Player #${index + 1} clock`);
    row.querySelector('[data-adjust="10"]').setAttribute("aria-label", `Increase Player #${index + 1} clock`);
    row.querySelector('input[type="color"]').setAttribute("aria-label", `Player #${index + 1} color`);
  });
  rowDrag = null;
}

function openSettings() {
  state.running = false;
  document.querySelector(".clock").classList.add("is-settings-open");
  $("player-count").value = settings.players;
  durationControls.forEach((name) => setDurationControl(name, settings[{ "starting-time": "starting", delay: "delay", increment: "increment", gift: "gift" }[name]]));
  playerOrder = [...settings.order];
  syncOutputs();
  renderColorPickers();
  $("settings").showModal();
}

function readSettings() {
  const players = +$("player-count").value;
  const rows = [...$("player-color-fields").children];
  const order = rows.map((row) => +row.dataset.player);
  const colorValues = [...settings.colors];
  const orientationValues = [...settings.orientations];
  const playerTimes = [...state.time];
  rows.forEach((row) => {
    const player = +row.dataset.player;
    colorValues[player] = row.querySelector('input[type="color"]').value || defaultColors[player];
    orientationValues[player] = +row.querySelector(".orientation-button").dataset.orientation;
    playerTimes[player] = (parseExactDuration(row.querySelector(".player-clock").value) ?? 0) * 1000;
  });
  return { players, starting: getDurationControl("starting-time"), delay: getDurationControl("delay"), increment: getDurationControl("increment"), gift: getDurationControl("gift"), colors: colorValues, orientations: orientationValues, order, playerTimes, durationFormat: "seconds" };
}

function saveSettings() {
  const nextSettings = readSettings();
  settings = { ...nextSettings };
  delete settings.order;
  delete settings.playerTimes;
  settings.order = nextSettings.order;
  localStorage.setItem("game-timer-settings", JSON.stringify(settings));
  state.time = nextSettings.playerTimes;
  if (!settings.order.includes(state.activeId)) state.activeId = settings.order[0];
  render();
}

function resetFromSettings() {
  saveSettings();
  resetClock();
  $("settings").close("reset");
}

function addLap() {
  const completedTime = state.laps.reduce((sum, lap) => sum + lap, 0);
  const lapTime = state.elapsed - completedTime;
  if (lapTime <= 0) return;
  state.laps.push(lapTime);
  render();
}

function swapPlayers(from, to) {
  if (from === to) return;
  const other = timerSections.find((section) => section.dataset.slot === to);
  const button = timerSections.find((section) => section.dataset.slot === from).querySelector("button");
  const otherButton = other.querySelector("button");
  [button.dataset.player, otherButton.dataset.player] = [otherButton.dataset.player, button.dataset.player];
  render();
}

function clearDrag() {
  timerSections.forEach((section) => { section.classList.remove("is-dragging"); section.dataset.dropTarget = "false"; });
  drag = null;
}

function setDragTarget(clientX, clientY) {
  const target = document.elementFromPoint(clientX, clientY)?.closest(".timer");
  drag.target = target?.dataset.slot;
  timerSections.forEach((section) => { section.dataset.dropTarget = String(section.dataset.slot === drag.target && drag.target !== drag.from); });
}

timerSections.forEach((section) => {
  const button = section.querySelector("button");
  let holdTimer;
  button.addEventListener("contextmenu", (event) => event.preventDefault());
  button.addEventListener("pointerdown", (event) => {
    button.setPointerCapture(event.pointerId);
    holdTimer = setTimeout(() => {
      drag = { from: section.dataset.slot, target: section.dataset.slot };
      section.classList.add("is-dragging");
    }, 350);
  });
  button.addEventListener("pointermove", (event) => { if (drag) setDragTarget(event.clientX, event.clientY); });
  button.addEventListener("pointerup", (event) => {
    clearTimeout(holdTimer);
    if (!drag) { endTurn(+button.dataset.player); return; }
    setDragTarget(event.clientX, event.clientY);
    const target = drag.target;
    const from = drag.from;
    clearDrag();
    if (target) swapPlayers(from, target);
  });
  button.addEventListener("pointercancel", () => { clearTimeout(holdTimer); clearDrag(); });
});

$("duration-ticks").innerHTML = durationSteps.map((_, index) => `<option value="${index}"></option>`).join("");
durationControls.forEach((name) => {
  $(name).min = "0";
  $(name).max = String(durationSteps.length - 1);
  $(name).step = "1";
  $(name).setAttribute("list", "duration-ticks");
  $(name).addEventListener("input", syncOutputs);
  const output = $(`${name}-output`);
  output.addEventListener("blur", () => commitDuration(name));
  output.addEventListener("change", () => commitDuration(name));
  output.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    commitDuration(name);
    output.blur();
  });
});
$("player-count").addEventListener("input", () => { syncOutputs(); playerOrder = []; renderColorPickers(); });
$("center-button").addEventListener("click", openSettings);
$("reset-button").addEventListener("click", resetFromSettings);
$("lap-button").addEventListener("click", addLap);
$("settings").addEventListener("close", () => {
  document.querySelector(".clock").classList.remove("is-settings-open");
  if ($("settings").returnValue === "default") saveSettings();
});
window.addEventListener("pointerup", endRowDrag);
window.addEventListener("pointercancel", endRowDrag);
window.addEventListener("blur", endRowDrag);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") requestWakeLock();
  else endRowDrag();
});
resetClock();
requestAnimationFrame(tick);
