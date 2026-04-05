(function () {
  "use strict";

  const CHECKIN_KEY = "iers_checkin_v1";
  const DEVICE_ID_KEY = "iers_device_id_v1";
  const LOCATION_LOG_KEY = "iers_location_log_v1";
  const LOG_MAX = 200;

  const SUGGESTED = {
    Fire: { text: "Evacuate + call fire team", detail: "Sound alarm, clear the floor, muster at assembly point." },
    Medical: { text: "Call doctor", detail: "Dispatch medical staff or EMS; secure the scene for care." },
    Security: { text: "Send security team", detail: "Lock down access points and review live CCTV feeds." },
    Fall: { text: "Wellness check", detail: "Dispatch staff to room; escalate to medical if needed." },
  };

  const TYPE_ICONS = {
    Fire: "🔥",
    Medical: "🏥",
    Security: "🚨",
    Fall: "⚠️",
  };

  const SOURCE_META = {
    user: { short: "Manual", icon: "👤", line: "👤 Source: Manual" },
    sensor: { short: "Sensor", icon: "📡", line: "📡 Source: Sensor" },
    ai: { short: "AI", icon: "🤖", line: "🤖 Source: AI Camera" },
  };

  /** Demo anchors: production would map UUID / major / minor from native BLE scan */
  const MOCK_BEACONS = [
    { beaconId: "BLE-EAST-2", building: "Grand Plaza Hotel", floor: "2", room: "210" },
    { beaconId: "BLE-NORTH-3", building: "Grand Plaza Hotel", floor: "3", room: "312" },
    { beaconId: "BLE-LOBBY-1", building: "Grand Plaza Hotel", floor: "1", room: "Lobby" },
  ];

  const API_BASE = (typeof window !== "undefined" && window.IERS_API_BASE) || "http://127.0.0.1:8000/api";

  let emergencies = [];
  let history = [];
  let filterStatus = "all";
  let aiObjectUrl = null;
  let audioCtx = null;

  let pendingEmergency = null;
  let beaconAutoTimer = null;
  let beaconScanActive = false;

  function id() {
    return "em-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  }

  function getDeviceId() {
    try {
      let d = localStorage.getItem(DEVICE_ID_KEY);
      if (!d) {
        d = "dev-" + (crypto.randomUUID ? crypto.randomUUID() : id());
        localStorage.setItem(DEVICE_ID_KEY, d);
      }
      return d;
    } catch (e) {
      return "dev-anon";
    }
  }

  function loadLocationLog() {
    try {
      const raw = localStorage.getItem(LOCATION_LOG_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return [];
  }

  function saveLocationLog(arr) {
    try {
      localStorage.setItem(LOCATION_LOG_KEY, JSON.stringify(arr.slice(0, LOG_MAX)));
    } catch (e) {}
  }

  function logLocationEvent(entry) {
    const row = {
      at: new Date().toISOString(),
      device_id: getDeviceId(),
      event_type: entry.event_type,
      building: entry.building || "",
      floor: entry.floor || "",
      room: entry.room || "",
      beacon_id: entry.beacon_id || "",
      emergency_type: entry.emergency_type || "",
      metadata: entry.metadata || {},
    };
    const log = loadLocationLog();
    log.unshift(row);
    saveLocationLog(log);
    apiPost("/location-events/", {
      device_id: row.device_id,
      event_type: row.event_type,
      building: row.building,
      floor: row.floor,
      room: row.room,
      beacon_id: row.beacon_id,
      emergency_type: row.emergency_type,
      metadata: row.metadata,
      client_ts: row.at,
    });
    return row;
  }

  function apiPost(path, body) {
    const url = API_BASE.replace(/\/$/, "") + path;
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    }).catch(function () {});
  }

  function postEmergencyRecord(payload) {
    return apiPost("/emergencies/", payload);
  }

  function loadCheckin() {
    try {
      const raw = localStorage.getItem(CHECKIN_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        if (o && typeof o.building === "string") return o;
      }
    } catch (e) {}
    return { building: "Grand Plaza Hotel", floor: "2", room: "204" };
  }

  function saveCheckin(building, floor, room) {
    const data = { building: String(building).trim(), floor: String(floor).trim(), room: String(room).trim() };
    localStorage.setItem(CHECKIN_KEY, JSON.stringify(data));
    return data;
  }

  function checkinLocationStrings(c) {
    const floor = `Floor ${c.floor}`;
    const room = `Room ${c.room}`;
    const detail = `${c.building} · ${floor} · ${room}`;
    return {
      pinLabel: "User Location",
      locationDetail: detail,
      floor,
      room,
      building: c.building,
      locationType: "User check-in (confirmed)",
    };
  }

  function formatRoomLabel(roomRaw) {
    const r = String(roomRaw || "").trim();
    if (!r) return "—";
    if (/^room\s/i.test(r)) return r;
    if (/^[A-Za-z]/i.test(r) && !/^\d+$/.test(r)) return r;
    return "Room " + r;
  }

  function locationFromBeacon(b) {
    const floor = `Floor ${b.floor}`;
    const room = formatRoomLabel(b.room);
    const detail = `${b.building} · ${floor} · ${room} · Beacon ${b.beaconId}`;
    return {
      pinLabel: "Nearest beacon",
      locationDetail: detail,
      floor,
      room,
      building: b.building,
      locationType: "Bluetooth beacon",
      beaconId: b.beaconId,
    };
  }

  function locationFromQuickManual(building, floorNum, roomNum) {
    const floor = `Floor ${floorNum}`;
    const room = `Room ${roomNum}`;
    const detail = `${building} · ${floor} · ${room} (quick entry)`;
    return {
      pinLabel: "User Location",
      locationDetail: detail,
      floor,
      room,
      building,
      locationType: "Manual (quick entry)",
    };
  }

  function mapBluetoothNameToBeacon(name) {
    if (!name) return null;
    const n = String(name).toUpperCase();
    for (let i = 0; i < MOCK_BEACONS.length; i++) {
      const b = MOCK_BEACONS[i];
      if (n.indexOf(b.beaconId.toUpperCase().replace(/-/g, "")) >= 0 || n.indexOf(b.beaconId.split("-")[1]) >= 0)
        return b;
    }
    if (n.indexOf("IERS") >= 0 || n.indexOf("BLE") >= 0) return MOCK_BEACONS[0];
    return null;
  }

  function ensureAudio() {
    if (!audioCtx) {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        return null;
      }
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(function () {});
    }
    return audioCtx;
  }

  function playAlertSound() {
    const ctx = ensureAudio();
    if (!ctx) return;
    const t0 = ctx.currentTime;
    function beep(freq, start, dur) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(freq, t0 + start);
      g.gain.setValueAtTime(0.0001, t0 + start);
      g.gain.exponentialRampToValueAtTime(0.12, t0 + start + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + start + dur);
      o.connect(g);
      g.connect(ctx.destination);
      o.start(t0 + start);
      o.stop(t0 + start + dur + 0.05);
    }
    beep(880, 0, 0.12);
    beep(660, 0.14, 0.12);
    beep(880, 0.3, 0.18);
  }

  function priorityClass(p) {
    if (p === "high") return "high";
    if (p === "medium") return "medium";
    return "low";
  }

  function priorityLabel(p) {
    if (p === "high") return "🔴 HIGH";
    if (p === "medium") return "🟡 MEDIUM";
    return "🟢 LOW";
  }

  function statusClass(status) {
    if (status === "Pending") return "pending";
    if (status === "In Progress") return "in-progress";
    return "resolved";
  }

  function suggestedForType(type) {
    return SUGGESTED[type] || { text: "Assess situation", detail: "Follow facility protocol." };
  }

  function addEmergency(o) {
    const meta = SOURCE_META[o.sourceCategory] || SOURCE_META.user;
    const em = {
      id: id(),
      type: o.type,
      icon: TYPE_ICONS[o.type] || "📋",
      sourceCategory: o.sourceCategory,
      sourceShort: meta.short,
      sourceLine: meta.line,
      pinLabel: o.pinLabel,
      locationDetail: o.locationDetail,
      locationType: o.locationType || "",
      floor: o.floor || "",
      room: o.room || "",
      priority: o.priority,
      staff: o.staff != null ? o.staff : "—",
      status: "Pending",
      createdAt: Date.now(),
      isNewAnimation: o.isNewAnimation !== false,
      locationMethod: o.locationMethod || "",
      beaconId: o.beaconId || "",
    };
    emergencies.unshift(em);
    updateStats();
    renderDashboard();
    playAlertSound();
    showToast(em);

    logLocationEvent({
      event_type: "emergency_dispatched",
      building: o.building || "",
      floor: o.floor || "",
      room: o.room || "",
      beacon_id: o.beaconId || "",
      emergency_type: o.type,
      metadata: {
        location_method: o.locationMethod || "",
        source_category: o.sourceCategory,
        pin_label: o.pinLabel,
      },
    });

    postEmergencyRecord({
      device_id: getDeviceId(),
      emergency_type: o.type,
      priority: o.priority,
      source_category: o.sourceCategory,
      location_method: o.locationMethod || "",
      building: o.building || "",
      floor: o.floor || "",
      room: o.room || "",
      pin_label: o.pinLabel,
      location_detail: o.locationDetail,
      location_type: o.locationType || "",
      beacon_id: o.beaconId || "",
    });

    return em;
  }

  function showToast(em) {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.setAttribute("role", "alert");
    toast.innerHTML = `
      <span class="toast-icon">${em.icon}</span>
      <div class="toast-body">
        <strong>New emergency: ${escapeHtml(em.type)}</strong>
        <p>📍 ${escapeHtml(em.pinLabel)} · ${escapeHtml(em.sourceLine)}</p>
      </div>
    `;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateX(12px)";
      toast.style.transition = "opacity 0.35s, transform 0.35s";
      setTimeout(() => toast.remove(), 400);
    }, 5200);
  }

  function updateStats() {
    const open = emergencies.filter((e) => e.status !== "Resolved").length;
    const resolvedToday = history.filter((h) => {
      const d = new Date(h.resolvedAt);
      const t = new Date();
      return d.toDateString() === t.toDateString();
    }).length;
    document.getElementById("statOpen").textContent = String(open);
    document.getElementById("statResolved").textContent = String(resolvedToday);
  }

  function filteredEmergencies() {
    if (filterStatus === "all") return emergencies;
    return emergencies.filter((e) => e.status === filterStatus);
  }

  function renderDashboard() {
    const grid = document.getElementById("emergencyGrid");
    const empty = document.getElementById("dashEmpty");
    const list = filteredEmergencies();
    grid.innerHTML = "";

    if (list.length === 0) {
      empty.classList.remove("hidden");
      return;
    }
    empty.classList.add("hidden");

    list.forEach((em) => {
      const sug = suggestedForType(em.type);
      const pClass = priorityClass(em.priority);
      const card = document.createElement("article");
      card.className =
        "card emergency-card priority-" +
        (em.priority === "high" ? "high" : em.priority === "medium" ? "medium" : "low");
      if (em.isNewAnimation) {
        card.classList.add("card-new");
        em.isNewAnimation = false;
      }
      card.dataset.id = em.id;

      const acceptDisabled = em.status !== "Pending" ? "disabled" : "";
      const resolveDisabled = em.status === "Resolved" ? "disabled" : "";
      const methodLine = em.locationMethod
        ? `<p class="dash-line dash-method"><span class="dash-lt-label">How located</span> ${escapeHtml(em.locationMethod)}</p>`
        : "";

      card.innerHTML = `
        <div class="card-top">
          <div class="type-row">
            <span class="type-icon" aria-hidden="true">${em.icon}</span>
            <div>
              <div class="type-name">${escapeHtml(em.type)}</div>
              <span class="badge-priority ${pClass}">${priorityLabel(em.priority)}</span>
            </div>
          </div>
          <span class="badge-status ${statusClass(em.status)}">${escapeHtml(em.status)}</span>
        </div>
        <div class="dash-highlight">
          <p class="dash-line dash-pin">📍 ${escapeHtml(em.pinLabel)}</p>
          <p class="dash-line dash-detail">${escapeHtml(em.locationDetail)}</p>
          <p class="dash-line dash-source">${escapeHtml(em.sourceLine)}</p>
          ${methodLine}
          <p class="dash-line dash-loc-type"><span class="dash-lt-label">Location type</span> ${escapeHtml(em.locationType)}</p>
        </div>
        <div class="meta-grid">
          <div class="meta-item">
            <span class="meta-label">Source (short)</span>
            <span class="meta-value">${escapeHtml(em.sourceShort)}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Assigned</span>
            <span class="meta-value">${escapeHtml(em.staff)}</span>
          </div>
          <div class="meta-item meta-span-2">
            <span class="meta-label">Incident ID</span>
            <span class="meta-value" style="font-family:var(--font-mono);font-size:0.8rem">${escapeHtml(em.id.slice(0, 14))}…</span>
          </div>
        </div>
        <div class="suggested-box">
          <strong>Suggested action</strong>
          <p class="suggested-text"><span>${escapeHtml(sug.text)}</span> — ${escapeHtml(sug.detail)}</p>
        </div>
        <div class="card-actions">
          <button type="button" class="btn btn-accept" data-action="accept" ${acceptDisabled}>Accept</button>
          <button type="button" class="btn btn-resolve" data-action="resolve" ${resolveDisabled}>Mark as Resolved</button>
        </div>
      `;

      card.querySelector('[data-action="accept"]').addEventListener("click", () => acceptEmergency(em.id));
      card.querySelector('[data-action="resolve"]').addEventListener("click", () => resolveEmergency(em.id));

      grid.appendChild(card);
    });
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function acceptEmergency(emId) {
    const em = emergencies.find((e) => e.id === emId);
    if (!em || em.status !== "Pending") return;
    em.status = "In Progress";
    em.staff = pickStaff();
    renderDashboard();
    updateStats();
  }

  function pickStaff() {
    const names = ["J. Rivera", "M. Chen", "A. Okonkwo", "S. Patel", "R. Kim"];
    return names[Math.floor(Math.random() * names.length)];
  }

  function resolveEmergency(emId) {
    const em = emergencies.find((e) => e.id === emId);
    if (!em || em.status === "Resolved") return;
    em.status = "Resolved";
    const resolvedAt = Date.now();
    history.unshift({
      ...em,
      resolvedAt,
      resolvedTimeStr: new Date(resolvedAt).toLocaleString(),
    });
    emergencies = emergencies.filter((e) => e.id !== emId);
    renderDashboard();
    renderHistory();
    updateStats();
  }

  function renderHistory() {
    const tbody = document.getElementById("historyBody");
    tbody.innerHTML = "";
    if (history.length === 0) {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td colspan="7" style="text-align:center;color:var(--text-muted);padding:2rem">No resolved incidents yet.</td>`;
      tbody.appendChild(tr);
      return;
    }
    history.forEach((h) => {
      const tr = document.createElement("tr");
      const pClass = priorityClass(h.priority);
      tr.innerHTML = `
        <td>${h.icon} ${escapeHtml(h.type)}</td>
        <td>
          <div class="hist-loc-pin">📍 ${escapeHtml(h.pinLabel)}</div>
          <div class="hist-loc-detail">${escapeHtml(h.locationDetail)}</div>
        </td>
        <td>${escapeHtml(h.locationType)}</td>
        <td>${escapeHtml(h.sourceShort)}</td>
        <td><span class="badge-priority ${pClass}">${priorityLabel(h.priority)}</span></td>
        <td><span class="badge-status resolved">Resolved</span></td>
        <td style="font-family:var(--font-mono);font-size:0.8rem">${escapeHtml(h.resolvedTimeStr)}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function initNav() {
    document.querySelectorAll(".nav-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        ensureAudio();
        const view = btn.dataset.view;
        document.querySelectorAll(".nav-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        document.querySelectorAll(".view").forEach((v) => v.classList.remove("view-active"));
        document.getElementById("view-" + view).classList.add("view-active");
      });
    });
  }

  function initFilters() {
    document.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        document.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        filterStatus = chip.dataset.filter;
        renderDashboard();
      });
    });
  }

  function fillCheckinForm(c) {
    document.getElementById("checkinBuilding").value = c.building;
    document.getElementById("checkinFloor").value = c.floor;
    document.getElementById("checkinRoom").value = c.room;
    updateCheckinLive(c);
  }

  function updateCheckinLive(c) {
    const el = document.getElementById("checkinLive");
    const s = checkinLocationStrings(c);
    el.textContent = "Active check-in: " + s.locationDetail;
  }

  function initCheckin() {
    const c = loadCheckin();
    fillCheckinForm(c);
    document.getElementById("checkinForm").addEventListener("submit", (e) => {
      e.preventDefault();
      ensureAudio();
      const building = document.getElementById("checkinBuilding").value;
      const floor = document.getElementById("checkinFloor").value;
      const room = document.getElementById("checkinRoom").value;
      const saved = saveCheckin(building, floor, room);
      updateCheckinLive(saved);
      const live = document.getElementById("checkinLive");
      live.textContent = "Saved — " + checkinLocationStrings(saved).locationDetail;
      logLocationEvent({
        event_type: "checkin_saved",
        building: saved.building,
        floor: saved.floor,
        room: saved.room,
        metadata: { source: "form" },
      });
    });
  }

  function getCheckin() {
    return loadCheckin();
  }

  function randomCameraZone() {
    const zones = ["Camera Zone A", "Camera Zone B", "Camera Zone C", "Lobby CCTV-1"];
    return zones[Math.floor(Math.random() * zones.length)];
  }

  function modalEl() {
    return document.getElementById("emergencyModal");
  }

  function showModalStep(step) {
    document.getElementById("modalStepConfirm").classList.toggle("hidden", step !== "confirm");
    document.getElementById("modalStepBeacon").classList.toggle("hidden", step !== "beacon");
    document.getElementById("modalStepManual").classList.toggle("hidden", step !== "manual");
    const spin = document.getElementById("modalSpinner");
    if (spin) spin.classList.toggle("modal-spinner-active", step === "beacon");
  }

  function openEmergencyModal() {
    const m = modalEl();
    m.classList.remove("hidden");
    m.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
  }

  function closeEmergencyModal() {
    clearTimeout(beaconAutoTimer);
    beaconAutoTimer = null;
    beaconScanActive = false;
    pendingEmergency = null;
    const m = modalEl();
    m.classList.add("hidden");
    m.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    showModalStep("confirm");
  }

  function startBeaconAutoScan() {
    clearTimeout(beaconAutoTimer);
    beaconScanActive = true;
    document.getElementById("modalSpinner").classList.add("modal-spinner-active");
    beaconAutoTimer = setTimeout(function () {
      if (!beaconScanActive || !pendingEmergency) return;
      runSimulatedBeaconProbe();
    }, 1800);
  }

  function runSimulatedBeaconProbe() {
    if (!pendingEmergency) return;
    const found = Math.random() < 0.62;
    if (found) {
      const b = MOCK_BEACONS[Math.floor(Math.random() * MOCK_BEACONS.length)];
      logLocationEvent({
        event_type: "beacon_found_simulated",
        building: b.building,
        floor: b.floor,
        room: b.room,
        beacon_id: b.beaconId,
        metadata: { mode: "demo_rssi" },
      });
      finishWithBeacon(b);
    } else {
      logLocationEvent({
        event_type: "beacon_not_found",
        metadata: { mode: "demo_scan_timeout" },
      });
      showManualStep();
    }
  }

  function showManualStep() {
    beaconScanActive = false;
    clearTimeout(beaconAutoTimer);
    beaconAutoTimer = null;
    document.getElementById("modalSpinner").classList.remove("modal-spinner-active");
    const c = getCheckin();
    document.getElementById("modalManualBuilding").textContent = "Building (from check-in): " + c.building;
    document.getElementById("quickFloor").value = "";
    document.getElementById("quickRoom").value = "";
    showModalStep("manual");
    setTimeout(() => document.getElementById("quickFloor").focus(), 100);
  }

  function finishWithCheckin() {
    if (!pendingEmergency) return;
    const c = getCheckin();
    const loc = checkinLocationStrings(c);
    logLocationEvent({
      event_type: "emergency_checkin_yes",
      building: c.building,
      floor: c.floor,
      room: c.room,
      emergency_type: pendingEmergency.type,
      metadata: {},
    });
    const pe = pendingEmergency;
    closeEmergencyModal();
    addEmergency({
      type: pe.type,
      sourceCategory: "user",
      priority: pe.priority,
      pinLabel: loc.pinLabel,
      locationDetail: loc.locationDetail,
      locationType: loc.locationType,
      floor: loc.floor,
      room: loc.room,
      building: c.building,
      locationMethod: "Last check-in (confirmed)",
    });
  }

  function finishWithBeacon(b) {
    if (!pendingEmergency) return;
    const loc = locationFromBeacon(b);
    const pe = pendingEmergency;
    closeEmergencyModal();
    addEmergency({
      type: pe.type,
      sourceCategory: "user",
      priority: pe.priority,
      pinLabel: loc.pinLabel,
      locationDetail: loc.locationDetail,
      locationType: loc.locationType,
      floor: loc.floor,
      room: loc.room,
      building: loc.building,
      locationMethod: "Bluetooth beacon → mapped indoor position",
      beaconId: loc.beaconId,
    });
  }

  function finishWithQuickManual(floorNum, roomNum) {
    if (!pendingEmergency) return;
    const c = getCheckin();
    const loc = locationFromQuickManual(c.building, floorNum, roomNum);
    logLocationEvent({
      event_type: "manual_quick_entry",
      building: c.building,
      floor: floorNum,
      room: roomNum,
      emergency_type: pendingEmergency.type,
      metadata: {},
    });
    const pe = pendingEmergency;
    closeEmergencyModal();
    addEmergency({
      type: pe.type,
      sourceCategory: "user",
      priority: pe.priority,
      pinLabel: loc.pinLabel,
      locationDetail: loc.locationDetail,
      locationType: loc.locationType,
      floor: loc.floor,
      room: loc.room,
      building: c.building,
      locationMethod: "Manual floor & room (beacon unavailable)",
    });
  }

  function tryWebBluetooth() {
    if (!navigator.bluetooth || !navigator.bluetooth.requestDevice) {
      logLocationEvent({ event_type: "bluetooth_unavailable", metadata: {} });
      showManualStep();
      return;
    }
    clearTimeout(beaconAutoTimer);
    beaconAutoTimer = null;
    beaconScanActive = false;
    document.getElementById("modalSpinner").classList.add("modal-spinner-active");
    navigator.bluetooth
      .requestDevice({ acceptAllDevices: true, optionalServices: [] })
      .then(function (device) {
        document.getElementById("modalSpinner").classList.remove("modal-spinner-active");
        const name = device.name || device.id || "";
        const b = mapBluetoothNameToBeacon(name);
        if (b) {
          logLocationEvent({
            event_type: "beacon_found_ble",
            building: b.building,
            floor: b.floor,
            room: b.room,
            beacon_id: b.beaconId,
            metadata: { device_name: name },
          });
          finishWithBeacon(b);
        } else {
          logLocationEvent({
            event_type: "beacon_unknown_device",
            metadata: { device_name: name },
          });
          showManualStep();
        }
      })
      .catch(function () {
        document.getElementById("modalSpinner").classList.remove("modal-spinner-active");
        logLocationEvent({ event_type: "bluetooth_scan_cancelled", metadata: {} });
        showManualStep();
      });
  }

  function initEmergencyModal() {
    document.getElementById("emergencyModalBackdrop").addEventListener("click", function () {
      const confirm = document.getElementById("modalStepConfirm");
      if (confirm && !confirm.classList.contains("hidden")) {
        closeEmergencyModal();
      }
    });
    document.getElementById("btnLocCancel").addEventListener("click", function () {
      closeEmergencyModal();
    });
    document.getElementById("btnLocYes").addEventListener("click", function () {
      ensureAudio();
      finishWithCheckin();
    });
    document.getElementById("btnLocNo").addEventListener("click", function () {
      ensureAudio();
      logLocationEvent({
        event_type: "emergency_checkin_no",
        emergency_type: pendingEmergency && pendingEmergency.type,
        metadata: {},
      });
      showModalStep("beacon");
      startBeaconAutoScan();
    });
    document.getElementById("btnBleScan").addEventListener("click", function () {
      ensureAudio();
      logLocationEvent({ event_type: "beacon_ble_user_scan", metadata: {} });
      tryWebBluetooth();
    });
    document.getElementById("btnSkipBle").addEventListener("click", function () {
      ensureAudio();
      clearTimeout(beaconAutoTimer);
      beaconAutoTimer = null;
      beaconScanActive = false;
      logLocationEvent({ event_type: "beacon_scan_skipped", metadata: {} });
      document.getElementById("modalSpinner").classList.remove("modal-spinner-active");
      showManualStep();
    });
    document.getElementById("modalManualForm").addEventListener("submit", function (e) {
      e.preventDefault();
      ensureAudio();
      const f = document.getElementById("quickFloor").value.trim();
      const r = document.getElementById("quickRoom").value.trim();
      if (!f || !r) return;
      finishWithQuickManual(f, r);
    });
  }

  function initTriggerButtons() {
    document.querySelectorAll(".big-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        ensureAudio();
        pendingEmergency = { type: btn.dataset.type, priority: btn.dataset.priority };
        const c = getCheckin();
        const loc = checkinLocationStrings(c);
        document.getElementById("modalConfirmLoc").textContent = loc.locationDetail;
        showModalStep("confirm");
        openEmergencyModal();
      });
    });

    document.querySelectorAll("[data-sim]").forEach((btn) => {
      btn.addEventListener("click", () => {
        ensureAudio();
        const sim = btn.dataset.sim;
        if (sim === "fire") {
          addEmergency({
            type: "Fire",
            sourceCategory: "sensor",
            priority: "high",
            pinLabel: "Floor 3",
            locationDetail: "Smoke sensor · Floor 3 (fixed install)",
            locationType: "Fixed sensor",
            floor: "Floor 3",
            room: "—",
            building: "",
            locationMethod: "Sensor (fixed)",
          });
        } else if (sim === "fall") {
          addEmergency({
            type: "Medical",
            sourceCategory: "sensor",
            priority: "high",
            pinLabel: "Room 102",
            locationDetail: "Fall sensor · Room 102 (fixed install)",
            locationType: "Fixed sensor",
            floor: "Floor 1",
            room: "Room 102",
            building: "",
            locationMethod: "Sensor (fixed)",
          });
        }
      });
    });
  }

  function initAiUpload() {
    const input = document.getElementById("aiImageInput");
    const zone = document.getElementById("uploadZone");
    const wrap = document.getElementById("aiPreviewWrap");
    const img = document.getElementById("aiPreviewImg");
    const analyze = document.getElementById("btnAiAnalyze");

    function setPreview(file) {
      if (aiObjectUrl) {
        URL.revokeObjectURL(aiObjectUrl);
        aiObjectUrl = null;
      }
      if (!file || !file.type.startsWith("image/")) return;
      aiObjectUrl = URL.createObjectURL(file);
      img.src = aiObjectUrl;
      wrap.classList.remove("hidden");
    }

    input.addEventListener("change", () => {
      const f = input.files && input.files[0];
      setPreview(f);
    });

    zone.addEventListener("dragover", (e) => {
      e.preventDefault();
      zone.style.borderColor = "var(--accent)";
    });
    zone.addEventListener("dragleave", () => {
      zone.style.borderColor = "";
    });
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.style.borderColor = "";
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) setPreview(f);
    });

    analyze.addEventListener("click", () => {
      if (!img.src) return;
      ensureAudio();
      const zoneName = randomCameraZone();
      const types = [
        { type: "Fire", priority: "high" },
        { type: "Medical", priority: "high" },
        { type: "Security", priority: "medium" },
      ];
      const pick = types[Math.floor(Math.random() * types.length)];
      addEmergency({
        type: pick.type,
        sourceCategory: "ai",
        priority: pick.priority,
        pinLabel: zoneName,
        locationDetail: `${zoneName} · CCTV feed (simulated analysis)`,
        locationType: "CCTV zone",
        floor: "—",
        room: zoneName,
        building: "",
        locationMethod: "AI camera (simulated)",
      });
    });
  }

  function initTooltips() {
    document.querySelectorAll(".info-tip").forEach((el) => {
      const text = el.getAttribute("data-tooltip");
      el.setAttribute("role", "img");
      el.setAttribute("aria-label", text);
    });
  }

  function tickClock() {
    const el = document.getElementById("headerClock");
    el.textContent = new Date().toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }

  function seedDemo() {
    const c = loadCheckin();
    const loc = checkinLocationStrings(c);
    emergencies = [
      {
        id: id(),
        type: "Security",
        icon: TYPE_ICONS.Security,
        sourceCategory: "user",
        sourceShort: "Manual",
        sourceLine: SOURCE_META.user.line,
        pinLabel: loc.pinLabel,
        locationDetail: loc.locationDetail,
        locationType: loc.locationType,
        floor: loc.floor,
        room: loc.room,
        priority: "medium",
        staff: "M. Chen",
        status: "In Progress",
        createdAt: Date.now() - 120000,
        isNewAnimation: false,
        locationMethod: "Last check-in (confirmed)",
        beaconId: "",
      },
      {
        id: id(),
        type: "Medical",
        icon: TYPE_ICONS.Medical,
        sourceCategory: "sensor",
        sourceShort: "Sensor",
        sourceLine: SOURCE_META.sensor.line,
        pinLabel: "Room 102",
        locationDetail: "Fall sensor · Room 102 (fixed install)",
        locationType: "Fixed sensor",
        floor: "Floor 1",
        room: "Room 102",
        priority: "high",
        staff: "—",
        status: "Pending",
        createdAt: Date.now() - 30000,
        isNewAnimation: false,
        locationMethod: "Sensor (fixed)",
        beaconId: "",
      },
      {
        id: id(),
        type: "Security",
        icon: TYPE_ICONS.Security,
        sourceCategory: "ai",
        sourceShort: "AI",
        sourceLine: SOURCE_META.ai.line,
        pinLabel: "Camera Zone A",
        locationDetail: "Camera Zone A · CCTV feed (simulated analysis)",
        locationType: "CCTV zone",
        floor: "—",
        room: "Camera Zone A",
        priority: "low",
        staff: "—",
        status: "Pending",
        createdAt: Date.now() - 600000,
        isNewAnimation: false,
        locationMethod: "AI camera (simulated)",
        beaconId: "",
      },
    ];
    renderDashboard();
    renderHistory();
    updateStats();
  }

  function init() {
    initTooltips();
    initNav();
    initFilters();
    initCheckin();
    initEmergencyModal();
    initTriggerButtons();
    initAiUpload();
    tickClock();
    setInterval(tickClock, 1000);
    document.body.addEventListener(
      "click",
      function once() {
        ensureAudio();
      },
      { once: true }
    );
    seedDemo();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
