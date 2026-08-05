/* Control + programming UI.
 *
 * No build step on purpose: this is plain ES modules so the whole interface
 * stays hackable. Edit, refresh, done.
 *
 * Device rows are built once and patched in place. Re-rendering the list on
 * every state push would fight the user mid-drag.
 */

const FAN_SPEEDS = ["Off", "Low", "Medium", "MediumHigh", "High"];
const FAN_LABELS = { Off: "Off", Low: "Low", Medium: "Med", MediumHigh: "Med+", High: "High" };
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const GLYPHS = { light: "●", switch: "■", shade: "▬", fan: "✳" };

const state = {
  devices: new Map(),
  areas: [],
  nativeScenes: [],
  scenes: [],
  schedules: [],
  upcoming: [],
  demo: false,
};

// device id -> { row, fill, value, wrapper, tilt, seg }
const nodes = new Map();
// Devices the user is actively dragging; incoming updates for these are ignored.
const dragging = new Set();

const $ = (sel) => document.querySelector(sel);

/* ----------------------------------------------------------------- api */
async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    let detail = response.statusText;
    try {
      detail = (await response.json()).detail || detail;
    } catch (_) { /* non-JSON error body */ }
    throw new Error(detail);
  }
  return response.status === 204 ? null : response.json();
}

let toastTimer;
function toast(message, isError = false) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.toggle("is-error", isError);
  el.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("is-visible"), 2600);
}

function fail(error) {
  console.error(error);
  toast(error.message || String(error), true);
}

/* --------------------------------------------------------------- state */
async function loadState() {
  const data = await api("/api/state");
  state.areas = data.inventory.areas;
  state.nativeScenes = data.inventory.native_scenes;
  state.demo = data.inventory.demo;
  state.devices = new Map(data.inventory.devices.map((d) => [d.id, d]));
  state.scenes = data.scenes;
  state.schedules = data.schedules;
  state.upcoming = data.upcoming;

  setStatus(data.inventory.demo ? "demo" : data.inventory.connected ? "live" : "down");
  renderRooms();
  renderSceneBar();
  renderProgram();
}

function setStatus(kind) {
  const el = $("#status");
  el.className = "status is-" + kind;
  el.title =
    kind === "demo"
      ? "Simulated house — no processor paired"
      : kind === "live"
      ? "Connected to the processor"
      : "Disconnected";
  if (kind === "demo") $("#title").textContent = "Home · Demo";
}

/* ------------------------------------------------------------- control */
function devicesInArea(areaId) {
  return [...state.devices.values()].filter((d) => d.area_id === areaId);
}

function renderRooms() {
  const container = $("#rooms");
  container.innerHTML = "";
  nodes.clear();

  for (const area of state.areas) {
    const devices = devicesInArea(area.id);
    if (!devices.length) continue;

    const room = document.createElement("section");
    room.className = "room";

    const head = document.createElement("div");
    head.className = "room-head";
    const name = document.createElement("h2");
    name.className = "room-name";
    name.textContent = area.name;
    head.append(name);

    const actions = document.createElement("div");
    actions.className = "room-actions";
    for (const [label, level] of [["Off", 0], ["On", 100]]) {
      const button = document.createElement("button");
      button.className = "mini";
      button.textContent = label;
      button.addEventListener("click", () =>
        api(`/api/areas/${area.id}/level`, {
          method: "POST",
          body: JSON.stringify({ level, fade_seconds: 1 }),
        }).catch(fail)
      );
      actions.append(button);
    }
    head.append(actions);

    const body = document.createElement("div");
    body.className = "room-body";
    for (const device of devices) body.append(buildDevice(device));

    room.append(head, body);
    container.append(room);
  }

  if (!container.children.length) {
    container.innerHTML = '<p class="empty">No controllable loads found.</p>';
  }
}

function buildDevice(device) {
  const wrapper = document.createElement("div");
  wrapper.className = "device";
  wrapper.dataset.kind = device.kind;

  const row = document.createElement("div");
  row.className = "level-row";

  const fill = document.createElement("div");
  fill.className = "fill";

  const glyph = document.createElement("span");
  glyph.className = "glyph";
  glyph.textContent = GLYPHS[device.kind] || "●";

  const label = document.createElement("div");
  label.className = "label";
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = device.name;
  label.append(name);

  const value = document.createElement("div");
  value.className = "value";

  row.append(fill, glyph, label, value);
  wrapper.append(row);

  const refs = { wrapper, row, fill, value, device };

  if (device.kind === "fan") {
    const extra = document.createElement("div");
    extra.className = "extra";
    const seg = document.createElement("div");
    seg.className = "seg";
    for (const speed of FAN_SPEEDS) {
      const button = document.createElement("button");
      button.dataset.speed = speed;
      button.textContent = FAN_LABELS[speed];
      button.addEventListener("click", () => {
        api(`/api/devices/${device.id}/fan`, {
          method: "POST",
          body: JSON.stringify({ speed }),
        }).catch(fail);
      });
      seg.append(button);
    }
    extra.append(seg);
    wrapper.append(extra);
    refs.seg = seg;
  } else if (device.kind === "shade") {
    const extra = document.createElement("div");
    extra.className = "extra";

    const seg = document.createElement("div");
    seg.className = "seg";
    for (const [label, action] of [["Open", "raise"], ["Stop", "stop"], ["Close", "lower"]]) {
      const button = document.createElement("button");
      button.textContent = label;
      button.addEventListener("click", () => {
        api(`/api/devices/${device.id}/cover`, {
          method: "POST",
          body: JSON.stringify({ action }),
        }).catch(fail);
      });
      seg.append(button);
    }
    extra.append(seg);

    if (device.capabilities.tilt) {
      const tiltRow = document.createElement("div");
      tiltRow.className = "tilt-row";
      const tiltLabel = document.createElement("span");
      tiltLabel.className = "tilt-label";
      tiltLabel.textContent = "Tilt";
      const tilt = document.createElement("input");
      tilt.type = "range";
      tilt.className = "tilt";
      tilt.min = 0;
      tilt.max = 100;
      tilt.value = device.tilt ?? 50;
      tilt.addEventListener("change", () => {
        api(`/api/devices/${device.id}/tilt`, {
          method: "POST",
          body: JSON.stringify({ tilt: Number(tilt.value) }),
        }).catch(fail);
      });
      tiltRow.append(tiltLabel, tilt);
      extra.append(tiltRow);
      refs.tilt = tilt;
    }
    wrapper.append(extra);
  }

  attachLevelControl(row, device);
  nodes.set(device.id, refs);
  paintDevice(device);
  return wrapper;
}

/* The row itself is the dimmer: tap toggles, drag sets a level. */
function attachLevelControl(row, device) {
  let pointerId = null;
  let moved = false;
  let startX = 0;
  let pending = null;
  let sendTimer = null;

  const levelFromEvent = (event) => {
    const rect = row.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(100, Math.round(ratio * 100)));
  };

  const send = (level, fade) => {
    api(`/api/devices/${device.id}/level`, {
      method: "POST",
      body: JSON.stringify({ level, fade_seconds: fade }),
    }).catch(fail);
  };

  // While dragging, throttle to ~1 request per 80ms so we do not flood LEAP.
  const queue = (level) => {
    pending = level;
    if (sendTimer) return;
    sendTimer = setTimeout(() => {
      sendTimer = null;
      if (pending !== null) {
        send(pending, 0);
        pending = null;
      }
    }, 80);
  };

  row.addEventListener("pointerdown", (event) => {
    if (pointerId !== null) return;
    pointerId = event.pointerId;
    moved = false;
    startX = event.clientX;
    row.setPointerCapture(pointerId);
  });

  row.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointerId) return;
    if (!moved && Math.abs(event.clientX - startX) < 6) return;
    if (!moved) {
      moved = true;
      dragging.add(device.id);
      row.classList.add("is-dragging");
    }
    const level = device.kind === "switch" ? (levelFromEvent(event) > 50 ? 100 : 0) : levelFromEvent(event);
    const current = state.devices.get(device.id);
    current.level = level;
    paintDevice(current);
    queue(level);
  });

  const finish = (event) => {
    if (event.pointerId !== pointerId) return;
    row.releasePointerCapture?.(pointerId);
    pointerId = null;
    row.classList.remove("is-dragging");

    const current = state.devices.get(device.id);
    if (moved) {
      clearTimeout(sendTimer);
      sendTimer = null;
      pending = null;
      send(current.level, 0);
      // Let the processor's own report win again after a moment.
      setTimeout(() => dragging.delete(device.id), 400);
    } else {
      // A tap toggles.
      const level = current.level > 0 ? 0 : 100;
      current.level = level;
      paintDevice(current);
      send(level, 1);
    }
    moved = false;
  };

  row.addEventListener("pointerup", finish);
  row.addEventListener("pointercancel", (event) => {
    if (event.pointerId !== pointerId) return;
    pointerId = null;
    moved = false;
    dragging.delete(device.id);
    row.classList.remove("is-dragging");
  });
}

function paintDevice(device) {
  const refs = nodes.get(device.id);
  if (!refs) return;

  refs.fill.style.width = `${device.level}%`;
  refs.wrapper.classList.toggle("is-on", device.level > 0);

  if (device.kind === "fan") {
    refs.wrapper.classList.toggle("is-on", (device.fan_speed || "Off") !== "Off");
    refs.value.textContent = FAN_LABELS[device.fan_speed] || "Off";
    if (refs.seg) {
      for (const button of refs.seg.children) {
        button.classList.toggle("is-active", button.dataset.speed === (device.fan_speed || "Off"));
      }
    }
    return;
  }

  if (device.kind === "switch") {
    refs.value.textContent = device.level > 0 ? "On" : "Off";
  } else if (device.kind === "shade") {
    refs.value.textContent = device.level === 0 ? "Closed" : `${device.level}%`;
  } else {
    refs.value.textContent = device.level === 0 ? "Off" : `${device.level}%`;
  }

  if (refs.tilt && device.tilt != null && document.activeElement !== refs.tilt) {
    refs.tilt.value = device.tilt;
  }
}

function renderSceneBar() {
  const bar = $("#scene-bar");
  bar.innerHTML = "";
  const favorites = state.scenes.filter((s) => s.favorite);
  const shown = favorites.length ? favorites : state.scenes.slice(0, 6);

  for (const scene of shown) {
    const chip = document.createElement("button");
    chip.className = "scene-chip";
    chip.innerHTML = `<span>${scene.icon || "✨"}</span><span></span>`;
    chip.lastElementChild.textContent = scene.name;
    chip.addEventListener("click", async () => {
      chip.classList.add("is-firing");
      try {
        const result = await api(`/api/scenes/${scene.id}/activate`, { method: "POST" });
        toast(result.ok ? `${scene.name}` : `${scene.name} — some loads failed`, !result.ok);
      } catch (error) {
        fail(error);
      } finally {
        setTimeout(() => chip.classList.remove("is-firing"), 600);
      }
    });
    bar.append(chip);
  }

  if (!shown.length) {
    bar.innerHTML = '<p class="empty">No scenes yet — create one on the Program tab.</p>';
  }
}

/* ------------------------------------------------------------- program */
function renderProgram() {
  renderSceneList();
  renderScheduleList();
  renderNativeList();
}

function renderSceneList() {
  const list = $("#scene-list");
  list.innerHTML = "";
  if (!state.scenes.length) {
    list.innerHTML = '<p class="empty">No scenes yet.</p>';
    return;
  }
  for (const scene of state.scenes) {
    const item = document.createElement("div");
    item.className = "item";

    const main = document.createElement("div");
    main.className = "item-main";
    const name = document.createElement("div");
    name.className = "item-name";
    name.textContent = `${scene.icon || "✨"}  ${scene.name}`;
    const sub = document.createElement("div");
    sub.className = "item-sub";
    const bits = [`${scene.steps.length} load${scene.steps.length === 1 ? "" : "s"}`];
    if (scene.native_scene_id) bits.push("+ processor scene");
    if (scene.favorite) bits.push("favorite");
    sub.textContent = bits.join(" · ");
    main.append(name, sub);

    const actions = document.createElement("div");
    actions.className = "item-actions";
    actions.append(
      button("Run", () =>
        api(`/api/scenes/${scene.id}/activate`, { method: "POST" })
          .then(() => toast(scene.name))
          .catch(fail)
      ),
      button(scene.favorite ? "Unstar" : "Star", async () => {
        try {
          await api("/api/scenes", {
            method: "POST",
            body: JSON.stringify({ ...scene, favorite: !scene.favorite }),
          });
          await loadState();
        } catch (error) {
          fail(error);
        }
      }),
      button("Edit", () => openSceneDialog(scene)),
      button("Delete", async () => {
        if (!confirm(`Delete the scene "${scene.name}"?`)) return;
        try {
          await api(`/api/scenes/${scene.id}`, { method: "DELETE" });
          await loadState();
          toast("Scene deleted");
        } catch (error) {
          fail(error);
        }
      }, "btn-danger")
    );

    item.append(main, actions);
    list.append(item);
  }
}

function describeSchedule(schedule) {
  const trigger = schedule.trigger;
  let when;
  if (trigger.type === "time") {
    when = trigger.time;
  } else {
    const offset = trigger.offset_minutes;
    const suffix = offset === 0 ? "" : offset > 0 ? ` +${offset}m` : ` ${offset}m`;
    when = trigger.type + suffix;
  }
  const days = schedule.days.length
    ? schedule.days.slice().sort().map((d) => DAY_NAMES[d]).join(" ")
    : "every day";
  const scene = state.scenes.find((s) => s.id === schedule.scene_id);
  const next = state.upcoming.find((u) => u.id === schedule.id)?.next;
  const parts = [when, days, scene ? `→ ${scene.name}` : "→ (missing scene)"];
  if (next) {
    parts.push(`next ${new Date(next).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}`);
  }
  return parts.join(" · ");
}

function renderScheduleList() {
  const list = $("#schedule-list");
  list.innerHTML = "";
  if (!state.schedules.length) {
    list.innerHTML = '<p class="empty">No schedules yet.</p>';
    return;
  }
  for (const schedule of state.schedules) {
    const item = document.createElement("div");
    item.className = "item";

    const main = document.createElement("div");
    main.className = "item-main";
    const name = document.createElement("div");
    name.className = "item-name";
    name.textContent = schedule.name + (schedule.enabled ? "" : "  (off)");
    const sub = document.createElement("div");
    sub.className = "item-sub";
    sub.textContent = describeSchedule(schedule);
    main.append(name, sub);

    const actions = document.createElement("div");
    actions.className = "item-actions";
    actions.append(
      button(schedule.enabled ? "Disable" : "Enable", async () => {
        try {
          await api("/api/schedules", {
            method: "POST",
            body: JSON.stringify({ ...schedule, enabled: !schedule.enabled }),
          });
          await loadState();
        } catch (error) {
          fail(error);
        }
      }),
      button("Edit", () => openScheduleDialog(schedule)),
      button("Delete", async () => {
        if (!confirm(`Delete the schedule "${schedule.name}"?`)) return;
        try {
          await api(`/api/schedules/${schedule.id}`, { method: "DELETE" });
          await loadState();
          toast("Schedule deleted");
        } catch (error) {
          fail(error);
        }
      }, "btn-danger")
    );

    item.append(main, actions);
    list.append(item);
  }
}

function renderNativeList() {
  const list = $("#native-list");
  list.innerHTML = "";
  if (!state.nativeScenes.length) {
    $("#native-panel").hidden = true;
    return;
  }
  $("#native-panel").hidden = false;
  for (const scene of state.nativeScenes) {
    list.append(
      button(scene.name, () =>
        api(`/api/native-scenes/${scene.id}/activate`, { method: "POST" })
          .then(() => toast(scene.name))
          .catch(fail)
      )
    );
  }
}

function button(text, onClick, extraClass = "") {
  const el = document.createElement("button");
  el.className = "btn " + extraClass;
  el.textContent = text;
  el.addEventListener("click", onClick);
  return el;
}

/* ------------------------------------------------------- scene dialog */
let editingScene = null;

function openSceneDialog(scene) {
  editingScene = scene || null;
  $("#scene-dialog-title").textContent = scene ? "Edit scene" : "New scene";
  $("#scene-name").value = scene?.name || "";
  $("#scene-icon").value = scene?.icon || "✨";

  const nativeSelect = $("#scene-native");
  nativeSelect.innerHTML = '<option value="">None</option>';
  for (const native of state.nativeScenes) {
    const option = document.createElement("option");
    option.value = native.id;
    option.textContent = native.name;
    nativeSelect.append(option);
  }
  nativeSelect.value = scene?.native_scene_id || "";

  const byId = new Map((scene?.steps || []).map((s) => [s.device_id, s]));
  const steps = $("#scene-steps");
  steps.innerHTML = "";

  for (const device of state.devices.values()) {
    const existing = byId.get(device.id);
    const row = document.createElement("div");
    row.className = "step";
    row.dataset.deviceId = device.id;
    row.dataset.kind = device.kind;

    const include = document.createElement("input");
    include.type = "checkbox";
    include.checked = Boolean(existing);

    const name = document.createElement("div");
    name.className = "step-name";
    name.innerHTML = "<small></small> ";
    name.firstElementChild.textContent = device.area_name + " · ";
    name.append(device.name);

    row.append(include, name);

    if (device.kind === "fan") {
      const select = document.createElement("select");
      for (const speed of FAN_SPEEDS) {
        const option = document.createElement("option");
        option.value = speed;
        option.textContent = FAN_LABELS[speed];
        select.append(option);
      }
      select.value = existing?.fan_speed || device.fan_speed || "Off";
      select.className = "step-fan";
      row.append(select);
    } else {
      const range = document.createElement("input");
      range.type = "range";
      range.min = 0;
      range.max = 100;
      range.value = existing?.level ?? device.level;
      const val = document.createElement("span");
      val.className = "step-val";
      val.textContent = `${range.value}%`;
      range.addEventListener("input", () => {
        val.textContent = `${range.value}%`;
        include.checked = true;
        row.classList.remove("is-off");
      });
      row.append(range, val);
    }

    row.classList.toggle("is-off", !include.checked);
    include.addEventListener("change", () => row.classList.toggle("is-off", !include.checked));
    steps.append(row);
  }

  $("#scene-dialog").showModal();
}

function collectSceneSteps() {
  const steps = [];
  for (const row of $("#scene-steps").children) {
    const include = row.querySelector('input[type="checkbox"]');
    if (!include.checked) continue;
    if (row.dataset.kind === "fan") {
      steps.push({
        device_id: row.dataset.deviceId,
        action: "fan",
        fan_speed: row.querySelector("select").value,
        fade_seconds: 0,
      });
    } else {
      steps.push({
        device_id: row.dataset.deviceId,
        action: "level",
        level: Number(row.querySelector('input[type="range"]').value),
        fade_seconds: 1.5,
      });
    }
  }
  return steps;
}

$("#scene-form").addEventListener("submit", async (event) => {
  if (event.submitter?.value !== "save") return;
  event.preventDefault();
  const payload = {
    id: editingScene?.id || "",
    name: $("#scene-name").value.trim(),
    icon: $("#scene-icon").value || "✨",
    native_scene_id: $("#scene-native").value || null,
    favorite: editingScene?.favorite || false,
    steps: collectSceneSteps(),
  };
  if (!payload.name) return;
  try {
    await api("/api/scenes", { method: "POST", body: JSON.stringify(payload) });
    $("#scene-dialog").close();
    await loadState();
    toast("Scene saved");
  } catch (error) {
    fail(error);
  }
});

$("#new-scene").addEventListener("click", () => openSceneDialog(null));

$("#capture-scene").addEventListener("click", async () => {
  const name = prompt("Name this snapshot of the current light levels:");
  if (!name) return;
  try {
    await api("/api/scenes/capture", {
      method: "POST",
      body: JSON.stringify({ name, icon: "\u{1F4F8}", steps: [] }),
    });
    await loadState();
    toast(`Captured "${name}"`);
  } catch (error) {
    fail(error);
  }
});

/* ---------------------------------------------------- schedule dialog */
let editingSchedule = null;
let selectedDays = new Set();

function renderDayPicker() {
  const container = $("#schedule-days");
  container.innerHTML = "";
  DAY_NAMES.forEach((label, index) => {
    const day = document.createElement("button");
    day.type = "button";
    day.className = "day" + (selectedDays.has(index) ? " is-active" : "");
    day.textContent = label;
    day.addEventListener("click", () => {
      if (selectedDays.has(index)) selectedDays.delete(index);
      else selectedDays.add(index);
      renderDayPicker();
    });
    container.append(day);
  });
}

function syncTriggerFields() {
  const type = $("#schedule-trigger").value;
  $("#time-field").hidden = type !== "time";
  $("#offset-field").hidden = type === "time";
}

function openScheduleDialog(schedule) {
  editingSchedule = schedule || null;
  $("#schedule-dialog-title").textContent = schedule ? "Edit schedule" : "New schedule";
  $("#schedule-name").value = schedule?.name || "";

  const sceneSelect = $("#schedule-scene");
  sceneSelect.innerHTML = "";
  for (const scene of state.scenes) {
    const option = document.createElement("option");
    option.value = scene.id;
    option.textContent = scene.name;
    sceneSelect.append(option);
  }
  if (!state.scenes.length) {
    toast("Create a scene first", true);
    return;
  }
  sceneSelect.value = schedule?.scene_id || state.scenes[0].id;

  $("#schedule-trigger").value = schedule?.trigger?.type || "time";
  $("#schedule-time").value = schedule?.trigger?.time || "18:00";
  $("#schedule-offset").value = schedule?.trigger?.offset_minutes ?? 0;
  $("#schedule-enabled").checked = schedule ? schedule.enabled : true;
  selectedDays = new Set(schedule?.days || []);
  renderDayPicker();
  syncTriggerFields();
  $("#schedule-dialog").showModal();
}

$("#schedule-trigger").addEventListener("change", syncTriggerFields);
$("#new-schedule").addEventListener("click", () => openScheduleDialog(null));

$("#schedule-form").addEventListener("submit", async (event) => {
  if (event.submitter?.value !== "save") return;
  event.preventDefault();
  const payload = {
    id: editingSchedule?.id || "",
    name: $("#schedule-name").value.trim(),
    enabled: $("#schedule-enabled").checked,
    scene_id: $("#schedule-scene").value,
    days: [...selectedDays].sort(),
    trigger: {
      type: $("#schedule-trigger").value,
      time: $("#schedule-time").value || "18:00",
      offset_minutes: Number($("#schedule-offset").value) || 0,
    },
    last_fired: editingSchedule?.last_fired || null,
  };
  if (!payload.name) return;
  try {
    await api("/api/schedules", { method: "POST", body: JSON.stringify(payload) });
    $("#schedule-dialog").close();
    await loadState();
    toast("Schedule saved");
  } catch (error) {
    fail(error);
  }
});

/* ----------------------------------------------------------------- tabs */
for (const tab of document.querySelectorAll(".tab")) {
  tab.addEventListener("click", () => {
    for (const other of document.querySelectorAll(".tab")) {
      other.classList.toggle("is-active", other === tab);
    }
    for (const view of document.querySelectorAll(".view")) {
      view.classList.toggle("is-active", view.id === `view-${tab.dataset.tab}`);
    }
  });
}

/* ------------------------------------------------------------ live feed */
function connectSocket() {
  const scheme = location.protocol === "https:" ? "wss" : "ws";
  const socket = new WebSocket(`${scheme}://${location.host}/ws`);

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.type === "device") {
      const incoming = message.device;
      if (dragging.has(incoming.id)) return;
      state.devices.set(incoming.id, incoming);
      paintDevice(incoming);
    } else if (message.type === "snapshot") {
      for (const device of message.inventory.devices) {
        if (dragging.has(device.id)) continue;
        state.devices.set(device.id, device);
        paintDevice(device);
      }
    }
  });

  socket.addEventListener("close", () => {
    setStatus("down");
    setTimeout(connectSocket, 2000);
  });

  socket.addEventListener("open", () => {
    setStatus(state.demo ? "demo" : "live");
    // Keep intermediaries from idling the socket out.
    setInterval(() => socket.readyState === 1 && socket.send("ping"), 25000);
  });
}

loadState().then(connectSocket).catch(fail);
